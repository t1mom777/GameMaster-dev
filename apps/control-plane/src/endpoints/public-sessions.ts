import type { Endpoint } from 'payload'

import {
  findJoinableSessionsForPlayer,
  listPublicSessions,
  loadAuthenticatedPlayer,
} from '@/lib/player-access'
import { readPlayerSessionFromHeaders } from '@/lib/player-auth'

export const publicSessionsEndpoint: Endpoint = {
  handler: async (req) => {
    const authSession = readPlayerSessionFromHeaders(req.headers)
    const player = await loadAuthenticatedPlayer(req.payload, authSession)

    const sessions = player
      ? await findJoinableSessionsForPlayer(req.payload, player, 24)
      : await listPublicSessions(req.payload, 12)

    return Response.json({
      sessions: sessions.map((session) => ({
        id: String(session.id),
        publicSummary: session.publicSummary,
        roomName: session.roomName,
        rulesetTitle:
          session.ruleset && typeof session.ruleset === 'object' && 'title' in session.ruleset
            ? String(session.ruleset.title || '')
            : undefined,
        scheduledFor: session.scheduledFor,
        slug: session.slug,
        title: session.title,
        welcomeText: session.welcomeText,
      })),
    })
  },
  method: 'get',
  path: '/gm/public/sessions',
}
