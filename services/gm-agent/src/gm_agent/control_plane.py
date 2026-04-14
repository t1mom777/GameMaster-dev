from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import aiohttp


@dataclass
class RuntimeDefaults:
    allow_text_fallback: bool
    join_greeting: str
    llm_model: str
    llm_provider: str
    retrieval_top_k: int
    stt_model: str
    stt_provider: str
    system_prompt: str
    tts_model: str
    tts_provider: str
    tts_voice: str
    voice_mode: str


@dataclass
class SessionContext:
    active_document_ids: list[str]
    room_name: str
    session_title: str
    system_prompt: str
    table_roster: list[dict[str, str]]
    welcome_text: str
    runtime_defaults: RuntimeDefaults


class ControlPlaneClient:
    def __init__(self, base_url: str, token: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._token = token

    async def _request(self, method: str, path: str, json: dict[str, Any] | None = None) -> Any:
        headers = {
            "Authorization": f"Bearer {self._token}",
        }
        async with aiohttp.ClientSession(base_url=self._base_url, headers=headers) as session:
            async with session.request(method, path, json=json) as response:
                payload = await response.json()
                if response.status >= 400:
                    raise RuntimeError(payload.get("message", f"Control plane request failed: {response.status}"))
                return payload

    async def load_session_context(self, room_name: str) -> SessionContext:
        payload = await self._request("GET", f"/api/gm/runtime/session/{room_name}")
        runtime_defaults = payload["runtimeDefaults"]
        return SessionContext(
          active_document_ids=payload.get("activeDocumentIds", []),
          room_name=payload["sessionSummary"]["roomName"],
          session_title=payload["sessionSummary"]["title"],
          system_prompt=runtime_defaults["systemPrompt"],
          table_roster=payload.get("tableRoster", []),
          welcome_text=payload["sessionSummary"].get("welcomeText", ""),
          runtime_defaults=RuntimeDefaults(
              allow_text_fallback=runtime_defaults.get("allowTextFallback", True),
              join_greeting=runtime_defaults.get("joinGreeting", ""),
              llm_model=runtime_defaults.get("llmModel", "gemini-2.5-flash"),
              llm_provider=runtime_defaults.get("llmProvider", "gemini"),
              retrieval_top_k=runtime_defaults.get("retrievalTopK", 5),
              stt_model=runtime_defaults.get("sttModel", "nova-3"),
              stt_provider=runtime_defaults.get("sttProvider", "deepgram"),
              system_prompt=runtime_defaults.get("systemPrompt", ""),
              tts_model=runtime_defaults.get("ttsModel", "aura-2"),
              tts_provider=runtime_defaults.get("ttsProvider", "deepgram"),
              tts_voice=runtime_defaults.get("ttsVoice", "thalia-en"),
              voice_mode=runtime_defaults.get("voiceMode", "auto-vad"),
          ),
        )

    async def retrieve_snippets(self, room_name: str, query: str) -> list[str]:
        payload = await self._request(
            "POST",
            "/api/gm/runtime/retrieve",
            json={"roomName": room_name, "query": query},
        )
        return [item.get("snippet", "") for item in payload.get("hits", []) if item.get("snippet")]
