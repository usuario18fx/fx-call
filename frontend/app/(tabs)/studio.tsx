import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import WebView from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";

import { useAuth } from "@/src/auth";
import { Loading } from "@/src/components/ui";
import { useNovaActions, type NovaPacket } from "@/src/nova/useNovaActions";

const CompatibleWebView = WebView as unknown as ComponentType<any>;

function StudioUnavailable({
  message,
  retry,
  browserUrl,
}: {
  message: string;
  retry?: () => void;
  browserUrl?: string;
}) {
  return (
    <View style={styles.failure} testID="studio-unavailable">
      <Text style={styles.eyebrow}>FX CALL / NOVA STUDIO</Text>
      <Text style={styles.title}>Studio isn't loading</Text>
      <Text style={styles.description}>{message}</Text>
      <View style={styles.actions}>
        {retry ? (
          <Pressable testID="studio-retry" accessibilityRole="button" onPress={retry} style={styles.retry}>
            <Text style={styles.retryText}>RETRY STUDIO</Text>
          </Pressable>
        ) : null}
        {browserUrl ? (
          <Pressable
            testID="studio-open-safari"
            accessibilityRole="button"
            onPress={() => { void Linking.openURL(browserUrl); }}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>OPEN IN SAFARI</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>Your account, meetings and LiveKit rooms have not been modified.</Text>
    </View>
  );
}

export default function NovaStudioNative() {
  const webView = useRef<WebView>(null);
  const { user, ready } = useAuth();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasBridge, setHasBridge] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const backend = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/+$/, "");
  const url = backend.startsWith("https://") ? `${backend}/nova-studio.html` : "";

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
    if (!packet || packet.__fxNova !== true) return;
    if (packet.action === "ready") {
      setHasBridge(true);
      setLoadError(null);
    }
    void action(packet);
  }, [action]);

  useEffect(() => {
    if (!ready || !user || !url || hasBridge) return;
    const timeout = setTimeout(() => {
      setLoadError((current) => current || "NOVA Studio did not respond within 12 seconds. Verify the preview server, or open Studio in Safari.");
    }, 12000);
    return () => clearTimeout(timeout);
  }, [ready, user, url, hasBridge, attempt]);

  if (!ready) return <Loading label="Loading Studio" />;
  if (!user) return <StudioUnavailable message="Your session is not signed in. Return to Account and sign in." />;
  if (!url) {
    return (
      <StudioUnavailable message="The HTTPS preview URL is missing. Configure EXPO_PUBLIC_BACKEND_URL in the Expo environment and restart Expo." />
    );
  }

  const retry = () => {
    setHasBridge(false);
    setLoadError(null);
    setAttempt((current) => current + 1);
  };

  return (
    <View style={styles.root} testID="fx-nova-studio-native">
      <CompatibleWebView
        key={attempt}
        ref={webView}
        source={{ uri: url }}
        originWhitelist={["https://*"]}
        onShouldStartLoadWithRequest={(request: { url: string }) => request.url === "about:blank" || request.url.startsWith(url)}
        javaScriptEnabled
        domStorageEnabled={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        onMessage={onMessage}
        onLoadStart={() => {
          setHasBridge(false);
          setLoadError(null);
        }}
        onError={(event: { nativeEvent?: { description?: string } }) => {
          setLoadError(event.nativeEvent?.description || "The Studio page could not be loaded.");
        }}
        onHttpError={(event: { nativeEvent?: { statusCode?: number; url?: string } }) => {
          if (event.nativeEvent?.url?.startsWith(url)) {
            setLoadError(`Studio server returned HTTP ${event.nativeEvent.statusCode ?? "error"}.`);
          }
        }}
        style={styles.webView}
        overScrollMode="never"
        startInLoadingState
        renderLoading={() => <Loading label="Opening NOVA Studio" />}
      />
      {loadError ? <View style={styles.overlay}><StudioUnavailable message={loadError} retry={retry} browserUrl={url} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: "#050607" },
  webView: { flex: 1, backgroundColor: "#050607" },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", backgroundColor: "#06090ff5" },
  failure: { width: "100%", maxWidth: 460, alignSelf: "center", gap: 15, padding: 28, alignItems: "center", justifyContent: "center", flex: 1 },
  eyebrow: { color: "#2ED3B7", fontSize: 11, letterSpacing: 2, fontWeight: "700", textAlign: "center" },
  title: { color: "#F4F6F8", fontSize: 25, fontWeight: "700", textAlign: "center" },
  description: { color: "#ACBAC5", fontSize: 14, lineHeight: 22, textAlign: "center" },
  hint: { color: "#89919A", fontSize: 11, lineHeight: 18, textAlign: "center" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  retry: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 8, backgroundColor: "#2ED3B7" },
  retryText: { color: "#03201B", fontSize: 12, fontWeight: "800" },
  secondary: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 8, borderWidth: 1, borderColor: "#4D6F86" },
  secondaryText: { color: "#C5DAE9", fontSize: 12, fontWeight: "800" },
});
