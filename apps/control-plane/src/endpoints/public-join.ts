import type { Endpoint } from 'payload'
import { z } from 'zod'

import { createPlayerToken, ensureRoom, getLiveKitPublicUrl } from '@/lib/livekit'
import { toSlug } from '@/lib/slug'

const joinSchema = z.object({
  playerName: z.string().trim().min(2).max(60),
  sessionSlug: z.string().trim().min(1),
})

export const publicJoinEndpoint: Endpoint = {
  handler: async (req) => {
    const body = req.json ? await req.json() : {}
    const data = joinSchema.parse(body)

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

    const player = await req.payload.create({
      collection: 'players',
      data: {
        displayName: data.playerName,
        lastRoomName: session.roomName,
        lastSeenAt: new Date().toISOString(),
      },
    })

    await ensureRoom(session.roomName, 8)

    const identity = `player-${toSlug(data.playerName, 'guest')}-${String(player.id).slice(0, 8)}`
    const token = await createPlayerToken({
      identity,
      name: data.playerName,
      room: session.roomName,
    })

    return Response.json({
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
