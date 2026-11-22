import { useEffect, useRef, useState } from "react";

import { API_BASE, getParticipantKey } from "@/src/api";

export type RoomSignal = { type: string; [k: string]: any };

/** Authenticated realtime channel. Auth is the first frame (never in the URL). Auto-reconnects with backoff. */
export function useRoomSocket(roomId: string | undefined, enabled: boolean, onMessage: (m: RoomSignal) => void) {
  const handler = useRef(onMessage);
  handler.current = onMessage;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!roomId || !enabled) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;

    const connect = async () => {
      const key = await getParticipantKey(roomId);
      if (!key || closed) return;
      ws = new WebSocket(`${API_BASE.replace(/^http/, "ws")}/ws`);
      ws.onopen = () => {
        retry = 0;
        ws?.send(JSON.stringify({ room_id: roomId, key }));
        ping = setInterval(() => ws?.readyState === 1 && ws.send("ping"), 25000);
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(String(e.data));
          if (msg.type === "ready") setConnected(true);
          handler.current(msg);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (ping) clearInterval(ping);
        if (!closed) timer = setTimeout(connect, Math.min(15000, 1000 * 2 ** retry++));
      };
    };
    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      if (ping) clearInterval(ping);
      ws?.close();
    };
  }, [roomId, enabled]);

  return connected;
}
