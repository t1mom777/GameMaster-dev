import type { Endpoint } from 'payload'
import { z } from 'zod'

import { requireAdmin } from '@/lib/access'
import { generateSpeech } from '@/lib/tts'

const previewSchema = z.object({
  text: z.string().trim().min(1).max(2_000),
  voiceSettings: z
    .object({
      deepgram: z
        .object({
          apiKey: z.string().optional().nullable(),
          model: z.string().optional().nullable(),
        })
        .optional()
        .nullable(),
      elevenlabs: z
        .object({
          apiKey: z.string().optional().nullable(),
          model: z.string().optional().nullable(),
          voiceId: z.string().optional().nullable(),
        })
        .optional()
        .nullable(),
      instructions: z.string().optional().nullable(),
      openai: z
        .object({
          apiKey: z.string().optional().nullable(),
          model: z.string().optional().nullable(),
        })
        .optional()
        .nullable(),
      pitch: z.number().optional().nullable(),
      provider: z.enum(['openai', 'deepgram', 'elevenlabs']).optional().nullable(),
      speed: z.number().optional().nullable(),
      voice: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
})

export const adminVoicePreviewEndpoint: Endpoint = {
  method: 'post',
  path: '/gm/admin/voice-preview',
  handler: async (req) => {
    const denied = requireAdmin(req)
    if (denied) {
      return denied
    }

    try {
      const body = previewSchema.parse(req.json ? await req.json() : {})
      const speech = await generateSpeech({
        payload: req.payload,
        text: body.text,
        voiceSettingsOverride: body.voiceSettings || undefined,
      })

      return new Response(speech.audio, {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': speech.mimeType,
        },
        status: 200,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate preview audio.'
      return Response.json(
        {
          error: 'voice_preview_failed',
          message,
        },
        { status: 500 },
      )
    }
  },
}
