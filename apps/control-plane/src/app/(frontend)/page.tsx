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
                  <svg fill="none" viewBox="0 0 24 24">
                    <path
                      d="M21.805 12.23c0-.763-.068-1.495-.195-2.199H12v4.159h5.49a4.696 4.696 0 0 1-2.04 3.082v2.56h3.3c1.932-1.778 3.055-4.399 3.055-7.602Z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 22c2.76 0 5.074-.914 6.766-2.468l-3.3-2.56c-.914.613-2.082.976-3.466.976-2.668 0-4.928-1.8-5.734-4.221H2.855v2.641A10.213 10.213 0 0 0 12 22Z"
                      fill="#34A853"
                    />
                    <path
                      d="M6.266 13.727A6.14 6.14 0 0 1 5.945 12c0-.6.11-1.182.32-1.727V7.632H2.856A10.213 10.213 0 0 0 1.778 12c0 1.633.392 3.178 1.078 4.368l3.41-2.64Z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 6.05c1.5 0 2.85.517 3.913 1.532l2.937-2.937C17.07 2.99 14.756 2 12 2 7.855 2 4.253 4.386 2.855 7.632l3.41 2.64C7.071 7.85 9.331 6.05 12 6.05Z"
                      fill="#EA4335"
                    />
                  </svg>
                </span>
                {primaryLabel}
              </Link>
            </div>

            <div className="landing-minimal__meta">
              <p>{subline}</p>
              <p>{supportLine}</p>
            </div>

            {!playerSession ? (
              <Link className="landing-minimal__founder-link" href="/kickstarter">
                Founder Access opens on Kickstarter
              </Link>
            ) : null}

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
