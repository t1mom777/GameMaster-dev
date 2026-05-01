from __future__ import annotations

import logging
import re

from dotenv import load_dotenv
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, RunContext, cli, room_io
from livekit.agents.llm import function_tool
from livekit.plugins import deepgram, inworld, openai

from gm_agent.config import load_settings
from gm_agent.control_plane import ControlPlaneClient, SessionContext

logger = logging.getLogger("gm-agent")
logger.setLevel(logging.INFO)

load_dotenv()
settings = load_settings()
server = AgentServer()


def build_llm(runtime: SessionContext):
    if runtime.runtime_defaults.llm_provider != "openai":
        logger.warning("Gemini runtime is disabled in the slim production worker image; falling back to OpenAI.")
    return openai.LLM(model=runtime.runtime_defaults.llm_model or "gpt-4.1-mini")


def build_stt(runtime: SessionContext):
    if runtime.runtime_defaults.stt_provider == "openai":
        return openai.STT(model=runtime.runtime_defaults.stt_model or "gpt-4o-mini-transcribe")
    return deepgram.STT(model=runtime.runtime_defaults.stt_model or "nova-3", language="multi")


def build_deepgram_tts_model(runtime: SessionContext) -> str:
    configured_model = (runtime.runtime_defaults.tts_model or "").strip()
    configured_voice = (runtime.runtime_defaults.tts_voice or "").strip()
    voice_profile = (runtime.runtime_defaults.tts_instructions or "").strip().lower()

    if configured_voice.startswith("aura-2-"):
        return configured_voice

    if re.match(r"^aura-[a-z0-9]+-[a-z]{2}(?:-[a-z]{2})?$", configured_voice):
        return configured_voice.replace("aura-", "aura-2-", 1)

    if not configured_voice and "hugh laurie" in voice_profile:
        return "aura-2-helios-en"

    if configured_voice in {"asteria-en", "thalia-en"} and "hugh laurie" in voice_profile:
        return "aura-2-helios-en"

    if configured_voice.startswith("aura-"):
        return configured_voice

    if configured_model and configured_voice and configured_voice.startswith(f"{configured_model}-"):
        return configured_voice

    if configured_model and configured_voice and configured_voice not in configured_model:
        return f"{configured_model}-{configured_voice}"

    return configured_model or configured_voice or "aura-2-thalia-en"


def build_openai_tts_voice(runtime: SessionContext) -> str:
    configured_voice = (runtime.runtime_defaults.tts_voice or "").strip().lower()
    voice_profile = (runtime.runtime_defaults.tts_instructions or "").strip().lower()
    supported_voices = {
        "alloy",
        "ash",
        "ballad",
        "coral",
        "echo",
        "sage",
        "shimmer",
        "verse",
    }

    if "hugh laurie" in voice_profile:
        if configured_voice in {"ballad", "ash", "verse"}:
            return configured_voice
        return "ash"

    return configured_voice if configured_voice in supported_voices else "alloy"


def build_tts(runtime: SessionContext):
    if runtime.runtime_defaults.tts_provider == "openai":
        instructions = (runtime.runtime_defaults.tts_instructions or "").strip() or None
        return openai.TTS(
            model=runtime.runtime_defaults.tts_model or "gpt-4o-mini-tts",
            voice=build_openai_tts_voice(runtime),
            instructions=instructions,
        )

    if runtime.runtime_defaults.tts_provider == "deepgram":
        try:
            return deepgram.TTS(model=build_deepgram_tts_model(runtime))
        except TypeError:
            logger.warning("Deepgram TTS init failed; falling back to OpenAI TTS.")
            return openai.TTS(
                model="gpt-4o-mini-tts",
                voice=build_openai_tts_voice(runtime),
            )

    if runtime.runtime_defaults.tts_provider == "elevenlabs":
        logger.warning("ElevenLabs TTS is configured but not installed in the current worker image; falling back to OpenAI TTS.")
        return openai.TTS(
            model="gpt-4o-mini-tts",
            voice=build_openai_tts_voice(runtime),
            instructions=(runtime.runtime_defaults.tts_instructions or "").strip() or None,
        )

    if runtime.runtime_defaults.tts_provider == "inworld":
        return inworld.TTS(
            model=runtime.runtime_defaults.tts_model or "inworld-tts-1.5-max",
            voice=runtime.runtime_defaults.tts_voice or runtime.runtime_defaults.tts_voice_id or "Sebastian",
            encoding="MP3",
            speaking_rate=runtime.runtime_defaults.tts_speed or 1,
            temperature=1,
        )

    try:
        logger.warning("Unknown TTS provider '%s'; falling back to OpenAI TTS.", runtime.runtime_defaults.tts_provider)
        return openai.TTS(
            model="gpt-4o-mini-tts",
            voice=build_openai_tts_voice(runtime),
            instructions=(runtime.runtime_defaults.tts_instructions or "").strip() or None,
        )
    except TypeError:
        logger.warning("Deepgram TTS init failed; falling back to OpenAI TTS.")
        return openai.TTS(
            model="gpt-4o-mini-tts",
            voice=build_openai_tts_voice(runtime),
            instructions=(runtime.runtime_defaults.tts_instructions or "").strip() or None,
        )


class GameMasterAgent(Agent):
    def __init__(self, *, room_name: str, runtime: SessionContext, control_plane: ControlPlaneClient) -> None:
        table_roster = ""
        if runtime.table_roster:
            table_lines = []
            for entry in runtime.table_roster:
                label = entry.get("label", "Seat")
                name = entry.get("name", "Unknown player")
                notes = entry.get("speakingNotes", "").strip()
                table_lines.append(f"{label}: {name}" + (f" ({notes})" if notes else ""))

            table_roster = "\n".join(
                [
                    "Shared microphone roster:",
                    *table_lines,
                    "Everyone at the real table shares one device and one microphone. Use these names when addressing players and be explicit when speaker attribution is uncertain.",
                ],
            )

        instructions = "\n\n".join(
            segment
            for segment in [
                runtime.system_prompt,
                runtime.welcome_text,
                f"Session title: {runtime.session_title}.",
                table_roster,
                f"Voice delivery profile: {runtime.runtime_defaults.tts_instructions.strip()}."
                if runtime.runtime_defaults.tts_instructions.strip()
                else "",
                "If the voice profile asks for calm authority, dry wit, British cadence, or Hugh Laurie energy, make that obvious in sentence rhythm and timing.",
                "Use the consult_rulebooks tool whenever a player asks about mechanics, edge cases, or lore covered by the active books.",
                "Keep responses concise, speakable, and dramatic enough for a live tabletop session.",
                "Format spoken answers for TTS: keep most turns to one to three short sentences.",
                "Use punctuation to control timing. Favor commas, periods, and occasional ellipses for deliberate pauses.",
                "Prefer one clear beat per sentence. If emphasis matters, isolate it in a short sentence.",
                "Avoid markdown, bullet lists, numbered lists, tables, bracketed stage directions, and long quoted passages in normal voice replies.",
                "Do not sound like you are reading an essay. Sound like you are speaking across a real table.",
            ]
            if segment
        )
        super().__init__(instructions=instructions)
        self._control_plane = control_plane
        self._room_name = room_name
        self._runtime = runtime

    async def on_enter(self) -> None:
        opening_line = (
            self._runtime.welcome_text.strip()
            if self._runtime.welcome_text.strip()
            else f"Welcome to {self._runtime.session_title}. The table is live. Tell me what the players do first."
        )
        logger.info("Speaking deterministic join greeting for room %s", self._room_name)
        await self.session.say(
            opening_line,
            allow_interruptions=False,
        )

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
        stt=build_stt(runtime),
        llm=build_llm(runtime),
        tts=build_tts(runtime),
        turn_detection="stt",
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
