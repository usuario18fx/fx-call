import { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";

import { useAuth } from "@/src/auth";
import { Loading } from "@/src/components/ui";
import { useNovaActions, type NovaPacket } from "@/src/nova/useNovaActions";

export default function NovaStudioWeb() {
  const frame = useRef<HTMLIFrameElement>(null);
  const { user, ready } = useAuth();
  const send = useCallback((packet: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage({ __fxNova: true, ...packet }, window.location.origin);
  }, []);
  const action = useNovaActions(send);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frame.current?.contentWindow) return;
      void action(event.data as NovaPacket);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [action]);

  if (!ready) return <Loading label="Loading studio" />;
  if (!user) return <Loading label="Sign in to FX CALL first" />;

  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: "#050607" }} testID="fx-nova-studio-web">
      <iframe
        ref={frame}
        title="FX CALL — NOVA Studio"
        src="/nova-studio.html?fxbuild=general-room-v3-20261127"
        allow="camera; microphone"
        style={{ display: "block", width: "100%", height: "100%", border: 0, background: "#050607" }}
      />
    </View>
  );
}
