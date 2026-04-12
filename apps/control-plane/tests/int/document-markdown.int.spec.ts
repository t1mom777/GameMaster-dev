import { describe, expect, it } from 'vitest'

import { normalizeDocumentToMarkdown } from '@/lib/document-markdown'

describe('normalizeDocumentToMarkdown', () => {
  it('preserves markdown uploads as markdown', () => {
    const markdown = normalizeDocumentToMarkdown({
      extension: '.md',
      text: '# Core Rules\n\n- Fast turns\n- Clear stakes\n',
    })

    expect(markdown).toBe('# Core Rules\n\n- Fast turns\n- Clear stakes')
  })

  it('converts PDF-like line output into markdown sections and bullets', () => {
    const markdown = normalizeDocumentToMarkdown({
      extension: '.pdf',
      text: 'CHAPTER 1\n\nCombat Basics\nAttack rolls decide whether a blow lands.\nDamage applies after a hit.\n\n1. Roll initiative\n2. Take turns\n',
    })

    expect(markdown).toContain('## CHAPTER 1')
    expect(markdown).toContain('## Combat Basics')
    expect(markdown).toContain('Attack rolls decide whether a blow lands. Damage applies after a hit.')
    expect(markdown).toContain('- Roll initiative')
    expect(markdown).toContain('- Take turns')
  })
})
