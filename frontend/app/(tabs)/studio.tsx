import { useCallback, useRef, type ComponentType } from "react";
import { View } from "react-native";
import WebView from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";

import { useAuth } from "@/src/auth";
import { Loading } from "@/src/components/ui";
import { useNovaActions, type NovaPacket } from "@/src/nova/useNovaActions";

const CompatibleWebView = WebView as unknown as ComponentType<any>;

// The API route reads the current NOVA HTML directly from frontend/public.
// Do not point the native WebView at /nova-studio.html: that path may be stale.

export default function NovaStudioNative() {
  const webView = useRef<WebView>(null);
  const { user, ready } = useAuth();
  const send = useCallback((packet: Record<string, unknown>) => {
    const encoded = JSON.stringify(packet);
    webView.current?.injectJavaScript(`window.FXNOVA_receive(${encoded}); true;`);
  }, []);
  const action = useNovaActions(send);
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    let packet: NovaPacket;
    try {
      packet = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    void action(packet);
  }, [action]);

  if (!ready) return <Loading label="Loading studio" />;
  if (!user) return <Loading label="Sign in to FX CALL first" />;

  const backend = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
  const novaPath = "/api/studio/nova.html";
  const novaUrl = `${backend}${novaPath}?fxbuild=general-room-v6-20261127`;
  if (!backend.startsWith("https://")) return <Loading label="HTTPS preview URL is not configured" />;

  return (
    <View style={{ flex: 1, backgroundColor: "#050607" }} testID="fx-nova-studio-native">
      <CompatibleWebView
        ref={webView}
        source={{ uri: novaUrl, headers: { "Cache-Control": "no-cache, no-store" } }}
        originWhitelist={["https://*"]}
        onShouldStartLoadWithRequest={(request: { url: string }) => request.url === "about:blank" || request.url.startsWith(`${backend}${novaPath}`)}
        cacheEnabled={false}
        cacheMode="LOAD_NO_CACHE"
        javaScriptEnabled
        domStorageEnabled={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        onMessage={onMessage}
        style={{ flex: 1, backgroundColor: "#050607" }}
        overScrollMode="never"
        startInLoadingState
        renderLoading={() => <Loading label="Opening NOVA Studio" />}
      />
    </View>
  );
}
