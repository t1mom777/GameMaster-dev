import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const PLAYER_AUTH_COOKIE = 'gm-player-session'
const LOGIN_ROUTE = '/login'
const PLAYER_ONLY_PREFIXES = ['/join', '/play', '/rooms', '/session', '/sessions']

type PlayerCookieSession = {
  authProvider: 'google'
  displayName: string
  email: string
  googleSub: string
  playerId: string
}

function requiresPlayerSession(pathname: string): boolean {
  return PLAYER_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  const binary = atob(`${normalized}${padding}`)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function signValue(value: string): Promise<string> {
  const secret = process.env.PAYLOAD_SECRET?.trim()
  if (!secret) {
    return ''
  }

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {
      hash: 'SHA-256',
      name: 'HMAC',
    },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return encodeBase64Url(new Uint8Array(signature))
}

async function readPlayerCookieSession(rawValue?: string): Promise<PlayerCookieSession | null> {
  if (!rawValue) {
    return null
  }

  const [encoded, signature] = rawValue.split('.')
  if (!encoded || !signature) {
    return null
  }

  const expected = await signValue(encoded)
  if (!expected || expected !== signature) {
    return null
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(encoded)) as Partial<PlayerCookieSession>
    if (
      parsed.authProvider !== 'google' ||
      typeof parsed.displayName !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.googleSub !== 'string' ||
      typeof parsed.playerId !== 'string'
    ) {
      return null
    }

    return parsed as PlayerCookieSession
  } catch {
    return null
  }
}

function buildLoginRedirect(request: NextRequest): NextResponse {
  const target = new URL(LOGIN_ROUTE, request.url)
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`
  target.searchParams.set('returnTo', returnTo)
  return NextResponse.redirect(target)
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const playerSession = await readPlayerCookieSession(request.cookies.get(PLAYER_AUTH_COOKIE)?.value)

  if (pathname === '/setup') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (pathname === LOGIN_ROUTE && playerSession) {
    return NextResponse.redirect(new URL('/play', request.url))
  }

  if (requiresPlayerSession(pathname) && !playerSession) {
    return buildLoginRedirect(request)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/join/:path*', '/login', '/play/:path*', '/rooms/:path*', '/session/:path*', '/sessions/:path*', '/setup'],
}
