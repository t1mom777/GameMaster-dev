import type { Metadata } from 'next'
import React from 'react'

import './styles.css'

export const metadata: Metadata = {
  description: 'Voice-first tabletop sessions with a Payload control plane and LiveKit runtime.',
  title: 'GameMaster',
}

export default function FrontendLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{props.children}</body>
    </html>
  )
}
