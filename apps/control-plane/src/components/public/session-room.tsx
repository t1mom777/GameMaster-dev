'use client'

import { LoaderCircle, Mic, MicOff, Radio, RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { RemoteTrack, Room, RoomEvent, Track } from 'livekit-client'

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

export function SessionRoom(props: SessionRoomProps) {
  const [playerName, setPlayerName] = useState(props.initialPlayerName || '')
  const [joinBundle, setJoinBundle] = useState<JoinBundle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [participantNames, setParticipantNames] = useState<string[]>([])
  const roomRef = useRef<Room | null>(null)
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())

  useEffect(() => {
    if (props.authenticatedPlayer?.displayName) {
      setPlayerName(props.authenticatedPlayer.displayName)
      return
    }

    const stored = window.localStorage.getItem('gm-player-name')
    if (stored) {
      setPlayerName(stored)
      return
    }

    if (props.initialPlayerName) {
      setPlayerName(props.initialPlayerName)
    }
  }, [props.authenticatedPlayer?.displayName, props.initialPlayerName])

  useEffect(() => {
    if (!joinBundle) {
      return
    }

    const room = new Room()
    roomRef.current = room

    const syncParticipants = () => {
      const names = [room.localParticipant.name || room.localParticipant.identity]
      room.remoteParticipants.forEach((participant) => {
        names.push(participant.name || participant.identity)
      })
      setParticipantNames(names)
    }

    const attachAudio = (track: RemoteTrack, sid: string) => {
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

    const detachAudio = (sid: string, track?: RemoteTrack) => {
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

    room
      .connect(joinBundle.serverUrl, joinBundle.token)
      .then(async () => {
        await room.localParticipant.setMicrophoneEnabled(true)
        syncParticipants()
        setIsConnected(true)
        setMicEnabled(true)
      })
      .catch((connectError) => {
        setError(connectError instanceof Error ? connectError.message : 'Unable to connect to room.')
      })

    room.on(RoomEvent.ParticipantConnected, syncParticipants)
    room.on(RoomEvent.ParticipantDisconnected, syncParticipants)
    room.on(RoomEvent.LocalTrackPublished, syncParticipants)
    room.on(RoomEvent.Disconnected, () => {
      setIsConnected(false)
      setParticipantNames([])
    })
    room.on(RoomEvent.TrackSubscribed, (track, _publication, _participant) => {
      if (track instanceof RemoteTrack) {
        if (track.sid) {
          attachAudio(track, track.sid)
        }
      }
      syncParticipants()
    })
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track instanceof RemoteTrack) {
        if (track.sid) {
          detachAudio(track.sid, track)
        }
      }
      syncParticipants()
    })

    return () => {
      room.removeAllListeners()
      for (const [sid, audio] of audioElementsRef.current.entries()) {
        audio.remove()
        audioElementsRef.current.delete(sid)
      }
      room.disconnect()
      roomRef.current = null
    }
  }, [joinBundle])

  const heading = useMemo(() => {
    if (isConnected) {
      return 'Connected to the table'
    }
    if (isJoining) {
      return 'Preparing your room token'
    }
    return 'Join with voice'
  }, [isConnected, isJoining])

  async function joinSession() {
    setIsJoining(true)
    setError(null)

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

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to join session.')
      }

      window.localStorage.setItem('gm-player-name', playerName)
      setJoinBundle(payload)
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Unable to join session.')
    } finally {
      setIsJoining(false)
    }
  }

  async function toggleMic() {
    const room = roomRef.current
    if (!room) {
      return
    }
    const next = !micEnabled
    await room.localParticipant.setMicrophoneEnabled(next)
    setMicEnabled(next)
  }

  return (
    <section className="room-card">
      <div className="room-card__header">
        <div>
          <p className="room-card__eyebrow">LiveKit session</p>
          <h2>{heading}</h2>
        </div>
        <div className={`status-dot ${isConnected ? 'status-dot--live' : ''}`}>
          <Radio size={16} />
          {isConnected ? 'Live' : 'Idle'}
        </div>
      </div>

      {props.welcomeText && <p className="room-card__welcome">{props.welcomeText}</p>}

      {props.authenticatedPlayer && (
        <div className="auth-inline-card">
          <span className="pill pill--signal">Google player session</span>
          <strong>{props.authenticatedPlayer.displayName}</strong>
          <p>{props.authenticatedPlayer.email}</p>
        </div>
      )}

      <label className="field">
        <span>Player name</span>
        <input
          onChange={(event) => setPlayerName(event.target.value)}
          placeholder="Dmitry, Sage, or Table Guest"
          value={playerName}
        />
      </label>

      <div className="room-card__actions">
        <button
          className="button button--primary"
          disabled={isJoining || isConnected || playerName.trim().length < 2}
          onClick={joinSession}
          type="button"
        >
          {isJoining ? <LoaderCircle className="spin" size={18} /> : 'Join voice table'}
        </button>

        <button className="button" disabled={!isConnected} onClick={toggleMic} type="button">
          {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
          {micEnabled ? 'Mute mic' : 'Unmute mic'}
        </button>

        <button
          className="button"
          disabled={!joinBundle}
          onClick={() => window.location.reload()}
          type="button"
        >
          <RefreshCcw size={18} />
          Reset room
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="room-card__panel">
        <div>
          <span>Session</span>
          <strong>{props.title}</strong>
        </div>
        <div>
          <span>Voice mode</span>
          <strong>Auto VAD primary</strong>
        </div>
        <div>
          <span>Participants</span>
          <strong>{participantNames.length || 0}</strong>
        </div>
        <div>
          <span>Server</span>
          <strong>{joinBundle ? new URL(joinBundle.serverUrl).host : 'Available after join'}</strong>
        </div>
      </div>

      <div className="room-card__hint">
        The room client is live once the browser has a token. Remote GM speech plays through the hidden audio attachments on this page.
      </div>

      <div className="participant-list">
        {participantNames.map((name) => (
          <span className="participant-pill" key={name}>
            {name}
          </span>
        ))}
        {!participantNames.length && <span className="participant-pill">Waiting for room join</span>}
      </div>
    </section>
  )
}
