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
GM_INTERNAL_API_TOKEN=replace-this
```
