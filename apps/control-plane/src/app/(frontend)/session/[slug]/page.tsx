import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { SessionRoom } from '@/components/public/session-room'
import { listPlayerLibrary, loadAuthenticatedPlayer, loadJoinableSessionBySlug } from '@/lib/player-access'
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
    redirect('/play')
  }

  const session = await loadJoinableSessionBySlug(payload, slug, player)
  if (!session) {
    notFound()
  }

  if (session.ownerPlayerId !== String(player.id)) {
    redirect('/play')
  }

  const library = await listPlayerLibrary(payload, player)
  const primaryBook = library.find((entry) => entry.isPrimary) || null
  const supportingCount = library.filter((entry) => !entry.isPrimary).length
  const readyCount = library.filter((entry) => entry.isActive && entry.status === 'ready').length

  return (
    <main className="surface surface--session">
      <div className="session-shell">
        <section className="session-hero">
          <Link className="back-link" href="/play">
            Back to my game
          </Link>

          <div className="session-hero__head">
            <span className="pill">{session.status}</span>
            <h1>{session.title}</h1>
            <p>{session.publicSummary || 'Verify your mic, let Auto VAD settle, and continue the current scene.'}</p>
          </div>

          <div className="session-hero__facts">
            <div>
              <span>Primary book</span>
              <strong>{primaryBook?.title || 'Not set yet'}</strong>
            </div>
            <div>
              <span>Supporting books</span>
              <strong>{supportingCount}</strong>
            </div>
            <div>
              <span>Ready sources</span>
              <strong>{readyCount}</strong>
            </div>
            <div>
              <span>Voice mode</span>
              <strong>Auto VAD</strong>
            </div>
          </div>

          <div className="session-hero__brief">
            <h2>Before voice starts</h2>
            <ul>
              <li>Confirm your player display name.</li>
              <li>Choose the microphone you want to use for the table.</li>
              <li>Label speakers only if more than one human voice is present.</li>
              <li>Keep this tab open so voice state and scene continuity stay stable.</li>
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
