import type { Endpoint } from 'payload'

import { requireAdmin } from '@/lib/access'
import {
  ensurePlayerGameSession,
  listPlayerLibrary,
  syncPlayerPrimaryRulebookPointer,
} from '@/lib/player-access'

function serializeError(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      message: String(error),
      name: 'UnknownError',
    }
  }

  return {
    cause:
      error.cause instanceof Error
        ? {
            message: error.cause.message,
            name: error.cause.name,
            stack: error.cause.stack,
          }
        : error.cause,
    message: error.message,
    name: error.name,
    stack: error.stack,
  }
}

export const adminDebugPlayerLibrarySaveEndpoint: Endpoint = {
  path: '/gm/internal/debug/player-library-save',
  method: 'post',
  handler: async (req) => {
    const denied = requireAdmin(req)
    if (denied) {
      return denied
    }

    const suffix = Date.now().toString(36)
    const phases: Array<Record<string, unknown>> = []
    let playerId: number | string | null = null
    let documentId: number | string | null = null
    let sessionId: number | string | null = null

    try {
      const player = (await req.payload.create({
        collection: 'players',
        data: {
          authProvider: 'google',
          displayName: `Library Debug ${suffix}`,
          email: `library-debug-${suffix}@example.com`,
          googleSub: `library-debug-${suffix}`,
          preferredVoiceMode: 'auto-vad',
        },
        overrideAccess: true,
      } as never)) as {
        displayName: string
        email?: string | null
        id: number | string
        quotaTier?: string | null
        status?: string | null
      }

      playerId = player.id
      phases.push({ phase: 'player.create', playerId })

      const fileData = Buffer.from('Core rules\n\nAttack rolls use a d20.', 'utf8')
      const document = (await req.payload.create({
        collection: 'documents',
        data: {
          title: 'Debug Core Book',
          slug: `debug-core-${suffix}`,
          kind: 'primary-rulebook',
          isActive: true,
          isPrimary: true,
          ownerPlayer: player.id,
          ruleset: null,
          session: null,
          status: 'uploaded',
        },
        file: {
          data: fileData,
          mimetype: 'text/plain',
          name: 'debug-core.txt',
          size: fileData.byteLength,
        },
        overrideAccess: true,
      } as never)) as {
        filename?: string | null
        id: number | string
        status?: string | null
      }

      documentId = document.id
      phases.push({
        documentId,
        filename: document.filename,
        phase: 'document.create',
        status: document.status,
      })

      const library = await listPlayerLibrary(req.payload, {
        displayName: player.displayName,
        email: player.email,
        id: player.id,
        personalRulebookId: null,
        quotaTier: player.quotaTier,
        status: player.status,
      })

      phases.push({
        libraryCount: library.length,
        phase: 'library.list',
      })

      await syncPlayerPrimaryRulebookPointer(req.payload, {
        displayName: player.displayName,
        email: player.email,
        id: player.id,
        personalRulebookId: null,
        quotaTier: player.quotaTier,
        status: player.status,
      }, library)

      phases.push({
        phase: 'player.syncPrimary',
      })

      const session = await ensurePlayerGameSession(req.payload, {
        displayName: player.displayName,
        email: player.email,
        id: player.id,
        personalRulebookId: null,
        quotaTier: player.quotaTier,
        status: player.status,
      })

      sessionId = session.id
      phases.push({
        phase: 'session.ensure',
        sessionId,
        sessionSlug: session.slug,
      })

      return Response.json({
        ok: true,
        phases,
      })
    } catch (error) {
      return Response.json(
        {
          error: 'player_library_debug_failed',
          phases,
          details: serializeError(error),
        },
        { status: 500 },
      )
    } finally {
      if (documentId) {
        await req.payload.delete({
          collection: 'documents',
          id: documentId,
          overrideAccess: true,
        } as never).catch(() => null)
      }

      if (sessionId) {
        await req.payload.delete({
          collection: 'game-sessions',
          id: sessionId,
          overrideAccess: true,
        } as never).catch(() => null)
      }

      if (playerId) {
        await req.payload.delete({
          collection: 'players',
          id: playerId,
          overrideAccess: true,
        } as never).catch(() => null)
      }
    }
  },
}
