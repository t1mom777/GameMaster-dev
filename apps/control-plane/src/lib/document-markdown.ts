type SupportedDocumentExtension = '.md' | '.pdf' | '.txt'

function normalizeNewlines(input: string): string {
  return input.replace(/\r\n?/g, '\n').replace(/\u0000/g, '')
}

function normalizeSpacing(input: string): string {
  return input.replace(/[ \t]+/g, ' ').trim()
}

function stripBulletPrefix(input: string): string {
  return input.replace(/^([*\-•▪◦●]|\d+[.)]|[a-z][.)])\s+/i, '').trim()
}

function isBulletLine(input: string): boolean {
  return /^([*\-•▪◦●]|\d+[.)]|[a-z][.)])\s+/.test(input)
}

function isMostlyUppercase(input: string): boolean {
  const letters = input.replace(/[^A-Za-z]/g, '')
  if (!letters) {
    return false
  }

  const uppercaseLetters = letters.replace(/[^A-Z]/g, '')
  return uppercaseLetters.length / letters.length >= 0.7
}

function isTitleCase(input: string): boolean {
  const words = input
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean)

  if (!words.length || words.length > 10) {
    return false
  }

  return words.every((word) => word[0] === word[0]?.toUpperCase())
}

function isHeadingCandidate(input: string, previousBlank: boolean, nextBlank: boolean): boolean {
  const line = normalizeSpacing(input)
  if (!line || line.length > 100 || line.length < 3) {
    return false
  }

  if (/[.!?]$/.test(line)) {
    return false
  }

  if (
    /^(chapter|section|appendix|part|book|act|scene|prologue|epilogue|level|tier|spell|class|feat|rule)\b/i.test(
      line,
    )
  ) {
    return true
  }

  if (/^\d+([.)]|\.\d+)+\s+/.test(line)) {
    return true
  }

  if (!(previousBlank || nextBlank)) {
    return false
  }

  return isMostlyUppercase(line) || isTitleCase(line)
}

function lineJoiner(current: string, next: string): string {
  if (current.endsWith('-')) {
    return `${current.slice(0, -1)}${next}`
  }

  return `${current} ${next}`
}

function linesToMarkdown(input: string): string {
  const normalizedInput = normalizeNewlines(input)
  const rawLines = normalizedInput
    .replace(/\f/g, '\n\n[[PAGE_BREAK]]\n\n')
    .split('\n')
    .map((line) => line.replace(/\t/g, ' '))

  const sections: string[] = []
  let paragraph = ''

  function flushParagraph() {
    const nextParagraph = normalizeSpacing(paragraph)
    if (nextParagraph) {
      sections.push(nextParagraph)
    }
    paragraph = ''
  }

  for (let index = 0; index < rawLines.length; index += 1) {
    const line = normalizeSpacing(rawLines[index] || '')
    const previousBlank = index === 0 || normalizeSpacing(rawLines[index - 1] || '') === ''
    const nextBlank = index === rawLines.length - 1 || normalizeSpacing(rawLines[index + 1] || '') === ''

    if (!line) {
      flushParagraph()
      continue
    }

    if (line === '[[PAGE_BREAK]]') {
      flushParagraph()
      if (sections.at(-1) !== '---') {
        sections.push('---')
      }
      continue
    }

    if (isBulletLine(line)) {
      flushParagraph()
      sections.push(`- ${stripBulletPrefix(line)}`)
      continue
    }

    if (isHeadingCandidate(line, previousBlank, nextBlank)) {
      flushParagraph()
      sections.push(`## ${line}`)
      continue
    }

    paragraph = paragraph ? lineJoiner(paragraph, line) : line
  }

  flushParagraph()

  return sections.join('\n\n').trim()
}

export function normalizeDocumentToMarkdown(input: {
  extension: SupportedDocumentExtension
  text: string
}): string {
  const normalized = normalizeNewlines(input.text).trim()
  if (!normalized) {
    return ''
  }

  if (input.extension === '.md') {
    return normalized
  }

  return linesToMarkdown(normalized)
}
