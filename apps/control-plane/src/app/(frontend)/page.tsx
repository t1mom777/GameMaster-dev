import { cookies } from 'next/headers'
import Link from 'next/link'
import { getPayload } from 'payload'

import { findJoinableSessionsForPlayer, loadAuthenticatedPlayer } from '@/lib/player-access'
import { isGooglePlayerAuthConfigured, readPlayerSessionFromCookieStore } from '@/lib/player-auth'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export default async function HomePage(props: { searchParams?: Promise<{ auth?: string }> }) {
  const payload = await getPayload({ config })
  const playerSession = readPlayerSessionFromCookieStore(await cookies())
  const searchParams = props.searchParams ? await props.searchParams : undefined
  const playerRecord = await loadAuthenticatedPlayer(payload, playerSession)
  const siteSettings = await payload.findGlobal({
    slug: 'site-settings',
  })

  const featuredSessions = playerRecord
    ? await findJoinableSessionsForPlayer(payload, playerRecord, 3)
    : (
        await payload.find({
          collection: 'game-sessions',
          depth: 1,
          limit: 3,
          pagination: false,
          where: {
            and: [
              {
                allowGuests: {
                  equals: true,
                },
              },
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
      ).docs.map((session) => ({
        allowGuests: session.allowGuests,
        id: session.id,
        publicJoinEnabled: session.publicJoinEnabled,
        publicSummary: session.publicSummary,
        roomName: session.roomName,
        ruleset: session.ruleset,
        scheduledFor: session.scheduledFor,
        slug: session.slug,
        status: session.status,
        title: session.title,
        welcomeText: session.welcomeText,
      }))

  const authNotice =
    searchParams?.auth === 'google-state'
      ? 'Your sign-in attempt expired. Try again.'
      : searchParams?.auth === 'google-failed'
        ? 'We could not finish sign-in. Try again or use a different Google account.'
        : null

  return (
    <main className="surface surface--landing">
      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Voice-first tabletop play</p>
          <h1>{siteSettings.siteTitle}</h1>
          <p className="hero__lede">{siteSettings.publicDescription}</p>

          <div className="hero__actions">
            {playerSession ? (
              <Link className="button button--primary" href="/rooms">
                Start playing
              </Link>
            ) : (
              <Link className="button button--primary" href="/login">
                {isGooglePlayerAuthConfigured() ? 'Sign in with Google' : 'Start playing'}
              </Link>
            )}

            <Link className="button button--ghost" href={playerSession ? '/rooms' : '/login'}>
              Join room
            </Link>
          </div>

          <div className="hero__steps" aria-label="How it works">
            <div>
              <span>01</span>
              <p>Sign in once with Google.</p>
            </div>
            <div>
              <span>02</span>
              <p>Pick the room you are allowed to join.</p>
            </div>
            <div>
              <span>03</span>
              <p>Check your mic and enter the scene.</p>
            </div>
          </div>

          {authNotice && <div className="notice-card">{authNotice}</div>}
        </div>

        <aside className="hero__panel">
          <p className="eyebrow">Flow</p>
          <h2>Fast from sign-in to table</h2>
          <ul className="hero__checklist">
            <li>Google SSO before any room presence</li>
            <li>Simple room list for the current player</li>
            <li>Mic check before join</li>
            <li>Speaker labeling when more than one player is present</li>
          </ul>
        </aside>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Available rooms</p>
            <h2>{playerSession ? 'Rooms you can enter right now' : 'A few rooms currently open for sign-in'}</h2>
          </div>
          <Link className="section-link" href={playerSession ? '/rooms' : '/login'}>
            {playerSession ? 'Open my rooms' : 'Sign in to see more'}
          </Link>
        </div>

        <div className="room-grid">
          {featuredSessions.map((session) => (
            <article className="room-card" key={String(session.id)}>
              <div className="room-card__topline">
                <span className="pill">{session.status}</span>
                <span className="room-card__room">Room {session.roomName}</span>
              </div>
              <h3>{session.title}</h3>
              <p>{session.publicSummary || 'A live voice session is ready for the table.'}</p>
              <div className="room-card__footer">
                <span>
                  {session.ruleset && typeof session.ruleset === 'object' && 'title' in session.ruleset
                    ? String(session.ruleset.title || '')
                    : 'Campaign room'}
                </span>
                <Link className="text-link" href={playerSession ? `/session/${session.slug}` : '/login'}>
                  {playerSession ? 'Enter room' : 'Sign in to join'}
                </Link>
              </div>
            </article>
          ))}

          {!featuredSessions.length && (
            <article className="room-card room-card--empty">
              <h3>No rooms are open just yet</h3>
              <p>When the next table opens, it will appear here automatically.</p>
            </article>
          )}
        </div>
      </section>
    </main>
  )
}
