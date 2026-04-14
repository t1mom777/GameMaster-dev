import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { PlayerLibraryManager } from '@/components/public/player-library-manager'
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
  const activeBooks = library.filter((entry) => entry.isActive)
  const readyBooks = activeBooks.filter((entry) => entry.status === 'ready')
  const primaryRulebookReady = primaryRulebook?.status === 'ready'
  const primaryRulebookIndexing = Boolean(primaryRulebook) && !primaryRulebookReady

  return (
    <main className="surface surface--play">
      <section className="play-hero">
        <div>
          <p className="eyebrow">Signed in as {player.displayName}</p>
          <h1>Run the table from one device</h1>
          <p>
            Put one microphone near the table, keep the main rulebook grounded, and use the same play
            surface each time you continue the session.
          </p>
        </div>

        <div className="play-hero__actions">
          {primaryRulebookReady ? (
            <Link className="button button--primary" href={`/session/${gameSession.slug}`}>
              {gameSession.status === 'live' ? 'Continue table voice' : 'Start table voice'}
            </Link>
          ) : (
            <a className="button button--primary" href="#library">
              {primaryRulebookIndexing ? 'Wait for main rulebook' : 'Upload a main rulebook'}
            </a>
          )}
          <Link className="button button--ghost" href="/">
            Back to home
          </Link>
        </div>
      </section>

      <section className="section-block section-block--split" id="library">
        <article className="game-card">
          <div className="game-card__header">
            <div>
              <p className="eyebrow">Current game</p>
              <h2>{gameSession.title}</h2>
            </div>
            <span className={`pill ${readyBooks.length ? 'pill--accent' : ''}`}>
              {gameSession.status === 'live' ? 'Live' : 'Ready'}
            </span>
          </div>

          <p className="game-card__lede">
            {primaryRulebookReady
              ? `Main rulings come from ${primaryRulebook?.title}. Supporting books join automatically, and the table roster is confirmed before voice starts.`
              : primaryRulebookIndexing
                ? `${primaryRulebook?.title} is still indexing. Voice stays locked until the main rulebook is ready.`
                : 'Upload a main rulebook to ground the session before voice starts.'}
          </p>

          <div className="game-card__facts">
            <div>
              <span>Main book</span>
              <strong>{primaryRulebook?.title || 'Not set yet'}</strong>
            </div>
            <div>
              <span>Supporting</span>
              <strong>{supportingBooks.length}</strong>
            </div>
            <div>
              <span>Active books</span>
              <strong>{activeBooks.length}</strong>
            </div>
            <div>
              <span>Ready for retrieval</span>
              <strong>{readyBooks.length}</strong>
            </div>
            <div>
              <span>Main book status</span>
              <strong>{primaryRulebookReady ? 'Ready' : primaryRulebookIndexing ? 'Indexing' : 'Missing'}</strong>
            </div>
            <div>
              <span>Voice mode</span>
              <strong>Auto VAD</strong>
            </div>
          </div>

          <div className="game-card__notes">
            <h3>Before you enter the table</h3>
            <ul>
              <li>Keep one main rulebook ready before you open voice.</li>
              <li>Only active books are injected into the running game.</li>
              <li>Put one device near the center of the real table.</li>
              <li>Name the people around the microphone before the scene begins.</li>
            </ul>
          </div>
        </article>

        <PlayerLibraryManager />
      </section>
    </main>
  )
}
