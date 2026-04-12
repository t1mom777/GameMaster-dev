'use client'

type ApiMessagePayload = {
  message?: string
}

function compactText(input: string): string {
  return input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function fallbackMessage(status: number, responseText: string, fallback: string): string {
  if (status === 502 || status === 504) {
    return 'The service took too long to answer. If you just uploaded a large book, refresh in a moment and check whether indexing is already running.'
  }

  const text = compactText(responseText)
  if (!text) {
    return fallback
  }

  return text.length > 220 ? `${text.slice(0, 217)}...` : text
}

export async function readApiPayload<T>(response: Response, fallback: string): Promise<T & ApiMessagePayload> {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return (await response.json()) as T & ApiMessagePayload
  }

  const responseText = await response.text().catch(() => '')
  return {
    message: fallbackMessage(response.status, responseText, fallback),
  } as T & ApiMessagePayload
}
