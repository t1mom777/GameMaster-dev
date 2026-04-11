import type { Endpoint } from 'payload'
import { z } from 'zod'

import { createPlayerToken, ensureRoom, getLiveKitPublicUrl } from '@/lib/livekit'
import {
  ensurePlayerGameSession,
  listPlayerLibrary,
  loadAuthenticatedPlayer,
  loadJoinableSessionBySlug,
  normalizeCollectionId,
  relationshipId,
} from '@/lib/player-access'
import { readPlayerSessionFromHeaders } from '@/lib/player-auth'
import { toSlug } from '@/lib/slug'

const joinSchema = z.object({
  playerName: z.string().trim().min(2).max(60).optional(),
  sessionSlug: z.string().trim().min(1),
})

type JoinPlayerRecord = {
  displayName: string
  id: number | string
}

function toJoinPlayerRecord(input: unknown): JoinPlayerRecord | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const candidate = input as { displayName?: unknown; id?: unknown }
  if (typeof candidate.displayName !== 'string') {
    return null
  }

  if (typeof candidate.id !== 'number' && typeof candidate.id !== 'string') {
    return null
  }

  return {
    displayName: candidate.displayName,
    id: candidate.id,
  }
}

export const publicJoinEndpoint: Endpoint = {
  handler: async (req) => {
    const authSession = readPlayerSessionFromHeaders(req.headers)
    if (!authSession) {
      return Response.json(
        {
          error: 'player_sign_in_required',
          message: 'Sign in with Google before starting or continuing your game.',
        },
        { status: 401 },
      )
    }

    const body = req.json ? await req.json() : {}
    const data = joinSchema.parse(body)
    const player = await loadAuthenticatedPlayer(req.payload, authSession)

    if (!player || player.status === 'suspended') {
      return Response.json(
        {
          error: 'player_access_denied',
          message: 'This player account cannot open play right now.',
        },
        { status: 403 },
      )
    }

    let session = await loadJoinableSessionBySlug(req.payload, data.sessionSlug, player)
    if (!session) {
      return Response.json(
        {
          error: 'session_access_denied',
          message: 'The requested game session is not available for this player.',
        },
        { status: 404 },
      )
    }

    const playerName = data.playerName?.trim() || player.displayName || authSession.displayName

    if (!playerName || playerName.length < 2) {
      return Response.json(
        {
          error: 'player_name_required',
          message: 'A player display name is required before entering voice play.',
        },
        { status: 400 },
      )
    }

    const persistedPlayer = toJoinPlayerRecord(
      (await req.payload.update({
        collection: 'players',
        data: {
          avatarUrl: authSession.avatarUrl || undefined,
          displayName: playerName,
          email: authSession.email,
          googleSub: authSession.googleSub,
          lastRoomName: session.roomName,
          lastSeenAt: new Date().toISOString(),
        },
        id: normalizeCollectionId(player.id),
        overrideAccess: true,
      } as never)) as unknown,
    )

    if (!persistedPlayer) {
      return Response.json(
        {
          error: 'player_update_failed',
          message: 'The player profile could not be prepared for voice play.',
        },
        { status: 500 },
      )
    }

    const playerLibrary = await listPlayerLibrary(req.payload, player)
    const primaryRulebook = playerLibrary.find((entry) => entry.isPrimary) || null
    const activeDocumentIds = playerLibrary
      .filter((entry) => entry.isActive)
      .map((entry) => String(entry.id))
    const currentSessionDocumentIds = (Array.isArray(session.activeDocuments) ? session.activeDocuments : [])
      .map((entry) => relationshipId(entry as { id?: number | string } | number | string | null))
      .filter((entry): entry is string => Boolean(entry))

    if (session.ownerPlayerId === String(player.id)) {
      session = await ensurePlayerGameSession(req.payload, player)
    } else if (activeDocumentIds.length && activeDocumentIds.some((entry) => !currentSessionDocumentIds.includes(entry))) {
      await req.payload.update({
        collection: 'game-sessions',
        data: {
          activeDocuments: Array.from(new Set([...currentSessionDocumentIds, ...activeDocumentIds])).map((entry) =>
            normalizeCollectionId(entry),
          ),
        },
        id: session.id,
        overrideAccess: true,
      } as never)
    }

    await ensureRoom(session.roomName, 8)

    const identity = `player-${toSlug(playerName, 'player')}-${String(persistedPlayer.id).slice(0, 8)}`
    const token = await createPlayerToken({
      identity,
      name: playerName,
      room: session.roomName,
    })

    return Response.json({
      authenticated: true,
      player: {
        displayName: persistedPlayer.displayName,
        id: String(persistedPlayer.id),
      },
      library:
        primaryRulebook && primaryRulebook.status
          ? {
              primaryRulebook: primaryRulebook.title,
              readyBooks: playerLibrary.filter((entry) => entry.status === 'ready' && entry.isActive).length,
              status: primaryRulebook.status,
            }
          : null,
      roomName: session.roomName,
      serverUrl: getLiveKitPublicUrl(),
      session: {
        publicSummary: session.publicSummary,
        slug: session.slug,
        title: session.title,
        welcomeText: session.welcomeText,
      },
      token,
    })
  },
  method: 'post',
  path: '/gm/public/join',
}
