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

  return (
    <main className="surface surface--play">
      <section className="play-hero">
        <div>
          <p className="eyebrow">Signed in as {player.displayName}</p>
          <h1>Start or continue your game</h1>
          <p>
            Your books stay with your account, your active game stays provisioned, and voice opens in
            Auto VAD mode when you are ready.
          </p>
        </div>

        <div className="play-hero__actions">
          {primaryRulebook ? (
            <Link className="button button--primary" href={`/session/${gameSession.slug}`}>
              {gameSession.status === 'live' ? 'Continue with VAD' : 'Start with VAD'}
            </Link>
          ) : (
            <a className="button button--primary" href="#library">
              Upload a primary rulebook
            </a>
          )}
          {!primaryRulebook && (
            <Link className="button button--ghost" href={`/session/${gameSession.slug}`}>
              Open voice anyway
            </Link>
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
            {primaryRulebook
              ? `Primary rulings come from ${primaryRulebook.title}. Supporting books are synced automatically before voice starts.`
              : 'Upload a primary rulebook to ground the game. You can still open the voice surface before the library is complete.'}
          </p>

          <div className="game-card__facts">
            <div>
              <span>Primary</span>
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
              <span>Voice mode</span>
              <strong>Auto VAD</strong>
            </div>
          </div>

          <div className="game-card__notes">
            <h3>Before you enter voice</h3>
            <ul>
              <li>Keep one primary rulebook selected.</li>
              <li>Only active books are injected into the running game.</li>
              <li>Supporting books can be swapped without rebuilding the game manually.</li>
              <li>If multiple human players are present, you will confirm who is speaking inside the session.</li>
            </ul>
          </div>
        </article>

        <PlayerLibraryManager />
      </section>
    </main>
  )
}
