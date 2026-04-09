import Link from 'next/link'
import { getPayload } from 'payload'

import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const payload = await getPayload({ config })
  const siteSettings = await payload.findGlobal({
    slug: 'site-settings',
  })
  const providerStatus = [
    {
      detail: 'Required for document embeddings and optional OpenAI runtime usage.',
      label: 'OpenAI',
      ready: Boolean(process.env.OPENAI_API_KEY),
    },
    {
      detail: 'Required when Runtime Defaults use Gemini models.',
      label: 'Google Gemini',
      ready: Boolean(process.env.GOOGLE_API_KEY),
    },
    {
      detail: 'Required for realtime speech input and spoken responses.',
      label: 'Deepgram',
      ready: Boolean(process.env.DEEPGRAM_API_KEY),
    },
  ]
  const sessions = await payload.find({
    collection: 'game-sessions',
    depth: 1,
    limit: 6,
    pagination: false,
    where: {
      and: [
        {
          publicJoinEnabled: {
            equals: true,
          },
        },
        {
          status: {
            in: ['scheduled', 'live'],
          },
        },
      ],
    },
  })

  return (
    <main className="shell">
      <section className="masthead">
        <div className="pill pill--signal">Migration stack online</div>
        <div className="masthead__links">
          <a href="https://game.dima.click/api/gm/health" rel="noreferrer" target="_blank">
            Health
          </a>
          <a href="https://rtc.game.dima.click" rel="noreferrer" target="_blank">
            RTC
          </a>
          <Link href="/setup">Setup</Link>
          <Link href="/t1m0m">Admin</Link>
        </div>
      </section>

      <section className="hero">
        <div className="hero__eyebrow">Payload control plane + LiveKit + Qdrant</div>
        <h1>{siteSettings.siteTitle}</h1>
        <p>{siteSettings.publicDescription}</p>
        <div className="hero__metrics">
          <div>
            <span>Public tables</span>
            <strong>{sessions.docs.length}</strong>
          </div>
          <div>
            <span>Admin route</span>
            <strong>/t1m0m</strong>
          </div>
          <div>
            <span>Voice transport</span>
            <strong>LiveKit realtime</strong>
          </div>
        </div>
        <div className="hero__actions">
          <a className="button button--primary" href="#sessions">
            Browse live tables
          </a>
          <Link className="button" href="/setup">
            Setup guide
          </Link>
          <Link className="button" href="/t1m0m">
            Admin
          </Link>
        </div>
      </section>

      <section className="access-grid">
        <article className="card card--access">
          <p className="section-heading__eyebrow">Public entry</p>
          <h2>Play surface</h2>
          <p>Players browse public tables, open a session page, and mint a LiveKit token only when they join.</p>
          <a className="text-link" href="#sessions">
            Open public sessions
          </a>
        </article>
        <article className="card card--access">
          <p className="section-heading__eyebrow">Operator entry</p>
          <h2>Payload admin</h2>
          <p>Campaigns, worlds, rulesets, sessions, globals, and provider metadata stay in the Payload admin shell.</p>
          <Link className="text-link" href="/t1m0m">
            Open admin console
          </Link>
        </article>
        <article className="card card--access">
          <p className="section-heading__eyebrow">Transport entry</p>
          <h2>Realtime media</h2>
          <p>The browser talks to LiveKit on its own subdomain while the control plane stays on the main site.</p>
          <a className="text-link" href="https://rtc.game.dima.click" rel="noreferrer" target="_blank">
            Inspect rtc.game.dima.click
          </a>
        </article>
      </section>

      <section className="overview">
        <article className="card">
          <h2>Voice-first play</h2>
          <p>
            Sessions are built for open-mic VAD play. Players join a room, speak naturally, and let
            the GM runtime keep the scene moving.
          </p>
        </article>
        <article className="card">
          <h2>Rulebook-aware sessions</h2>
          <p>
            Campaign rulebooks and supporting books are indexed in Qdrant so the runtime can ground
            its rulings in active sources.
          </p>
        </article>
        <article className="card">
          <h2>Framework-based control plane</h2>
          <p>
            The old custom admin surface is replaced with Payload collections, globals, and access
            control under the hidden admin route.
          </p>
        </article>
      </section>

      <section className="operations">
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Operator flow</p>
            <h2>Manual control plane</h2>
          </div>
          <p className="section-heading__copy">
            The app is intentionally thin on custom admin UI. Most serious setup happens in Payload, not in a separate dashboard rewrite.
          </p>
        </div>

        <div className="timeline">
          <article className="timeline__step">
            <span>01</span>
            <div>
              <h3>Log into Payload</h3>
              <p>Use the hidden admin route and create or update campaigns, rulesets, and public sessions there.</p>
            </div>
          </article>
          <article className="timeline__step">
            <span>02</span>
            <div>
              <h3>Attach your active sources</h3>
              <p>Rulesets point at the primary rulebook and supporting books. Sessions activate the subset the runtime should use.</p>
            </div>
          </article>
          <article className="timeline__step">
            <span>03</span>
            <div>
              <h3>Flip public join on</h3>
              <p>Once a session is marked public, it appears here automatically and the join endpoint starts minting room tokens.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="operations">
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Provider readiness</p>
            <h2>Runtime keys and admin entry</h2>
          </div>
          <p className="section-heading__copy">
            Server-side model calls use API credentials. Browser login sessions are not used as backend runtime auth.
          </p>
        </div>

        <div className="provider-grid">
          {providerStatus.map((provider) => (
            <article className="card provider-card" key={provider.label}>
              <div className={`pill ${provider.ready ? 'pill--signal' : 'pill--warning'}`}>
                {provider.ready ? 'Configured' : 'Missing'}
              </div>
              <h3>{provider.label}</h3>
              <p>{provider.detail}</p>
            </article>
          ))}
          <article className="card provider-card provider-card--cta">
            <p className="section-heading__eyebrow">Operator docs</p>
            <h3>Setup and admin instructions</h3>
            <p>Use the public setup page for access points, manual bootstrap steps, and production checks.</p>
            <Link className="button" href="/setup">
              Open setup guide
            </Link>
          </article>
        </div>
      </section>

      <section className="sessions" id="sessions">
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Join a table</p>
            <h2>Open sessions</h2>
          </div>
          <p className="section-heading__copy">
            Pick a session, enter your player name, and the room client will mint a LiveKit token on
            demand.
          </p>
        </div>

        <div className="session-grid">
          {sessions.docs.map((session) => (
            <article className="session-card" key={String(session.id)}>
              <div className="pill pill--accent">{session.status}</div>
              <h3>{session.title}</h3>
              <p>{session.publicSummary || 'A live GameMaster session is ready for players.'}</p>
              <dl className="session-card__meta">
                <div>
                  <dt>Ruleset</dt>
                  <dd>
                    {typeof session.ruleset === 'object' && session.ruleset?.title
                      ? session.ruleset.title
                      : 'Assigned in control plane'}
                  </dd>
                </div>
                <div>
                  <dt>Room</dt>
                  <dd>{session.roomName}</dd>
                </div>
                <div>
                  <dt>Join route</dt>
                  <dd>/sessions/{session.slug}</dd>
                </div>
              </dl>
              <Link className="button button--primary" href={`/sessions/${session.slug}`}>
                Enter session
              </Link>
            </article>
          ))}

          {!sessions.docs.length && (
            <article className="session-card session-card--empty">
              <h3>No public sessions yet</h3>
              <p>Create one in Payload under Game Sessions, then mark public join enabled.</p>
            </article>
          )}
        </div>
      </section>
    </main>
  )
}
