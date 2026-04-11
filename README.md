# GameMaster

GameMaster is the migration stack for `game.dima.click`, with a public player app separated cleanly from a hidden admin control plane at `/t1m0m`.

The old GM app remains the protected reference system and is not part of this rollout.

## Services

- `apps/control-plane`
  Payload CMS + the public player-facing Next.js app
- `services/gm-agent`
  Python LiveKit Agents worker
- `postgres`
  relational source of truth
- `qdrant`
  rulebook and supplement vector retrieval
- `livekit`
  realtime media transport for preview and migration validation

## What Changed

- Public player routes are centered on a player-owned flow:
  - `/`
  - `/login`
  - `/play`
  - `/session/[slug]`
- Google SSO is the required path before a player can enter the playable experience.
- Public UI no longer exposes admin entrypoints, provider diagnostics, or setup copy.
- Each signed-in player gets a private game session behind the scenes. LiveKit rooms still exist technically, but they are no longer part of the player-facing model.
- Signed-in players manage a personal library from the player app:
  - one primary rulebook
  - multiple supporting books
  - replace, rename, remove, and include/exclude from active play
- Active player books are synced into the player’s game session automatically before voice starts.
- Speaker labeling remains in-session and only appears when multiple human voices are present.
- Payload admin remains the place for campaigns, worlds, rulebooks, sessions, quotas, runtime defaults, provider visibility, and diagnostics.

## Docs

- [Codex Handoff](./CODEX_HANDOFF.md)
- [Architecture Overview](./docs/architecture-overview.md)
- [Migration Plan](./docs/migration-plan.md)
- [Environment Variables](./docs/env-vars.md)
- [Deployment Instructions](./docs/deployment.md)
- [Manual Admin Setup](./docs/manual-admin-setup.md)
- [Backup and Restore Plan](./docs/backup-and-restore.md)
- [Payload Collections](./docs/payload-collection-model.md)
- [Qdrant Strategy](./docs/qdrant-strategy.md)
- [LiveKit Runtime](./docs/livekit-runtime-model.md)
- [Cutover Checklist](./docs/cutover-checklist.md)

## Quick Start

1. Configure env from [`docs/env-vars.md`](./docs/env-vars.md).
2. Deploy the stack with [`docker-compose.coolify.yml`](./docker-compose.coolify.yml).
3. Open:
   - public app: `https://game.dima.click`
   - admin: `https://game.dima.click/t1m0m`

Each control-plane deploy applies the checked-in Payload migrations before serving traffic, so a fresh Postgres volume can bootstrap the schema without manual SQL.

The stack is designed so the old GM app can remain live while this repo is brought up separately.
