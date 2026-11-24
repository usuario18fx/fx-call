import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { ApiError, participantApi } from "@/src/api";
import { attachAudio, getLK, liveKitAvailable, startAudio, stopAudio, unavailableReason } from "./lk";

export type Tile = {
  id: string;
  name: string;
  isLocal: boolean;
  role: string;
  videoTrack: any | null;
  camOn: boolean;
  micOn: boolean;
  quality: "excellent" | "good" | "poor" | "lost" | "unknown";
  speaking: boolean;
};

export type CallStatus = "idle" | "connecting" | "connected" | "reconnecting" | "ended" | "error" | "unavailable";

const roleOf = (p: any) => {
  try {
    return JSON.parse(p.metadata || "{}").role || "participant";
  } catch {
    return "participant";
  }
};

/** Shared LiveKit call engine for iOS, Android and web (livekit-client on all three). */
export function useCall(roomId: string, enabled: boolean) {
  const [status, setStatus] = useState<CallStatus>(liveKitAvailable() ? "idle" : "unavailable");
  const [error, setError] = useState<string | null>(liveKitAvailable() ? null : unavailableReason);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const roomRef = useRef<any>(null);
  const audioCleanup = useRef(new Map<string, () => void>());
  const leaving = useRef(false);
  const retries = useRef(0);

  const rebuild = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const LK = getLK();
    const all = [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
    setTiles(
      all.map((p: any) => {
        const pub = p.getTrackPublication(LK.Track.Source.Camera);
        return {
          id: p.identity,
          name: p.name || "Guest",
          isLocal: p === room.localParticipant,
          role: roleOf(p),
          videoTrack: pub && !pub.isMuted && pub.track ? pub.track : null,
          camOn: !!pub && !pub.isMuted,
          micOn: p.isMicrophoneEnabled,
          quality: (p.connectionQuality as Tile["quality"]) || "unknown",
          speaking: p.isSpeaking,
        };
      }),
    );
  }, []);

  const connect = useCallback(async () => {
    if (!liveKitAvailable()) return;
    const LK = getLK();
    setStatus("connecting");
    setError(null);
    try {
      await startAudio();
      const { server_url, token } = await participantApi<{ server_url: string; token: string }>(roomId, "/media-token", { body: {} });
      const room = new LK.Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: { resolution: LK.VideoPresets.h720.resolution, facingMode: "user" },
        publishDefaults: { simulcast: true, videoCodec: "vp8" },
      });
      roomRef.current = room;
      const E = LK.RoomEvent;
      [E.ParticipantConnected, E.ParticipantDisconnected, E.TrackMuted, E.TrackUnmuted, E.LocalTrackPublished,
        E.LocalTrackUnpublished, E.ConnectionQualityChanged, E.ActiveSpeakersChanged, E.TrackUnsubscribed].forEach((ev) => room.on(ev, rebuild));
      room.on(E.TrackPublished, (pub: any) => {
        // Defence in depth: never subscribe to any screen-share source (server never grants it).
        if (pub.source === LK.Track.Source.ScreenShare || pub.source === LK.Track.Source.ScreenShareAudio) pub.setSubscribed(false);
      });
      room.on(E.TrackSubscribed, (track: any, pub: any) => {
        if (pub.source === LK.Track.Source.ScreenShare || pub.source === LK.Track.Source.ScreenShareAudio) {
          pub.setSubscribed(false);
          return;
        }
        if (track.kind === "audio") audioCleanup.current.set(track.sid, attachAudio(track));
        rebuild();
      });
      room.on(E.TrackUnsubscribed, (track: any) => {
        audioCleanup.current.get(track.sid)?.();
        audioCleanup.current.delete(track.sid);
      });
      room.on(E.Reconnecting, () => setStatus("reconnecting"));
      room.on(E.Reconnected, () => setStatus("connected"));
      room.on(E.Disconnected, (reason?: number) => {
        audioCleanup.current.forEach((fn) => fn());
        audioCleanup.current.clear();
        roomRef.current = null;
        setTiles([]);
        const R = LK.DisconnectReason;
        if (leaving.current || reason === R.CLIENT_INITIATED) return setStatus("ended");
        if (reason === R.PARTICIPANT_REMOVED || reason === R.ROOM_DELETED) {
          setError(reason === R.ROOM_DELETED ? "The host ended this meeting." : "You were removed from this meeting.");
          return setStatus("ended");
        }
        if (retries.current < 3) {
          retries.current += 1;
          setStatus("reconnecting");
          setTimeout(() => connect(), 1500 * retries.current);
        } else {
          setError("Connection lost. Please rejoin.");
          setStatus("error");
        }
      });
      await room.connect(server_url, token);
      retries.current = 0;
      setStatus("connected");
      try {
        await room.localParticipant.setCameraEnabled(true);
      } catch {
        setCamOn(false);
      }
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch {
        setMicOn(false);
      }
      rebuild();
    } catch (e) {
      setStatus("error");
      setError(e instanceof ApiError ? e.message : "Could not connect to the secure video server.");
    }
  }, [roomId, rebuild]);

  useEffect(() => {
    if (!enabled || status !== "idle") return;
    connect();
  }, [enabled, status, connect]);

  useEffect(
    () => () => {
      leaving.current = true;
      roomRef.current?.disconnect();
      if (Platform.OS !== "web" && liveKitAvailable()) stopAudio().catch(() => {});
    },
    [],
  );

  const report = (state: { camera_on?: boolean; mic_on?: boolean }) => participantApi(roomId, "/state", { body: state }).catch(() => {});

  const toggleMic = async () => {
    const next = !micOn;
    setMicOn(next);
    await roomRef.current?.localParticipant.setMicrophoneEnabled(next).catch(() => setMicOn(!next));
    report({ mic_on: next });
    rebuild();
  };

  const toggleCam = async () => {
    const next = !camOn;
    setCamOn(next);
    await roomRef.current?.localParticipant.setCameraEnabled(next).catch(() => setCamOn(!next));
    report({ camera_on: next });
    rebuild();
  };

  const flipCamera = async () => {
    const LK = getLK();
    const pub = roomRef.current?.localParticipant.getTrackPublication(LK.Track.Source.Camera);
    const next = facing === "user" ? "environment" : "user";
    try {
      await pub?.track?.restartTrack({ facingMode: next });
      setFacing(next);
    } catch {
      // device has a single camera
    }
    rebuild();
  };

  const leave = async () => {
    leaving.current = true;
    await roomRef.current?.disconnect();
    await participantApi(roomId, "/leave", { body: {} }).catch(() => {});
    setStatus("ended");
  };

  /** Server revoked our subscribe permission (privacy restriction) or similar — fetch a fresh token. */
  const reconnectFresh = async () => {
    leaving.current = true;
    await roomRef.current?.disconnect();
    leaving.current = false;
    retries.current = 0;
    await connect();
  };

  return { status, error, tiles, micOn, camOn, facing, toggleMic, toggleCam, flipCamera, leave, reconnectFresh, retry: connect };
}
