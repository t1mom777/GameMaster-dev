from __future__ import annotations

import logging

from dotenv import load_dotenv
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, JobProcess, RunContext, cli, room_io
from livekit.agents.llm import function_tool
from livekit.plugins import deepgram, google, openai, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from gm_agent.config import load_settings
from gm_agent.control_plane import ControlPlaneClient, SessionContext

logger = logging.getLogger("gm-agent")
logger.setLevel(logging.INFO)

load_dotenv()
settings = load_settings()
server = AgentServer()


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


def build_llm(runtime: SessionContext):
    if runtime.runtime_defaults.llm_provider == "openai":
        return openai.LLM(model=runtime.runtime_defaults.llm_model or "gpt-4.1-mini")
    return google.LLM(model=runtime.runtime_defaults.llm_model or "gemini-2.5-flash")


def build_stt(runtime: SessionContext):
    if runtime.runtime_defaults.stt_provider == "openai":
        return openai.STT(model=runtime.runtime_defaults.stt_model or "gpt-4o-mini-transcribe")
    return deepgram.STT(model=runtime.runtime_defaults.stt_model or "nova-3", language="multi")


def build_tts(runtime: SessionContext):
    if runtime.runtime_defaults.tts_provider == "openai":
        return openai.TTS(
            model=runtime.runtime_defaults.tts_model or "gpt-4o-mini-tts",
            voice=runtime.runtime_defaults.tts_voice or "alloy",
        )
    return deepgram.TTS(
        model=runtime.runtime_defaults.tts_model or "aura-2",
        voice=runtime.runtime_defaults.tts_voice or "thalia-en",
    )


class GameMasterAgent(Agent):
    def __init__(self, *, room_name: str, runtime: SessionContext, control_plane: ControlPlaneClient) -> None:
        instructions = "\n\n".join(
            segment
            for segment in [
                runtime.system_prompt,
                runtime.welcome_text,
                f"Session title: {runtime.session_title}.",
                "Use the consult_rulebooks tool whenever a player asks about mechanics, edge cases, or lore covered by the active books.",
                "Keep responses concise, speakable, and dramatic enough for a live tabletop session.",
            ]
            if segment
        )
        super().__init__(instructions=instructions)
        self._control_plane = control_plane
        self._room_name = room_name
        self._runtime = runtime

    async def on_enter(self) -> None:
        greeting = (
            self._runtime.runtime_defaults.join_greeting
            or f"Welcome to {self._runtime.session_title}. Open with a strong first scene and invite the players to act."
        )
        self.session.generate_reply(instructions=greeting)

    @function_tool
    async def consult_rulebooks(self, context: RunContext, question: str) -> str:
        """Look up active rulebooks and supporting books before answering rules or lore questions.

        Args:
            question: The exact rules or lore question from the player.
        """

        snippets = await self._control_plane.retrieve_snippets(self._room_name, question)
        if not snippets:
            return "No matching rules were found in the active books. Use system knowledge carefully and say when you are inferring."
        return "\n\n".join(f"Source excerpt {index + 1}: {snippet}" for index, snippet in enumerate(snippets[:4]))


@server.rtc_session()
async def entrypoint(ctx: JobContext) -> None:
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    control_plane = ControlPlaneClient(settings.control_plane_url, settings.gm_internal_api_token)
    runtime = await control_plane.load_session_context(ctx.room.name)

    session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        stt=build_stt(runtime),
        llm=build_llm(runtime),
        tts=build_tts(runtime),
        turn_handling={
            "turn_detection": MultilingualModel(),
        },
        preemptive_generation=True,
    )

    await session.start(
        agent=GameMasterAgent(room_name=ctx.room.name, runtime=runtime, control_plane=control_plane),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_output=True,
            text_output=True,
        ),
    )


if __name__ == "__main__":
    cli.run_app(server)
