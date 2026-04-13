'use client'

import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Mic,
  MicOff,
  Radio,
  RefreshCcw,
  Settings2,
  UsersRound,
} from 'lucide-react'
import { ParticipantKind, RemoteTrack, Room, RoomEvent, Track } from 'livekit-client'
import { useEffect, useMemo, useRef, useState } from 'react'

import { readApiPayload } from './api-response'

type JoinBundle = {
  roomName: string
  serverUrl: string
  token: string
}

type AuthenticatedPlayer = {
  displayName: string
  email: string
}

type SessionRoomProps = {
  authenticatedPlayer?: AuthenticatedPlayer | null
  initialPlayerName?: string
  sessionSlug: string
  title: string
  welcomeText: string
}

type ParticipantEntry = {
  identity: string
  isAgent: boolean
  isLocal: boolean
  label: string
}

type PersistedMapping = {
  livekitIdentity: string
  mappedName: string
  participantLabel: string
}

const AUDIO_STORAGE_KEY = 'gm-preferred-mic'
const NAME_STORAGE_KEY = 'gm-player-name'

type LegacyCompatibleRoom = Room & {
  engine?: {
    __gmLegacyRtcPathForced?: boolean
    client?: {
      useV0SignalPath?: boolean
    }
    join?: (
      url: string,
      token: string,
      opts: unknown,
      abortSignal?: AbortSignal,
      useV0Path?: boolean,
    ) => Promise<unknown>
  }
}

function buildParticipantRoster(room: Room, playerName: string, fallbackTitle: string): ParticipantEntry[] {
  const nextRoster: ParticipantEntry[] = [
    {
      identity: room.localParticipant.identity,
      isAgent: false,
      isLocal: true,
      label: room.localParticipant.name || playerName || fallbackTitle,
    },
  ]

  room.remoteParticipants.forEach((participant) => {
    nextRoster.push({
      identity: participant.identity,
      isAgent: participant.kind === ParticipantKind.AGENT,
      isLocal: false,
      label: participant.name || participant.identity,
    })
  })

  return nextRoster
}

function buildRosterKey(participants: ParticipantEntry[]): string {
  return participants
    .filter((participant) => !participant.isAgent)
    .map((participant) => participant.identity)
    .sort()
    .join('|')
}

function formatSessionError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback
  }

  const message = error.message.trim()
  if (!message) {
    return fallback
  }

  if (/unexpected token .*bad gateway/i.test(message) || /\bbad gateway\b/i.test(message)) {
    return 'The realtime voice service returned a gateway error while starting. Wait a few seconds, then try again.'
  }

  if (/could not establish pc connection/i.test(message)) {
    return 'The browser could not establish the realtime voice connection. Refresh the page and try again.'
  }

  return message
}

function forceLegacyRtcSignalPath(room: Room) {
  const legacyRoom = room as LegacyCompatibleRoom
  const engine = legacyRoom.engine
  if (!engine?.join || engine.__gmLegacyRtcPathForced) {
    return
  }

  const originalJoin = engine.join.bind(engine) as LegacyCompatibleRoom['engine']['join']
  engine.join = ((url, token, opts, abortSignal) =>
    originalJoin?.(url, token, opts, abortSignal, true)) as LegacyCompatibleRoom['engine']['join']

  if (engine.client) {
    ;(engine.client as { useV0SignalPath?: boolean }).useV0SignalPath = true
  }

  engine.__gmLegacyRtcPathForced = true
}

export function SessionRoom(props: SessionRoomProps) {
  const [playerName, setPlayerName] = useState(props.initialPlayerName || '')
  const [joinBundle, setJoinBundle] = useState<JoinBundle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'preflight' | 'connecting' | 'mapping' | 'live'>('preflight')
  const [isConnected, setIsConnected] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [selectedMicId, setSelectedMicId] = useState('')
  const [micCheckState, setMicCheckState] = useState<'idle' | 'checking' | 'ready' | 'blocked'>('idle')
  const [participantRoster, setParticipantRoster] = useState<ParticipantEntry[]>([])
  const [persistedMappings, setPersistedMappings] = useState<Record<string, PersistedMapping>>({})
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, string>>({})
  const [isLoadingMappings, setIsLoadingMappings] = useState(false)
  const [isSavingMappings, setIsSavingMappings] = useState(false)
  const [loadedMappingsRosterKey, setLoadedMappingsRosterKey] = useState('')
  const [mappingStatus, setMappingStatus] = useState<string | null>(null)
  const [acknowledgedRosterKey, setAcknowledgedRosterKey] = useState('')
  const roomRef = useRef<Room | null>(null)
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())

  useEffect(() => {
    if (props.authenticatedPlayer?.displayName) {
      setPlayerName(props.authenticatedPlayer.displayName)
      return
    }

    const stored = window.localStorage.getItem(NAME_STORAGE_KEY)
    if (stored) {
      setPlayerName(stored)
      return
    }

    if (props.initialPlayerName) {
      setPlayerName(props.initialPlayerName)
    }
  }, [props.authenticatedPlayer?.displayName, props.initialPlayerName])

  useEffect(() => {
    let mounted = true

    async function loadAudioInputs() {
      if (!navigator.mediaDevices?.enumerateDevices) {
        return
      }

      const devices = await navigator.mediaDevices.enumerateDevices()
      const nextInputs = devices.filter((device) => device.kind === 'audioinput')
      if (!mounted) {
        return
      }

      setAudioInputs(nextInputs)
      const rememberedId = window.localStorage.getItem(AUDIO_STORAGE_KEY) || ''
      const nextSelected =
        nextInputs.find((device) => device.deviceId === selectedMicId)?.deviceId ||
        nextInputs.find((device) => device.deviceId === rememberedId)?.deviceId ||
        nextInputs[0]?.deviceId ||
        ''

      setSelectedMicId((current) => current || nextSelected)
    }

    void loadAudioInputs()

    navigator.mediaDevices?.addEventListener?.('devicechange', loadAudioInputs)

    return () => {
      mounted = false
      navigator.mediaDevices?.removeEventListener?.('devicechange', loadAudioInputs)
    }
  }, [selectedMicId])

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect()
      roomRef.current = null

      for (const [sid, audio] of audioElementsRef.current.entries()) {
        audio.remove()
        audioElementsRef.current.delete(sid)
      }
    }
  }, [])

  const humanParticipants = useMemo(
    () => participantRoster.filter((participant) => !participant.isAgent),
    [participantRoster],
  )
  const rosterKey = useMemo(
    () => humanParticipants.map((participant) => participant.identity).sort().join('|'),
    [humanParticipants],
  )
  const participantDisplay = useMemo(
    () =>
      participantRoster.map((participant) => ({
        ...participant,
        mappedName:
          mappingDrafts[participant.identity] ||
          persistedMappings[participant.identity]?.mappedName ||
          participant.label,
      })),
    [mappingDrafts, participantRoster, persistedMappings],
  )

  useEffect(() => {
    if (!participantRoster.length) {
      return
    }

    setMappingDrafts((current) => {
      const next = { ...current }

      for (const participant of participantRoster) {
        if (!participant.isAgent && !next[participant.identity]) {
          next[participant.identity] =
            persistedMappings[participant.identity]?.mappedName ||
            (participant.isLocal ? playerName : participant.label)
        }
      }

      return next
    })
  }, [participantRoster, persistedMappings, playerName])

  useEffect(() => {
    if (isConnected && humanParticipants.length > 1 && rosterKey && rosterKey !== acknowledgedRosterKey) {
      setStep('mapping')
      setMappingStatus(null)
    }
  }, [acknowledgedRosterKey, humanParticipants.length, isConnected, rosterKey])

  useEffect(() => {
    if (
      !isConnected ||
      humanParticipants.length < 2 ||
      !rosterKey ||
      rosterKey === loadedMappingsRosterKey ||
      isLoadingMappings
    ) {
      return
    }

    void loadMappings(rosterKey)
  }, [humanParticipants.length, isConnected, isLoadingMappings, loadedMappingsRosterKey, rosterKey])

  useEffect(() => {
    if (!isConnected || humanParticipants.length > 1 || !rosterKey) {
      return
    }

    setAcknowledgedRosterKey(rosterKey)
    if (step === 'mapping') {
      setStep('live')
    }
  }, [humanParticipants.length, isConnected, rosterKey, step])

  async function loadMappings(targetRosterKey = '') {
    setIsLoadingMappings(true)

    try {
      const response = await fetch(
        `/api/gm/public/player-mappings?sessionSlug=${encodeURIComponent(props.sessionSlug)}`,
        {
          cache: 'no-store',
        },
      )

      const payload = await readApiPayload<{ mappings?: PersistedMapping[] }>(
        response,
        'Unable to load speaker labels.',
      )
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to load speaker labels.')
      }

      setPersistedMappings(
        Object.fromEntries(
          (payload.mappings || []).map((mapping) => [mapping.livekitIdentity, mapping]),
        ),
      )
      setLoadedMappingsRosterKey(targetRosterKey || rosterKey)
    } catch (mappingError) {
      setMappingStatus(
        mappingError instanceof Error ? mappingError.message : 'Unable to load player labels.',
      )
    } finally {
      setIsLoadingMappings(false)
    }
  }

  async function runMicCheck() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicCheckState('blocked')
      setError('This browser cannot access microphone devices.')
      return
    }

    setMicCheckState('checking')
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true,
      })

      stream.getTracks().forEach((track) => track.stop())
      window.localStorage.setItem(AUDIO_STORAGE_KEY, selectedMicId)
      setMicCheckState('ready')
    } catch (deviceError) {
      setMicCheckState('blocked')
      setError(
        deviceError instanceof Error
          ? deviceError.message
          : 'Microphone access was blocked for this game session.',
      )
    }
  }

  function syncParticipants(room: Room): ParticipantEntry[] {
    const nextRoster = buildParticipantRoster(room, playerName, props.title)
    setParticipantRoster(nextRoster)
    return nextRoster
  }

  function attachAudio(track: RemoteTrack, sid: string) {
    if (track.kind !== Track.Kind.Audio) {
      return
    }

    let audio = audioElementsRef.current.get(sid)
    if (!audio) {
      audio = document.createElement('audio')
      audio.autoplay = true
      audio.dataset.trackSid = sid
      document.body.appendChild(audio)
      audioElementsRef.current.set(sid, audio)
    }

    track.attach(audio)
  }

  function detachAudio(sid: string, track?: RemoteTrack) {
    const audio = audioElementsRef.current.get(sid)
    if (!audio) {
      return
    }

    if (track) {
      track.detach(audio)
    }

    audio.remove()
    audioElementsRef.current.delete(sid)
  }

  async function connectToRoom(bundle: JoinBundle) {
    const room = new Room()
    forceLegacyRtcSignalPath(room)
    roomRef.current = room

    room.on(RoomEvent.ParticipantConnected, () => syncParticipants(room))
    room.on(RoomEvent.ParticipantDisconnected, () => syncParticipants(room))
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track instanceof RemoteTrack && track.sid) {
        attachAudio(track, track.sid)
      }
      syncParticipants(room)
    })
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track instanceof RemoteTrack && track.sid) {
        detachAudio(track.sid, track)
      }
      syncParticipants(room)
    })
    room.on(RoomEvent.Disconnected, () => {
      setIsConnected(false)
      setParticipantRoster([])
      setStep('preflight')
      setJoinBundle(null)
      setLoadedMappingsRosterKey('')
      setAcknowledgedRosterKey('')
    })

    await room.connect(bundle.serverUrl, bundle.token)
    await room.localParticipant.setMicrophoneEnabled(true)

    if (selectedMicId) {
      try {
        await room.switchActiveDevice('audioinput', selectedMicId)
      } catch {
        // Device switching is best-effort. Stay connected even if it fails.
      }
    }

    const nextRoster = syncParticipants(room)
    const nextHumanParticipants = nextRoster.filter((participant) => !participant.isAgent)
    const nextRosterKey = buildRosterKey(nextRoster)

    setJoinBundle(bundle)
    setIsConnected(true)
    setMicEnabled(true)

    if (nextHumanParticipants.length > 1) {
      setAcknowledgedRosterKey('')
      setStep('mapping')
    } else {
      setAcknowledgedRosterKey(nextRosterKey)
      setStep('live')
    }
  }

  async function joinSession() {
    setError(null)

    if (micCheckState !== 'ready') {
      setError('Run the microphone check before starting the game.')
      return
    }

    setStep('connecting')

    try {
      const response = await fetch('/api/gm/public/join', {
        body: JSON.stringify({
          playerName,
          sessionSlug: props.sessionSlug,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      const payload = await readApiPayload<JoinBundle>(response, 'Unable to start this game session.')
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to start this game session.')
      }

      window.localStorage.setItem(NAME_STORAGE_KEY, playerName)
      await connectToRoom(payload)
    } catch (joinError) {
      setError(formatSessionError(joinError, 'Unable to start this game session.'))
      setStep('preflight')
    }
  }

  async function saveMappingsAndContinue() {
    const nextMappings = humanParticipants.map((participant) => ({
      livekitIdentity: participant.identity,
      mappedName: (mappingDrafts[participant.identity] || participant.label).trim(),
      participantLabel: participant.label,
    }))

    if (nextMappings.some((mapping) => mapping.mappedName.length < 2)) {
      setMappingStatus('Give each player a short label before continuing.')
      return
    }

    setIsSavingMappings(true)
    setMappingStatus(null)

    try {
      const response = await fetch('/api/gm/public/player-mappings', {
        body: JSON.stringify({
          mappings: nextMappings,
          sessionSlug: props.sessionSlug,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      const payload = await readApiPayload<{ mappings?: PersistedMapping[] }>(
        response,
        'Unable to save player labels.',
      )
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to save player labels.')
      }

      setPersistedMappings(
        Object.fromEntries(
          (payload.mappings || []).map((mapping) => [mapping.livekitIdentity, mapping]),
        ),
      )
      setAcknowledgedRosterKey(rosterKey)
      setStep('live')
    } catch (mappingError) {
      setMappingStatus(
        mappingError instanceof Error ? mappingError.message : 'Unable to save player labels.',
      )
    } finally {
      setIsSavingMappings(false)
    }
  }

  async function toggleMic() {
    const room = roomRef.current
    if (!room) {
      return
    }

    const nextState = !micEnabled
    await room.localParticipant.setMicrophoneEnabled(nextState)
    setMicEnabled(nextState)
  }

  function resetRoom() {
    roomRef.current?.disconnect()
    roomRef.current = null
    setJoinBundle(null)
    setIsConnected(false)
    setMicEnabled(true)
    setParticipantRoster([])
    setPersistedMappings({})
    setMappingDrafts({})
    setLoadedMappingsRosterKey('')
    setMappingStatus(null)
    setAcknowledgedRosterKey('')
    setStep('preflight')
  }

  const liveSummary = useMemo(() => {
    if (step === 'connecting') {
      return 'Connecting voice'
    }

    if (step === 'mapping') {
      return 'Confirming speakers'
    }

    if (isConnected) {
      return 'Session live'
    }

    return 'Ready to play'
  }, [isConnected, step])

  return (
    <section className="console-card">
      <div className="console-card__header">
        <div>
          <p className="eyebrow">Voice session</p>
          <h2>{liveSummary}</h2>
        </div>

        <div className={`status-chip ${isConnected ? 'status-chip--live' : ''}`}>
          <Radio size={16} />
          {isConnected ? 'Connected' : 'Standing by'}
        </div>
      </div>

      {props.welcomeText && <p className="console-card__lede">{props.welcomeText}</p>}

      <div className="identity-chip">
        <span className="pill">Signed in</span>
        <div>
          <strong>{props.authenticatedPlayer?.displayName}</strong>
          <p>{props.authenticatedPlayer?.email}</p>
        </div>
      </div>

      {step === 'preflight' && (
        <div className="stack-panel">
          <div className="panel-card">
            <div className="panel-card__header">
              <div>
                <p className="eyebrow">Step 1</p>
                <h3>Check your mic</h3>
              </div>
              <Settings2 size={18} />
            </div>

            <label className="field">
              <span>Player label</span>
              <input
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="Your table name"
                value={playerName}
              />
            </label>

            <label className="field">
              <span>Microphone</span>
              <select
                onChange={(event) => setSelectedMicId(event.target.value)}
                value={selectedMicId}
              >
                {audioInputs.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || 'Default microphone'}
                  </option>
                ))}
                {!audioInputs.length && <option value="">Default microphone</option>}
              </select>
            </label>

            <div className="inline-actions">
              <button className="button button--ghost" onClick={runMicCheck} type="button">
                {micCheckState === 'checking' ? <LoaderCircle className="spin" size={18} /> : <Mic size={18} />}
                {micCheckState === 'ready' ? 'Mic checked' : 'Run mic check'}
              </button>

              <button
                className="button button--primary"
                disabled={playerName.trim().length < 2 || micCheckState !== 'ready'}
                onClick={joinSession}
                type="button"
              >
                Start with VAD
                <ArrowRight size={18} />
              </button>
            </div>

            <div className="status-line">
              {micCheckState === 'ready' && (
                <>
                  <CheckCircle2 size={16} />
                  Your microphone is ready for this session.
                </>
              )}
              {micCheckState === 'idle' && 'Run a quick mic check before you start.'}
              {micCheckState === 'blocked' && 'Microphone access is blocked for this browser session.'}
            </div>
          </div>
        </div>
      )}

      {step === 'connecting' && (
        <div className="panel-card panel-card--centered">
          <LoaderCircle className="spin" size={22} />
          <h3>Connecting voice</h3>
          <p>Your voice session is opening now.</p>
        </div>
      )}

      {step === 'mapping' && (
        <div className="panel-card">
          <div className="panel-card__header">
            <div>
              <p className="eyebrow">Step 2</p>
              <h3>Who is who?</h3>
            </div>
            <UsersRound size={18} />
          </div>

          <p className="panel-card__copy">
            More than one human player is present. Confirm the labels so the session can keep
            voices straight.
          </p>

          {isLoadingMappings && (
            <div className="status-line">
              <LoaderCircle className="spin" size={16} />
              Loading saved speaker labels.
            </div>
          )}

          <div className="mapping-list">
            {humanParticipants.map((participant) => (
              <label className="mapping-row" key={participant.identity}>
                <span>{participant.label}</span>
                <input
                  onChange={(event) =>
                    setMappingDrafts((current) => ({
                      ...current,
                      [participant.identity]: event.target.value,
                    }))
                  }
                  placeholder={participant.isLocal ? 'You' : 'Player name'}
                  value={mappingDrafts[participant.identity] || ''}
                />
              </label>
            ))}
          </div>

          {mappingStatus && <div className="notice-card">{mappingStatus}</div>}

          <div className="inline-actions">
            <button
              className="button button--primary"
              disabled={isSavingMappings}
              onClick={saveMappingsAndContinue}
              type="button"
            >
              {isSavingMappings ? <LoaderCircle className="spin" size={18} /> : 'Save labels'}
            </button>
            <button
              className="button button--ghost"
              onClick={() => {
                setAcknowledgedRosterKey(rosterKey)
                setStep('live')
              }}
              type="button"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 'live' && (
        <div className="stack-panel">
          <div className="session-strip">
            <div>
              <span>Session</span>
              <strong>{props.title}</strong>
            </div>
            <div>
              <span>Participants</span>
              <strong>{humanParticipants.length}</strong>
            </div>
            <div>
              <span>Audio</span>
              <strong>{micEnabled ? 'Mic live' : 'Mic muted'}</strong>
            </div>
            <div>
              <span>Voice mode</span>
              <strong>Auto VAD</strong>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-card__header">
              <div>
                <p className="eyebrow">Now playing</p>
                <h3>Stay in scene</h3>
              </div>
              <Radio size={18} />
            </div>
            <p className="panel-card__copy">
              Keep this page open. Voice controls stay lightweight so the game stays focused on the
              scene instead of the control surface.
            </p>

            <div className="inline-actions">
              <button className="button button--ghost" disabled={!isConnected} onClick={toggleMic} type="button">
                {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                {micEnabled ? 'Mute mic' : 'Unmute mic'}
              </button>

              {humanParticipants.length > 1 && (
                <button className="button button--ghost" onClick={() => setStep('mapping')} type="button">
                  Review player labels
                </button>
              )}

              <button className="button button--ghost" onClick={resetRoom} type="button">
                <RefreshCcw size={18} />
                Leave session
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="notice-card">{error}</div>}

      <div className="participant-board">
        {participantDisplay.map((participant) => (
          <div className="participant-pill" key={participant.identity}>
            <strong>{participant.mappedName}</strong>
            <span>
              {participant.isAgent ? 'GM' : participant.isLocal ? 'You' : 'Player'}
            </span>
          </div>
        ))}

        {!participantDisplay.length && (
          <div className="participant-pill participant-pill--empty">Start the voice session to load the table.</div>
        )}
      </div>

      {joinBundle && (
        <div className="subtle-note">
          Voice session connected and ready.
        </div>
      )}
    </section>
  )
}
