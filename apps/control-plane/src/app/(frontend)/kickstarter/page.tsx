import type { Metadata } from 'next'
import Link from 'next/link'

import { PrelaunchLeadForm } from '@/components/public/prelaunch-lead-form'

export const metadata: Metadata = {
  description:
    'Back Founder Access for GameMaster, a voice-first virtual GM built for real tabletop groups using one shared device.',
  title: 'Founder Access | GameMaster',
}

const kickstarterUrl = process.env.NEXT_PUBLIC_KICKSTARTER_PRELAUNCH_URL || ''
const hasKickstarterUrl = kickstarterUrl.startsWith('https://')

const rewardTiers = [
  {
    name: 'Signal Boost',
    price: 'CA$5',
    summary: 'Backer updates, thank-you credit, and access to the founder community if opened.',
  },
  {
    name: 'Early Table Seat',
    price: 'CA$19',
    summary: 'One month of early access, founder badge, and the backer setup guide.',
  },
  {
    name: 'Founder GM',
    price: 'CA$39',
    summary: 'Three months of early access, founder badge, and priority access to voice, model, and rulebook features.',
    featured: true,
  },
  {
    name: 'Table Founder Pack',
    price: 'CA$79',
    summary: 'Six months for one table owner, higher usage limits, and the starter adventure template.',
  },
  {
    name: 'Campaign Circle',
    price: 'CA$149',
    summary: 'Twelve months for one table owner plus private onboarding. Limited to 50.',
  },
  {
    name: 'Creator / Club Pack',
    price: 'CA$399',
    summary: 'Twelve months for up to five table owners and group onboarding. Limited to 25.',
  },
]

const roadmap = [
  ['Month 1', 'Founder onboarding, quota setup, and stability pass.'],
  ['Month 2', 'Improved Android voice reliability, better session memory, and rulebook polish.'],
  ['Month 3', 'Supporting-book templates, creator packs, model/voice controls, and founder feedback loop.'],
]

export default function KickstarterPage() {
  return (
    <main className="surface kickstarter-page">
      <section className="kickstarter-hero">
        <p className="eyebrow">Founder Access</p>
        <h1>A virtual GM for real tabletop sessions.</h1>
        <p>
          One table. One device. One memory. Back the first voice-first virtual GM built for groups
          playing together around a real table.
        </p>

        <div className="kickstarter-hero__actions">
          {hasKickstarterUrl ? (
            <a className="button button--primary button--hero" href={kickstarterUrl}>
              Notify me on Kickstarter
            </a>
          ) : (
            <span className="button button--primary button--hero button--disabled">
              Kickstarter prelaunch page coming soon
            </span>
          )}
          <Link className="button button--ghost button--hero" href="/auth/google/start?returnTo=%2Fplay">
            Try the live app
          </Link>
        </div>

        <div className="kickstarter-hero__facts" aria-label="Campaign facts">
          <div>
            <span>Goal</span>
            <strong>CA$20,000</strong>
          </div>
          <div>
            <span>Campaign</span>
            <strong>28 days</strong>
          </div>
          <div>
            <span>Rewards</span>
            <strong>Digital only</strong>
          </div>
        </div>
      </section>

      <section className="kickstarter-grid">
        <article className="kickstarter-card kickstarter-card--wide">
          <p className="eyebrow">What You Back</p>
          <h2>Founder access to the shared-table GM.</h2>
          <p>
            GameMaster is for in-person groups that want one phone or laptop in the middle of the
            table. Upload a main rulebook, add supporting books, name the people at the table, and
            start talking. The virtual GM listens, retrieves from your books, remembers the session,
            and responds in speech.
          </p>
        </article>

        <article className="kickstarter-card">
          <p className="eyebrow">Founder Perk</p>
          <h2>Use managed defaults or bring your own AI stack.</h2>
          <p>
            Founder tiers include the roadmap for advanced model and voice configuration, including
            supported personal reasoning models and voice providers such as GPT-5.4-class models,
            Gemini-class models, and ElevenLabs where available.
          </p>
        </article>
      </section>

      <section className="kickstarter-section">
        <div className="section-heading">
          <h2>Reward tiers</h2>
          <p className="subtle-note">Digital rewards only. No shipping risk.</p>
        </div>
        <div className="kickstarter-rewards">
          {rewardTiers.map((tier) => (
            <article className={tier.featured ? 'reward-card reward-card--featured' : 'reward-card'} key={tier.name}>
              {tier.featured ? <span className="pill pill--accent">Recommended</span> : null}
              <strong>{tier.price}</strong>
              <h3>{tier.name}</h3>
              <p>{tier.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="kickstarter-grid">
        <article className="kickstarter-card">
          <p className="eyebrow">Why Kickstarter</p>
          <h2>Fund the expensive parts of realtime play.</h2>
          <p>
            The campaign funds voice/runtime costs, rulebook ingestion scale, Android voice
            reliability, founder onboarding, and real table testing with backers.
          </p>
        </article>

        <article className="kickstarter-card">
          <p className="eyebrow">Delivery</p>
          <h2>Access within 30 days after funds clear.</h2>
          <p>
            Founder access is delivered as a web app account and quota setup. Backers receive weekly
            progress updates until all digital rewards are fulfilled.
          </p>
        </article>
      </section>

      <section className="kickstarter-section">
        <div className="section-heading">
          <h2>Roadmap</h2>
          <p className="subtle-note">The target plan for funded Founder Access.</p>
        </div>
        <div className="kickstarter-roadmap">
          {roadmap.map(([time, detail]) => (
            <div key={time}>
              <span>{time}</span>
              <p>{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="kickstarter-card kickstarter-card--center">
        <p className="eyebrow">Ready To Help?</p>
        <h2>Follow the prelaunch page, then bring one real table.</h2>
        <p>
          The strongest backers are people who will test GameMaster with friends and tell us where
          the shared-mic experience needs to become sharper.
        </p>
        {hasKickstarterUrl ? (
          <a className="button button--primary button--hero" href={kickstarterUrl}>
            Notify me on Kickstarter
          </a>
        ) : (
          <div className="kickstarter-card kickstarter-card--form">
            <h2>Join the backup list</h2>
            <p>Get the Kickstarter link when the prelaunch page is approved.</p>
            <PrelaunchLeadForm />
          </div>
        )}
      </section>
    </main>
  )
}
