import Link from 'next/link'
import { getPayload } from 'payload'

import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const payload = await getPayload({ config })
  const siteSettings = await payload.findGlobal({
    slug: 'site-settings',
  })
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
      <section className="hero">
        <div className="hero__eyebrow">Payload control plane + LiveKit Agents</div>
        <h1>{siteSettings.siteTitle}</h1>
        <p>{siteSettings.publicDescription}</p>
        <div className="hero__actions">
          <a className="button button--primary" href="#sessions">
            Browse live tables
          </a>
          <Link className="button" href="/t1m0m">
            Admin
          </Link>
        </div>
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
