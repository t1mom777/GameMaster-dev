import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { PlayerLibraryManager } from '@/components/public/player-library-manager'
import { SessionRoom } from '@/components/public/session-room'
import {
  ensurePlayerGameSession,
  isPlayerActive,
  listPlayerLibrary,
  loadAuthenticatedPlayer,
} from '@/lib/player-access'
import { readPlayerSessionFromCookieStore } from '@/lib/player-auth'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export default async function PlayPage() {
  const payload = await getPayload({ config })
  const playerSession = readPlayerSessionFromCookieStore(await cookies())

  if (!playerSession) {
    redirect('/login?returnTo=/play')
  }

  const player = await loadAuthenticatedPlayer(payload, playerSession)
  if (!player || !isPlayerActive(player)) {
    redirect('/login?auth=google-failed')
  }

  const library = await listPlayerLibrary(payload, player)
  const gameSession = await ensurePlayerGameSession(payload, player)
  const primaryRulebook = library.find((entry) => entry.isPrimary) || null
  const supportingBooks = library.filter((entry) => !entry.isPrimary)
  const readyBooks = library.filter((entry) => entry.isActive && entry.status === 'ready')
  const primaryRulebookReady = primaryRulebook?.status === 'ready'

  return (
    <main className="surface surface--play">
      <section className="play-ready">
        <div className="play-ready__header">
          <div>
            <p className="eyebrow">Signed in as {player.displayName}</p>
            <h1>Ready to play.</h1>
            <p>
              Run the table from one device. Keep the main rulebook grounded, confirm who is at the
              table, then start voice from the same page.
            </p>
          </div>

          <div className="play-ready__identity">
            <span>{player.email || playerSession.email}</span>
          </div>
        </div>

        <PlayerLibraryManager compact />

        <SessionRoom
          authenticatedPlayer={{
            displayName: player.displayName,
            email: player.email || playerSession.email,
          }}
          initialPlayerName={player.displayName}
          primaryRulebookTitle={primaryRulebook?.title || null}
          readyBookCount={readyBooks.length}
          rulebookReady={primaryRulebookReady}
          sessionSlug={gameSession.slug}
          supportingBookCount={supportingBooks.length}
          title={gameSession.title}
          welcomeText={
            gameSession.welcomeText ||
            'Shared-device play is ready. Check the mic, confirm the table, and start voice when everyone is seated.'
          }
        />
      </section>
    </main>
  )
}
