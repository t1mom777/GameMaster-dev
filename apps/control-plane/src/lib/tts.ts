import type { Payload } from 'payload'

type TTSProvider = 'openai' | 'deepgram' | 'elevenlabs'

type ProviderGroup = {
  apiKey?: string | null
  model?: string | null
  voiceId?: string | null
}

type VoiceSettingsGlobal = {
  deepgram?: ProviderGroup | null
  elevenlabs?: ProviderGroup | null
  instructions?: string | null
  openai?: ProviderGroup | null
  pitch?: number | null
  provider?: TTSProvider | null
  speed?: number | null
  voice?: string | null
}

type UserTTSSettings = {
  instructions?: string | null
  pitch?: number | null
  provider?: TTSProvider | null
  speed?: number | null
  useGlobalSettings?: boolean | null
  voice?: string | null
}

type TTSUserLike = {
  ttsSettings?: UserTTSSettings | null
}

export type ResolvedTTSSettings = {
  instructions: string
  pitch: number | null
  provider: TTSProvider
  providerConfig: ProviderGroup
  speed: number
  voice: string
}

export type GeneratedSpeech = {
  audio: Buffer
  mimeType: string
}

type GenerateSpeechArgs = {
  payload: Payload
  text: string
  user?: TTSUserLike | null
}

type ProviderHandler = (args: { settings: ResolvedTTSSettings; text: string }) => Promise<GeneratedSpeech>

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeProvider(value: unknown, fallback: TTSProvider): TTSProvider {
  return value === 'openai' || value === 'deepgram' || value === 'elevenlabs' ? value : fallback
}

function getProviderConfig(globalSettings: VoiceSettingsGlobal, provider: TTSProvider): ProviderGroup {
  if (provider === 'openai') {
    return globalSettings.openai || {}
  }

  if (provider === 'elevenlabs') {
    return globalSettings.elevenlabs || {}
  }

  return globalSettings.deepgram || {}
}

async function requireOk(response: Response, provider: TTSProvider) {
  if (response.ok) {
    return
  }

  const body = await response.text().catch(() => '')
  throw new Error(`${provider} TTS request failed (${response.status}): ${body.slice(0, 240)}`)
}

const providerMap: Record<TTSProvider, ProviderHandler> = {
  openai: async ({ settings, text }) => {
    const apiKey = asText(settings.providerConfig.apiKey)
    const model = asText(settings.providerConfig.model) || 'gpt-4o-mini-tts'

    if (!apiKey) {
      throw new Error('OpenAI TTS API key is missing in voice-settings.')
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      body: JSON.stringify({
        input: text,
        instructions: settings.instructions || undefined,
        model,
        speed: settings.speed,
        voice: settings.voice,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    await requireOk(response, 'openai')

    return {
      audio: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get('content-type') || 'audio/mpeg',
    }
  },
  deepgram: async ({ settings, text }) => {
    const apiKey = asText(settings.providerConfig.apiKey)
    const model = asText(settings.providerConfig.model) || 'aura-2'

    if (!apiKey) {
      throw new Error('Deepgram TTS API key is missing in voice-settings.')
    }

    const voiceModel = settings.voice ? `${model}-${settings.voice}` : model
    const response = await fetch(`https://api.deepgram.com/v1/speak?model=${encodeURIComponent(voiceModel)}`, {
      body: JSON.stringify({ text }),
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    await requireOk(response, 'deepgram')

    return {
      audio: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get('content-type') || 'audio/mpeg',
    }
  },
  elevenlabs: async ({ settings, text }) => {
    const apiKey = asText(settings.providerConfig.apiKey)
    const voiceId = asText(settings.providerConfig.voiceId)

    if (!apiKey) {
      throw new Error('ElevenLabs TTS API key is missing in voice-settings.')
    }

    if (!voiceId) {
      throw new Error('ElevenLabs voiceId is missing in voice-settings.')
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      body: JSON.stringify({
        model_id: asText(settings.providerConfig.model) || undefined,
        text,
        voice_settings: {
          similarity_boost: 0.5,
          speed: settings.speed,
          stability: 0.5,
          style: settings.pitch ?? 0,
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      method: 'POST',
    })

    await requireOk(response, 'elevenlabs')

    return {
      audio: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get('content-type') || 'audio/mpeg',
    }
  },
}

export async function getResolvedTTSSettings(payload: Payload, user?: TTSUserLike | null): Promise<ResolvedTTSSettings> {
  const globalSettings = ((await payload.findGlobal({
    overrideAccess: true,
    slug: 'voice-settings',
  } as never).catch(() => null)) || {}) as VoiceSettingsGlobal

  const globalProvider = normalizeProvider(globalSettings.provider, 'deepgram')
  const userSettings = user?.ttsSettings || null
  const useGlobalSettings = userSettings?.useGlobalSettings !== false
  const provider = useGlobalSettings ? globalProvider : normalizeProvider(userSettings?.provider, globalProvider)

  return {
    instructions: useGlobalSettings
      ? asText(globalSettings.instructions)
      : asText(userSettings?.instructions) || asText(globalSettings.instructions),
    pitch: useGlobalSettings
      ? (typeof globalSettings.pitch === 'number' ? globalSettings.pitch : null)
      : (typeof userSettings?.pitch === 'number'
          ? userSettings.pitch
          : typeof globalSettings.pitch === 'number'
            ? globalSettings.pitch
            : null),
    provider,
    providerConfig: getProviderConfig(globalSettings, provider),
    speed: useGlobalSettings
      ? asNumber(globalSettings.speed, 1)
      : asNumber(userSettings?.speed, asNumber(globalSettings.speed, 1)),
    voice: useGlobalSettings ? asText(globalSettings.voice) : asText(userSettings?.voice) || asText(globalSettings.voice),
  }
}

export async function generateSpeech({ payload, text, user }: GenerateSpeechArgs): Promise<GeneratedSpeech> {
  const settings = await getResolvedTTSSettings(payload, user)
  const provider = providerMap[settings.provider]

  if (!provider) {
    throw new Error(`Unsupported TTS provider: ${settings.provider}`)
  }

  return provider({
    settings,
    text,
  })
}
