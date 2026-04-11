import { cookies } from 'next/headers'
import Link from 'next/link'
import { getPayload } from 'payload'

import {
  ensurePlayerGameSession,
  listPlayerLibrary,
  loadAuthenticatedPlayer,
} from '@/lib/player-access'
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
  const playerLibrary = playerRecord ? await listPlayerLibrary(payload, playerRecord) : []
  const playerGame = playerRecord ? await ensurePlayerGameSession(payload, playerRecord) : null
  const primaryBook = playerLibrary.find((entry) => entry.isPrimary) || null
  const activeBooks = playerLibrary.filter((entry) => entry.isActive)

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
              <Link className="button button--primary" href="/play">
                Open my game
              </Link>
            ) : (
              <Link className="button button--primary" href="/login">
                {isGooglePlayerAuthConfigured() ? 'Sign in with Google' : 'Start playing'}
              </Link>
            )}

            <Link className="button button--ghost" href={playerSession ? '/play' : '/login'}>
              Start playing
            </Link>
          </div>

          <div className="hero__steps" aria-label="How it works">
            <div>
              <span>01</span>
              <p>Sign in once with Google.</p>
            </div>
            <div>
              <span>02</span>
              <p>Upload your rulebook and supporting books.</p>
            </div>
            <div>
              <span>03</span>
              <p>Start or continue your game in Auto VAD.</p>
            </div>
          </div>

          {authNotice && <div className="notice-card">{authNotice}</div>}
        </div>

        <aside className="hero__panel">
          <p className="eyebrow">Product flow</p>
          <h2>Personal library, persistent game, voice-first play</h2>
          <ul className="hero__checklist">
            <li>Google SSO before any playable presence</li>
            <li>One player-owned game session behind the scenes</li>
            <li>Primary rulebook plus supporting books</li>
            <li>Speaker labeling only when more than one human voice is present</li>
          </ul>
        </aside>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your game</p>
            <h2>{playerSession ? 'Everything important in one surface' : 'A cleaner way to enter voice play'}</h2>
          </div>
          <Link className="section-link" href={playerSession ? '/play' : '/login'}>
            {playerSession ? 'Open my game' : 'Sign in to start'}
          </Link>
        </div>

        <div className="room-grid">
          <article className="room-card">
            <div className="room-card__topline">
              <span className={`pill ${playerSession ? 'pill--accent' : ''}`}>
                {playerSession ? 'Signed in' : 'Step 1'}
              </span>
            </div>
            <h3>Identity first</h3>
            <p>Keep one Google-backed player identity so your books, voice settings, and mappings stay consistent.</p>
            <div className="room-card__footer">
              <span>{playerSession ? 'Player profile active' : 'Google SSO required'}</span>
              <Link className="text-link" href={playerSession ? '/play' : '/login'}>
                {playerSession ? 'Continue' : 'Sign in'}
              </Link>
            </div>
          </article>

          <article className="room-card">
            <div className="room-card__topline">
              <span className={`pill ${primaryBook ? 'pill--accent' : ''}`}>
                {primaryBook ? 'Primary ready' : 'Step 2'}
              </span>
            </div>
            <h3>Own your books</h3>
            <p>
              {primaryBook
                ? `${primaryBook.title} is your primary rulebook, with ${Math.max(playerLibrary.length - 1, 0)} supporting book${playerLibrary.length - 1 === 1 ? '' : 's'} in your library.`
                : 'Upload a primary rulebook and any supporting books you want active during play.'}
            </p>
            <div className="room-card__footer">
              <span>{playerSession ? `${activeBooks.length} active book${activeBooks.length === 1 ? '' : 's'}` : 'Library opens after sign-in'}</span>
              <Link className="text-link" href={playerSession ? '/play' : '/login'}>
                {playerSession ? 'Manage library' : 'Unlock library'}
              </Link>
            </div>
          </article>

          <article className="room-card">
            <div className="room-card__topline">
              <span className={`pill ${playerGame ? 'pill--accent' : ''}`}>
                {playerGame?.status === 'live' ? 'Live' : 'Step 3'}
              </span>
            </div>
            <h3>Start or continue with VAD</h3>
            <p>
              The voice runtime stays behind the scenes. You open one personal game surface, check the mic, confirm speakers if needed, and play.
            </p>
            <div className="room-card__footer">
              <span>{playerGame ? 'Auto VAD session prepared' : 'Voice opens after sign-in'}</span>
              <Link className="text-link" href={playerSession ? '/play' : '/login'}>
                {playerSession ? 'Open my game' : 'Start playing'}
              </Link>
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}
