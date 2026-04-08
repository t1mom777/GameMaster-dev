import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { SessionRoom } from '@/components/public/session-room'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export default async function SessionPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const payload = await getPayload({ config })
  const sessions = await payload.find({
    collection: 'game-sessions',
    depth: 1,
    limit: 1,
    where: {
      and: [
        {
          publicJoinEnabled: {
            equals: true,
          },
        },
        {
          slug: {
            equals: slug,
          },
        },
      ],
    },
  })

  const session = sessions.docs[0]
  if (!session) {
    notFound()
  }

  return (
    <main className="shell shell--session">
      <a className="back-link" href="/">
        Back to session list
      </a>
      <section className="session-stage">
        <div className="session-stage__copy">
          <div className="pill pill--accent">{session.status}</div>
          <h1>{session.title}</h1>
          <p>{session.publicSummary || 'Join the table and the GM runtime will take it from there.'}</p>
          <div className="session-stage__details">
            <div>
              <span>Room</span>
              <strong>{session.roomName}</strong>
            </div>
            <div>
              <span>Ruleset</span>
              <strong>
                {typeof session.ruleset === 'object' && session.ruleset?.title
                  ? session.ruleset.title
                  : 'Active campaign sources'}
              </strong>
            </div>
          </div>
          <div className="session-stage__notes">
            <h2>Before you join</h2>
            <ul>
              <li>Pick a player name you want other room members to see.</li>
              <li>Allow microphone access when the browser asks.</li>
              <li>Use the reset control if you want a fresh token or a clean room reconnect.</li>
            </ul>
          </div>
        </div>
        <SessionRoom
          sessionSlug={session.slug}
          title={session.title}
          welcomeText={session.welcomeText || ''}
        />
      </section>
    </main>
  )
}
