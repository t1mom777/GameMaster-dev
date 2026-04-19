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
    ? 'Your table, books, and current game are ready. Open the shared device and continue in seconds.'
    : 'A virtual GM that remembers your world, your story, and every player by voice.'
  const subline = playerSession
    ? `${primaryBook ? `${primaryBook.title} is set as your main rulebook.` : 'Add your main rulebook next.'} ${readyBooks.length} ready book${readyBooks.length === 1 ? '' : 's'} can ground the next session.`
    : 'No setup. Start in seconds.'
  const supportLine = playerSession ? 'Built for real tabletop sessions.' : 'Built for real tabletop sessions.'
  const primaryHref = playerSession
    ? '/play'
    : isGooglePlayerAuthConfigured()
      ? '/auth/google/start?returnTo=%2Fplay'
      : '/login'
  const primaryLabel = playerSession ? 'Open your table' : isGooglePlayerAuthConfigured() ? 'Continue with Google' : 'Start playing'

  return (
    <main className="surface surface--landing">
      <section className="landing-minimal">
        <div className="landing-minimal__glow landing-minimal__glow--top" aria-hidden="true" />
        <div className="landing-minimal__glow landing-minimal__glow--center" aria-hidden="true" />

        <div className="landing-minimal__hero">
          <div className="landing-minimal__copy">
            <h1>
              {playerSession ? (
                <>
                  Return to your table
                  <br />
                  from one device.
                </>
              ) : (
                <>
                  Play any TTRPG
                  <br />
                  from one device.
                </>
              )}
            </h1>
            <p className="landing-minimal__lede">{heroLede}</p>

            <div className="landing-minimal__actions">
              <Link className="button button--google" href={primaryHref}>
                <span className="button__google-badge" aria-hidden="true">
                  G
                </span>
                {primaryLabel}
              </Link>
            </div>

            <div className="landing-minimal__meta">
              <p>{subline}</p>
              <p>{supportLine}</p>
            </div>

            {authNotice ? <div className="notice-card landing-minimal__notice">{authNotice}</div> : null}
          </div>
        </div>

        <div className="landing-minimal__rail" aria-label="How it works">
          <span className="landing-minimal__rail-item">
            <span className="landing-minimal__rail-icon" aria-hidden="true">
              ◎
            </span>
            <span>Sign in</span>
          </span>
          <span className="landing-minimal__arrow" aria-hidden="true">
            →
          </span>
          <span className="landing-minimal__rail-item">
            <span className="landing-minimal__rail-icon" aria-hidden="true">
              ▣
            </span>
            <span>Add rulebook</span>
          </span>
          <span className="landing-minimal__arrow" aria-hidden="true">
            →
          </span>
          <span className="landing-minimal__rail-item">
            <span className="landing-minimal__rail-icon" aria-hidden="true">
              ◉
            </span>
            <span>Start talking</span>
          </span>
        </div>

        <div className="landing-minimal__footer-copy">
          {playerSession ? (
            <>
              <p>One table. One device. Your story stays intact.</p>
              <p className="landing-minimal__status">
                {primaryBook ? `${primaryBook.title} is your current main rulebook.` : 'Your main rulebook is not set yet.'}{' '}
                {playerGame?.status === 'live' ? 'Session is live.' : `${readyBooks.length} ready book${readyBooks.length === 1 ? '' : 's'} available.`}
              </p>
            </>
          ) : (
            <p>One table. One device. One memory.</p>
          )}
        </div>
      </section>
    </main>
  )
}
