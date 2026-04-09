import Link from 'next/link'
import { getPayload } from 'payload'

import { getGoogleRedirectUri, isGooglePlayerAuthConfigured } from '@/lib/player-auth'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  const payload = await getPayload({ config })
  const siteSettings = await payload.findGlobal({
    slug: 'site-settings',
  })
  const runtimeDefaults = await payload.findGlobal({
    overrideAccess: true,
    slug: 'runtime-defaults',
  })
  const openAiReady = Boolean(process.env.OPENAI_API_KEY)
  const googleReady = Boolean(process.env.GOOGLE_API_KEY)
  const deepgramReady = Boolean(process.env.DEEPGRAM_API_KEY)
  const googlePlayerAuthReady = isGooglePlayerAuthConfigured()
  const googleRedirectUri = getGoogleRedirectUri()

  const providerStatus = [
    {
      detail: 'Embeddings and optional OpenAI runtime features.',
      label: 'OpenAI API',
      ready: openAiReady,
    },
    {
      detail: 'Gemini runtime calls when Runtime Defaults use Gemini.',
      label: 'Google Gemini API',
      ready: googleReady,
    },
    {
      detail: googleRedirectUri
        ? `Public player login via Google OAuth callback ${googleRedirectUri}.`
        : 'Public player login via Google OAuth. Set client id, client secret, and redirect URI.',
      label: 'Google Player OAuth',
      ready: googlePlayerAuthReady,
    },
    {
      detail: 'Realtime speech-to-text and text-to-speech.',
      label: 'Deepgram API',
      ready: deepgramReady,
    },
  ]
  const runtimeProfile = [
    {
      label: 'LLM provider',
      value: runtimeDefaults.llmProvider || 'openai',
    },
    {
      label: 'LLM model',
      value: runtimeDefaults.llmModel || 'gpt-4.1-mini',
    },
    {
      label: 'STT',
      value: `${runtimeDefaults.sttProvider || 'deepgram'} / ${runtimeDefaults.sttModel || 'nova-3'}`,
    },
    {
      label: 'TTS',
      value: `${runtimeDefaults.ttsProvider || 'deepgram'} / ${runtimeDefaults.ttsVoice || runtimeDefaults.ttsModel || 'aura-2'}`,
    },
    {
      label: 'Voice mode',
      value: runtimeDefaults.voiceMode || 'auto-vad',
    },
    {
      label: 'Retrieval',
      value: `top ${runtimeDefaults.retrievalTopK || 5}`,
    },
  ]
  const runtimeWarnings = [
    runtimeDefaults.llmProvider === 'gemini' && !googleReady
      ? 'Runtime Defaults currently select Gemini, but GOOGLE_API_KEY is missing from the live container.'
      : null,
    runtimeDefaults.llmProvider === 'openai' && !openAiReady
      ? 'Runtime Defaults currently select OpenAI, but OPENAI_API_KEY is missing from the live container.'
      : null,
    !deepgramReady
      ? 'Deepgram is missing, so the GM can still text-fallback but not complete the intended voice loop.'
      : null,
    !googlePlayerAuthReady
      ? 'Public Google sign-in is disabled until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are present and the redirect URI matches this deployment.'
      : null,
  ].filter(Boolean)

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
    'If you want Google player sign-in on the homepage, configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in Coolify first.',
    'Open Runtime Defaults and confirm the LLM, STT, TTS, and retrieval defaults.',
    'After changing provider env vars in Coolify, redeploy or restart control-plane and gm-agent so the live containers see them.',
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
            Google player login is separate from Gemini model auth. Public browser sign-in uses OAuth client credentials, while server-to-server runtime calls still require API keys.
          </p>
        </article>
      </section>

      <section className="setup-grid">
        <article className="card">
          <p className="section-heading__eyebrow">Runtime profile</p>
          <h2>Current defaults</h2>
          <div className="runtime-grid runtime-grid--tight">
            {runtimeProfile.map((entry) => (
              <div className="runtime-card runtime-card--compact" key={entry.label}>
                <span>{entry.label}</span>
                <strong>{entry.value}</strong>
              </div>
            ))}
          </div>
          {runtimeWarnings.length > 0 && (
            <div className="alert-card alert-card--inline">
              <h3>Current blockers</h3>
              <ul className="setup-list setup-list--bullets">
                {runtimeWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </article>

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

        <article className="card">
          <p className="section-heading__eyebrow">Payload collections</p>
          <h2>Where to edit manually</h2>
          <ul className="setup-list setup-list--bullets">
            <li>Campaigns: high-level campaign identity, pitch, and primary ruleset link.</li>
            <li>Worlds: tone, player promise, and setting-specific framing.</li>
            <li>Rulesets: the source pack the GM should treat as authoritative.</li>
            <li>Documents: primary rulebook, supporting books, and reindex requests.</li>
            <li>Game Sessions: public join toggle, room name, welcome text, and active source list.</li>
            <li>Runtime Defaults: LLM, STT, TTS, retrieval, and join greeting.</li>
            <li>Players: guest and Google-authenticated player profiles created by public joins.</li>
          </ul>
        </article>
      </section>
    </main>
  )
}
