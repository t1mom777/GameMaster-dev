import type { Endpoint } from 'payload'

export const healthEndpoint: Endpoint = {
  handler: async () =>
    Response.json({
      ok: true,
      service: 'gm-control-plane',
      timestamp: new Date().toISOString(),
    }),
  method: 'get',
  path: '/gm/health',
}
