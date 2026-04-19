import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { loadAuthenticatedPlayer, loadJoinableSessionBySlug } from '@/lib/player-access'
import { readPlayerSessionFromCookieStore } from '@/lib/player-auth'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

export default async function SessionPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const payload = await getPayload({ config })
  const playerSession = readPlayerSessionFromCookieStore(await cookies())

  if (!playerSession) {
    redirect(`/login?returnTo=${encodeURIComponent(`/session/${slug}`)}`)
  }

  const player = await loadAuthenticatedPlayer(payload, playerSession)
  if (!player || player.status === 'suspended') {
    redirect('/play')
  }

  const session = await loadJoinableSessionBySlug(payload, slug, player)
  if (!session) {
    notFound()
  }

  redirect('/play')
}
