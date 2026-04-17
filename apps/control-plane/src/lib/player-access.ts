import type { Payload } from 'payload'

import { queueDocumentIngest } from '@/lib/document-ingest'
import type { PlayerAuthSession } from '@/lib/player-auth'
import { toSlug } from '@/lib/slug'

type RelationshipValue =
  | null
  | number
  | string
  | {
      id?: number | string | null
      status?: string | null
    }

export type PlayerRecord = {
  avatarUrl?: string | null
  displayName: string
  email?: string | null
  id: number | string
  personalRulebookId?: string | null
  quotaTier?: string | null
  status?: string | null
}

export type SessionRecord = {
  activeDocuments?: unknown[] | null
  allowGuests?: boolean | null
  allowedPlayers?: RelationshipValue[] | null
  id: number | string
  ownerPlayerId?: string | null
  publicJoinEnabled?: boolean | null
  publicSummary?: string | null
  roomName: string
  ruleset?: unknown
  scheduledFor?: string | null
  slug: string
  status: string
  title: string
  updatedAt?: string | null
  welcomeText?: string | null
}

export type LibraryDocumentRecord = {
  filename?: string | null
  id: number | string
  ingestError?: string | null
  ingestPhase?: string | null
  ingestProgress?: number | null
  isActive: boolean
  isPrimary: boolean
  kind: string
  lastIngestedAt?: string | null
  ownerPlayerId?: string | null
  status?: string | null
  title: string
  updatedAt?: string | null
}

function shouldResumeDocumentIngest(document: LibraryDocumentRecord): boolean {
  if (!document.filename) {
    return false
  }

  return document.status === 'uploaded' || document.status === 'indexing'
}

function normalizeId(input: number | string): string {
  return String(input)
}

export function normalizeCollectionId(input: number | string): number | string {
  if (typeof input === 'number') {
    return input
  }

  return /^\d+$/.test(input) ? Number(input) : input
}

export function relationshipId(input: RelationshipValue): string | null {
  if (typeof input === 'number' || typeof input === 'string') {
    return String(input)
  }

  if (input && typeof input === 'object' && input.id !== null && input.id !== undefined) {
    return String(input.id)
  }

  return null
}

export function isPlayerActive(player: PlayerRecord | null | undefined): boolean {
  return Boolean(player && (player.status === undefined || player.status === null || player.status === 'active'))
}

export function isPlayerOwnedSession(
  session: SessionRecord | null | undefined,
  player: PlayerRecord | null | undefined,
): boolean {
  if (!session || !player) {
    return false
  }

  return session.ownerPlayerId === normalizeId(player.id)
}

export function sessionAllowsPlayer(
  session: SessionRecord | null | undefined,
  player: PlayerRecord | null | undefined,
): boolean {
  if (!session || !player) {
    return false
  }

  if (!isPlayerActive(player)) {
    return false
  }

  if (isPlayerOwnedSession(session, player)) {
    return ['scheduled', 'live', 'ended'].includes(session.status)
  }

  if (!session.publicJoinEnabled) {
    return false
  }

  if (!['scheduled', 'live'].includes(session.status)) {
    return false
  }

  if (session.allowGuests !== false) {
    return true
  }

  const allowedPlayerIds = (session.allowedPlayers || [])
    .map((entry) => relationshipId(entry))
    .filter((entry): entry is string => Boolean(entry))

  return allowedPlayerIds.includes(normalizeId(player.id))
}

function toPlayerRecord(input: unknown): PlayerRecord | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const candidate = input as Record<string, unknown>
  if ((typeof candidate.id !== 'number' && typeof candidate.id !== 'string') || typeof candidate.displayName !== 'string') {
    return null
  }

  return {
    avatarUrl: typeof candidate.avatarUrl === 'string' ? candidate.avatarUrl : null,
    displayName: candidate.displayName,
    email: typeof candidate.email === 'string' ? candidate.email : null,
    id: candidate.id as number | string,
    personalRulebookId: relationshipId((candidate.personalRulebook as RelationshipValue | undefined) || null),
    quotaTier: typeof candidate.quotaTier === 'string' ? candidate.quotaTier : null,
    status: typeof candidate.status === 'string' ? candidate.status : null,
  }
}

function toSessionRecord(input: unknown): SessionRecord | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const candidate = input as Record<string, unknown>

  if (
    (typeof candidate.id !== 'number' && typeof candidate.id !== 'string') ||
    typeof candidate.slug !== 'string' ||
    typeof candidate.title !== 'string' ||
    typeof candidate.roomName !== 'string' ||
    typeof candidate.status !== 'string'
  ) {
    return null
  }

  return {
    activeDocuments: Array.isArray(candidate.activeDocuments) ? candidate.activeDocuments : null,
    allowGuests: typeof candidate.allowGuests === 'boolean' ? candidate.allowGuests : null,
    allowedPlayers: Array.isArray(candidate.allowedPlayers)
      ? (candidate.allowedPlayers as RelationshipValue[])
      : null,
    id: candidate.id as number | string,
    ownerPlayerId: relationshipId((candidate.ownerPlayer as RelationshipValue | undefined) || null),
    publicJoinEnabled:
      typeof candidate.publicJoinEnabled === 'boolean' ? candidate.publicJoinEnabled : null,
    publicSummary: typeof candidate.publicSummary === 'string' ? candidate.publicSummary : null,
    roomName: candidate.roomName,
    ruleset: candidate.ruleset,
    scheduledFor: typeof candidate.scheduledFor === 'string' ? candidate.scheduledFor : null,
    slug: candidate.slug,
    status: candidate.status,
    title: candidate.title,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null,
    welcomeText: typeof candidate.welcomeText === 'string' ? candidate.welcomeText : null,
  }
}

function toLibraryDocumentRecord(input: unknown): LibraryDocumentRecord | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const candidate = input as Record<string, unknown>
  if (
    (typeof candidate.id !== 'number' && typeof candidate.id !== 'string') ||
    typeof candidate.title !== 'string' ||
    typeof candidate.kind !== 'string'
  ) {
    return null
  }

  return {
    filename: typeof candidate.filename === 'string' ? candidate.filename : null,
    id: candidate.id as number | string,
    ingestError: typeof candidate.ingestError === 'string' ? candidate.ingestError : null,
    ingestPhase: typeof candidate.ingestPhase === 'string' ? candidate.ingestPhase : null,
    ingestProgress:
      typeof candidate.ingestProgress === 'number' && Number.isFinite(candidate.ingestProgress)
        ? candidate.ingestProgress
        : null,
    isActive: candidate.isActive !== false,
    isPrimary: candidate.isPrimary === true || candidate.kind === 'primary-rulebook',
    kind: candidate.kind,
    lastIngestedAt: typeof candidate.lastIngestedAt === 'string' ? candidate.lastIngestedAt : null,
    ownerPlayerId: relationshipId((candidate.ownerPlayer as RelationshipValue | undefined) || null),
    status: typeof candidate.status === 'string' ? candidate.status : null,
    title: candidate.title,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null,
  }
}

function buildPlayerGameSlug(player: PlayerRecord): string {
  return toSlug(`player-${normalizeId(player.id)}-game`)
}

function buildPlayerRoomName(player: PlayerRecord): string {
  return toSlug(`player-${normalizeId(player.id)}-voice`)
}

function buildPlayerGameTitle(player: PlayerRecord): string {
  return `${player.displayName}'s Game`
}

function buildPlayerGameSummary(primaryBook: LibraryDocumentRecord | null, supportingCount: number): string {
  if (primaryBook) {
    return supportingCount > 0
      ? `Continue your voice-first campaign using ${primaryBook.title} and ${supportingCount} supporting book${supportingCount === 1 ? '' : 's'}.`
      : `Continue your voice-first campaign with ${primaryBook.title} as the primary rulebook.`
  }

  return 'Upload a primary rulebook and any supporting books, then continue your VAD game from here.'
}

function buildPlayerWelcomeText(primaryBook: LibraryDocumentRecord | null, supportingCount: number): string {
  if (primaryBook) {
    return supportingCount > 0
      ? `Open with the current scene, ground rulings in ${primaryBook.title}, and use the active supporting books when needed.`
      : `Open with the current scene and keep the game grounded in ${primaryBook.title}.`
  }

  return 'Open the voice session, establish the scene, and ask the player to upload a primary rulebook to improve rulings and recall.'
}

function documentIds(records: LibraryDocumentRecord[]): Array<number | string> {
  return records.filter((record) => record.isActive).map((record) => record.id)
}

function sameIdSet(left: Array<number | string>, right: Array<number | string>): boolean {
  if (left.length !== right.length) {
    return false
  }

  const leftSet = new Set(left.map((entry) => normalizeId(entry)))
  return right.every((entry) => leftSet.has(normalizeId(entry)))
}

export async function loadAuthenticatedPlayer(
  payload: Payload,
  authSession: PlayerAuthSession | null | undefined,
): Promise<PlayerRecord | null> {
  if (!authSession?.playerId) {
    return null
  }

  try {
    const player = await payload.findByID({
      collection: 'players',
      depth: 0,
      id: normalizeCollectionId(authSession.playerId),
      overrideAccess: true,
    })

    const normalized = toPlayerRecord(player)
    if (normalized) {
      return normalized
    }
  } catch {
    // Fall back to a Google subject lookup if the cookie outlived the record id.
  }

  const result = await payload.find({
    collection: 'players',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: {
      googleSub: {
        equals: authSession.googleSub,
      },
    },
  })

  return toPlayerRecord(result.docs[0])
}

export async function listPlayerLibrary(
  payload: Payload,
  player: PlayerRecord,
): Promise<LibraryDocumentRecord[]> {
  const result = await payload.find({
    collection: 'documents',
    depth: 0,
    limit: 100,
    overrideAccess: true,
    pagination: false,
    sort: '-updatedAt',
    where: {
      ownerPlayer: {
        equals: player.id,
      },
    },
  })

  const library = result.docs
    .map((doc) => toLibraryDocumentRecord(doc))
    .filter((doc): doc is LibraryDocumentRecord => Boolean(doc))

  for (const document of library) {
    if (!shouldResumeDocumentIngest(document)) {
      continue
    }

    queueDocumentIngest(payload, document.id, {
      alreadyMarkedIndexing: document.status === 'indexing',
    })

    if (document.status !== 'indexing') {
      document.status = 'indexing'
      document.ingestError = ''
    }
  }

  return library
    .sort((left, right) => {
      if (left.isPrimary !== right.isPrimary) {
        return left.isPrimary ? -1 : 1
      }

      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1
      }

      const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0
      const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0
      return rightTime - leftTime
    })
}

export async function loadPlayerRulebook(
  payload: Payload,
  player: PlayerRecord,
): Promise<LibraryDocumentRecord | null> {
  const library = await listPlayerLibrary(payload, player)
  return library.find((entry) => entry.isPrimary) || library[0] || null
}

export async function syncPlayerPrimaryRulebookPointer(
  payload: Payload,
  player: PlayerRecord,
  library?: LibraryDocumentRecord[],
): Promise<void> {
  const currentLibrary = library || (await listPlayerLibrary(payload, player))
  const primary = currentLibrary.find((entry) => entry.isPrimary) || null
  const nextPrimaryId = primary ? normalizeId(primary.id) : null

  if ((player.personalRulebookId || null) === nextPrimaryId) {
    return
  }

  await payload.update({
    collection: 'players',
    data: {
      personalRulebook: nextPrimaryId ? normalizeCollectionId(nextPrimaryId) : null,
    },
    id: normalizeCollectionId(player.id),
    overrideAccess: true,
  } as never)
}

export async function ensurePlayerGameSession(
  payload: Payload,
  player: PlayerRecord,
): Promise<SessionRecord> {
  const library = await listPlayerLibrary(payload, player)
  const primaryBook = library.find((entry) => entry.isPrimary) || null
  const activeDocumentIds = documentIds(library)
  const supportingCount = library.filter((entry) => !entry.isPrimary && entry.isActive).length
  const ownerSession = await payload.find({
    collection: 'game-sessions',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    sort: '-updatedAt',
    where: {
      ownerPlayer: {
        equals: player.id,
      },
    },
  })

  const nextData = {
    activeDocuments: activeDocumentIds,
    allowGuests: false,
    allowedPlayers: [player.id],
    ownerPlayer: player.id,
    publicJoinEnabled: false,
    publicSummary: buildPlayerGameSummary(primaryBook, supportingCount),
    roomName: buildPlayerRoomName(player),
    scheduledFor: new Date().toISOString(),
    status: ownerSession.docs[0]?.status === 'live' ? 'live' : 'scheduled',
    title: buildPlayerGameTitle(player),
    welcomeText: buildPlayerWelcomeText(primaryBook, supportingCount),
  }

  const existing = toSessionRecord(ownerSession.docs[0])

  if (existing) {
    const currentDocuments = (existing.activeDocuments || [])
      .map((entry) => relationshipId(entry as RelationshipValue))
      .filter((entry): entry is string => Boolean(entry))
      .map((entry) => normalizeCollectionId(entry))

    const expectedDocuments = activeDocumentIds.map((entry) => normalizeCollectionId(entry))
    const shouldSyncDocuments = !sameIdSet(currentDocuments, expectedDocuments)
    const shouldUpdateCopy =
      existing.title !== nextData.title ||
      existing.publicSummary !== nextData.publicSummary ||
      existing.welcomeText !== nextData.welcomeText ||
      existing.roomName !== nextData.roomName ||
      existing.allowGuests !== nextData.allowGuests ||
      existing.publicJoinEnabled !== nextData.publicJoinEnabled ||
      existing.ownerPlayerId !== normalizeId(player.id)

    if (shouldSyncDocuments || shouldUpdateCopy) {
      const updated = await payload.update({
        collection: 'game-sessions',
        data: nextData,
        id: normalizeCollectionId(existing.id),
        overrideAccess: true,
      } as never)

      const normalized = toSessionRecord(updated)
      if (normalized) {
        return normalized
      }
    }

    return existing
  }

  const created = await payload.create({
    collection: 'game-sessions',
    data: {
      slug: buildPlayerGameSlug(player),
      ...nextData,
    },
    overrideAccess: true,
  } as never)

  const normalized = toSessionRecord(created)
  if (!normalized) {
    throw new Error('The player game session could not be created.')
  }

  return normalized
}

export async function findJoinableSessionsForPlayer(
  payload: Payload,
  player: PlayerRecord,
  limit = 24,
): Promise<SessionRecord[]> {
  const result = await payload.find({
    collection: 'game-sessions',
    depth: 0,
    limit,
    overrideAccess: true,
    pagination: false,
    where: {
      and: [
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

  return result.docs
    .map((doc) => toSessionRecord(doc))
    .filter((doc): doc is SessionRecord => Boolean(doc))
    .filter((doc) => sessionAllowsPlayer(doc, player))
}

export function isSessionPubliclyListed(session: SessionRecord | null | undefined): boolean {
  if (!session) {
    return false
  }

  if (!session.publicJoinEnabled) {
    return false
  }

  if (session.allowGuests === false) {
    return false
  }

  return ['scheduled', 'live'].includes(session.status)
}

export async function listPublicSessions(payload: Payload, limit = 12): Promise<SessionRecord[]> {
  const result = await payload.find({
    collection: 'game-sessions',
    depth: 0,
    limit,
    overrideAccess: true,
    pagination: false,
    where: {
      and: [
        {
          publicJoinEnabled: {
            equals: true,
          },
        },
        {
          allowGuests: {
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

  return result.docs
    .map((doc) => toSessionRecord(doc))
    .filter((doc): doc is SessionRecord => Boolean(doc))
    .filter((doc) => isSessionPubliclyListed(doc))
}

export async function loadJoinableSessionBySlug(
  payload: Payload,
  slug: string,
  player: PlayerRecord,
): Promise<SessionRecord | null> {
  const result = await payload.find({
    collection: 'game-sessions',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  const session = toSessionRecord(result.docs[0])
  return sessionAllowsPlayer(session, player) ? session : null
}
