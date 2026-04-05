import type { Endpoint } from 'payload'

export const publicSessionsEndpoint: Endpoint = {
  handler: async (req) => {
    const result = await req.payload.find({
      collection: 'game-sessions',
      depth: 1,
      limit: 12,
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

    const sessions = result.docs.map((session) => ({
      id: String(session.id),
      publicSummary: session.publicSummary,
      roomName: session.roomName,
      rulesetTitle:
        typeof session.ruleset === 'object' && session.ruleset?.title ? session.ruleset.title : undefined,
      scheduledFor: session.scheduledFor,
      slug: session.slug,
      title: session.title,
      welcomeText: session.welcomeText,
    }))

    return Response.json({ sessions })
  },
  method: 'get',
  path: '/gm/public/sessions',
}
