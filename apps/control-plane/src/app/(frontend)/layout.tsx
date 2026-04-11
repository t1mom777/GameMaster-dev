import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google'
import React from 'react'

import { readPlayerSessionFromCookieStore } from '@/lib/player-auth'

import './styles.css'

const displayFont = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
})

const bodyFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  description: 'Voice-first tabletop adventures with a private player library and a hidden admin control plane.',
  title: 'GameMaster',
}

export default async function FrontendLayout(props: { children: React.ReactNode }) {
  const playerSession = readPlayerSessionFromCookieStore(await cookies())

  return (
    <html className={`${displayFont.variable} ${bodyFont.variable}`} lang="en">
      <body>
        <div className="player-app">
          <header className="topbar">
            <Link className="brandmark" href="/">
              <span className="brandmark__crest">GM</span>
              <span>GameMaster</span>
            </Link>

            <nav className="topbar__actions" aria-label="Player">
              {playerSession ? (
                <>
                  <Link className="topbar__link" href="/play">
                    My game
                  </Link>
                  <a className="button button--ghost" href="/auth/logout?returnTo=/">
                    Sign out
                  </a>
                </>
              ) : (
                <Link className="button button--ghost" href="/login">
                  Sign in
                </Link>
              )}
            </nav>
          </header>

          {props.children}
        </div>
      </body>
    </html>
  )
}
