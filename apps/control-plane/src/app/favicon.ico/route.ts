import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const requestHeaders = await headers()
  const protocol = requestHeaders.get('x-forwarded-proto') || 'https'
  const host =
    requestHeaders.get('x-forwarded-host') ||
    requestHeaders.get('host') ||
    'game.dima.click'

  return NextResponse.redirect(`${protocol}://${host}/icon.svg`, 307)
}
