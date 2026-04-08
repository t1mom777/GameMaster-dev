# Manual Admin Setup

## Access points

- Public app: `https://game.dima.click`
- Public session page pattern: `https://game.dima.click/sessions/<session-slug>`
- Payload admin: `https://game.dima.click/t1m0m`
- Control-plane health: `https://game.dima.click/api/gm/health`
- Public session listing: `https://game.dima.click/api/gm/public/sessions`
- LiveKit RTC endpoint: `wss://rtc.game.dima.click`

## What the admin controls manually

Use the Payload admin for:

- `Campaigns`
- `Worlds`
- `Rulesets`
- `Documents`
- `Game Sessions`
- `Runtime Defaults`
- `Site Settings`
- `Provider Connections`

The migration stack is intentionally built so advanced admin behavior stays inside Payload instead of a second custom admin frontend.

## Manual first-pass setup

1. Log into `https://game.dima.click/t1m0m`.
2. Open `Runtime Defaults`.
3. Confirm the provider defaults you want:
   - LLM provider/model
   - STT provider/model
   - TTS provider/model/voice
   - retrieval top-k
4. Open `Site Settings` and set public copy.
5. Create one `Campaign`.
6. Create one `World` linked to that campaign.
7. Create one `Ruleset` linked to that campaign.
8. Upload documents in `Documents`.
9. Mark the primary rulebook with `kind=primary-rulebook` and `isPrimary=true`.
10. Create one `Game Session`.
11. Set:
    - `campaign`
    - `world`
    - `ruleset`
    - `status=live` or `scheduled`
    - `publicJoinEnabled=true`
    - `allowGuests=true`
    - `roomName`
12. Save the session and verify it appears on the public homepage.

## Documents and retrieval

The `Documents` collection is the source of truth for rulebooks and supplements.

Recommended setup:

1. Upload the primary rulebook.
2. Upload one or more supporting books.
3. Confirm `status` moves to `ready`.
4. If a document needs to be re-embedded, set `reindexRequested=true` and save again.

`Documents` drive retrieval for runtime questions. If there are no active documents, retrieval returns empty hits.

## Public session setup

The minimum session fields for a playable public room are:

- `title`
- `slug`
- `roomName`
- `campaign`
- `world`
- `ruleset`
- `status`
- `publicJoinEnabled`

Optional but recommended:

- `publicSummary`
- `welcomeText`
- `scheduledFor`
- `activeDocuments`

## Provider setup

Current runtime support is server-side API-key based.

Required in Coolify for a full voice stack:

- `OPENAI_API_KEY`
  Used for embeddings in the current retrieval path.
- `GOOGLE_API_KEY`
  Used for Gemini runtime calls.
- `DEEPGRAM_API_KEY`
  Used for STT/TTS.

## Important auth limitation

This stack does **not** currently support using a consumer ChatGPT/Codex login or a consumer Gemini login via OAuth as the backend model credential.

Practical reason:

- OpenAI and Gemini model APIs for server applications are authenticated with API credentials, not with your interactive web-product login session.
- `provider-connections` currently stores provider metadata and model choices, not encrypted OAuth tokens or refresh-token flows.

If you want account-scoped provider auth later, that is a separate feature and should be implemented explicitly as a secure token-management system.

## Operational checks

After manual setup, verify:

1. `GET /api/gm/health` returns `ok: true`.
2. `GET /api/gm/public/sessions` returns at least one session.
3. The session page loads.
4. `POST /api/gm/public/join` returns:
   - player id
   - room name
   - LiveKit URL
   - token
5. `rtc.game.dima.click` is reachable.

## Current production caveats

- The old app at `gm.dima.click` remains protected and untouched.
- LiveKit is still in migration/preview mode and needs production hardening before cutover.
- Retrieval and GM voice responses require the provider keys above to be present.
