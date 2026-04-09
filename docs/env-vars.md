# Environment Variables

## Core

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Payload Postgres adapter connection string |
| `POSTGRES_DB` | yes | Postgres database name for compose deployment |
| `POSTGRES_USER` | yes | Postgres user |
| `POSTGRES_PASSWORD` | yes | Postgres password |
| `PAYLOAD_SECRET` | yes | Payload session/auth secret |
| `PAYLOAD_PUBLIC_SERVER_URL` | yes | Public Payload base URL, e.g. `https://game.dima.click` |
| `NEXT_PUBLIC_SITE_URL` | yes | Public frontend origin |
| `GM_INTERNAL_API_TOKEN` | yes | Internal bearer token shared between Payload and the agent service |
| `GM_BOOTSTRAP_ADMIN_EMAIL` | required for first deploy | First Payload admin email used by the startup bootstrap |
| `GM_BOOTSTRAP_ADMIN_PASSWORD` | required for first deploy | First Payload admin password used by the startup bootstrap |
| `GM_BOOTSTRAP_ADMIN_NAME` | no | Optional display name for the bootstrap admin |

## LiveKit

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_LIVEKIT_URL` | yes | Public websocket URL used by browsers |
| `LIVEKIT_HOST` | yes | Control-plane room-management URL |
| `LIVEKIT_API_KEY` | yes | LiveKit API key |
| `LIVEKIT_API_SECRET` | yes | LiveKit API secret |

## Knowledge / Retrieval

| Variable | Required | Purpose |
|---|---|---|
| `QDRANT_URL` | yes | Qdrant HTTP URL |
| `QDRANT_COLLECTION` | yes | Qdrant collection name |
| `QDRANT_API_KEY` | no | Qdrant auth if enabled |
| `OPENAI_API_KEY` | yes for retrieval | Embeddings provider key |
| `OPENAI_EMBEDDING_MODEL` | yes | Embedding model, default `text-embedding-3-small` |

## Voice runtime

| Variable | Required | Purpose |
|---|---|---|
| `GOOGLE_API_KEY` | yes for Gemini runtime | Gemini LLM provider key for the agent |
| `DEEPGRAM_API_KEY` | yes for voice pipeline | Deepgram STT/TTS key |
| `GM_SYSTEM_NAME` | no | Cosmetic runtime/system label |

## Public player auth

| Variable | Required | Purpose |
|---|---|---|
| `GOOGLE_CLIENT_ID` | yes for Google player sign-in | OAuth client id used by the public homepage login |
| `GOOGLE_CLIENT_SECRET` | yes for Google player sign-in | OAuth client secret used for the server-side code exchange |
| `GOOGLE_REDIRECT_URI` | recommended | Explicit callback URL, e.g. `https://game.dima.click/auth/google/callback` |

## Provider auth notes

- This stack currently expects server-side API credentials for OpenAI, Gemini, and Deepgram.
- Public Google player sign-in is implemented separately from Gemini runtime auth.
- Interactive consumer OAuth or web-login reuse for ChatGPT/Codex or Gemini is not implemented in this repo.

## Example local set

```dotenv
DATABASE_URL=postgresql://gamemaster:postgres@postgres:5432/gamemaster
POSTGRES_DB=gamemaster
POSTGRES_USER=gamemaster
POSTGRES_PASSWORD=change-me
PAYLOAD_SECRET=change-me
PAYLOAD_PUBLIC_SERVER_URL=https://game.dima.click
NEXT_PUBLIC_SITE_URL=https://game.dima.click
NEXT_PUBLIC_LIVEKIT_URL=wss://rtc.game.dima.click
LIVEKIT_HOST=http://livekit:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION=gm_rulebook_chunks
OPENAI_API_KEY=...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
GOOGLE_API_KEY=...
DEEPGRAM_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://game.dima.click/auth/google/callback
GM_INTERNAL_API_TOKEN=replace-this
GM_BOOTSTRAP_ADMIN_EMAIL=admin@example.com
GM_BOOTSTRAP_ADMIN_PASSWORD=change-me-now
GM_BOOTSTRAP_ADMIN_NAME=GameMaster Operator
```
