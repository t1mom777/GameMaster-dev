import type { Endpoint, PayloadRequest } from 'payload'
import { z } from 'zod'

import { loadAuthenticatedPlayer, loadJoinableSessionBySlug } from '@/lib/player-access'
import { readPlayerSessionFromHeaders } from '@/lib/player-auth'

const mappingPayloadSchema = z.object({
  mappedName: z.string().trim().min(1).max(80),
  participantLabel: z.string().trim().min(1).max(80),
  speakingNotes: z.string().trim().max(240).optional(),
  livekitIdentity: z.string().trim().min(1).max(120),
})

const saveMappingsSchema = z.object({
  mappings: z.array(mappingPayloadSchema).min(1).max(12),
  replaceTableRoster: z.boolean().optional(),
  sessionSlug: z.string().trim().min(1),
})

type AuthorizedPlayerContext =
  | {
      player: NonNullable<Awaited<ReturnType<typeof loadAuthenticatedPlayer>>>
      session: NonNullable<Awaited<ReturnType<typeof loadJoinableSessionBySlug>>>
    }
  | {
      response: Response
    }

type MappingRecord = {
  id: number | string
  livekitIdentity: string
  mappedName: string
  participantLabel: string
  speakingNotes?: string
}

function toMappingRecord(input: unknown): MappingRecord | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const candidate = input as Record<string, unknown>
  if (
    (typeof candidate.id !== 'number' && typeof candidate.id !== 'string') ||
    typeof candidate.livekitIdentity !== 'string' ||
    typeof candidate.mappedName !== 'string' ||
    typeof candidate.participantLabel !== 'string'
  ) {
    return null
  }

  return {
    id: candidate.id as number | string,
    livekitIdentity: candidate.livekitIdentity,
    mappedName: candidate.mappedName,
    participantLabel: candidate.participantLabel,
    speakingNotes: typeof candidate.speakingNotes === 'string' ? candidate.speakingNotes : '',
  }
}

async function resolveAuthorizedPlayerContext(
  req: PayloadRequest,
  sessionSlug: string,
): Promise<AuthorizedPlayerContext> {
  const authSession = readPlayerSessionFromHeaders(req.headers)
  if (!authSession) {
    return {
      response: Response.json(
        {
          error: 'player_sign_in_required',
          message: 'Sign in with Google before opening voice play.',
        },
        { status: 401 },
      ),
    }
  }

  const player = await loadAuthenticatedPlayer(req.payload, authSession)
  if (!player || player.status === 'suspended') {
    return {
      response: Response.json(
        {
          error: 'player_access_denied',
          message: 'This player account cannot enter voice play right now.',
        },
        { status: 403 },
      ),
    }
  }

  const session = await loadJoinableSessionBySlug(req.payload, sessionSlug, player)
  if (!session) {
    return {
      response: Response.json(
        {
          error: 'session_access_denied',
          message: 'This game session is not available for the current player.',
        },
        { status: 404 },
      ),
    }
  }

  return { player, session }
}

export const publicPlayerMappingsGetEndpoint: Endpoint = {
  handler: async (req) => {
    const url = new URL(req.url || 'http://gm.local')
    const sessionSlug = url.searchParams.get('sessionSlug')?.trim() || ''
    if (!sessionSlug) {
      return Response.json(
        {
          error: 'session_slug_required',
          message: 'sessionSlug is required.',
        },
        { status: 400 },
      )
    }

    const context = await resolveAuthorizedPlayerContext(req, sessionSlug)
    if ('response' in context) {
      return context.response
    }

    const result = await req.payload.find({
      collection: 'player-mappings',
      depth: 1,
      limit: 24,
      overrideAccess: true,
      pagination: false,
      where: {
        session: {
          equals: context.session.id,
        },
      },
    })

    return Response.json({
      mappings: result.docs.map((mapping) => ({
        id: String(mapping.id),
        isConfirmed: Boolean(mapping.isConfirmed),
        livekitIdentity: mapping.livekitIdentity,
        mappedName: mapping.mappedName,
        participantLabel: mapping.participantLabel,
        speakingNotes: mapping.speakingNotes || '',
      })),
      sessionSlug: context.session.slug,
    })
  },
  method: 'get',
  path: '/gm/public/player-mappings',
}

export const publicPlayerMappingsSaveEndpoint: Endpoint = {
  handler: async (req) => {
    const body = req.json ? await req.json() : {}
    const data = saveMappingsSchema.parse(body)
    const context = await resolveAuthorizedPlayerContext(req, data.sessionSlug)
    if ('response' in context) {
      return context.response
    }

    const savedMappings = []

    for (const entry of data.mappings) {
      const mappingKey = `${context.session.id}:${entry.livekitIdentity}`
      const existing = await req.payload.find({
        collection: 'player-mappings',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        pagination: false,
        where: {
          mappingKey: {
            equals: mappingKey,
          },
        },
      })

      const nextData = {
        confirmedBy: context.player.id,
        isConfirmed: true,
        lastConfirmedAt: new Date().toISOString(),
        livekitIdentity: entry.livekitIdentity,
        mappedName: entry.mappedName,
        mappingKey,
        participantLabel: entry.participantLabel,
        session: context.session.id,
        speakingNotes: entry.speakingNotes || '',
      }

      const saved = toMappingRecord(
        existing.docs[0]
        ? await req.payload.update({
            collection: 'player-mappings',
            data: nextData,
            id: existing.docs[0].id,
            overrideAccess: true,
          } as never)
        : await req.payload.create({
            collection: 'player-mappings',
            data: nextData,
            overrideAccess: true,
          } as never),
      )

      if (!saved) {
        return Response.json(
          {
            error: 'player_mapping_save_failed',
            message: 'The player labels could not be saved.',
          },
          { status: 500 },
        )
      }

      savedMappings.push({
        id: String(saved.id),
        livekitIdentity: saved.livekitIdentity,
        mappedName: saved.mappedName,
        participantLabel: saved.participantLabel,
        speakingNotes: saved.speakingNotes || '',
      })
    }

    if (data.replaceTableRoster) {
      const keepSeatIdentities = new Set(
        data.mappings
          .map((entry) => entry.livekitIdentity)
          .filter((identity) => identity.startsWith('table-seat-')),
      )

      const existingTableMappings = await req.payload.find({
        collection: 'player-mappings',
        depth: 0,
        limit: 24,
        overrideAccess: true,
        pagination: false,
        where: {
          session: {
            equals: context.session.id,
          },
        },
      })

      for (const mapping of existingTableMappings.docs) {
        if (
          typeof mapping.livekitIdentity === 'string' &&
          mapping.livekitIdentity.startsWith('table-seat-') &&
          !keepSeatIdentities.has(mapping.livekitIdentity)
        ) {
          await req.payload.delete({
            collection: 'player-mappings',
            id: mapping.id,
            overrideAccess: true,
          } as never)
        }
      }
    }

    return Response.json({
      mappings: savedMappings,
      sessionSlug: context.session.slug,
    })
  },
  method: 'post',
  path: '/gm/public/player-mappings',
}
