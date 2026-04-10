import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { SessionRoom } from '@/components/public/session-room'
import { loadAuthenticatedPlayer, loadJoinableSessionBySlug } from '@/lib/player-access'
import { readPlayerSessionFromCookieStore } from '@/lib/player-auth'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export default async function SessionPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const payload = await getPayload({ config })
  const playerSession = readPlayerSessionFromCookieStore(await cookies())

  if (!playerSession) {
    redirect(`/login?returnTo=${encodeURIComponent(`/session/${slug}`)}`)
  }

  const player = await loadAuthenticatedPlayer(payload, playerSession)
  if (!player || player.status === 'suspended') {
    redirect('/rooms')
  }

  const session = await loadJoinableSessionBySlug(payload, slug, player)
  if (!session) {
    notFound()
  }

  const activeSourceCount = Array.isArray(session.activeDocuments) ? session.activeDocuments.length : 0
  const rulesetTitle =
    session.ruleset && typeof session.ruleset === 'object' && 'title' in session.ruleset
      ? String(session.ruleset.title || '')
      : 'Campaign room'

  return (
    <main className="surface surface--session">
      <div className="session-shell">
        <section className="session-hero">
          <Link className="back-link" href="/rooms">
            Back to rooms
          </Link>

          <div className="session-hero__head">
            <span className="pill">{session.status}</span>
            <h1>{session.title}</h1>
            <p>{session.publicSummary || 'Enter the room, verify your mic, and let the next scene start fast.'}</p>
          </div>

          <div className="session-hero__facts">
            <div>
              <span>Ruleset</span>
              <strong>{rulesetTitle}</strong>
            </div>
            <div>
              <span>Room</span>
              <strong>{session.roomName}</strong>
            </div>
            <div>
              <span>Active sources</span>
              <strong>{activeSourceCount}</strong>
            </div>
          </div>

          <div className="session-hero__brief">
            <h2>Before you enter</h2>
            <ul>
              <li>Confirm your player display name.</li>
              <li>Choose the microphone you want to use for the table.</li>
              <li>Label speakers if more than one player is present.</li>
              <li>Keep this tab open so room audio and controls stay stable.</li>
            </ul>
          </div>
        </section>

        <SessionRoom
          authenticatedPlayer={{
            displayName: player.displayName,
            email: player.email || playerSession.email,
          }}
          initialPlayerName={player.displayName}
          sessionSlug={session.slug}
          title={session.title}
          welcomeText={session.welcomeText || ''}
        />
      </div>
    </main>
  )
}
