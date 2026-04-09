import OpenAI from 'openai'

const DEFAULT_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
const LOCAL_EMBEDDING_DIMENSION = 256

let openaiClient: OpenAI | null = null
let warnedAboutFallback = false

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for embeddings.')
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  return openaiClient
}

export function getEmbeddingModel(): string {
  return DEFAULT_MODEL
}

function buildLocalEmbedding(input: string): number[] {
  const vector = new Array<number>(LOCAL_EMBEDDING_DIMENSION).fill(0)
  const tokens = input.toLowerCase().match(/[a-z0-9]+/g) ?? input.toLowerCase().split('')

  for (const token of tokens) {
    let hash = 2166136261
    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }

    const bucket = Math.abs(hash) % LOCAL_EMBEDDING_DIMENSION
    const sign = hash & 1 ? 1 : -1
    vector[bucket] += sign * Math.max(1, token.length / 6)
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  if (!magnitude) {
    return vector
  }

  return vector.map((value) => value / magnitude)
}

export async function embedText(input: string): Promise<number[]> {
  if (process.env.OPENAI_API_KEY) {
    try {
      const client = getOpenAIClient()
      const response = await client.embeddings.create({
        input,
        model: getEmbeddingModel(),
      })

      return response.data[0]?.embedding ?? []
    } catch (error) {
      if (!warnedAboutFallback) {
        warnedAboutFallback = true
        console.error(
          `OpenAI embeddings unavailable, falling back to local hash embeddings: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  return buildLocalEmbedding(input)
}
