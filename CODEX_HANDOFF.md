# Codex Handoff

Last updated: 2026-04-07 / 2026-04-08 UTC check

This file is the detailed continuation handoff for the `t1mom777/GameMaster` migration repo so work can continue in the Codex app without reconstructing prior context.

## Mission Context

This repo is the new Game Master platform, intentionally rebuilt on:

- Payload CMS as the admin/control plane
- LiveKit Agents as the realtime voice runtime
- Qdrant as the vector database for rulebooks and supporting books
- self-hosted PostgreSQL as the relational system of record
- a simple player-facing frontend under the same control-plane app

This is a separate migration stack. The old app at `gm.dima.click` remains intact and must stay intact until cutover is explicitly approved.

## Source And Target Repos

Source/reference:

- local old app: `/home/dmytro/Documents/GameMaster_Transfer_Clean`
- old/reference GitHub repo: `t1mom777/GMv3-open`

Target migration repo:

- local new repo: `/home/dmytro/Documents/GameMaster`
- GitHub repo: `t1mom777/GameMaster`

## What Was Decided

### High-level architecture

- Payload owns admin auth, collections, globals, uploads, and the main API surface.
- LiveKit Agents owns the GM runtime.
- Qdrant remains the vector store; it was not replaced with pgvector or another DB.
- PostgreSQL is the durable source of truth for structured data.
- The player frontend is intentionally simple and separate from the advanced admin surface.

### Product boundaries

- Admin remains hidden at `/t1m0m`
- Player flow is public/guest-first
- Rulebooks are first-class
- Voice-first remains the identity of the product
- Advanced settings live in Payload admin, not in another custom frontend-heavy control panel

## Official References Used

- Payload admin/config: <https://payloadcms.com/docs/admin/overview>
- Payload Postgres adapter: <https://payloadcms.com/docs/database/postgres>
- Payload access control: <https://payloadcms.com/docs/access-control/overview>
- LiveKit Agents: <https://docs.livekit.io/agents/>
- LiveKit voice agent guide: <https://docs.livekit.io/agents/start/voice-ai/>
- Qdrant filtering: <https://qdrant.tech/documentation/concepts/filtering/>
- Qdrant payload indexing: <https://qdrant.tech/documentation/manage-data/indexing/>
- Coolify docs: <https://coolify.io/docs/>

## Repo Structure

Top-level structure:

- `apps/control-plane`
- `services/gm-agent`
- `docker-compose.coolify.yml`
- `docs/architecture-overview.md`
- `docs/migration-plan.md`
- `docs/env-vars.md`
- `docs/deployment.md`
- `docs/payload-collection-model.md`
- `docs/qdrant-strategy.md`
- `docs/livekit-runtime-model.md`
- `docs/cutover-checklist.md`
- `docs/backup-and-restore.md`

### Control plane structure

Important directories:

- `apps/control-plane/src/app/(frontend)`
- `apps/control-plane/src/app/(payload)`
- `apps/control-plane/src/collections`
- `apps/control-plane/src/globals`
- `apps/control-plane/src/endpoints`
- `apps/control-plane/src/lib`
- `apps/control-plane/src/migrations`

### Agent structure

Important files:

- `services/gm-agent/src/gm_agent/worker.py`
- `services/gm-agent/src/gm_agent/control_plane.py`
- `services/gm-agent/src/gm_agent/config.py`

## Services In Coolify

Compose app: `game-master-stack`

Services:

- `control-plane`
- `gm-agent`
- `postgres`
- `qdrant`
- `livekit`

Key compose file:

- `docker-compose.coolify.yml`

Current public routing intent:

- `https://game.dima.click` -> Payload control plane + player frontend
- `https://game.dima.click/t1m0m` -> Payload admin
- `https://rtc.game.dima.click` -> LiveKit

## What Was Built

### Payload control plane

Payload config:

- `apps/control-plane/src/payload.config.ts`

Implemented:

- admin route customized to `/t1m0m`
- Postgres adapter
- admin auth via `admins`
- public frontend inside the same Next app
- custom endpoints for health, public sessions/join, runtime session context, runtime retrieval, document reindex

### Payload collections and globals

Collections:

- `admins`
- `players`
- `campaigns`
- `worlds`
- `rulesets`
- `documents`
- `game-sessions`
- `provider-connections`

Globals:

- `runtime-defaults`
- `site-settings`

Access model:

- admin-only: most structured config/content writes
- public filtered reads: `game-sessions` when `publicJoinEnabled = true`
- public/player creation allowed through join flow

### Public player frontend

Implemented in the control plane:

- public home page listing public sessions
- session page by slug
- public join endpoint returning LiveKit token + room info

### Rulebook and supporting-book pipeline

Implemented via:

- `apps/control-plane/src/collections/Documents.ts`
- `apps/control-plane/src/lib/document-ingest.ts`
- `apps/control-plane/src/lib/qdrant.ts`

Behavior:

- PDF/TXT/Markdown uploads
- automatic ingest on create/change
- reindex support
- delete removes vectors
- Qdrant payload contains:
  - `doc_id`
  - `ruleset_id`
  - `session_id`
  - `doc_kind`
  - `is_active`
  - `is_primary`
  - `chunk_index`
  - `title`
  - `content`
- payload indexes created for common filter fields

### Runtime session and retrieval bridge

Endpoints:

- `/api/gm/runtime/session/:roomName`
- `/api/gm/runtime/retrieve`

Behavior:

- runtime session endpoint loads merged runtime defaults + session summary + active document IDs
- retrieval endpoint embeds the query, filters Qdrant by active document IDs, and returns snippets

### LiveKit Agents runtime

Main file:

- `services/gm-agent/src/gm_agent/worker.py`

Implemented:

- Silero VAD prewarm
- multilingual turn detector
- provider-specific LLM/STT/TTS selection from control-plane runtime defaults
- `consult_rulebooks` tool calling the control-plane retrieval endpoint
- session context loaded from control plane by room name

### Documentation

Created:

- architecture overview
- migration plan
- env vars doc
- deployment doc
- Payload collection model
- Qdrant strategy
- LiveKit runtime model
- cutover checklist
- backup and restore plan

Mermaid diagrams already exist across the docs set.

## What Was Intentionally Replaced

The migration does not carry forward the old custom web/settings shell as-is.

Intentionally replaced:

- custom frontend-heavy admin/settings architecture
- brittle custom admin panel logic
- old mixed auth/callback setup
- old custom backend/control plane as the long-term source of truth

Kept conceptually but moved into better boundaries:

- hidden admin route
- session / room model
- Qdrant-backed rule lookup
- rulebook/supporting-book semantics
- voice-first runtime concept

## Deployment History

### Initial migration stack bootstrap

Base migration stack commit:

- `c8f9f07` `Bootstrap Payload and LiveKit migration stack`

### Cleanup of Payload template leftovers

- `fbf43f3` `Remove template scaffolding from control plane`
- `54bce60` `Add missing control-plane public directory`

### Public access fix

Problem:

- public homepage and public sessions flow crashed because `game-sessions` and related reads were too locked down

Fix:

- `e3bff04` `Allow public session and ruleset reads`

### Payload schema bootstrap fix

Problem:

- new stack returned `500` because Postgres tables did not exist
- Coolify logs showed errors such as:
  - relation `game_sessions` does not exist
  - relation `site_settings` does not exist

Fix:

- generated initial Payload migration
- added startup migration execution
- updated runtime container entrypoint

Commit:

- `0009065` `Bootstrap Payload schema on deploy`

Outcome:

- public site became healthy
- `/api/gm/health`, `/`, `/api/gm/public/sessions`, and `/t1m0m` all served successfully

### Standalone server cleanup

Problem:

- control plane was healthy but still started through `next start`, which is not ideal for `output: standalone`

Fix:

- updated `apps/control-plane/docker-entrypoint.sh` to run:
  - `npm run payload -- migrate`
  - `node .next/standalone/server.js`

Commit:

- `9602899` `Start control plane with standalone server`

Coolify eventually finished this deploy and marked `9602899` as the running release.

### Docs follow-up

Problem:

- cutover checklist mentioned backups, but the actual backup/restore plan had not been written yet
- deployment docs still said `next start`

Fix:

- added backup/restore doc
- updated deployment wording
- added README link

Commit:

- `d7720b6` `Document backup plan and standalone startup`

## Current Live State

Checked after the above work:

- `https://game.dima.click/api/gm/health` -> `200`
- `https://game.dima.click/` -> `200`
- `https://game.dima.click/t1m0m` -> `200`
- `https://rtc.game.dima.click/` -> `200`
- DNS for `rtc.game.dima.click` resolves
- old app still healthy:
  - `https://gm.dima.click/health` -> `200`

Current repo HEAD at time of this handoff:

- `d7720b6ddb302d60f4573a267f010d0e5909f496`

## Important Files To Open First In A Future Codex Session

If continuing development, start here:

- `CODEX_HANDOFF.md`
- `README.md`
- `docs/architecture-overview.md`
- `docs/deployment.md`
- `docs/cutover-checklist.md`
- `apps/control-plane/src/payload.config.ts`
- `apps/control-plane/src/lib/session-runtime.ts`
- `apps/control-plane/src/lib/document-ingest.ts`
- `apps/control-plane/src/lib/qdrant.ts`
- `apps/control-plane/src/endpoints/runtime-session.ts`
- `apps/control-plane/src/endpoints/runtime-retrieve.ts`
- `services/gm-agent/src/gm_agent/worker.py`

## Remaining Gaps Before Real Cutover

The new stack is real and live, but it is not yet cutover-ready.

Still needed:

- complete first Payload admin bootstrap under `/t1m0m`
- create initial admin records/content:
  - campaign
  - ruleset
  - session
  - runtime defaults
  - uploaded documents
- seed at least one public session so `/api/gm/public/sessions` is not empty
- verify end-to-end room join from the player frontend
- verify LiveKit room creation and token flow against the new `rtc.game.dima.click`
- verify agent auto-connect in a real room
- verify microphone audio reaches the agent
- verify the agent responds with speech
- set real provider keys in Coolify for OpenAI / Google / Deepgram as needed
- replace LiveKit `--dev` mode with hardened production config, TURN, and ICE policy
- run at least one real backup/restore drill before cutover

## Security Notes

- Do not print or commit secrets.
- Earlier tool output in prior work exposed credentials/secrets in logs. Those should be rotated:
  - Coolify credentials
  - any generated migration secrets
  - any env values that were echoed during automation

## Recommended Next Work Order

1. Bootstrap admin at `https://game.dima.click/t1m0m`
2. Seed one ruleset, one session, one primary rulebook, and one supporting book
3. Validate public join flow on `game.dima.click`
4. Validate LiveKit signaling/media via `rtc.game.dima.click`
5. Validate `consult_rulebooks` from a real live session
6. Harden LiveKit server config for production
7. Do restore rehearsal
8. Only then prepare a real cutover plan from `gm.dima.click`

## Quick Codex Prompt To Resume

If resuming in Codex, a good starting prompt is:

> Open `/home/dmytro/Documents/GameMaster/CODEX_HANDOFF.md`, audit the current live state of `game.dima.click` and `rtc.game.dima.click`, then continue the migration by finishing admin bootstrap, seeding one playable session with rulebooks, and validating end-to-end LiveKit room join plus GM agent voice response without touching the old `gm.dima.click` app.
