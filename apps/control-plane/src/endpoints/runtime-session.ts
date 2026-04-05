import type { Endpoint } from 'payload'

import { requireInternalToken } from '@/lib/access'
import { loadRuntimeContext } from '@/lib/session-runtime'

export const runtimeSessionEndpoint: Endpoint = {
  handler: async (req) => {
    const denied = requireInternalToken(req)
    if (denied) {
      return denied
    }

    const roomName = req.routeParams?.roomName
    if (!roomName) {
      return Response.json(
        {
          error: 'room_name_required',
          message: 'Room name is required.',
        },
        { status: 400 },
      )
    }

    const result = await req.payload.find({
      collection: 'game-sessions',
      depth: 1,
      limit: 1,
      where: {
        roomName: {
          equals: roomName,
        },
      },
    })

    const session = result.docs[0]
    if (!session) {
      return Response.json(
        {
          error: 'session_not_found',
          message: 'The requested room is not mapped to a session.',
        },
        { status: 404 },
      )
    }

    const runtime = await loadRuntimeContext(req.payload, session)
    return Response.json(runtime)
  },
  method: 'get',
  path: '/gm/runtime/session/:roomName',
}
