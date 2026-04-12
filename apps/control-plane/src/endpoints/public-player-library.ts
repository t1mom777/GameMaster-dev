import path from 'path'
import type { Endpoint, PayloadRequest } from 'payload'
import { z } from 'zod'

import {
  ensurePlayerGameSession,
  isPlayerActive,
  listPlayerLibrary,
  loadAuthenticatedPlayer,
  normalizeCollectionId,
  relationshipId,
  syncPlayerPrimaryRulebookPointer,
  type LibraryDocumentRecord,
} from '@/lib/player-access'
import { readPlayerSessionFromHeaders } from '@/lib/player-auth'
import { toSlug } from '@/lib/slug'
import { ingestDocument, markDocumentIndexing, markDocumentIngestError } from '@/lib/document-ingest'

const libraryTitleSchema = z.string().trim().min(2).max(120)
const DEFAULT_LIBRARY_UPLOAD_MAX_MB = 100
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.txt', '.md'])
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'text/plain', 'text/markdown'])

const updateLibrarySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('make-primary'),
    documentId: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal('rename'),
    documentId: z.string().trim().min(1),
    title: libraryTitleSchema,
  }),
  z.object({
    action: z.literal('toggle-active'),
    documentId: z.string().trim().min(1),
    isActive: z.boolean(),
  }),
])

const deleteLibrarySchema = z.object({
  documentId: z.string().trim().min(1),
})

type AuthorizedPlayerContext =
  | {
      player: NonNullable<Awaited<ReturnType<typeof loadAuthenticatedPlayer>>>
    }
  | {
      response: Response
    }

type PayloadUploadFile = {
  data: Buffer
  mimetype: string
  name: string
  size: number
}

function libraryResponse(library: LibraryDocumentRecord[]) {
  const primary = library.find((entry) => entry.isPrimary) || null

  return {
    books: library.map((book) => ({
      filename: book.filename || '',
      id: String(book.id),
      ingestError: book.ingestError || '',
      isActive: book.isActive,
      isPrimary: book.isPrimary,
      kind: book.kind,
      lastIngestedAt: book.lastIngestedAt || null,
      status: book.status || 'uploaded',
      title: book.title,
      updatedAt: book.updatedAt || null,
    })),
    primaryBookId: primary ? String(primary.id) : null,
    supportingCount: library.filter((entry) => !entry.isPrimary).length,
  }
}

async function resolveAuthorizedPlayerContext(req: PayloadRequest): Promise<AuthorizedPlayerContext> {
  const authSession = readPlayerSessionFromHeaders(req.headers)
  if (!authSession) {
    return {
      response: Response.json(
        {
          error: 'player_sign_in_required',
          message: 'Sign in with Google before managing your game library.',
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
          message: 'This player account cannot manage a game library right now.',
        },
        { status: 403 },
      ),
    }
  }

  return { player }
}

function fileBaseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
}

function getLibraryUploadLimitBytes(): number {
  const configuredLimit = Number(process.env.GM_LIBRARY_UPLOAD_MAX_MB)
  const maxMb = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : DEFAULT_LIBRARY_UPLOAD_MAX_MB
  return Math.round(maxMb * 1024 * 1024)
}

function getLibraryUploadLimitLabel(): string {
  const configuredLimit = Number(process.env.GM_LIBRARY_UPLOAD_MAX_MB)
  const maxMb = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : DEFAULT_LIBRARY_UPLOAD_MAX_MB
  return Number.isInteger(maxMb) ? `${maxMb} MB` : `${maxMb.toFixed(1)} MB`
}

function validateLibraryFile(file: File): { extension: string; mimetype: string } {
  const extension = path.extname(file.name || '').toLowerCase()
  const mimetype = file.type || (extension === '.pdf' ? 'application/pdf' : 'text/plain')

  if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_TYPES.has(mimetype)) {
    throw new Error('Upload a PDF, Markdown, or plain text book.')
  }

  if (file.size < 1 || file.size > getLibraryUploadLimitBytes()) {
    throw new Error(`Library uploads must be smaller than ${getLibraryUploadLimitLabel()}.`)
  }

  return { extension, mimetype }
}

async function toPayloadUploadFile(file: File, mimetype: string): Promise<PayloadUploadFile> {
  const data = Buffer.from(await file.arrayBuffer())

  return {
    data,
    mimetype,
    name: file.name || 'player-book',
    size: data.byteLength,
  }
}

function libraryErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: unknown }).data as
      | {
          errors?: Array<{ message?: string }>
          message?: string
        }
      | undefined

    const firstFieldError = data?.errors?.find((entry) => typeof entry.message === 'string')?.message
    if (firstFieldError) {
      return firstFieldError
    }

    if (typeof data?.message === 'string' && data.message.trim()) {
      return data.message
    }
  }

  return fallback
}

function generatePlayerDocumentSlug(playerId: string | number, title: string): string {
  const base = toSlug(title, 'player-book')
  return toSlug(`player-${String(playerId)}-${base}-${Date.now().toString(36)}`)
}

async function loadOwnedDocument(
  req: PayloadRequest,
  playerId: string | number,
  documentId: string,
): Promise<LibraryDocumentRecord | null> {
  try {
    const document = await req.payload.findByID({
      collection: 'documents',
      depth: 0,
      id: normalizeCollectionId(documentId),
      overrideAccess: true,
    })

    const library = await listPlayerLibrary(req.payload, {
      displayName: '',
      id: playerId,
      personalRulebookId: null,
    })

    return library.find((entry) => String(entry.id) === String(document.id)) || null
  } catch {
    return null
  }
}

async function demoteOtherPrimaryBooks(
  req: PayloadRequest,
  playerId: string | number,
  keepId: string,
): Promise<void> {
  const library = await listPlayerLibrary(req.payload, {
    displayName: '',
    id: playerId,
    personalRulebookId: null,
  })

  for (const book of library) {
    if (String(book.id) === keepId || !book.isPrimary) {
      continue
    }

    await req.payload.update({
      collection: 'documents',
      data: {
        isPrimary: false,
        kind: 'supporting-book',
      },
      id: normalizeCollectionId(book.id),
      overrideAccess: true,
    } as never)
  }
}

async function promoteFallbackPrimary(
  req: PayloadRequest,
  playerId: string | number,
): Promise<void> {
  const library = await listPlayerLibrary(req.payload, {
    displayName: '',
    id: playerId,
    personalRulebookId: null,
  })

  if (library.some((entry) => entry.isPrimary)) {
    return
  }

  const fallback = library.find((entry) => entry.isActive) || library[0]
  if (!fallback) {
    return
  }

  await req.payload.update({
    collection: 'documents',
    data: {
      isActive: true,
      isPrimary: true,
      kind: 'primary-rulebook',
    },
    id: normalizeCollectionId(fallback.id),
    overrideAccess: true,
  } as never)
}

async function detachDocumentFromSessions(req: PayloadRequest, documentId: string): Promise<void> {
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

async function refreshPlayerGameContext(req: PayloadRequest, player: NonNullable<Awaited<ReturnType<typeof loadAuthenticatedPlayer>>>) {
  const library = await listPlayerLibrary(req.payload, player)
  await syncPlayerPrimaryRulebookPointer(req.payload, player, library)
  await ensurePlayerGameSession(req.payload, player)
  return libraryResponse(await listPlayerLibrary(req.payload, player))
}

async function syncSavedPlayerDocument(req: PayloadRequest, documentId: number | string): Promise<void> {
  try {
    await markDocumentIndexing(req.payload, documentId, req)

    const savedDocument = await req.payload.findByID({
      collection: 'documents',
      id: normalizeCollectionId(documentId),
      overrideAccess: true,
      req,
    } as never)

    await ingestDocument(
      req.payload,
      savedDocument as {
        filename?: string | null
        id: number | string
        isActive?: boolean | null
        isPrimary?: boolean | null
        kind?: string | null
        ruleset?: { id?: string | number } | string | number | null
        session?: { id?: string | number } | string | number | null
        title?: string | null
      },
      req,
    )
  } catch (error) {
    await markDocumentIngestError(
      req.payload,
      documentId,
      libraryErrorMessage(error, 'Unable to index this book right now.'),
      req,
    )
  }
}

export const publicPlayerLibraryGetEndpoint: Endpoint = {
  path: '/gm/public/player-library',
  method: 'get',
  handler: async (req) => {
    const context = await resolveAuthorizedPlayerContext(req)
    if ('response' in context) {
      return context.response
    }

    const library = await listPlayerLibrary(req.payload, context.player)
    return Response.json(libraryResponse(library))
  },
}

export const publicPlayerLibrarySaveEndpoint: Endpoint = {
  path: '/gm/public/player-library',
  method: 'post',
  handler: async (req) => {
    const context = await resolveAuthorizedPlayerContext(req)
    if ('response' in context) {
      return context.response
    }

    const formData = req.formData ? await req.formData() : new FormData()
    const file = formData.get('file')
    const rawTitle = formData.get('title')
    const rawRole = typeof formData.get('role') === 'string' ? String(formData.get('role')) : ''
    const replaceDocumentId =
      typeof formData.get('documentId') === 'string' ? String(formData.get('documentId')).trim() : ''

    if (!(file instanceof File)) {
      return Response.json(
        {
          error: 'library_file_required',
          message: 'Choose a file to add to your game library.',
        },
        { status: 400 },
      )
    }

    const currentLibrary = await listPlayerLibrary(req.payload, context.player)
    const existingPrimary = currentLibrary.find((entry) => entry.isPrimary) || null
    const replacement = replaceDocumentId
      ? await loadOwnedDocument(req, context.player.id, replaceDocumentId)
      : null

    if (replaceDocumentId && !replacement) {
      return Response.json(
        {
          error: 'library_document_not_found',
          message: 'That library item could not be found for this player.',
        },
        { status: 404 },
      )
    }

    const { mimetype } = validateLibraryFile(file)
    const requestedTitle =
      typeof rawTitle === 'string' && rawTitle.trim()
        ? libraryTitleSchema.parse(rawTitle)
        : fileBaseName(file.name || 'Game book')

    const requestedRole =
      rawRole === 'primary-rulebook' || rawRole === 'supporting-book' ? rawRole : undefined
    const shouldBePrimary =
      requestedRole === 'primary-rulebook' ||
      replacement?.isPrimary === true ||
      (!existingPrimary && currentLibrary.length === 0)
    try {
      const payloadFile = await toPayloadUploadFile(file, mimetype)
      const nextData = {
        isActive: replacement?.isActive ?? true,
        isPrimary: shouldBePrimary,
        kind: shouldBePrimary ? ('primary-rulebook' as const) : ('supporting-book' as const),
        ownerPlayer: context.player.id,
        ruleset: null,
        session: null,
        status: 'uploaded' as const,
        title: requestedTitle,
      }

      const saved =
        replacement
          ? await req.payload.update({
              collection: 'documents',
              context: {
                skipDocumentSync: true,
              },
              data: nextData,
              file: payloadFile,
              id: normalizeCollectionId(replacement.id),
              overrideAccess: true,
              req,
            } as never)
          : await req.payload.create({
              collection: 'documents',
              context: {
                skipDocumentSync: true,
              },
              data: {
                ...nextData,
                slug: generatePlayerDocumentSlug(context.player.id, requestedTitle),
              },
              file: payloadFile,
              overrideAccess: true,
              req,
            } as never)

      const savedId = String((saved as { id: number | string }).id)

      if (shouldBePrimary) {
        await demoteOtherPrimaryBooks(req, context.player.id, savedId)
      }

      await syncSavedPlayerDocument(req, savedId)

      return Response.json(await refreshPlayerGameContext(req, context.player))
    } catch (error) {
      return Response.json(
        {
          error: 'player_library_save_failed',
          message: libraryErrorMessage(error, 'Unable to save this book right now.'),
        },
        { status: 500 },
      )
    }
  },
}

export const publicPlayerLibraryUpdateEndpoint: Endpoint = {
  path: '/gm/public/player-library',
  method: 'patch',
  handler: async (req) => {
    const context = await resolveAuthorizedPlayerContext(req)
    if ('response' in context) {
      return context.response
    }

    const body = req.json ? await req.json() : {}
    const data = updateLibrarySchema.parse(body)
    const document = await loadOwnedDocument(req, context.player.id, data.documentId)

    if (!document) {
      return Response.json(
        {
          error: 'library_document_not_found',
          message: 'That library item could not be found for this player.',
        },
        { status: 404 },
      )
    }

    if (data.action === 'make-primary') {
      await req.payload.update({
        collection: 'documents',
        data: {
          isActive: true,
          isPrimary: true,
          kind: 'primary-rulebook',
        },
        id: normalizeCollectionId(document.id),
        overrideAccess: true,
      } as never)

      await demoteOtherPrimaryBooks(req, context.player.id, String(document.id))
    }

    if (data.action === 'rename') {
      await req.payload.update({
        collection: 'documents',
        data: {
          title: data.title,
        },
        id: normalizeCollectionId(document.id),
        overrideAccess: true,
      } as never)
    }

    if (data.action === 'toggle-active') {
      if (document.isPrimary && !data.isActive) {
        return Response.json(
          {
            error: 'primary_book_must_remain_active',
            message: 'Choose another primary rulebook before disabling this one.',
          },
          { status: 400 },
        )
      }

      await req.payload.update({
        collection: 'documents',
        data: {
          isActive: data.isActive,
        },
        id: normalizeCollectionId(document.id),
        overrideAccess: true,
      } as never)
    }

    return Response.json(await refreshPlayerGameContext(req, context.player))
  },
}

export const publicPlayerLibraryDeleteEndpoint: Endpoint = {
  path: '/gm/public/player-library',
  method: 'delete',
  handler: async (req) => {
    const context = await resolveAuthorizedPlayerContext(req)
    if ('response' in context) {
      return context.response
    }

    const body = req.json ? await req.json() : {}
    const data = deleteLibrarySchema.parse(body)
    const document = await loadOwnedDocument(req, context.player.id, data.documentId)

    if (!document) {
      return Response.json(
        {
          error: 'library_document_not_found',
          message: 'That library item could not be found for this player.',
        },
        { status: 404 },
      )
    }

    await detachDocumentFromSessions(req, String(document.id))
    await req.payload.delete({
      collection: 'documents',
      id: normalizeCollectionId(document.id),
      overrideAccess: true,
    } as never)

    if (document.isPrimary) {
      await promoteFallbackPrimary(req, context.player.id)
    }

    return Response.json(await refreshPlayerGameContext(req, context.player))
  },
}
