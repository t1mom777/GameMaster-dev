import type { Endpoint } from 'payload'

import { hasAdminSession, requireInternalToken } from '@/lib/access'
import { runBootstrap } from '@/lib/bootstrap'

export const internalBootstrapEndpoint: Endpoint = {
  handler: async (req) => {
    if (!hasAdminSession(req)) {
      const denied = requireInternalToken(req)
      if (denied) {
        return denied
      }
    }

    try {
      const summary = await runBootstrap(req.payload)
      return Response.json({
        ok: true,
        ...summary,
      })
    } catch (error) {
      return Response.json(
        {
          error: 'bootstrap_failed',
          message: error instanceof Error ? error.message : 'Unknown bootstrap error',
        },
        { status: 500 },
      )
    }
  },
  method: 'post',
  path: '/gm/internal/bootstrap',
}
