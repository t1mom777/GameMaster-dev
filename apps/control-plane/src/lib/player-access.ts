import type { Payload } from 'payload'

import type { PlayerAuthSession } from '@/lib/player-auth'

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
  publicJoinEnabled?: boolean | null
  publicSummary?: string | null
  roomName: string
  ruleset?: unknown
  scheduledFor?: string | null
  slug: string
  status: string
  title: string
  welcomeText?: string | null
}

export type RulebookRecord = {
  filename?: string | null
  id: number | string
  ingestError?: string | null
  lastIngestedAt?: string | null
  ownerPlayerId?: string | null
  status?: string | null
  title: string
  updatedAt?: string | null
}

function normalizeId(input: number | string): string {
  return String(input)
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
  if (
    typeof candidate.id !== 'number' &&
    typeof candidate.id !== 'string' &&
    candidate.id !== 0
  ) {
    return null
  }

  if (typeof candidate.displayName !== 'string') {
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
    publicJoinEnabled:
      typeof candidate.publicJoinEnabled === 'boolean' ? candidate.publicJoinEnabled : null,
    publicSummary: typeof candidate.publicSummary === 'string' ? candidate.publicSummary : null,
    roomName: candidate.roomName,
    ruleset: candidate.ruleset,
    scheduledFor: typeof candidate.scheduledFor === 'string' ? candidate.scheduledFor : null,
    slug: candidate.slug,
    status: candidate.status,
    title: candidate.title,
    welcomeText: typeof candidate.welcomeText === 'string' ? candidate.welcomeText : null,
  }
}

function toRulebookRecord(input: unknown): RulebookRecord | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const candidate = input as Record<string, unknown>
  if (
    (typeof candidate.id !== 'number' && typeof candidate.id !== 'string') ||
    typeof candidate.title !== 'string'
  ) {
    return null
  }

  return {
    filename: typeof candidate.filename === 'string' ? candidate.filename : null,
    id: candidate.id as number | string,
    ingestError: typeof candidate.ingestError === 'string' ? candidate.ingestError : null,
    lastIngestedAt: typeof candidate.lastIngestedAt === 'string' ? candidate.lastIngestedAt : null,
    ownerPlayerId: relationshipId((candidate.ownerPlayer as RelationshipValue | undefined) || null),
    status: typeof candidate.status === 'string' ? candidate.status : null,
    title: candidate.title,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null,
  }
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
      id: Number.isNaN(Number(authSession.playerId))
        ? authSession.playerId
        : Number(authSession.playerId),
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

export async function findJoinableSessionsForPlayer(
  payload: Payload,
  player: PlayerRecord,
  limit = 24,
): Promise<SessionRecord[]> {
  const result = await payload.find({
    collection: 'game-sessions',
    depth: 1,
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

  return result.docs.map((doc) => toSessionRecord(doc)).filter((doc): doc is SessionRecord => Boolean(doc)).filter((doc) => sessionAllowsPlayer(doc, player))
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
    depth: 1,
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
    depth: 1,
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

export async function loadPlayerRulebook(
  payload: Payload,
  player: PlayerRecord,
): Promise<RulebookRecord | null> {
  if (player.personalRulebookId) {
    try {
      const byId = await payload.findByID({
        collection: 'documents',
        depth: 0,
        id: Number.isNaN(Number(player.personalRulebookId))
          ? player.personalRulebookId
          : Number(player.personalRulebookId),
        overrideAccess: true,
      })

      const normalized = toRulebookRecord(byId)
      if (normalized && (!normalized.ownerPlayerId || normalized.ownerPlayerId === normalizeId(player.id))) {
        return normalized
      }
    } catch {
      // Fall back to the owner lookup below.
    }
  }

  const result = await payload.find({
    collection: 'documents',
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

  return toRulebookRecord(result.docs[0])
}
