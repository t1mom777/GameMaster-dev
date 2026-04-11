import type { Endpoint } from 'payload'

import { requireAdmin } from '@/lib/access'

function serializeError(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      message: String(error),
      name: 'UnknownError',
    }
  }

  const cause =
    error.cause instanceof Error
      ? {
          message: error.cause.message,
          name: error.cause.name,
          stack: error.cause.stack,
        }
      : undefined

  const data =
    typeof error === 'object' && error !== null && 'data' in error
      ? (error as { data?: unknown }).data
      : undefined

  return {
    cause,
    data,
    message: error.message,
    name: error.name,
    stack: error.stack,
  }
}

export const adminDebugPlayerWriteEndpoint: Endpoint = {
  path: '/gm/internal/debug/player-write',
  method: 'post',
  handler: async (req) => {
    const denied = requireAdmin(req)
    if (denied) {
      return denied
    }

    const random = Math.floor(Math.random() * 10_000_000)

    try {
      const created = await req.payload.create({
        collection: 'players',
        data: {
          authProvider: 'google',
          displayName: `Debug Player ${random}`,
          email: `debug-${random}@example.com`,
          googleSub: `debug-${random}`,
          preferredVoiceMode: 'auto-vad',
        },
        overrideAccess: true,
      } as never)

      await req.payload.delete({
        collection: 'players',
        id: String((created as { id: number | string }).id),
        overrideAccess: true,
      } as never)

      return Response.json({
        ok: true,
      })
    } catch (error) {
      return Response.json(
        {
          error: 'player_write_failed',
          details: serializeError(error),
        },
        { status: 500 },
      )
    }
  },
}
