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
  const readyBooks = activeBooks.filter((entry) => entry.status === 'ready')
  const heroLede = playerSession
    ? 'Your table setup, book stack, and current game are ready in one place. Open play when the real table is seated around one microphone.'
    : 'Sign in once, upload the books you want grounded in play, and run a shared-mic session from one device at the table.'
  const signedInSummary = playerSession
    ? `${primaryBook ? `${primaryBook.title} is your main rulebook.` : 'Your main rulebook is not set yet.'} ${readyBooks.length} ready book${readyBooks.length === 1 ? '' : 's'} can ground the next session.`
    : null

  return (
    <main className="surface surface--landing">
      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Voice-first tabletop play</p>
          <h1>{siteSettings.siteTitle}</h1>
          <p className="hero__lede">{heroLede}</p>

          <div className="hero__actions">
            {playerSession ? (
              <Link className="button button--primary" href="/play">
                Open play
              </Link>
            ) : (
              <Link className="button button--primary" href="/login">
                {isGooglePlayerAuthConfigured() ? 'Sign in with Google' : 'Start playing'}
              </Link>
            )}

            <Link className="button button--ghost" href={playerSession ? '/play#library' : '#flow'}>
              {playerSession ? 'Review books' : 'See the table flow'}
            </Link>
          </div>

          <div className="hero__steps" aria-label="How it works">
            <div>
              <span>01</span>
              <p>Sign in once with Google.</p>
            </div>
            <div>
              <span>02</span>
              <p>Upload one main rulebook and any supporting books.</p>
            </div>
            <div>
              <span>03</span>
              <p>Name the people around the table, then start shared-mic voice.</p>
            </div>
          </div>

          {authNotice && <div className="notice-card">{authNotice}</div>}
        </div>

        <aside className="hero__panel">
          <p className="eyebrow">{playerSession ? 'Player status' : 'Product flow'}</p>
          <h2>{playerSession ? 'One identity, one table surface' : 'One device, one mic, one grounded game surface'}</h2>
          {playerSession ? (
            <>
              <p className="hero__lede hero__lede--tight">{signedInSummary}</p>
              <div className="hero__status-grid">
                <div>
                  <span>Main book</span>
                  <strong>{primaryBook?.title || 'Missing'}</strong>
                </div>
                <div>
                  <span>Ready books</span>
                  <strong>{readyBooks.length}</strong>
                </div>
                <div>
                  <span>Voice state</span>
                  <strong>{playerGame?.status === 'live' ? 'Live' : 'Ready'}</strong>
                </div>
              </div>
            </>
          ) : (
            <ul className="hero__checklist">
              <li>Google SSO before any playable presence</li>
              <li>One shared device sits at the real table</li>
              <li>Main rulebook plus supporting books ground the GM</li>
              <li>You name the people around the mic before the scene starts</li>
            </ul>
          )}
        </aside>
      </section>

      <section className="section-block" id="flow">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Table flow</p>
            <h2>{playerSession ? 'Everything important stays on one shared device' : 'A cleaner way to open a shared-mic session'}</h2>
          </div>
          <Link className="section-link" href={playerSession ? '/play' : '/login'}>
            {playerSession ? 'Open play' : 'Sign in to start'}
          </Link>
        </div>

        <div className="room-grid">
          <article className="room-card">
            <div className="room-card__topline">
              <span className={`pill ${playerSession ? 'pill--accent' : ''}`}>
                {playerSession ? 'Signed in' : 'Step 1'}
              </span>
            </div>
            <h3>Trusted identity</h3>
            <p>Keep one Google-backed player identity so the same table setup, book stack, and voice preferences come back every session.</p>
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
                {primaryBook?.status === 'ready' ? 'Main book ready' : 'Step 2'}
              </span>
            </div>
            <h3>Rulebooks first</h3>
            <p>
              {primaryBook?.status === 'ready'
                ? `${primaryBook.title} is ready as the main rulebook, with ${Math.max(playerLibrary.length - 1, 0)} supporting book${playerLibrary.length - 1 === 1 ? '' : 's'} available for context.`
                : primaryBook
                  ? `${primaryBook.title} is still indexing. Voice unlocks when the main rulebook is ready.`
                  : 'Upload a main rulebook first, then add supporting books you want available during play.'}
            </p>
            <div className="room-card__footer">
              <span>{playerSession ? `${activeBooks.length} active book${activeBooks.length === 1 ? '' : 's'}` : 'Library opens after sign-in'}</span>
              <Link className="text-link" href={playerSession ? '/play' : '/login'}>
                {playerSession ? 'Manage books' : 'Unlock library'}
              </Link>
            </div>
          </article>

          <article className="room-card">
            <div className="room-card__topline">
              <span className={`pill ${playerGame ? 'pill--accent' : ''}`}>
                {playerGame?.status === 'live' ? 'Live' : 'Step 3'}
              </span>
            </div>
            <h3>Shared-mic voice</h3>
            <p>
              Open one table surface, check the microphone, confirm who is seated around it, and let voice stay focused on the scene.
            </p>
            <div className="room-card__footer">
              <span>{playerGame ? 'Auto VAD session prepared' : 'Voice opens after sign-in'}</span>
              <Link className="text-link" href={playerSession ? '/play' : '/login'}>
                {playerSession ? 'Open play' : 'Start playing'}
              </Link>
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}
