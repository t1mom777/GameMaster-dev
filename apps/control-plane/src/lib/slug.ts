import slugify from 'slugify'

export function toSlug(value: string, fallback = 'game-master'): string {
  const normalized = slugify(value, {
    lower: true,
    strict: true,
    trim: true,
  })

  return normalized || fallback
}
