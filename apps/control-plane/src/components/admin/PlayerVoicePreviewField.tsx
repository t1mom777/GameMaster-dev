'use client'

import React, { useMemo, useRef, useState } from 'react'
import { useDocumentInfo, useForm } from '@payloadcms/ui'

type PreviewState = 'idle' | 'loading' | 'ready' | 'error'

const defaultPreviewText =
  'You push open the tavern door. Warm light, wet boots, and twelve bad decisions look back at you. What does Dmytro do?'

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

export function PlayerVoicePreviewField() {
  const { getData } = useForm()
  const { collectionSlug } = useDocumentInfo()
  const [previewText, setPreviewText] = useState(defaultPreviewText)
  const [status, setStatus] = useState<PreviewState>('idle')
  const [error, setError] = useState('')
  const [audioURL, setAudioURL] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const disabled = collectionSlug !== 'players'
  const helperText = useMemo(
    () =>
      disabled
        ? 'Player voice preview is available only on player records.'
        : 'Tests how the GM voice will sound for sessions owned by this player.',
    [disabled],
  )

  async function handlePreview() {
    if (disabled) {
      return
    }

    setStatus('loading')
    setError('')

    try {
      const formData = asObject(getData())
      const ttsSettings = asObject(formData.ttsSettings)
      const useGlobalSettings = ttsSettings.useGlobalSettings !== false
      const response = await fetch('/api/gm/admin/voice-preview', {
        body: JSON.stringify({
          text: previewText,
          voiceSettings: useGlobalSettings
            ? null
            : {
                instructions: ttsSettings.instructions ?? null,
                pitch: ttsSettings.pitch ?? null,
                provider: ttsSettings.provider ?? null,
                speed: ttsSettings.speed ?? null,
                voice: ttsSettings.voice ?? null,
              },
        }),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(payload?.message || `Preview request failed with ${response.status}.`)
      }

      const blob = await response.blob()
      if (audioURL) {
        URL.revokeObjectURL(audioURL)
      }

      const nextAudioURL = URL.createObjectURL(blob)
      setAudioURL(nextAudioURL)
      setStatus('ready')

      requestAnimationFrame(() => {
        audioRef.current?.play().catch(() => undefined)
      })
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Unable to generate preview audio.')
    }
  }

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 12,
        marginTop: 8,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Player Voice Preview</div>
      <div style={{ color: 'var(--theme-text-dim)', fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
        {helperText}
      </div>
      <textarea
        disabled={disabled || status === 'loading'}
        onChange={(event) => setPreviewText(event.target.value)}
        rows={4}
        style={{
          background: 'var(--theme-input-bg)',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 8,
          color: 'var(--theme-text)',
          marginBottom: 12,
          minHeight: 104,
          padding: 12,
          resize: 'vertical',
          width: '100%',
        }}
        value={previewText}
      />
      <div style={{ alignItems: 'center', display: 'flex', gap: 12, marginBottom: audioURL ? 12 : 0 }}>
        <button
          disabled={disabled || status === 'loading' || !previewText.trim()}
          onClick={handlePreview}
          style={{
            background: disabled ? 'var(--theme-elevation-100)' : 'var(--theme-success-500)',
            border: 0,
            borderRadius: 999,
            color: disabled ? 'var(--theme-text-dim)' : '#08110c',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 700,
            padding: '10px 16px',
          }}
          type="button"
        >
          {status === 'loading' ? 'Generating preview...' : 'Preview Player Voice'}
        </button>
        {status === 'ready' ? (
          <span style={{ color: 'var(--theme-success-500)', fontSize: 13 }}>Preview ready</span>
        ) : null}
        {status === 'error' && error ? (
          <span style={{ color: 'var(--theme-error-500)', fontSize: 13 }}>{error}</span>
        ) : null}
      </div>
      {audioURL ? <audio controls ref={audioRef} src={audioURL} style={{ width: '100%' }} /> : null}
    </div>
  )
}

export default PlayerVoicePreviewField
