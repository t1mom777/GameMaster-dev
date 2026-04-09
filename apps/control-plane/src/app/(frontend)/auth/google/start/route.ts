import { NextRequest, NextResponse } from 'next/server'

import {
  GOOGLE_STATE_COOKIE,
  buildGoogleAuthUrl,
  googleStateCookieTtl,
  isGooglePlayerAuthConfigured,
  sanitizeReturnTo,
  toPublicUrl,
} from '@/lib/player-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get('returnTo'))

  if (!isGooglePlayerAuthConfigured()) {
    return NextResponse.redirect(toPublicUrl('/setup', request.headers))
  }

  const { cookieValue, url } = buildGoogleAuthUrl(returnTo)
  const response = NextResponse.redirect(url)

  response.cookies.set({
    httpOnly: true,
    maxAge: googleStateCookieTtl(),
    name: GOOGLE_STATE_COOKIE,
    path: '/',
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    value: cookieValue,
  })

  return response
}
