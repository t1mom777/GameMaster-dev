'use client'

import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Mic,
  MicOff,
  OctagonX,
  Radio,
  RefreshCcw,
  Save,
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
  primaryRulebookTitle?: string | null
  readyBookCount: number
  rulebookReady: boolean
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
  speakingNotes?: string
}

type TableSeatDraft = {
  id: string
  label: string
  name: string
  notes: string
}

const AUDIO_STORAGE_KEY = 'gm-preferred-mic'
const NAME_STORAGE_KEY = 'gm-player-name'
const TABLE_SEAT_PREFIX = 'table-seat-'
const DEFAULT_TABLE_SEAT_COUNT = 4
const MAX_TABLE_SEAT_COUNT = 6

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

function clampTableSeatCount(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_TABLE_SEAT_COUNT
  }

  return Math.min(MAX_TABLE_SEAT_COUNT, Math.max(1, Math.trunc(value)))
}

function buildTableSeatId(index: number): string {
  return `${TABLE_SEAT_PREFIX}${index + 1}`
}

function buildTableSeatLabel(index: number): string {
  return `Seat ${index + 1}`
}

function buildTableSeatDrafts(
  source: Record<string, { name?: string; notes?: string }>,
  fallbackName: string,
): TableSeatDraft[] {
  return Array.from({ length: MAX_TABLE_SEAT_COUNT }, (_, index) => {
    const id = buildTableSeatId(index)
    const persisted = source[id] || {}

    return {
      id,
      label: buildTableSeatLabel(index),
      name: persisted.name || (index === 0 ? fallbackName : ''),
      notes: persisted.notes || '',
    }
  })
}

function sortTableMappings(mappings: PersistedMapping[]): PersistedMapping[] {
  return [...mappings].sort((left, right) => {
    const leftIndex = Number.parseInt(left.livekitIdentity.replace(TABLE_SEAT_PREFIX, ''), 10)
    const rightIndex = Number.parseInt(right.livekitIdentity.replace(TABLE_SEAT_PREFIX, ''), 10)

    if (Number.isFinite(leftIndex) && Number.isFinite(rightIndex)) {
      return leftIndex - rightIndex
    }

    return left.livekitIdentity.localeCompare(right.livekitIdentity)
  })
}

function normalizeLibraryGateMessage(primaryRulebookTitle?: string | null): string {
  if (primaryRulebookTitle) {
    return `${primaryRulebookTitle} is still indexing. Wait until the main rulebook is ready before opening voice.`
  }

  return 'Upload and finish indexing a main rulebook before opening voice.'
}

function formatTableSetupError(error: unknown, fallback: string): string {
  if (error instanceof TypeError || (error instanceof Error && /failed to fetch/i.test(error.message))) {
    return 'The browser could not reach the upload or save service. If the book is in a phone or cloud-sync folder, copy it locally and retry.'
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
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
  const [step, setStep] = useState<'preflight' | 'connecting' | 'live'>('preflight')
  const [isConnected, setIsConnected] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [selectedMicId, setSelectedMicId] = useState('')
  const [micCheckState, setMicCheckState] = useState<'idle' | 'checking' | 'ready' | 'blocked'>('idle')
  const [participantRoster, setParticipantRoster] = useState<ParticipantEntry[]>([])
  const [tableSeatCount, setTableSeatCount] = useState(DEFAULT_TABLE_SEAT_COUNT)
  const [tableSeatDrafts, setTableSeatDrafts] = useState<TableSeatDraft[]>(() =>
    buildTableSeatDrafts({}, props.initialPlayerName || ''),
  )
  const [isLoadingTableSetup, setIsLoadingTableSetup] = useState(true)
  const [isSavingTableSetup, setIsSavingTableSetup] = useState(false)
  const [tableStatus, setTableStatus] = useState<string | null>(null)
  const [conversationStatus, setConversationStatus] = useState<string | null>(null)
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
    setTableSeatDrafts((current) => {
      const next = [...current]
      if (!next[0] || next[0].name.trim()) {
        return current
      }

      next[0] = {
        ...next[0],
        name: playerName,
      }
      return next
    })
  }, [playerName])

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

  useEffect(() => {
    void loadTableSetup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sessionSlug])

  const visibleTableSeats = useMemo(
    () => tableSeatDrafts.slice(0, tableSeatCount),
    [tableSeatCount, tableSeatDrafts],
  )
  const connectedAgent = useMemo(
    () => participantRoster.find((participant) => participant.isAgent) || null,
    [participantRoster],
  )
  const tableSeatsReady = useMemo(
    () =>
      visibleTableSeats.length > 0 &&
      visibleTableSeats.every((seat) => seat.name.trim().length >= 2),
    [visibleTableSeats],
  )
  const tableSeatsWithNotes = useMemo(
    () => visibleTableSeats.filter((seat) => seat.notes.trim().length > 0).length,
    [visibleTableSeats],
  )

  async function loadTableSetup() {
    setIsLoadingTableSetup(true)

    try {
      const response = await fetch(
        `/api/gm/public/player-mappings?sessionSlug=${encodeURIComponent(props.sessionSlug)}`,
        {
          cache: 'no-store',
        },
      )

      const payload = await readApiPayload<{ mappings?: PersistedMapping[] }>(
        response,
        'Unable to load the table setup.',
      )
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to load the table setup.')
      }

      const tableMappings = sortTableMappings(
        (payload.mappings || []).filter((mapping) =>
          mapping.livekitIdentity.startsWith(TABLE_SEAT_PREFIX),
        ),
      )
      const nextSeatCount = clampTableSeatCount(tableMappings.length || DEFAULT_TABLE_SEAT_COUNT)
      const seed = Object.fromEntries(
        tableMappings.map((mapping) => [
          mapping.livekitIdentity,
          {
            name: mapping.mappedName,
            notes: mapping.speakingNotes || '',
          },
        ]),
      )

      setTableSeatCount(nextSeatCount)
      setTableSeatDrafts(buildTableSeatDrafts(seed, playerName || props.initialPlayerName || ''))
      setTableStatus(tableMappings.length ? 'Saved table labels loaded.' : null)
    } catch (mappingError) {
      setTableStatus(
        formatTableSetupError(mappingError, 'Unable to load the table setup.'),
      )
    } finally {
      setIsLoadingTableSetup(false)
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
          : 'Microphone access was blocked for this table session.',
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
      audio.muted = false
      audio.setAttribute('playsinline', 'true')
      audio.dataset.trackSid = sid
      document.body.appendChild(audio)
      audioElementsRef.current.set(sid, audio)
    }

    track.attach(audio)
    void audio.play().catch((playbackError) => {
      console.warn('Unable to start remote room audio playback.', playbackError)
    })
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
      setMicEnabled(true)
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

    syncParticipants(room)
    setJoinBundle(bundle)
    setIsConnected(true)
    setMicEnabled(true)
    setStep('live')
  }

  async function saveTableSetup(showSuccessMessage: boolean): Promise<boolean> {
    if (!tableSeatsReady) {
      setTableStatus('Add a short name for every seat before you continue.')
      return false
    }

    setIsSavingTableSetup(true)

    try {
      const response = await fetch('/api/gm/public/player-mappings', {
        body: JSON.stringify({
          mappings: visibleTableSeats.map((seat) => ({
            livekitIdentity: seat.id,
            mappedName: seat.name.trim(),
            participantLabel: seat.label,
            speakingNotes: seat.notes.trim() || undefined,
          })),
          replaceTableRoster: true,
          sessionSlug: props.sessionSlug,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      const payload = await readApiPayload<{ mappings?: PersistedMapping[] }>(
        response,
        'Unable to save the table setup.',
      )
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to save the table setup.')
      }

      const tableMappings = sortTableMappings(
        (payload.mappings || []).filter((mapping) =>
          mapping.livekitIdentity.startsWith(TABLE_SEAT_PREFIX),
        ),
      )
      const nextSeatCount = clampTableSeatCount(tableMappings.length || tableSeatCount)
      const seed = Object.fromEntries(
        tableMappings.map((mapping) => [
          mapping.livekitIdentity,
          {
            name: mapping.mappedName,
            notes: mapping.speakingNotes || '',
          },
        ]),
      )

      setTableSeatCount(nextSeatCount)
      setTableSeatDrafts(buildTableSeatDrafts(seed, playerName))
      setTableStatus(showSuccessMessage ? 'Table names saved for this session.' : null)
      return true
    } catch (mappingError) {
      setTableStatus(formatTableSetupError(mappingError, 'Unable to save the table setup.'))
      return false
    } finally {
      setIsSavingTableSetup(false)
    }
  }

  async function joinSession() {
    setError(null)
    setConversationStatus(null)

    if (!props.rulebookReady) {
      setError(normalizeLibraryGateMessage(props.primaryRulebookTitle))
      return
    }

    if (micCheckState !== 'ready') {
      setError('Run the microphone check before starting the game.')
      return
    }

    if (playerName.trim().length < 2) {
      setError('Give the signed-in player a short label before starting.')
      return
    }

    setStep('connecting')

    const saved = await saveTableSetup(false)
    if (!saved) {
      setStep('preflight')
      return
    }

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

  async function toggleMic() {
    const room = roomRef.current
    if (!room) {
      return
    }

    const nextState = !micEnabled
    await room.localParticipant.setMicrophoneEnabled(nextState)
    setMicEnabled(nextState)
  }

  function stopConversation() {
    setConversationStatus('Conversation stopped. Reopen setup whenever you want to start voice again.')
    resetRoom()
  }

  function resetRoom() {
    roomRef.current?.disconnect()
    roomRef.current = null
    setJoinBundle(null)
    setIsConnected(false)
    setMicEnabled(true)
    setParticipantRoster([])
    setError(null)
    setStep('preflight')
  }

  const liveSummary = useMemo(() => {
    if (step === 'connecting') {
      return 'Connecting voice'
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

      {!props.rulebookReady && (
        <div className="notice-card">
          {normalizeLibraryGateMessage(props.primaryRulebookTitle)}
        </div>
      )}

      {step === 'preflight' && (
        <div className="stack-panel">
          <div className="panel-card">
            <div className="panel-card__header">
              <div>
                <p className="eyebrow">Step 1</p>
                <h3>Check the shared mic</h3>
              </div>
              <Settings2 size={18} />
            </div>

            <label className="field">
              <span>Signed-in player label</span>
              <input
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="Who is launching the session?"
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
            </div>

            <div className="status-line">
              {micCheckState === 'ready' && (
                <>
                  <CheckCircle2 size={16} />
                  The shared microphone is ready.
                </>
              )}
              {micCheckState === 'idle' && 'Run a quick mic check before the table starts.'}
              {micCheckState === 'blocked' && 'Microphone access is blocked for this browser session.'}
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-card__header">
              <div>
                <p className="eyebrow">Step 2</p>
                <h3>Name the people at the table</h3>
              </div>
              <UsersRound size={18} />
            </div>

            <p className="panel-card__copy">
              Everyone shares one device and one microphone. Save the seat names now so the GM has a
              stable roster before the scene starts.
            </p>

            {isLoadingTableSetup && (
              <div className="status-line">
                <LoaderCircle className="spin" size={16} />
                Loading saved table labels.
              </div>
            )}

            <label className="field">
              <span>People at this microphone</span>
              <select
                onChange={(event) => setTableSeatCount(clampTableSeatCount(Number.parseInt(event.target.value, 10)))}
                value={tableSeatCount}
              >
                {Array.from({ length: MAX_TABLE_SEAT_COUNT }, (_, index) => {
                  const count = index + 1
                  return (
                    <option key={count} value={count}>
                      {count} {count === 1 ? 'person' : 'people'}
                    </option>
                  )
                })}
              </select>
            </label>

            <div className="table-seat-grid">
              {visibleTableSeats.map((seat) => (
                <div className="table-seat-card" key={seat.id}>
                  <div className="table-seat-card__header">
                    <strong>{seat.label}</strong>
                    <span>Short name plus optional cue</span>
                  </div>

                  <label className="field">
                    <span>Name</span>
                    <input
                      onChange={(event) =>
                        setTableSeatDrafts((current) =>
                          current.map((entry) =>
                            entry.id === seat.id ? { ...entry, name: event.target.value } : entry,
                          ),
                        )
                      }
                      placeholder="Player or character name"
                      value={seat.name}
                    />
                  </label>

                  <label className="field">
                    <span>Quick cue</span>
                    <input
                      onChange={(event) =>
                        setTableSeatDrafts((current) =>
                          current.map((entry) =>
                            entry.id === seat.id ? { ...entry, notes: event.target.value } : entry,
                          ),
                        )
                      }
                      placeholder="Seat, character, or voice cue"
                      value={seat.notes}
                    />
                  </label>
                </div>
              ))}
            </div>

            {tableStatus && <div className="notice-card">{tableStatus}</div>}

            <div className="inline-actions">
              <button
                className="button button--ghost"
                disabled={isSavingTableSetup || isLoadingTableSetup}
                onClick={() => void saveTableSetup(true)}
                type="button"
              >
                {isSavingTableSetup ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />}
                Save table labels
              </button>

              <button
                className="button button--primary"
                disabled={isSavingTableSetup || !props.rulebookReady || !tableSeatsReady || micCheckState !== 'ready'}
                onClick={joinSession}
                type="button"
              >
                Start shared-mic VAD
                <ArrowRight size={18} />
              </button>
            </div>

            <div className="status-line">
              {props.rulebookReady
                ? `${props.readyBookCount} ready book${props.readyBookCount === 1 ? '' : 's'} will ground the next voice session.`
                : normalizeLibraryGateMessage(props.primaryRulebookTitle)}
            </div>
          </div>
        </div>
      )}

      {step === 'connecting' && (
        <div className="panel-card panel-card--centered">
          <LoaderCircle className="spin" size={22} />
          <h3>Connecting voice</h3>
          <p>Saving the table roster and opening the shared-mic session now.</p>
        </div>
      )}

      {step === 'live' && (
        <div className="stack-panel">
          <div className="session-strip">
            <div>
              <span>Table seats</span>
              <strong>{visibleTableSeats.length}</strong>
            </div>
            <div>
              <span>Connected room</span>
              <strong>{joinBundle?.roomName || 'Not connected'}</strong>
            </div>
            <div>
              <span>GM</span>
              <strong>{connectedAgent ? 'Listening' : 'Joining'}</strong>
            </div>
            <div>
              <span>Audio</span>
              <strong>{micEnabled ? 'Mic live' : 'Mic muted'}</strong>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-card__header">
              <div>
                <p className="eyebrow">Now playing</p>
                <h3>Keep the table in scene</h3>
              </div>
              <Radio size={18} />
            </div>
            <p className="panel-card__copy">
              Everyone shares one microphone. Speak naturally, pause between overlapping voices when
              you can, and keep the saved seat names stable across sessions.
            </p>

            <div className="inline-actions">
              <button className="button button--ghost" disabled={!isConnected} onClick={toggleMic} type="button">
                {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                {micEnabled ? 'Mute mic' : 'Unmute mic'}
              </button>

              <button className="button button--danger" onClick={stopConversation} type="button">
                <OctagonX size={18} />
                Stop conversation
              </button>

              <button className="button button--ghost" onClick={resetRoom} type="button">
                <RefreshCcw size={18} />
                Reopen setup
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="notice-card">{error}</div>}
      {conversationStatus && <div className="notice-card notice-card--muted">{conversationStatus}</div>}

      <div className="participant-board">
        {visibleTableSeats.map((seat) => (
          <div className="participant-pill" key={seat.id}>
            <strong>{seat.name.trim() || seat.label}</strong>
            <span>
              {seat.label}
              {seat.notes.trim() ? ` · ${seat.notes.trim()}` : ''}
            </span>
          </div>
        ))}

        <div className="participant-pill">
          <strong>Shared device</strong>
          <span>{isConnected ? 'Connected to the room' : 'Waiting to start'}</span>
        </div>

        <div className="participant-pill">
          <strong>GM</strong>
          <span>{connectedAgent ? 'Voice GM joined the room' : 'Starts after voice opens'}</span>
        </div>

        {!visibleTableSeats.length && (
          <div className="participant-pill participant-pill--empty">
            Add the people around this microphone before starting.
          </div>
        )}
      </div>

      {joinBundle && (
        <div className="subtle-note">
          Shared-mic voice is connected and ready.
        </div>
      )}

      <div className="subtle-note">
        {tableSeatsWithNotes
          ? `${tableSeatsWithNotes} seat cue${tableSeatsWithNotes === 1 ? '' : 's'} saved to help the GM keep the table straight.`
          : 'Add quick seat cues if two people sound similar on the same microphone.'}
      </div>
    </section>
  )
}
