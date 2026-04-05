from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    control_plane_url: str
    gm_internal_api_token: str
    livekit_api_key: str
    livekit_api_secret: str
    livekit_url: str
    system_name: str


def load_settings() -> Settings:
    return Settings(
        control_plane_url=os.environ.get("CONTROL_PLANE_URL", "http://control-plane:3000").rstrip("/"),
        gm_internal_api_token=os.environ.get("GM_INTERNAL_API_TOKEN", ""),
        livekit_api_key=os.environ.get("LIVEKIT_API_KEY", "devkey"),
        livekit_api_secret=os.environ.get("LIVEKIT_API_SECRET", "secret"),
        livekit_url=os.environ.get("LIVEKIT_URL", "ws://livekit:7880"),
        system_name=os.environ.get("GM_SYSTEM_NAME", "GameMaster"),
    )
