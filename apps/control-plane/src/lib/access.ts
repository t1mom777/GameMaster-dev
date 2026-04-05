import type { PayloadRequest } from 'payload'

type HeaderBag = Headers | Record<string, string | string[] | undefined> | undefined

function readHeader(headers: HeaderBag, name: string): string | undefined {
  if (!headers) {
    return undefined
  }

  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined
  }

  const raw = headers[name] ?? headers[name.toLowerCase()]
  if (Array.isArray(raw)) {
    return raw[0]
  }
  return raw
}

export function hasAdminSession(req: PayloadRequest): boolean {
  return Boolean(req.user)
}

export function requireAdmin(req: PayloadRequest): Response | null {
  if (hasAdminSession(req)) {
    return null
  }

  return Response.json(
    {
      error: 'admin_access_denied',
      message: 'Admin access is required.',
    },
    { status: 403 },
  )
}

export function requireInternalToken(req: PayloadRequest): Response | null {
  const expected = process.env.GM_INTERNAL_API_TOKEN
  if (!expected) {
    return Response.json(
      {
        error: 'internal_token_missing',
        message: 'GM_INTERNAL_API_TOKEN is not configured.',
      },
      { status: 500 },
    )
  }

  const authHeader = readHeader(req.headers, 'authorization')
  const token =
    authHeader?.replace(/^Bearer\s+/i, '') || readHeader(req.headers, 'x-gm-internal-token') || ''

  if (token === expected) {
    return null
  }

  return Response.json(
    {
      error: 'internal_access_denied',
      message: 'Internal runtime token is required.',
    },
    { status: 403 },
  )
}
