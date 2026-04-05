# Cutover Checklist

Do not cut over the old app until every item here is green.

## Platform

- [ ] Coolify project for `GameMaster` is separate from the old GM project
- [ ] `game.dima.click` points to the new control-plane service
- [ ] `rtc.game.dima.click` points to the new LiveKit service
- [ ] TLS is valid for both public endpoints
- [ ] Postgres and Qdrant volumes are persistent

## Payload / Admin

- [ ] Payload admin is reachable at `/t1m0m`
- [ ] first admin bootstrap completed
- [ ] campaigns, rulesets, sessions, and runtime defaults exist

## Documents / Retrieval

- [ ] primary rulebook upload works
- [ ] supporting book upload works
- [ ] ingest reaches `ready`
- [ ] Qdrant search returns active chunks for a live session

## Realtime

- [ ] player can join a room from the public frontend
- [ ] agent connects automatically
- [ ] mic input reaches the agent
- [ ] the GM responds with speech
- [ ] rule lookup calls pull active-source snippets

## Operational

- [ ] backup procedure documented for Postgres
- [ ] backup/export procedure documented for Qdrant
- [ ] env vars are stored in Coolify only
- [ ] no secrets are committed in the repo
