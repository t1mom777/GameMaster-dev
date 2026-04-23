import type { Endpoint } from 'payload'
import { z } from 'zod'

const leadSchema = z.object({
  email: z.string().trim().email().max(160),
  name: z.string().trim().max(120).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  source: z.enum(['kickstarter', 'product-hunt', 'manual']).default('kickstarter'),
})

const prelaunchLeadsCollection = 'prelaunch-leads'

export const publicPrelaunchLeadsEndpoint: Endpoint = {
  handler: async (req) => {
    const payload = req.json ? await req.json().catch(() => null) : null
    const parsed = leadSchema.safeParse(payload)

    if (!parsed.success) {
      return Response.json(
        {
          error: 'invalid_prelaunch_lead',
          message: 'Enter a valid email address.',
        },
        { status: 400 },
      )
    }

    const payloadApi = req.payload as any
    const existing = await payloadApi.find({
      collection: prelaunchLeadsCollection,
      limit: 1,
      overrideAccess: true,
      where: {
        email: {
          equals: parsed.data.email,
        },
      },
    })

    if (existing.docs[0]) {
      await payloadApi.update({
        collection: prelaunchLeadsCollection,
        data: {
          name: parsed.data.name || existing.docs[0].name,
          notes: parsed.data.notes || existing.docs[0].notes,
          source: parsed.data.source,
        },
        id: existing.docs[0].id,
        overrideAccess: true,
      })

      return Response.json({
        ok: true,
        status: 'updated',
      })
    }

    await payloadApi.create({
      collection: prelaunchLeadsCollection,
      data: {
        email: parsed.data.email,
        name: parsed.data.name || undefined,
        notes: parsed.data.notes || undefined,
        source: parsed.data.source,
        status: 'new',
      },
      overrideAccess: true,
    })

    return Response.json({
      ok: true,
      status: 'created',
    })
  },
  method: 'post',
  path: '/gm/prelaunch/leads',
}
