import OpenAI from 'openai'

const DEFAULT_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'

let openaiClient: OpenAI | null = null

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

export async function embedText(input: string): Promise<number[]> {
  const client = getOpenAIClient()
  const response = await client.embeddings.create({
    input,
    model: getEmbeddingModel(),
  })

  return response.data[0]?.embedding ?? []
}
