# Manual Admin Setup

## Access points

- Public app: `https://game.dima.click`
- Player sign-in: `https://game.dima.click/login`
- Player rooms: `https://game.dima.click/rooms`
- Player session page pattern: `https://game.dima.click/session/<session-slug>`
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
2. Open `Players` and confirm the Google-signed-in player records look correct.
3. Open `Runtime Defaults`.
4. Confirm the provider defaults you want:
   - LLM provider/model
   - STT provider/model
   - TTS provider/model/voice
   - retrieval top-k
5. Open `Site Settings` and set player-facing public copy.
6. Create one `Campaign`.
7. Create one `World` linked to that campaign.
8. Create one `Ruleset` linked to that campaign.
9. Upload documents in `Documents`.
10. Mark the primary rulebook with `kind=primary-rulebook` and `isPrimary=true`.
11. Create one `Game Session`.
12. Set:
    - `campaign`
    - `world`
    - `ruleset`
    - `status=live` or `scheduled`
    - `publicJoinEnabled=true`
    - `allowGuests=true` if any signed-in player can join
    - `allowGuests=false` and `allowedPlayers=[...]` for a restricted room
    - `roomName`
13. Save the session and verify it appears in the player app for the intended user.

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
- `allowedPlayers` when the room is restricted

## Player-owned rulebooks

Signed-in players can now manage one personal rulebook from the player app itself.

How it works:

1. The player signs in at `https://game.dima.click/login`.
2. The player opens `https://game.dima.click/rooms`.
3. The player uploads or replaces a personal rulebook.
4. When that player joins any room, their personal rulebook is attached to the room context automatically.

Admin visibility:

- The uploaded file appears in `Documents`.
- The document is linked back to the player through `ownerPlayer`.
- The player record keeps the current reference in `personalRulebook`.

## Provider setup

Current runtime support is server-side API-key based.

Required in Coolify for a full voice stack:

- `OPENAI_API_KEY`
  Used for embeddings in the current retrieval path.
- `GOOGLE_API_KEY`
  Used for Gemini runtime calls.
- `DEEPGRAM_API_KEY`
  Used for STT/TTS.

## Google player sign-in

Homepage Google sign-in is the required public auth path for players. It does not replace admin auth at `/t1m0m` and it does not replace the Gemini API key.

Required in Coolify for public Google login:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI=https://game.dima.click/auth/google/callback`

Google Cloud console setup:

1. Create or reuse a Web application OAuth client.
2. Add `https://game.dima.click` as an authorized JavaScript origin.
3. Add `https://game.dima.click/auth/google/callback` as an authorized redirect URI.
4. Redeploy the control-plane after saving the env vars in Coolify.

Player flow:

1. Open `https://game.dima.click`.
2. Click `Sign in with Google`.
3. Complete Google consent.
4. Return to the player app signed in.
5. Open `https://game.dima.click/rooms`.
6. Pick a room, check the microphone, confirm player labels if needed, and enter the session.

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

## Browser-side troubleshooting

If the public site renders as raw HTML or the admin route looks blank:

1. Hard refresh the page.
2. Confirm `/_next/static/...` assets return `200`.
3. Confirm the latest control-plane deployment finished cleanly.
4. Re-open `https://game.dima.click/login` and `https://game.dima.click/t1m0m`.

## Current production caveats

- The old app at `gm.dima.click` remains protected and untouched.
- LiveKit is still in migration/preview mode and needs production hardening before cutover.
- Retrieval and GM voice responses require the provider keys above to be present.
