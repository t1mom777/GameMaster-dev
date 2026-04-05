# Backup and Restore Plan

This stack keeps durable state in PostgreSQL and Qdrant. LiveKit and the GM agent are stateless and can be rebuilt from images plus environment configuration.

## What must be backed up

- PostgreSQL volume `postgres_data`
- Qdrant volume `qdrant_data`
- control-plane uploaded files under `apps/control-plane/media/documents`
- deployment environment values stored in Coolify

## PostgreSQL backup plan

- Run a logical dump daily with `pg_dump` against the `gamemaster` database.
- Store the dump outside the Coolify host on a separate object store or backup server.
- Keep at least:
  - 7 daily backups
  - 4 weekly backups
  - 3 monthly backups

Example command:

```bash
pg_dump "$DATABASE_URL" --format=custom --file gamemaster-$(date +%F).dump
```

Restore example:

```bash
pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" gamemaster-2026-04-05.dump
```

## Qdrant backup plan

- Snapshot the `qdrant_data` volume daily.
- Prefer filesystem or block-volume snapshots at the host level.
- If host snapshots are unavailable, stop writes briefly and archive `/qdrant/storage`.
- Keep the same retention schedule as Postgres.

## Uploaded documents

- Document binaries are separate from the database and vector store.
- Back up the `media/documents` directory with the same cadence as Postgres.
- If a restore is performed from older media without matching Qdrant data, run document reindexing from Payload admin after restore.

## Restore order

1. Restore PostgreSQL.
2. Restore uploaded document files.
3. Restore Qdrant storage.
4. Redeploy the stack in Coolify.
5. Open Payload admin and verify collections, sessions, and documents.
6. Reindex any documents whose binary files and vector state are out of sync.

## Cutover note

Before switching player traffic from the old GM app, test one full restore into a non-production Coolify environment. A backup plan is not credible until restore has been proven.
