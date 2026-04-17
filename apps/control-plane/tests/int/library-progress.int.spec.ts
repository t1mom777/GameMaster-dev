import { describe, expect, it } from 'vitest'

import {
  getBookProgressDetail,
  getBookProgressPercent,
  getOverallLibraryProgress,
} from '@/components/public/library-progress'

describe('library progress helpers', () => {
  const now = new Date('2026-04-17T12:00:00.000Z').getTime()

  it('marks ready books as fully complete', () => {
    expect(
      getBookProgressPercent(
        {
          status: 'ready',
          title: 'Nimble',
          updatedAt: '2026-04-17T11:59:40.000Z',
        },
        now,
      ),
    ).toBe(100)
  })

  it('advances indexing further than uploaded queueing', () => {
    const uploaded = getBookProgressPercent(
      {
        status: 'uploaded',
        title: 'Nimble',
        updatedAt: '2026-04-17T11:59:55.000Z',
      },
      now,
    )
    const indexing = getBookProgressPercent(
      {
        status: 'indexing',
        title: 'Nimble',
        updatedAt: '2026-04-17T11:59:10.000Z',
      },
      now,
    )

    expect(uploaded).toBeGreaterThanOrEqual(22)
    expect(indexing).toBeGreaterThan(uploaded)
  })

  it('warns when indexing is taking longer than expected', () => {
    expect(
      getBookProgressDetail(
        {
          status: 'indexing',
          title: 'Nimble',
          updatedAt: '2026-04-17T11:55:30.000Z',
        },
        now,
      ),
    ).toContain('longer than normal')
  })

  it('uses real upload progress while a file transfer is active', () => {
    expect(
      getOverallLibraryProgress(
        [
          {
            status: 'indexing',
            title: 'Nimble',
            updatedAt: '2026-04-17T11:59:10.000Z',
          },
        ],
        true,
        73,
        now,
      ),
    ).toBe(73)
  })
})
