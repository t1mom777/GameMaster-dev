import { NextRequest, NextResponse } from 'next/server'

import {
  GOOGLE_STATE_COOKIE,
  buildGoogleAuthUrl,
  googleStateCookieTtl,
  isSecureRequest,
  isGooglePlayerAuthConfigured,
  sanitizeReturnTo,
  toPublicUrl,
} from '@/lib/player-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get('returnTo'))

  if (!isGooglePlayerAuthConfigured()) {
    const destination = new URL(toPublicUrl('/login', request.headers))
    destination.searchParams.set('auth', 'google-failed')
    if (returnTo !== '/') {
      destination.searchParams.set('returnTo', returnTo)
    }
    return NextResponse.redirect(destination)
  }

  const { cookieValue, url } = buildGoogleAuthUrl(returnTo)
  const response = NextResponse.redirect(url)

  response.cookies.set({
    httpOnly: true,
    maxAge: googleStateCookieTtl(),
    name: GOOGLE_STATE_COOKIE,
    path: '/',
    sameSite: 'lax',
    secure: isSecureRequest(request.headers),
    value: cookieValue,
  })

  return response
}
