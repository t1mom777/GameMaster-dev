import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { isGooglePlayerAuthConfigured, readPlayerSessionFromCookieStore, sanitizeReturnTo } from '@/lib/player-auth'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export default async function LoginPage(props: {
  searchParams?: Promise<{ auth?: string; returnTo?: string }>
}) {
  const playerSession = readPlayerSessionFromCookieStore(await cookies())
  const searchParams = props.searchParams ? await props.searchParams : undefined
  const returnTo = sanitizeReturnTo(searchParams?.returnTo)

  if (playerSession) {
    redirect(returnTo === '/' ? '/rooms' : returnTo)
  }

  const payload = await getPayload({ config })
  const siteSettings = await payload.findGlobal({
    slug: 'site-settings',
  })
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
            {siteSettings.publicDescription ||
              'Sign in once, keep your player presence consistent, and move straight into voice play.'}
          </p>

          <ul className="auth-list">
            <li>Your name carries into rooms automatically</li>
            <li>Restricted rooms only appear when you are allowed in</li>
            <li>Voice onboarding happens after sign-in, not before</li>
          </ul>
        </div>

        <div className="auth-card">
          <p className="eyebrow">Continue</p>
          <h2>Google SSO required</h2>
          <p>Use the same player identity each time so rooms, speaker labels, and session access stay clean.</p>

          {authNotice && <div className="notice-card">{authNotice}</div>}

          {googlePlayerAuthConfigured ? (
            <a className="button button--primary button--full" href={`/auth/google/start?returnTo=${encodeURIComponent(returnTo || '/rooms')}`}>
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
