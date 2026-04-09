import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import {
  GOOGLE_STATE_COOKIE,
  PLAYER_AUTH_COOKIE,
  PLAYER_AUTH_TTL_SECS,
  createPlayerSessionCookieValue,
  fetchGoogleUserInfo,
  parseGoogleStateCookie,
  sanitizeReturnTo,
  upsertGooglePlayer,
} from '@/lib/player-auth'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

function redirectWithError(request: NextRequest, returnTo: string, code: string) {
  const destination = new URL(sanitizeReturnTo(returnTo), request.url)
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

export async function GET(request: NextRequest) {
  const stateCookie = request.cookies.get(GOOGLE_STATE_COOKIE)?.value
  const parsedState = parseGoogleStateCookie(stateCookie)
  const returnTo = parsedState?.returnTo || '/'
  const code = request.nextUrl.searchParams.get('code')
  const incomingState = request.nextUrl.searchParams.get('state')

  if (!parsedState || !code || !incomingState || incomingState !== stateCookie) {
    return redirectWithError(request, returnTo, 'google-state')
  }

  try {
    const payload = await getPayload({ config })
    const profile = await fetchGoogleUserInfo(code)
    const playerSession = await upsertGooglePlayer(payload, profile)

    const response = NextResponse.redirect(new URL(returnTo, request.url))
    response.cookies.set({
      httpOnly: true,
      maxAge: PLAYER_AUTH_TTL_SECS,
      name: PLAYER_AUTH_COOKIE,
      path: '/',
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      value: createPlayerSessionCookieValue(playerSession),
    })
    response.cookies.set({
      maxAge: 0,
      name: GOOGLE_STATE_COOKIE,
      path: '/',
      value: '',
    })

    return response
  } catch {
    return redirectWithError(request, returnTo, 'google-failed')
  }
}
