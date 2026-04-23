# GameMaster Kickstarter Campaign

This is the implementation source for the GameMaster Founder Access Kickstarter. Keep public copy player-facing and avoid admin routes, provider secrets, deployment details, and old-app references.

## Campaign Basics

- Working title: `GameMaster Founder Access`
- Public URL: `https://game.dima.click/kickstarter`
- Protected old-app URL: do not use `gm.dima.click` for this campaign.
- Kickstarter URL env var: `NEXT_PUBLIC_KICKSTARTER_PRELAUNCH_URL`
- Funding goal: `CA$20,000`
- Campaign length: `28 days`
- Prelaunch runway: `6-8 weeks`
- Minimum safe launch threshold: `500 qualified followers or email leads plus 20-30 confirmed warm backers`
- Primary prelaunch target: `1,000 Kickstarter followers`

## Positioning

Back the first voice-first virtual GM built for real tabletop groups using one shared device.

GameMaster is for in-person TTRPG groups that want one phone or laptop in the middle of the table. Upload a rulebook, add supporting books, name the people at the table, and start talking. The virtual GM listens, retrieves from your books, remembers the session, and responds in speech.

## Founder Model And Voice Perk

Founder Access should include a clear advanced-AI promise:

Backers can use managed GameMaster defaults or configure supported personal reasoning models, voice models, and voice providers where available. Public examples can include GPT-5.4-class models, Gemini-class models, and ElevenLabs because they are recognizable, but the campaign should stay provider-neutral enough to support OpenAI, Google Gemini, Deepgram, ElevenLabs, and future providers without overcommitting to one vendor.

Public-safe wording:

> Founder tiers include advanced model and voice configuration, including support for bringing your own compatible reasoning model, voice model, or voice provider, such as GPT-5.4-class models, Gemini-class models, and ElevenLabs where available.

Avoid:

- Mentioning API keys in public player copy
- Showing admin/provider screens in screenshots
- Promising copyrighted celebrity voice likenesses
- Promising official support for any RPG publisher
- Promising a specific vendor integration until it is tested in production

## Reward Tiers

| Tier | Price | Reward |
| --- | ---: | --- |
| Signal Boost | CA$5 | Thank-you credit, backer-only updates, access to founder community if opened |
| Early Table Seat | CA$19 | 1 month early access, founder badge, setup guide |
| Founder GM | CA$39 | 3 months early access, founder badge, priority access to new voice, model, and rulebook features |
| Table Founder Pack | CA$79 | 6 months access for one table owner, higher usage limits, starter adventure template |
| Campaign Circle | CA$149 | 12 months access for one table owner, private onboarding, priority setup support, limited to 50 |
| Creator / Club Pack | CA$399 | 12 months for up to 5 table owners, group onboarding, limited to 25 |

Recommended tier: `Founder GM`.

Main money tiers: `Founder GM` and `Table Founder Pack`.

## Campaign Page Copy

### Hero

A virtual GM for real tabletop sessions.

One table. One device. One memory.

Back the first voice-first virtual GM built for groups playing together around a real table.

### Problem

Groups want to play, but prep, rules lookup, and GM availability slow the table down. Most AI tabletop tools assume separate screens, separate chat windows, or isolated headsets. Real tabletop groups often need one shared device that helps without taking over the table.

### Solution

GameMaster turns one phone or laptop into a shared-table virtual GM. The table signs in, uploads a main rulebook, adds supporting books, names the people playing, and starts a voice session. The GM listens, answers in speech, retrieves from the books, and keeps session memory intact.

### Why Kickstarter

Kickstarter funds the expensive and risky parts of realtime voice play:

- voice/runtime costs
- rulebook ingestion scale
- Android browser voice reliability
- founder onboarding
- real table testing
- advanced reasoning-model and voice-provider configuration for founders

### Delivery

Founder access is delivered as web app access and quota setup. The target is access within 30 days after funds clear, followed by weekly backer updates until all digital rewards are fulfilled.

## Roadmap

| Phase | Delivery |
| --- | --- |
| Month 1 after funding | Founder onboarding, quota setup, and stability pass |
| Month 2 after funding | Improved Android voice reliability, better session memory, and rulebook management polish |
| Month 3 after funding | Supporting-book templates, creator/club packs, model/voice controls, and community feedback loop |

## Risks

- Realtime voice reliability varies by browser and device.
- AI and voice costs must be controlled by quotas.
- Uploaded content must be owned or legally usable by the user.
- GameMaster is not officially affiliated with any RPG publisher unless a partnership is later secured.
- Bring-your-own-model and bring-your-own-provider support depends on provider availability and supported APIs.

## Success Metrics

### Prelaunch

- 1,000 Kickstarter followers
- 500 backup email leads
- 50 warm DMs with real replies
- 10 real playtesters
- 3 usable testimonials

### Launch

- 30% funded in first 48 hours
- 100% funded by day 10
- Average pledge: CA$55-CA$75
- Main tier conversion: CA$39 and CA$79

### Post-Launch

- Founder access delivered within 30 days after funds clear
- Weekly updates until all digital rewards are fulfilled
- Public changelog for voice reliability, rulebook ingestion, and founder model/voice configuration

## Setup Checklist

1. Create Kickstarter draft.
2. Add title, subtitle, project image, story copy, rewards, FAQ, risks, and delivery timeline.
3. Submit for review.
4. Publish Kickstarter prelaunch page.
5. Set `NEXT_PUBLIC_KICKSTARTER_PRELAUNCH_URL` in Coolify for the control-plane app.
6. Redeploy so `/kickstarter` points to the live prelaunch page.
7. Add the Kickstarter URL to Product Hunt, X, LinkedIn, and outreach posts.
8. Start weekly prelaunch reporting against follower and warm-backer targets.
