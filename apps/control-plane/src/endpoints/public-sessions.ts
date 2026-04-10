import type { Endpoint } from 'payload'

import { findJoinableSessionsForPlayer, loadAuthenticatedPlayer } from '@/lib/player-access'
import { readPlayerSessionFromHeaders } from '@/lib/player-auth'

export const publicSessionsEndpoint: Endpoint = {
  handler: async (req) => {
    const authSession = readPlayerSessionFromHeaders(req.headers)
    const player = await loadAuthenticatedPlayer(req.payload, authSession)

    const sessions = player
      ? await findJoinableSessionsForPlayer(req.payload, player, 24)
      : (
          await req.payload.find({
            collection: 'game-sessions',
            depth: 1,
            limit: 12,
            pagination: false,
            where: {
              and: [
                {
                  allowGuests: {
                    equals: true,
                  },
                },
                {
                  publicJoinEnabled: {
                    equals: true,
                  },
                },
                {
                  status: {
                    in: ['scheduled', 'live'],
                  },
                },
              ],
            },
          })
        ).docs
          .map((session) => ({
            activeDocuments: Array.isArray(session.activeDocuments) ? session.activeDocuments : null,
            allowGuests: session.allowGuests,
            id: session.id,
            publicSummary: session.publicSummary,
            roomName: session.roomName,
            ruleset: session.ruleset,
            scheduledFor: session.scheduledFor,
            slug: session.slug,
            status: session.status,
            title: session.title,
            welcomeText: session.welcomeText,
          }))

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
