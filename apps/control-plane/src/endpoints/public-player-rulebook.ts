import path from 'path'
import type { Endpoint, PayloadRequest } from 'payload'
import { z } from 'zod'

import {
  isPlayerActive,
  loadAuthenticatedPlayer,
  loadPlayerRulebook,
  relationshipId,
} from '@/lib/player-access'
import { readPlayerSessionFromHeaders } from '@/lib/player-auth'
import { toSlug } from '@/lib/slug'

const rulebookTitleSchema = z.string().trim().min(2).max(120)
const MAX_RULEBOOK_BYTES = 25 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.txt', '.md'])
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'text/plain', 'text/markdown'])

type AuthorizedPlayerContext =
  | {
      player: NonNullable<Awaited<ReturnType<typeof loadAuthenticatedPlayer>>>
    }
  | {
      response: Response
    }

function rulebookResponse(rulebook: Awaited<ReturnType<typeof loadPlayerRulebook>>) {
  if (!rulebook) {
    return {
      rulebook: null,
    }
  }

  return {
    rulebook: {
      filename: rulebook.filename || '',
      id: String(rulebook.id),
      ingestError: rulebook.ingestError || '',
      lastIngestedAt: rulebook.lastIngestedAt || null,
      status: rulebook.status || 'uploaded',
      title: rulebook.title,
      updatedAt: rulebook.updatedAt || null,
    },
  }
}

async function resolveAuthorizedPlayerContext(req: PayloadRequest): Promise<AuthorizedPlayerContext> {
  const authSession = readPlayerSessionFromHeaders(req.headers)
  if (!authSession) {
    return {
      response: Response.json(
        {
          error: 'player_sign_in_required',
          message: 'Sign in with Google before managing your rulebook.',
        },
        { status: 401 },
      ),
    }
  }

  const player = await loadAuthenticatedPlayer(req.payload, authSession)
  if (!player || !isPlayerActive(player)) {
    return {
      response: Response.json(
        {
          error: 'player_access_denied',
          message: 'This player account cannot manage room access right now.',
        },
        { status: 403 },
      ),
    }
  }

  return { player }
}

function toCollectionId(input: unknown): number | string | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const candidate = input as { id?: unknown }
  if (typeof candidate.id === 'number' || typeof candidate.id === 'string') {
    return candidate.id
  }

  return null
}

function fileBaseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
}

function validateRulebookFile(file: File): { extension: string; mimetype: string } {
  const extension = path.extname(file.name || '').toLowerCase()
  const mimetype = file.type || (extension === '.pdf' ? 'application/pdf' : 'text/plain')

  if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_TYPES.has(mimetype)) {
    throw new Error('Upload a PDF, Markdown, or plain text rulebook.')
  }

  if (file.size < 1 || file.size > MAX_RULEBOOK_BYTES) {
    throw new Error('Rulebook uploads must be smaller than 25 MB.')
  }

  return { extension, mimetype }
}

async function detachRulebookFromSessions(req: PayloadRequest, documentId: string): Promise<void> {
  const sessions = await req.payload.find({
    collection: 'game-sessions',
    depth: 0,
    limit: 100,
    overrideAccess: true,
    pagination: false,
  })

  for (const session of sessions.docs) {
    const activeDocumentIds = (Array.isArray(session.activeDocuments) ? session.activeDocuments : [])
      .map((entry) => relationshipId(entry as { id?: number | string } | number | string | null))
      .filter((entry): entry is string => Boolean(entry))

    if (!activeDocumentIds.includes(documentId)) {
      continue
    }

    await req.payload.update({
      collection: 'game-sessions',
      data: {
        activeDocuments: activeDocumentIds.filter((entry) => entry !== documentId),
      },
      id: session.id,
      overrideAccess: true,
    } as never)
  }
}

export const publicPlayerRulebookGetEndpoint: Endpoint = {
  handler: async (req) => {
    const context = await resolveAuthorizedPlayerContext(req)
    if ('response' in context) {
      return context.response
    }

    const rulebook = await loadPlayerRulebook(req.payload, context.player)
    return Response.json(rulebookResponse(rulebook))
  },
  method: 'get',
  path: '/gm/public/player-rulebook',
}

export const publicPlayerRulebookSaveEndpoint: Endpoint = {
  handler: async (req) => {
    const context = await resolveAuthorizedPlayerContext(req)
    if ('response' in context) {
      return context.response
    }

    const formData = req.formData ? await req.formData() : new FormData()
    const file = formData.get('file')
    const rawTitle = formData.get('title')

    if (!(file instanceof File)) {
      return Response.json(
        {
          error: 'rulebook_file_required',
          message: 'Choose a rulebook file to upload.',
        },
        { status: 400 },
      )
    }

    const { mimetype } = validateRulebookFile(file)
    const requestedTitle =
      typeof rawTitle === 'string' && rawTitle.trim()
        ? rulebookTitleSchema.parse(rawTitle)
        : fileBaseName(file.name || 'Personal rulebook')

    const existingRulebook = await loadPlayerRulebook(req.payload, context.player)
    const payloadFile = new File([file], file.name, {
      type: mimetype,
    })

    const nextData = {
      isActive: true,
      isPrimary: false,
      kind: 'supporting-book' as const,
      ownerPlayer: context.player.id,
      ruleset: null,
      session: null,
      slug: `player-${toSlug(String(context.player.id), 'player')}-rulebook`,
      status: 'uploaded' as const,
      title: requestedTitle,
    }

    const savedRulebook = existingRulebook
      ? await req.payload.update({
          collection: 'documents',
          data: nextData,
          file: payloadFile,
          id: existingRulebook.id,
          overrideAccess: true,
        } as never)
      : await req.payload.create({
          collection: 'documents',
          data: nextData,
          file: payloadFile,
          overrideAccess: true,
        } as never)
    const savedRulebookId = toCollectionId(savedRulebook)

    if (!savedRulebookId) {
      return Response.json(
        {
          error: 'player_rulebook_save_failed',
          message: 'The rulebook could not be saved.',
        },
        { status: 500 },
      )
    }

    await req.payload.update({
      collection: 'players',
      data: {
        lastSeenAt: new Date().toISOString(),
        personalRulebook: savedRulebookId,
      },
      id: context.player.id,
      overrideAccess: true,
    } as never)

    const refreshed = await loadPlayerRulebook(req.payload, {
      ...context.player,
      personalRulebookId: String(savedRulebookId),
    })

    return Response.json(rulebookResponse(refreshed))
  },
  method: 'post',
  path: '/gm/public/player-rulebook',
}

export const publicPlayerRulebookDeleteEndpoint: Endpoint = {
  handler: async (req) => {
    const context = await resolveAuthorizedPlayerContext(req)
    if ('response' in context) {
      return context.response
    }

    const existingRulebook = await loadPlayerRulebook(req.payload, context.player)
    if (existingRulebook) {
      await detachRulebookFromSessions(req, String(existingRulebook.id))
      await req.payload.delete({
        collection: 'documents',
        id: existingRulebook.id,
        overrideAccess: true,
      })
    }

    await req.payload.update({
      collection: 'players',
      data: {
        personalRulebook: null,
      },
      id: context.player.id,
      overrideAccess: true,
    } as never)

    return Response.json({
      rulebook: null,
    })
  },
  method: 'delete',
  path: '/gm/public/player-rulebook',
}
