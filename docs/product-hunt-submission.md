# Product Hunt Submission Sheet

Use this as the direct source for creating the Product Hunt listing.

## Listing Fields

### Product name

GameMaster

### Website

https://game.dima.click

### Tagline

A voice-first virtual GM for real tabletop RPG sessions.

### Description

GameMaster lets a tabletop group run an in-person TTRPG session from one shared phone or laptop. Upload your rulebook, name the players at the table, and start talking. The virtual GM listens, uses your books for answers, remembers the session, and responds in speech.

### Topics

- Artificial Intelligence
- Games
- Productivity
- Developer Tools
- Voice AI

## Maker Comment

Hi Product Hunt,

I built GameMaster for the specific way many tabletop RPG groups actually play: several people sitting around one real table, using one shared device.

Most AI tabletop tools assume everyone has their own screen, headset, or separate chat window. I wanted the opposite. One phone or laptop sits in the middle of the table, the group talks naturally, and the virtual GM keeps the game moving.

The current version supports:

- Google sign-in
- personal rulebook upload
- supporting books
- document ingestion and retrieval
- shared microphone play
- player naming for speaker attribution
- persistent session state
- voice responses
- a hidden admin control plane for runtime tuning

The goal is not to replace the social table. The goal is to reduce prep friction, make rules lookup painless, and give small groups a reliable GM when nobody wants to run the session.

I would especially value feedback from TTRPG players, GMs, and builders working on voice-first AI products.

Demo: https://game.dima.click

## Media Files

Upload these in this order:

1. `docs/assets/product-hunt/01-landing.png`
2. `docs/assets/product-hunt/02-ready-to-play.png`
3. `docs/assets/product-hunt/03-play-surface.png`
4. `docs/assets/product-hunt/04-voice-setup.png`
5. `docs/assets/product-hunt/00-demo-montage.mp4`

The montage is a short silent product-screen sequence. Replace it later with a real voice-session recording if you want the launch to show live speech instead of static product flow.

## First-Day Publishing Sequence

1. Log in to Product Hunt with the maker account, use Submit/Post -> New Product, and publish the listing.
2. Post the X launch thread from `docs/outreach-kit.md`.
3. Post the LinkedIn launch copy from `docs/outreach-kit.md`.
4. Share the Reddit/community version only in communities where self-promotion is allowed.
5. Monitor `https://game.dima.click/api/gm/health`.
6. Monitor Google sign-in, rulebook upload, indexing, and voice start for failures.

## Pre-Launch Checks

- Public homepage loads.
- Google sign-in works.
- `/play` loads after sign-in.
- Primary rulebook is ready.
- Supporting books can be uploaded.
- Microphone check works on desktop.
- Microphone and voice response work on Android Chrome and Brave.
- No public UI mentions hidden admin routes, provider keys, Coolify, Payload internals, or old `gm.dima.click`.

## Risk Notes

- Do not imply OpenAI endorsement.
- Do not mention the hidden admin URL.
- Do not show secrets, logs, deployment screens, or provider settings.
- Do not point users to the old protected app.
- Treat the video montage as a placeholder until a real voice-session clip is recorded.
