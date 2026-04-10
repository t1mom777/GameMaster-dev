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

- Public player routes are now limited to ` / `, ` /login `, ` /rooms `, ` /join `, and ` /session/[slug]`.
- Google SSO is the required path before a player can join a room.
- Admin access is hidden under `https://game.dima.click/t1m0m` and is no longer linked from the public UI.
- Speaker labeling is now part of the player room flow when multiple human voices are present.
- Signed-in players can upload and replace one personal rulebook from the player app, and that rulebook follows them into joined rooms.
- Payload admin remains the place for campaigns, worlds, rulebooks, sessions, quotas, runtime defaults, and diagnostics.

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
