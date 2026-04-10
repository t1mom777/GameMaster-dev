import type { Endpoint } from 'payload'

import { requireInternalToken } from '@/lib/access'
import { listPublicSessions } from '@/lib/player-access'

export const internalDebugPublicSessionsEndpoint: Endpoint = {
  handler: async (req) => {
    const denied = requireInternalToken(req)
    if (denied) {
      return denied
    }

    try {
      const sessions = await listPublicSessions(req.payload, 12)
      return Response.json({
        ok: true,
        sessionCount: sessions.length,
        sessions,
      })
    } catch (error) {
      if (error instanceof Error) {
        return Response.json(
          {
            error: error.message,
            name: error.name,
            stack: error.stack,
          },
          { status: 500 },
        )
      }

      return Response.json(
        {
          error: 'Unknown error',
          value: String(error),
        },
        { status: 500 },
      )
    }
  },
  method: 'get',
  path: '/gm/internal/debug/public-sessions',
}
