import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import {
  GOOGLE_STATE_COOKIE,
  PLAYER_AUTH_COOKIE,
  PLAYER_AUTH_TTL_SECS,
  createPlayerSessionCookieValue,
  fetchGoogleUserInfo,
  parseGoogleStateCookie,
  parseGoogleStateParam,
  isSecureRequest,
  sanitizeReturnTo,
  toPublicUrl,
  upsertGooglePlayer,
} from '@/lib/player-auth'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

function redirectWithError(request: NextRequest, returnTo: string, code: string) {
  const destination = new URL(toPublicUrl(sanitizeReturnTo(returnTo), request.headers))
  destination.searchParams.set('auth', code)

  const response = NextResponse.redirect(destination)
  response.cookies.set({
    maxAge: 0,
    name: GOOGLE_STATE_COOKIE,
    path: '/',
    value: '',
  })

  return response
}

function classifyGoogleAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  if (message.includes('token exchange')) {
    return 'google-token'
  }

  if (message.includes('userinfo')) {
    return 'google-userinfo'
  }

  if (message.includes('player')) {
    return 'google-player'
  }

  if (message.includes('column') || message.includes('relation') || message.includes('schema')) {
    return 'google-schema'
  }

  return 'google-failed'
}

export async function GET(request: NextRequest) {
  const stateCookie = request.cookies.get(GOOGLE_STATE_COOKIE)?.value
  const parsedState = parseGoogleStateCookie(stateCookie)
  const code = request.nextUrl.searchParams.get('code')
  const incomingState = request.nextUrl.searchParams.get('state')
  const parsedIncomingState = parseGoogleStateParam(incomingState)
  const resolvedState = parsedIncomingState || parsedState
  const returnTo = resolvedState?.returnTo || '/'

  if (!resolvedState || !code || !incomingState) {
    return redirectWithError(request, returnTo, 'google-state')
  }

  if (parsedState && incomingState !== stateCookie) {
    return redirectWithError(request, returnTo, 'google-state')
  }

  try {
    const payload = await getPayload({ config })
    const profile = await fetchGoogleUserInfo(code)
    const playerSession = await upsertGooglePlayer(payload, profile)

    const response = NextResponse.redirect(toPublicUrl(returnTo, request.headers))
    response.cookies.set({
      httpOnly: true,
      maxAge: PLAYER_AUTH_TTL_SECS,
      name: PLAYER_AUTH_COOKIE,
      path: '/',
      sameSite: 'lax',
      secure: isSecureRequest(request.headers),
      value: createPlayerSessionCookieValue(playerSession),
    })
    response.cookies.set({
      maxAge: 0,
      name: GOOGLE_STATE_COOKIE,
      path: '/',
      value: '',
    })

    return response
  } catch (error) {
    console.error('Google auth callback failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      hasCode: Boolean(code),
      hasStateCookie: Boolean(stateCookie),
      returnTo,
    })
    return redirectWithError(request, returnTo, classifyGoogleAuthError(error))
  }
}
