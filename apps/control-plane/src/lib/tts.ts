import type { Payload } from 'payload'

type TTSProvider = 'openai' | 'deepgram' | 'elevenlabs' | 'inworld'

type ProviderGroup = {
  apiKey?: string | null
  model?: string | null
  voiceId?: string | null
}

type VoiceSettingsGlobal = {
  deepgram?: ProviderGroup | null
  elevenlabs?: ProviderGroup | null
  inworld?: ProviderGroup | null
  instructions?: string | null
  openai?: ProviderGroup | null
  pitch?: number | null
  provider?: TTSProvider | null
  speed?: number | null
  voice?: string | null
}

export type VoiceSettingsOverride = Partial<VoiceSettingsGlobal>

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
  voiceSettingsOverride?: VoiceSettingsOverride | null
}

type ProviderHandler = (args: { settings: ResolvedTTSSettings; text: string }) => Promise<GeneratedSpeech>

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeProvider(value: unknown, fallback: TTSProvider): TTSProvider {
  return value === 'openai' || value === 'deepgram' || value === 'elevenlabs' || value === 'inworld' ? value : fallback
}

function getProviderConfig(globalSettings: VoiceSettingsGlobal, provider: TTSProvider): ProviderGroup {
  if (provider === 'openai') {
    return globalSettings.openai || {}
  }

  if (provider === 'elevenlabs') {
    return globalSettings.elevenlabs || {}
  }

  if (provider === 'inworld') {
    return globalSettings.inworld || {}
  }

  return globalSettings.deepgram || {}
}

function mergeProviderGroup(
  baseGroup: ProviderGroup | null | undefined,
  overrideGroup: ProviderGroup | null | undefined,
): ProviderGroup {
  return {
    ...(baseGroup || {}),
    ...(overrideGroup || {}),
  }
}

function mergeVoiceSettings(
  baseSettings: VoiceSettingsGlobal,
  overrideSettings?: VoiceSettingsOverride | null,
): VoiceSettingsGlobal {
  if (!overrideSettings) {
    return baseSettings
  }

  return {
    ...baseSettings,
    ...overrideSettings,
    deepgram: mergeProviderGroup(baseSettings.deepgram, overrideSettings.deepgram),
    elevenlabs: mergeProviderGroup(baseSettings.elevenlabs, overrideSettings.elevenlabs),
    inworld: mergeProviderGroup(baseSettings.inworld, overrideSettings.inworld),
    openai: mergeProviderGroup(baseSettings.openai, overrideSettings.openai),
  }
}

function getEnvFallback(key: string): string {
  return asText(process.env[key])
}

function buildDeepgramVoiceModel(model: string, voice: string): string {
  const trimmedModel = asText(model)
  const trimmedVoice = asText(voice)
  const normalizedVoice = trimmedVoice.toLowerCase()
  const normalizedModel = trimmedModel.toLowerCase()

  if (trimmedVoice.startsWith('aura-2-')) {
    return trimmedVoice
  }

  if (/^aura-[a-z0-9]+-[a-z]{2}(?:-[a-z]{2})?$/i.test(trimmedVoice)) {
    return trimmedVoice.replace(/^aura-/i, 'aura-2-')
  }

  if (!trimmedVoice) {
    return trimmedModel || 'aura-2'
  }

  if (trimmedVoice.startsWith('aura-') || (trimmedModel && normalizedVoice.startsWith(`${normalizedModel}-`))) {
    return trimmedVoice
  }

  return trimmedModel ? `${trimmedModel}-${trimmedVoice}` : trimmedVoice
}

function buildWorkerCompatibleDeepgramModel(settings: ResolvedTTSSettings): string {
  const configuredModel = asText(settings.providerConfig.model)
  const configuredVoice = asText(settings.voice)
  const voiceProfile = asText(settings.instructions).toLowerCase()

  if (configuredVoice.startsWith('aura-2-')) {
    return configuredVoice
  }

  if (/^aura-[a-z0-9]+-[a-z]{2}(?:-[a-z]{2})?$/i.test(configuredVoice)) {
    return configuredVoice.replace(/^aura-/i, 'aura-2-')
  }

  if (!configuredVoice && voiceProfile.includes('hugh laurie')) {
    return 'aura-2-helios-en'
  }

  if (
    ['asteria-en', 'thalia-en', 'aura-asteria-en', 'aura-thalia-en', 'aura-2-asteria-en', 'aura-2-thalia-en'].includes(
      configuredVoice.toLowerCase(),
    ) &&
    voiceProfile.includes('hugh laurie')
  ) {
    return 'aura-2-helios-en'
  }

  return buildDeepgramVoiceModel(configuredModel, configuredVoice)
}

function buildWorkerCompatibleOpenAIVoice(settings: ResolvedTTSSettings): string {
  const configuredVoice = asText(settings.voice).toLowerCase()
  const voiceProfile = asText(settings.instructions).toLowerCase()
  const supportedVoices = new Set(['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'])

  if (voiceProfile.includes('hugh laurie')) {
    if (supportedVoices.has(configuredVoice) && ['ballad', 'ash', 'verse'].includes(configuredVoice)) {
      return configuredVoice
    }

    return 'ash'
  }

  return supportedVoices.has(configuredVoice) ? configuredVoice : 'alloy'
}

async function requireOk(response: Response, provider: TTSProvider) {
  if (response.ok) {
    return
  }

  const body = await response.text().catch(() => '')
  throw new Error(`${provider} TTS request failed (${response.status}): ${body.slice(0, 240)}`)
}

async function collectInworldAudio(response: Response): Promise<Buffer> {
  if (!response.body) {
    return Buffer.from(await response.arrayBuffer())
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const chunks: Buffer[] = []
  let buffered = ''

  const consumeLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) {
      return
    }

    const parsed = JSON.parse(trimmed) as {
      result?: {
        audioContent?: string
      }
    }
    const audioContent = parsed.result?.audioContent

    if (audioContent) {
      chunks.push(Buffer.from(audioContent, 'base64'))
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    buffered += decoder.decode(value, { stream: !done })

    const lines = buffered.split(/\r?\n/)
    buffered = lines.pop() || ''

    for (const line of lines) {
      consumeLine(line)
    }

    if (done) {
      break
    }
  }

  if (buffered.trim()) {
    consumeLine(buffered)
  }

  if (!chunks.length) {
    throw new Error('Inworld TTS returned no audio content.')
  }

  return Buffer.concat(chunks)
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
        voice: buildWorkerCompatibleOpenAIVoice(settings),
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

    const voiceModel = buildWorkerCompatibleDeepgramModel({
      ...settings,
      providerConfig: {
        ...settings.providerConfig,
        model,
      },
    })
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
  inworld: async ({ settings, text }) => {
    const apiKey = asText(settings.providerConfig.apiKey) || getEnvFallback('INWORLD_API_KEY')
    const model = asText(settings.providerConfig.model) || 'inworld-tts-1.5-max'
    const voice = asText(settings.voice) || asText(settings.providerConfig.voiceId) || 'Sebastian'

    if (!apiKey) {
      throw new Error('Inworld TTS API key is missing in voice-settings or INWORLD_API_KEY.')
    }

    const response = await fetch('https://api.inworld.ai/tts/v1/voice:stream', {
      body: JSON.stringify({
        audio_config: {
          audio_encoding: 'MP3',
          speaking_rate: settings.speed,
        },
        model_id: model,
        temperature: 1,
        text,
        voice_id: voice,
      }),
      headers: {
        Authorization: `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    await requireOk(response, 'inworld')

    return {
      audio: await collectInworldAudio(response),
      mimeType: 'audio/mpeg',
    }
  },
}

export async function getResolvedTTSSettings(
  payload: Payload,
  user?: TTSUserLike | null,
  voiceSettingsOverride?: VoiceSettingsOverride | null,
): Promise<ResolvedTTSSettings> {
  const persistedGlobalSettings = ((await payload.findGlobal({
    overrideAccess: true,
    slug: 'voice-settings',
  } as never).catch(() => null)) || {}) as VoiceSettingsGlobal
  const globalSettings = mergeVoiceSettings(persistedGlobalSettings, voiceSettingsOverride)

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

export async function generateSpeech({ payload, text, user, voiceSettingsOverride }: GenerateSpeechArgs): Promise<GeneratedSpeech> {
  const settings = await getResolvedTTSSettings(payload, user, voiceSettingsOverride)
  const provider = providerMap[settings.provider]

  if (!provider) {
    throw new Error(`Unsupported TTS provider: ${settings.provider}`)
  }

  return provider({
    settings,
    text,
  })
}
