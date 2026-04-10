import { redirect } from 'next/navigation'

export default async function LegacySessionPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  redirect(`/session/${slug}`)
}
