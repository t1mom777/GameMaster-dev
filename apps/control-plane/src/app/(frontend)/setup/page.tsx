import Link from 'next/link'
import { getPayload } from 'payload'

import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  const payload = await getPayload({ config })
  const siteSettings = await payload.findGlobal({
    slug: 'site-settings',
  })

  const providerStatus = [
    {
      detail: 'Embeddings and optional OpenAI runtime features.',
      label: 'OpenAI API',
      ready: Boolean(process.env.OPENAI_API_KEY),
    },
    {
      detail: 'Gemini runtime calls when Runtime Defaults use Gemini.',
      label: 'Google Gemini API',
      ready: Boolean(process.env.GOOGLE_API_KEY),
    },
    {
      detail: 'Realtime speech-to-text and text-to-speech.',
      label: 'Deepgram API',
      ready: Boolean(process.env.DEEPGRAM_API_KEY),
    },
  ]

  const accessPoints = [
    {
      href: 'https://game.dima.click',
      label: 'Public app',
      value: 'https://game.dima.click',
    },
    {
      href: 'https://game.dima.click/t1m0m',
      label: 'Payload admin',
      value: 'https://game.dima.click/t1m0m',
    },
    {
      href: 'https://game.dima.click/api/gm/health',
      label: 'Health endpoint',
      value: 'https://game.dima.click/api/gm/health',
    },
    {
      href: 'https://game.dima.click/api/gm/public/sessions',
      label: 'Public sessions API',
      value: 'https://game.dima.click/api/gm/public/sessions',
    },
    {
      href: 'https://rtc.game.dima.click',
      label: 'LiveKit endpoint',
      value: 'https://rtc.game.dima.click',
    },
  ]

  const manualSteps = [
    'Log into Payload at /t1m0m.',
    'Open Runtime Defaults and confirm the LLM, STT, TTS, and retrieval defaults.',
    'Open Site Settings and update the public title, tagline, and description.',
    'Create one Campaign, one World, and one Ruleset.',
    'Upload the primary rulebook and supporting books in Documents.',
    'Create or edit a Game Session, then set publicJoinEnabled=true and allowGuests=true.',
    'Save the session and confirm it appears on the public home page.',
  ]

  const operatingChecks = [
    'GET /api/gm/health returns ok: true.',
    'GET /api/gm/public/sessions returns at least one public session.',
    'The session page loads and the join form mints a LiveKit token.',
    'The browser can reach rtc.game.dima.click.',
    'Documents move to ready after ingest and reindex.',
  ]

  return (
    <main className="shell shell--setup">
      <div className="setup-header">
        <div>
          <p className="section-heading__eyebrow">Operator guide</p>
          <h1>{siteSettings.siteTitle} setup</h1>
          <p>{siteSettings.tagline}</p>
        </div>
        <div className="hero__actions">
          <Link className="button button--primary" href="/t1m0m">
            Open admin
          </Link>
          <Link className="button" href="/">
            Back to homepage
          </Link>
        </div>
      </div>

      <section className="setup-grid">
        <article className="card">
          <p className="section-heading__eyebrow">Access points</p>
          <h2>Primary entry routes</h2>
          <div className="access-list">
            {accessPoints.map((entry) => (
              <a className="access-list__item" href={entry.href} key={entry.href} rel="noreferrer" target="_blank">
                <span>{entry.label}</span>
                <strong>{entry.value}</strong>
              </a>
            ))}
          </div>
        </article>

        <article className="card">
          <p className="section-heading__eyebrow">Provider readiness</p>
          <h2>Server auth state</h2>
          <div className="status-list">
            {providerStatus.map((provider) => (
              <div className="status-list__item" key={provider.label}>
                <div>
                  <strong>{provider.label}</strong>
                  <p>{provider.detail}</p>
                </div>
                <div className={`pill ${provider.ready ? 'pill--signal' : 'pill--warning'}`}>
                  {provider.ready ? 'Configured' : 'Missing'}
                </div>
              </div>
            ))}
          </div>
          <p className="setup-note">
            Google web login and ChatGPT web login are not used as backend model auth in this stack. Server-to-server runtime calls still require API credentials.
          </p>
        </article>
      </section>

      <section className="setup-grid">
        <article className="card">
          <p className="section-heading__eyebrow">Manual bootstrap</p>
          <h2>Operator checklist</h2>
          <ol className="setup-list">
            {manualSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>

        <article className="card">
          <p className="section-heading__eyebrow">Validation</p>
          <h2>Production checks</h2>
          <ul className="setup-list setup-list--bullets">
            {operatingChecks.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  )
}
