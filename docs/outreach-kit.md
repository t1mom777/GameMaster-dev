# GameMaster Outreach Kit

This document keeps the current external-facing positioning for `game.dima.click` in one place so future promotion work stays consistent.

## Current Status

- OpenAI Showcase submission: submitted on 2026-04-22
- Public product URL: `https://game.dima.click`
- Cover image: `https://game.dima.click/showcase-cover.png`

## Core Positioning

### Short description

GameMaster is a voice-first virtual GM for real tabletop sessions. One phone or laptop sits at the table, listens to the group, grounds itself in uploaded rulebooks, and responds in speech.

### One-line pitch

Run an in-person TTRPG table from one shared device with a virtual GM that remembers your world and your books.

### Two-line pitch

GameMaster turns one phone or laptop into a shared-table virtual GM. Players sign in, upload a main rulebook, name the people at the table, and start voice play with rulebook-aware responses and persistent session memory.

### Key differentiators

- Built for one shared device at a real table, not isolated headsets
- Rulebook-grounded retrieval from uploaded primary and supporting books
- Hidden admin control plane separated from the player experience
- Voice-first flow with player naming and speaker mapping
- Designed for continuing campaigns, not only one-off chat demos

## Suggested Messaging Angles

### Product angle

This is not a generic chatbot in a fantasy skin. It is a table operating system for in-person play.

### Technical angle

Payload CMS handles the app and hidden admin surface, LiveKit Agents handles realtime voice, Qdrant handles retrieval, and PostgreSQL stores session state.

### User angle

Players do not need to learn a complex dashboard. The product flow is: sign in, upload rulebook, name the table, start voice.

## Reusable Copy

### X / short social post

Built a voice-first virtual GM for real tabletop sessions.

`game.dima.click` lets one phone or laptop run the whole table: upload your rulebook, name the players, and start talking. The GM answers in voice and stays grounded in your campaign memory and books.

### X / launch thread

1/ I built GameMaster: a voice-first virtual GM for in-person tabletop RPG sessions.

One phone or laptop sits at the table. Everyone talks naturally. The GM listens, remembers the world, uses uploaded rulebooks, and answers in speech.

`https://game.dima.click`

2/ The product is intentionally not a dashboard.

The player flow is:

Sign in -> upload rulebook -> name the people at the table -> start voice.

The table stays social. The app stays in the background.

3/ The main design constraint was shared-device play.

Most voice apps assume each person has a headset or separate account. Real tabletop groups often just want one device in the middle of the table.

4/ Current stack:

Payload CMS
LiveKit Agents
Qdrant
PostgreSQL
OpenAI
Deepgram

Player UI is minimal. Admin/runtime controls stay hidden.

5/ Looking for feedback from TTRPG players, GMs, and people building voice-first AI products.

What would make this useful at your table?

### LinkedIn / longer post

I’ve been building GameMaster, a voice-first virtual GM for in-person tabletop RPG sessions.

The core idea is simple: one shared device sits on the table, listens to the group, grounds itself in uploaded rulebooks, and responds in speech. Players sign in with Google, upload a main rulebook and supporting books, name the people at the table, and start play without dealing with operator-heavy UI.

Under the hood, the stack uses Payload CMS, LiveKit Agents, Qdrant, PostgreSQL, OpenAI, and Deepgram. The player app stays minimal while the admin surface stays hidden under a separate route.

Public demo: `https://game.dima.click`

### LinkedIn / launch version

I built GameMaster, a voice-first virtual GM for in-person tabletop RPG sessions.

The product is designed around one practical constraint: most real TTRPG groups do not want every player wearing a headset or managing a separate screen. They want one device at the table and a game that keeps moving.

GameMaster lets a player sign in, upload a main rulebook and supporting books, name the people at the table, run a mic check, and start a shared voice session. The virtual GM listens to the group, uses uploaded books for retrieval, tracks session memory, and responds in speech.

The architecture separates the public player flow from the hidden control plane. Payload CMS handles the app/admin side, LiveKit Agents handles realtime voice, Qdrant handles retrieval, PostgreSQL holds session state, and OpenAI/Deepgram power reasoning and speech.

The goal is not to replace the social table. The goal is to make it easier to play when prep time is low, rules lookup is slowing things down, or nobody wants to GM that night.

I’m looking for feedback from tabletop players, GMs, and builders working on voice-first AI products.

Demo: `https://game.dima.click`

### Community post

GameMaster is a web app for shared-device tabletop play. Instead of giving every player a separate headset or app, the table uses one phone or laptop with a mic. The virtual GM listens, uses uploaded rulebooks for retrieval, tracks session memory, and answers in speech.

Live demo: `https://game.dima.click`

### Reddit / community version

I’m building GameMaster, a voice-first virtual GM for in-person tabletop play.

The idea is one shared device at the table, not every player on a separate screen. You sign in, upload a main rulebook and supporting books, name the people at the table, and start a voice session. The virtual GM listens through the shared mic, looks up rules from the uploaded books, tracks session memory, and answers in speech.

I’m trying to keep the player experience very simple because I do not want the app to become a second VTT/dashboard. The table should still feel like a real table.

I’d appreciate feedback from GMs and players:

- Would you use something like this for a one-shot or campaign?
- What would make the shared-mic experience feel reliable?
- Where should the product draw the line between GM, rules assistant, and storyteller?

Demo: `https://game.dima.click`

## Demo Checklist

Use this before posting publicly or sharing directly.

1. Confirm Google login works on desktop and mobile.
2. Confirm the play page loads directly after sign-in.
3. Confirm a main rulebook can be uploaded and reaches ready.
4. Confirm supporting book upload also reaches ready.
5. Confirm voice start works on desktop.
6. Confirm voice start works on current Android Chrome and Brave builds.
7. Confirm the GM responds with the current default voice profile.
8. Confirm no admin links or internal diagnostics appear in the public UI.

## Promotion Targets

Use these channels when the build is stable enough for outside traffic.

1. OpenAI Showcase
2. Product Hunt
3. Kickstarter Founder Access
4. Indie Hackers
5. Reddit communities for TTRPG tooling and AI builders
6. LinkedIn founder / builder post
7. X launch thread with short demo clips

## Product Hunt Launch Package

### Product name

GameMaster

### Product Hunt tagline

A voice-first virtual GM for real tabletop RPG sessions.

### Short description

GameMaster lets a tabletop group run an in-person TTRPG session from one shared phone or laptop. Upload your rulebook, name the players at the table, and start talking. The virtual GM listens, uses your books for answers, remembers the session, and responds in speech.

### Maker comment

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

Demo: `https://game.dima.click`

### Product Hunt gallery assets

Prepare these before launch.

1. Cover image: `docs/assets/product-hunt/01-landing.png`
2. Screenshot 1: `docs/assets/product-hunt/01-landing.png`
3. Screenshot 2: `docs/assets/product-hunt/02-ready-to-play.png`
4. Screenshot 3: `docs/assets/product-hunt/03-play-surface.png`
5. Screenshot 4: `docs/assets/product-hunt/04-voice-setup.png`
6. Optional video montage: `docs/assets/product-hunt/00-demo-montage.mp4`

### Recommended thumbnail direction

Use a dark, minimal image with the `VGM` mark, the main headline, and a simple device/table visual. Avoid screenshots with admin surfaces, environment names, provider labels, or internal diagnostics.

### Product Hunt FAQ

#### Is this for online play or in-person play?

GameMaster is primarily built for in-person tabletop sessions where one shared phone or laptop sits at the table.

#### Does every player need an account?

No. The current product is optimized for one signed-in owner running a shared-device table. Players can be named inside the session so the virtual GM can track who is who.

#### Can I use my own rulebook?

Yes. You can upload a primary rulebook and supporting books. The app ingests them for retrieval so the GM can answer from the material during play.

#### Does it replace a human GM?

The goal is to support tables that want a virtual GM or rules assistant, especially when nobody wants to prepare and run the session. It is designed to keep real tabletop play social.

#### What is under the hood?

The stack uses Payload CMS, LiveKit Agents, Qdrant, PostgreSQL, OpenAI, and Deepgram.

### Launch day sequence

1. Confirm the public app is stable on desktop and Android.
2. Confirm rulebook upload and indexing succeed with a real PDF.
3. Confirm voice input and voice response work in the live production app.
4. Publish Product Hunt.
5. Post the X launch thread.
6. Post the LinkedIn launch post.
7. Share the community post in relevant TTRPG and AI-builder communities.
8. Monitor sign-in, upload, ingest, and voice errors for the first 24 hours.

### Product Hunt risk checklist

- Do not mention the hidden admin URL.
- Do not show credentials, provider keys, logs, or Coolify details.
- Do not imply OpenAI endorsement.
- Do not promote the old `gm.dima.click` app.
- Avoid promising support for every TTRPG system until broader testing is complete.

## Kickstarter Founder Access Package

### Campaign position

Back the first voice-first virtual GM built for real tabletop groups using one shared device.

### Campaign goal

CA$20,000 over 28 days.

### Primary CTA

Notify me on Kickstarter.

### Reward focus

Digital-only Founder Access: early access, usage credits, founder status, private onboarding, roadmap influence, and advanced model/voice configuration.

### Founder model and voice promise

Founder tiers can include advanced model and voice configuration, including support for bringing your own compatible reasoning model, voice model, or voice provider. Public examples can mention GPT-5.4-class models, Gemini-class models, and ElevenLabs where available, but do not promise a specific vendor integration until tested in production.

### Kickstarter one-line pitch

GameMaster turns one shared phone or laptop into a rulebook-aware virtual GM that listens to the table and answers in speech.

### Kickstarter short post

I’m preparing a Kickstarter for GameMaster Founder Access.

GameMaster is built for real tabletop groups using one shared phone or laptop. Upload your rulebook, name the people at the table, start voice, and let the virtual GM listen, remember, retrieve from your books, and answer in speech.

Founder Access will help fund realtime voice costs, Android reliability, rulebook ingestion scale, and advanced model/voice configuration, including bring-your-own compatible AI providers where available.

Prelaunch page: `https://game.dima.click/kickstarter`

### Kickstarter risk checklist

- Do not promise official support for copyrighted RPG systems.
- Do not mention celebrity voice likenesses.
- Do not expose admin URLs, provider keys, logs, or deployment screens.
- Keep rewards digital-only unless a separate fulfillment plan exists.
- Be explicit that users must own or have rights to uploaded books.

## Required Assets

- Cover screenshot: `docs/assets/product-hunt/01-landing.png`
- Homepage screenshot matching current landing page: `docs/assets/product-hunt/01-landing.png`
- Logged-in `Ready to play` screenshot: `docs/assets/product-hunt/02-ready-to-play.png`
- Product surface crop: `docs/assets/product-hunt/03-play-surface.png`
- Voice setup crop: `docs/assets/product-hunt/04-voice-setup.png`
- Demo montage: `docs/assets/product-hunt/00-demo-montage.mp4`

## Notes For Future Outreach

- Keep the old app out of promotional copy. Promotion should point only to the migration stack at `game.dima.click`.
- Avoid framing the product as “OpenAI-endorsed” even if it appears in external showcases.
- When sharing technical details, keep the player-facing value first and the infrastructure second.
