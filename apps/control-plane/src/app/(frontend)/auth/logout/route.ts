import { NextRequest, NextResponse } from 'next/server'

import { PLAYER_AUTH_COOKIE, sanitizeReturnTo, toPublicUrl } from '@/lib/player-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get('returnTo'))
  const response = NextResponse.redirect(toPublicUrl(returnTo, request.headers))

  response.cookies.set({
    maxAge: 0,
    name: PLAYER_AUTH_COOKIE,
    path: '/',
    value: '',
  })

  return response
}
