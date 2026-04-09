import crypto from 'node:crypto'

import type { Payload } from 'payload'

type HeaderBag = Headers | Record<string, string | string[] | undefined> | undefined

type CookieStoreLike = {
  get(name: string): { value: string } | undefined
}

type GoogleUserInfo = {
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
  sub: string
}

export type PlayerAuthSession = {
  authProvider: 'google'
  avatarUrl?: string
  displayName: string
  email: string
  googleSub: string
  playerId: string
}

type SignedGoogleState = {
  nonce: string
  returnTo: string
}

type PersistedPlayer = {
  avatarUrl?: string
  displayName: string
  email: string
  googleSub: string
  id: number | string
}

export const PLAYER_AUTH_COOKIE = 'gm-player-session'
export const GOOGLE_STATE_COOKIE = 'gm-google-state'
export const PLAYER_AUTH_TTL_SECS = 60 * 60 * 24 * 30
const GOOGLE_STATE_TTL_SECS = 60 * 10

function authSecret(): string {
  const secret = process.env.PAYLOAD_SECRET?.trim()
  if (!secret) {
    throw new Error('PAYLOAD_SECRET is required for player auth cookies.')
  }
  return secret
}

function encodeBase64Url(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64url')
}

function decodeBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf-8')
}

function signValue(value: string): string {
  return crypto.createHmac('sha256', authSecret()).update(value).digest('base64url')
}

function encodeSigned<T>(payload: T): string {
  const encoded = encodeBase64Url(JSON.stringify(payload))
  return `${encoded}.${signValue(encoded)}`
}

function decodeSigned<T>(rawValue?: string | null): T | null {
  if (!rawValue) {
    return null
  }

  const [encoded, signature] = rawValue.split('.')
  if (!encoded || !signature) {
    return null
  }

  const expected = signValue(encoded)
  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(signature)

  if (expectedBuffer.length !== signatureBuffer.length) {
    return null
  }

  if (!crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null
  }

  try {
    return JSON.parse(decodeBase64Url(encoded)) as T
  } catch {
    return null
  }
}

function readCookieHeader(headers: HeaderBag): string {
  if (!headers) {
    return ''
  }

  if (headers instanceof Headers) {
    return headers.get('cookie') || ''
  }

  const raw = headers.cookie ?? headers.Cookie
  if (Array.isArray(raw)) {
    return raw[0] || ''
  }

  return raw || ''
}

function readHeaderValue(headers: HeaderBag, name: string): string {
  if (!headers) {
    return ''
  }

  if (headers instanceof Headers) {
    return headers.get(name) || headers.get(name.toLowerCase()) || ''
  }

  const raw = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()]
  if (Array.isArray(raw)) {
    return raw[0] || ''
  }

  return raw || ''
}

function parseCookieHeader(cookieHeader: string): Map<string, string> {
  const cookies = new Map<string, string>()

  for (const cookie of cookieHeader.split(';')) {
    const [name, ...rest] = cookie.trim().split('=')
    if (!name || !rest.length) {
      continue
    }
    cookies.set(name, decodeURIComponent(rest.join('=')))
  }

  return cookies
}

function playerDisplayName(input: GoogleUserInfo): string {
  if (input.name?.trim()) {
    return input.name.trim()
  }

  if (input.email?.trim()) {
    return input.email.split('@')[0] || 'Player'
  }

  return 'Player'
}

function normalizePlayerId(input: number | string): number | string {
  if (typeof input === 'number') {
    return input
  }

  return /^\d+$/.test(input) ? Number(input) : input
}

function toPersistedPlayer(input: unknown): PersistedPlayer {
  if (!input || typeof input !== 'object') {
    throw new Error('Player auth write did not return a player document.')
  }

  const candidate = input as {
    avatarUrl?: unknown
    displayName?: unknown
    email?: unknown
    googleSub?: unknown
    id?: unknown
  }

  if (
    typeof candidate.displayName !== 'string' ||
    typeof candidate.email !== 'string' ||
    typeof candidate.googleSub !== 'string' ||
    (typeof candidate.id !== 'number' && typeof candidate.id !== 'string')
  ) {
    throw new Error('Player auth write returned an unexpected document shape.')
  }

  return {
    avatarUrl: typeof candidate.avatarUrl === 'string' ? candidate.avatarUrl : undefined,
    displayName: candidate.displayName,
    email: candidate.email,
    googleSub: candidate.googleSub,
    id: candidate.id,
  }
}

export function sanitizeReturnTo(input?: string | null): string {
  if (!input || !input.startsWith('/')) {
    return '/'
  }

  if (input.startsWith('//')) {
    return '/'
  }

  return input
}

export function getPublicOrigin(headers?: HeaderBag): string {
  const explicitSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.PAYLOAD_PUBLIC_SERVER_URL?.trim() || ''
  const forwardedProto = readHeaderValue(headers, 'x-forwarded-proto').split(',')[0]?.trim() || ''
  const forwardedHost = readHeaderValue(headers, 'x-forwarded-host').split(',')[0]?.trim() || ''

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  const host = readHeaderValue(headers, 'host').split(',')[0]?.trim() || ''
  if (forwardedProto && host) {
    return `${forwardedProto}://${host}`
  }

  return explicitSiteUrl.replace(/\/$/, '')
}

export function toPublicUrl(path: string, headers?: HeaderBag): string {
  const origin = getPublicOrigin(headers)
  if (!origin) {
    return sanitizeReturnTo(path)
  }

  return new URL(sanitizeReturnTo(path), origin).toString()
}

export function isGooglePlayerAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      getGoogleRedirectUri(),
  )
}

export function getGoogleRedirectUri(): string {
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim()
  if (explicit) {
    return explicit
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.PAYLOAD_PUBLIC_SERVER_URL?.trim() || ''
  return siteUrl ? `${siteUrl.replace(/\/$/, '')}/auth/google/callback` : ''
}

export function buildGoogleAuthUrl(returnTo: string): { cookieValue: string; url: string } {
  if (!isGooglePlayerAuthConfigured()) {
    throw new Error('Google OAuth is not configured.')
  }

  const cookieValue = encodeSigned<SignedGoogleState>({
    nonce: crypto.randomBytes(24).toString('base64url'),
    returnTo: sanitizeReturnTo(returnTo),
  })

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID?.trim() || '',
    redirect_uri: getGoogleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state: cookieValue,
    prompt: 'select_account',
  })

  return {
    cookieValue,
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  }
}

export function readPlayerSessionFromHeaders(headers: HeaderBag): PlayerAuthSession | null {
  const cookieHeader = readCookieHeader(headers)
  if (!cookieHeader) {
    return null
  }

  return decodeSigned<PlayerAuthSession>(parseCookieHeader(cookieHeader).get(PLAYER_AUTH_COOKIE))
}

export function readPlayerSessionFromCookieStore(store: CookieStoreLike): PlayerAuthSession | null {
  return decodeSigned<PlayerAuthSession>(store.get(PLAYER_AUTH_COOKIE)?.value)
}

export function createPlayerSessionCookieValue(session: PlayerAuthSession): string {
  return encodeSigned(session)
}

export function parseGoogleStateCookie(rawValue?: string | null): SignedGoogleState | null {
  return decodeSigned<SignedGoogleState>(rawValue)
}

export function googleStateCookieTtl(): number {
  return GOOGLE_STATE_TTL_SECS
}

export async function fetchGoogleUserInfo(code: string): Promise<GoogleUserInfo> {
  if (!isGooglePlayerAuthConfigured()) {
    throw new Error('Google OAuth is not configured.')
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID?.trim() || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET?.trim() || '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: getGoogleRedirectUri(),
    }),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  })

  if (!tokenResponse.ok) {
    throw new Error(`Google token exchange failed with ${tokenResponse.status}.`)
  }

  const tokenPayload = (await tokenResponse.json()) as { access_token?: string }
  if (!tokenPayload.access_token) {
    throw new Error('Google token exchange did not return an access token.')
  }

  const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      authorization: `Bearer ${tokenPayload.access_token}`,
    },
  })

  if (!userInfoResponse.ok) {
    throw new Error(`Google userinfo fetch failed with ${userInfoResponse.status}.`)
  }

  const userInfo = (await userInfoResponse.json()) as GoogleUserInfo
  if (!userInfo.sub) {
    throw new Error('Google userinfo response did not contain a subject.')
  }

  if (!userInfo.email?.trim()) {
    throw new Error('Google userinfo response did not contain an email.')
  }

  if (userInfo.email_verified === false) {
    throw new Error('Google userinfo response contained an unverified email.')
  }

  return userInfo
}

export async function upsertGooglePlayer(payload: Payload, profile: GoogleUserInfo): Promise<PlayerAuthSession> {
  const existing = await payload.find({
    collection: 'players',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: {
      googleSub: {
        equals: profile.sub,
      },
    },
  })

  const nextData = {
    authProvider: 'google' as const,
    avatarUrl: profile.picture || '',
    displayName: playerDisplayName(profile),
    email: profile.email?.trim() || '',
    googleSub: profile.sub,
    lastSeenAt: new Date().toISOString(),
  }

  const player = toPersistedPlayer(
    existing.docs[0]
      ? ((await payload.update({
          collection: 'players',
          data: nextData,
          id: normalizePlayerId(existing.docs[0].id),
          overrideAccess: true,
        } as never)) as unknown)
      : ((await payload.create({
          collection: 'players',
          data: {
            ...nextData,
            preferredVoiceMode: 'auto-vad',
          },
          overrideAccess: true,
        } as never)) as unknown),
  )

  return {
    authProvider: 'google',
    avatarUrl: player.avatarUrl || undefined,
    displayName: player.displayName,
    email: player.email,
    googleSub: player.googleSub,
    playerId: String(player.id),
  }
}
