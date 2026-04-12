import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { isGooglePlayerAuthConfigured, readPlayerSessionFromCookieStore, sanitizeReturnTo } from '@/lib/player-auth'

export const dynamic = 'force-dynamic'

export default async function LoginPage(props: {
  searchParams?: Promise<{ auth?: string; returnTo?: string }>
}) {
  const playerSession = readPlayerSessionFromCookieStore(await cookies())
  const searchParams = props.searchParams ? await props.searchParams : undefined
  const returnTo = sanitizeReturnTo(searchParams?.returnTo)

  if (playerSession) {
    redirect(returnTo === '/' ? '/play' : returnTo)
  }

  const googlePlayerAuthConfigured = isGooglePlayerAuthConfigured()
  const authNotice =
    searchParams?.auth === 'google-state'
      ? 'Your previous sign-in expired. Start again.'
      : searchParams?.auth === 'google-failed'
        ? 'Google sign-in could not be completed.'
        : null

  return (
    <main className="surface surface--centered">
      <section className="auth-shell">
        <div className="auth-shell__copy">
          <p className="eyebrow">Player sign-in</p>
          <h1>Enter the table with your Google identity</h1>
          <p>
            Sign in once, keep your player presence consistent, and move straight into your own game,
            books, and voice setup.
          </p>

          <ul className="auth-list">
            <li>Your library stays attached to the same player identity</li>
            <li>Your books and voice setup stay with your player profile</li>
            <li>Voice onboarding happens after sign-in, not before</li>
          </ul>
        </div>

        <div className="auth-card">
          <p className="eyebrow">Continue</p>
          <h2>Google SSO required</h2>
          <p>Use the same player identity each time so books, speaker labels, and your active game stay clean.</p>

          {authNotice && <div className="notice-card">{authNotice}</div>}

          {googlePlayerAuthConfigured ? (
            <a className="button button--primary button--full" href={`/auth/google/start?returnTo=${encodeURIComponent(returnTo || '/play')}`}>
              Sign in with Google
            </a>
          ) : (
            <div className="notice-card notice-card--muted">
              Sign-in is not available right now. Ask the organizer to finish the Google SSO configuration.
            </div>
          )}

          <Link className="button button--ghost button--full" href="/">
            Back to home
          </Link>
        </div>
      </section>
    </main>
  )
}
