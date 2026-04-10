import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { PlayerRulebookManager } from '@/components/public/player-rulebook-manager'
import { findJoinableSessionsForPlayer, isPlayerActive, loadAuthenticatedPlayer } from '@/lib/player-access'
import { readPlayerSessionFromCookieStore } from '@/lib/player-auth'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export default async function RoomsPage() {
  const payload = await getPayload({ config })
  const playerSession = readPlayerSessionFromCookieStore(await cookies())

  if (!playerSession) {
    redirect('/login?returnTo=/rooms')
  }

  const player = await loadAuthenticatedPlayer(payload, playerSession)
  if (!player || !isPlayerActive(player)) {
    redirect('/login?auth=google-failed')
  }

  const sessions = await findJoinableSessionsForPlayer(payload, player, 24)

  return (
    <main className="surface surface--rooms">
      <section className="rooms-hero">
        <div>
          <p className="eyebrow">Signed in as {player.displayName}</p>
          <h1>Choose a room</h1>
          <p>Only rooms available to this player identity appear here.</p>
        </div>
      </section>

      <section className="section-block section-block--split">
        <PlayerRulebookManager />

        <article className="info-card">
          <p className="eyebrow">Voice flow</p>
          <h2>From sign-in to scene with minimal friction</h2>
          <ul className="info-list">
            <li>Pick a room that is already assigned to your player identity.</li>
            <li>Run the mic check right before you enter, not earlier.</li>
            <li>Confirm speaker labels only when the room has multiple human voices.</li>
            <li>Your personal rulebook stays tied to your account until you replace it.</li>
          </ul>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Joinable now</p>
            <h2>{sessions.length ? 'Available rooms' : 'No rooms available yet'}</h2>
          </div>
        </div>

        <div className="room-grid room-grid--wide">
          {sessions.map((session) => (
            <article className="room-card room-card--wide" key={String(session.id)}>
              <div className="room-card__topline">
                <span className="pill">{session.status}</span>
                <span className="room-card__room">Room {session.roomName}</span>
              </div>
              <h3>{session.title}</h3>
              <p>{session.publicSummary || 'Your table is ready for voice play.'}</p>
              <div className="room-card__stats">
                <div>
                  <span>Schedule</span>
                  <strong>{session.scheduledFor ? new Date(session.scheduledFor).toLocaleString() : 'Open now'}</strong>
                </div>
                <div>
                  <span>Sources</span>
                  <strong>{Array.isArray(session.activeDocuments) ? session.activeDocuments.length : 0}</strong>
                </div>
              </div>
              <div className="room-card__footer">
                <span>
                  {session.ruleset && typeof session.ruleset === 'object' && 'title' in session.ruleset
                    ? String(session.ruleset.title || '')
                    : 'Campaign room'}
                </span>
                <Link className="button button--primary" href={`/session/${session.slug}`}>
                  Join room
                </Link>
              </div>
            </article>
          ))}

          {!sessions.length && (
            <article className="room-card room-card--empty">
              <h3>No rooms are assigned to this player right now</h3>
              <p>When a room becomes available, it will show up here automatically.</p>
            </article>
          )}
        </div>
      </section>
    </main>
  )
}
