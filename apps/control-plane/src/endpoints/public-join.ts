import type { Endpoint } from 'payload'
import { z } from 'zod'

import { createPlayerToken, ensureRoom, getLiveKitPublicUrl } from '@/lib/livekit'
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

function toJoinPlayerRecord(input: unknown): JoinPlayerRecord | undefined {
  if (!input || typeof input !== 'object') {
    return undefined
  }

  const candidate = input as { displayName?: unknown; id?: unknown }
  if (typeof candidate.displayName !== 'string') {
    return undefined
  }

  if (typeof candidate.id !== 'number' && typeof candidate.id !== 'string') {
    return undefined
  }

  return {
    displayName: candidate.displayName,
    id: candidate.id,
  }
}

function normalizeCollectionId(input: number | string): number | string {
  if (typeof input === 'number') {
    return input
  }

  return /^\d+$/.test(input) ? Number(input) : input
}

export const publicJoinEndpoint: Endpoint = {
  handler: async (req) => {
    const body = req.json ? await req.json() : {}
    const data = joinSchema.parse(body)
    const authenticatedPlayer = readPlayerSessionFromHeaders(req.headers)
    const playerName = data.playerName?.trim() || authenticatedPlayer?.displayName || ''

    if (playerName.length < 2) {
      return Response.json(
        {
          error: 'player_name_required',
          message: 'A player name or Google sign-in is required before joining.',
        },
        { status: 400 },
      )
    }

    const sessions = await req.payload.find({
      collection: 'game-sessions',
      depth: 0,
      limit: 1,
      where: {
        and: [
          {
            slug: {
              equals: data.sessionSlug,
            },
          },
          {
            publicJoinEnabled: {
              equals: true,
            },
          },
        ],
      },
    })

    const session = sessions.docs[0]
    if (!session) {
      return Response.json(
        {
          error: 'session_not_found',
          message: 'The requested session is not available for public join.',
        },
        { status: 404 },
      )
    }

    let player: JoinPlayerRecord | undefined

    if (authenticatedPlayer?.playerId) {
      try {
        player = toJoinPlayerRecord(
          (await req.payload.update({
            collection: 'players',
            data: {
              authProvider: 'google',
              avatarUrl: authenticatedPlayer.avatarUrl || undefined,
              displayName: playerName,
              email: authenticatedPlayer.email,
            googleSub: authenticatedPlayer.googleSub,
            lastRoomName: session.roomName,
            lastSeenAt: new Date().toISOString(),
          },
          id: normalizeCollectionId(authenticatedPlayer.playerId),
          overrideAccess: true,
        } as never)) as unknown,
      )
      } catch {
        player = undefined
      }
    }

    if (!player) {
      player = toJoinPlayerRecord(
        (await req.payload.create({
          collection: 'players',
          data: {
            authProvider: authenticatedPlayer ? 'google' : 'guest',
            avatarUrl: authenticatedPlayer?.avatarUrl || undefined,
            displayName: playerName,
            email: authenticatedPlayer?.email || undefined,
            googleSub: authenticatedPlayer?.googleSub || undefined,
            lastRoomName: session.roomName,
            lastSeenAt: new Date().toISOString(),
          },
          overrideAccess: true,
        } as never)) as unknown,
      )
    }

    if (!player) {
      throw new Error('Player record could not be created for public join.')
    }

    await ensureRoom(session.roomName, 8)

    const identity = `player-${toSlug(playerName, 'guest')}-${String(player.id).slice(0, 8)}`
    const token = await createPlayerToken({
      identity,
      name: playerName,
      room: session.roomName,
    })

    return Response.json({
      authenticated: Boolean(authenticatedPlayer),
      player: {
        displayName: player.displayName,
        id: String(player.id),
      },
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
