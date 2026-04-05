import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'

function normalizeHttpHost(input: string): string {
  if (input.startsWith('ws://')) {
    return `http://${input.slice('ws://'.length)}`
  }
  if (input.startsWith('wss://')) {
    return `https://${input.slice('wss://'.length)}`
  }
  return input
}

export function getLiveKitPublicUrl(): string {
  return process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://127.0.0.1:7880'
}

function getLiveKitControlUrl(): string {
  return normalizeHttpHost(process.env.LIVEKIT_HOST || getLiveKitPublicUrl())
}

function getLiveKitApiKey(): string {
  return process.env.LIVEKIT_API_KEY || 'devkey'
}

function getLiveKitApiSecret(): string {
  return process.env.LIVEKIT_API_SECRET || 'secret'
}

export function getRoomServiceClient(): RoomServiceClient {
  return new RoomServiceClient(getLiveKitControlUrl(), getLiveKitApiKey(), getLiveKitApiSecret())
}

export async function ensureRoom(roomName: string, maxParticipants = 8): Promise<void> {
  const client = getRoomServiceClient()

  try {
    await client.createRoom({
      emptyTimeout: 10 * 60,
      maxParticipants,
      name: roomName,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
    if (!message.includes('already exists')) {
      throw error
    }
  }
}

export async function createPlayerToken(args: {
  identity: string
  name: string
  room: string
}): Promise<string> {
  const token = new AccessToken(getLiveKitApiKey(), getLiveKitApiSecret(), {
    identity: args.identity,
    name: args.name,
    ttl: '2h',
  })

  token.addGrant({
    canPublish: true,
    canSubscribe: true,
    room: args.room,
    roomJoin: true,
  })

  return token.toJwt()
}
