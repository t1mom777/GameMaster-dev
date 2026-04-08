# GameMaster

Payload-backed Game Master control plane with a simple player frontend, a separate LiveKit Agents runtime, Qdrant retrieval, and PostgreSQL as the system of record.

The old GM app remains the reference system. This repo is the migration target for the new stack on `game.dima.click`.

## Services

- `apps/control-plane`
  Payload CMS + Next.js public frontend
- `services/gm-agent`
  Python LiveKit Agents worker
- `postgres`
  relational source of truth
- `qdrant`
  rulebook and supplement vector retrieval
- `livekit`
  realtime media transport for preview and migration validation

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
