import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { participantApi } from "@/src/api";
import { ChatMessage, ChatSheet } from "@/src/components/ChatSheet";
import { Badge, Body, Button, Heading, Icon, IconButton, Label, Loading } from "@/src/components/ui";
import { Watermark } from "@/src/components/Watermark";
import { PRIVACY_WARNING } from "@/src/privacy/labels";
import { getCaptureCapabilities, startShield } from "@/src/privacy/shield";
import { useRoomSocket } from "@/src/realtime";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { pickAudioRoute, supportsAudioRoute } from "@/src/video/lk";
import { Tile, useCall } from "@/src/video/useCall";
import { VideoTile } from "@/src/video/VideoTile";

type Me = {
  participant: { id: string; display_name: string; role: string; status: string; warnings: number; video_restricted: boolean };
  room: { id: string; title: string; status: string; settings: { watermark: boolean; capture_protection: boolean } };
  video_configured: boolean;
};

const QUALITY_ICON: Record<string, any> = { excellent: "signal-high", good: "signal-medium", poor: "signal-low", lost: "signal-zero", unknown: "signal" };

function TileView({ t, style, big }: { t: Tile; style?: any; big?: boolean }) {
  return (
    <View style={[styles.tile, t.speaking && styles.speaking, style]} testID={`video-tile-${t.isLocal ? "local" : t.id}`}>
      {t.videoTrack ? (
        <VideoTile track={t.videoTrack} mirror={t.isLocal} fit={big ? "contain" : "cover"} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{t.name.slice(0, 1).toUpperCase()}</Text></View>
        </View>
      )}
      <View style={styles.tileLabel}>
        {!t.micOn ? <Icon name="mic-off" size={13} color={colors.onError} /> : null}
        <Text style={styles.tileName} numberOfLines={1}>{t.isLocal ? "You" : t.name}{t.role === "host" ? " · Host" : ""}</Text>
        <Icon name={QUALITY_ICON[t.quality] ?? "signal"} size={13} color={t.quality === "poor" || t.quality === "lost" ? colors.onWarning : colors.onSurface} />
      </View>
    </View>
  );
}

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [layout, setLayout] = useState<"gallery" | "speaker">("gallery");
  const [chrome, setChrome] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [stamp, setStamp] = useState(() => new Date().toLocaleString());

  const me = useQuery({ queryKey: ["me", id], queryFn: () => participantApi<Me>(id, "/me"), refetchInterval: 5000 });
  const p = me.data?.participant;
  const approved = p?.status === "approved" && me.data?.room.status === "active";
  const call = useCall(id, !!approved);
  const msgs = useQuery({ queryKey: ["messages", id], queryFn: () => participantApi<ChatMessage[]>(id, "/messages"), enabled: !!approved, refetchInterval: chatOpen ? 4000 : 20000 });
  const [seen, setSeen] = useState(0);
  const unread = Math.max(0, (msgs.data?.length ?? 0) - seen);

  useRoomSocket(id, !!p, (m) => {
    if (m.type === "message") msgs.refetch();
    if (m.type === "you_update") {
      if (m.actions?.includes("participant_warned")) setWarning("Your device reported a screen capture. The host has been notified.");
      if (m.actions?.includes("video_restricted") || m.actions?.includes("restrict-video")) setWarning("The host restricted your access to video.");
      me.refetch();
    }
    if (m.type === "room_ended" || m.type === "room_update") me.refetch();
  });

  // FX PRIVACY SHIELD — report genuine OS capture signals for this authenticated participant.
  useEffect(() => {
    if (!approved) return;
    const caps = getCaptureCapabilities();
    participantApi(id, "/state", { body: { capture: { screenshot: caps.screenshot, recording: caps.recording, source: caps.source.slice(0, 80) } } }).catch(() => {});
    return startShield(async (e) => {
      try {
        const r = await participantApi<{ actions: string[] }>(id, "/security-events", { body: { event_type: e.type, detection_source: e.source } });
        if (r.actions.includes("participant_warned")) setWarning("Your device reported a screen capture. The host has been notified.");
        me.refetch();
      } catch {
        // rate-limited or not admitted
      }
    });
  }, [approved, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The single FX CALL root guard protects all screens, including this call.
  // Don't install a second differently-keyed guard here: that can freeze iOS.

  useEffect(() => {
    const t = setInterval(() => setStamp(new Date().toLocaleString()), 30000);
    return () => clearInterval(t);
  }, []);

  const removed = p && ["removed", "blocked", "rejected"].includes(p.status);
  const ended = me.data?.room.status === "ended";
  useEffect(() => {
    if (removed || ended) call.leave();
  }, [removed, ended]); // eslint-disable-line react-hooks/exhaustive-deps

  const tiles = call.tiles;
  const main = useMemo(() => tiles.find((t) => !t.isLocal && t.speaking) ?? tiles.find((t) => !t.isLocal) ?? tiles[0], [tiles]);

  const exit = async () => {
    await call.leave();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  if (me.isLoading) return <Loading label="Connecting to private room" />;
  if (me.isError || !p)
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Body>Your access to this meeting is not valid on this device.</Body>
        <Button testID="call-home-button" label="Go home" onPress={() => router.replace("/")} />
      </View>
    );

  if (removed || ended || call.status === "ended") {
    const msg = ended ? "The host ended this meeting." : p.status === "removed" ? "You were removed from this meeting." : p.status === "blocked" ? "The host blocked you from this meeting." : call.error ?? "You left the call.";
    return (
      <View style={[styles.center, { paddingTop: insets.top }]} testID="call-ended-view">
        <Icon name="phone-off" size={36} color={colors.muted} />
        <Heading size={22}>Call ended</Heading>
        <Body testID="call-ended-reason" style={{ textAlign: "center" }}>{msg}</Body>
        <Button testID="call-ended-home-button" label="Done" onPress={() => router.replace("/")} />
      </View>
    );
  }

  const n = tiles.length;
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : width > 900 ? 4 : 3;
  const rows = Math.max(1, Math.ceil(n / cols));
  // Keep the title and the call controls clear of video tiles on narrow screens.
  const topChrome = chrome ? (width < 520 ? 124 : 92) : 0;
  const bottomChrome = chrome ? (width < 520 ? 138 : 88) : 0;
  const stageH = Math.max(160, height - insets.top - insets.bottom - topChrome - bottomChrome);
  const tileHeight = Math.max(104, Math.floor(stageH / rows) - 8);
  const isHost = p.role === "host";

  return (
    <View style={styles.root} testID="call-screen">
      <Pressable style={[styles.stage, { paddingTop: insets.top + topChrome, paddingBottom: insets.bottom + bottomChrome }]} onPress={() => setChrome((c) => !c)} testID="call-stage">
        {call.status === "unavailable" || call.status === "error" || !me.data?.video_configured ? (
          <View style={styles.center} testID="call-unavailable">
            <Icon name="video-off" size={36} color={colors.muted} />
            <Body style={{ textAlign: "center", maxWidth: 420 }}>{!me.data?.video_configured ? "The video service is not configured yet." : call.error}</Body>
            {call.status === "error" ? <Button testID="call-retry-button" label="Retry" variant="secondary" onPress={call.retry} /> : null}
          </View>
        ) : layout === "gallery" || n <= 1 ? (
          <ScrollView style={styles.galleryScroll} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={n > 6}>
            {tiles.map((t) => (
              <TileView key={t.id} t={t} style={{ width: `${100 / cols}%`, height: tileHeight }} big={n === 1} />
            ))}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>
            {main ? <TileView t={main} big style={{ flex: 1 }} /> : null}
            <ScrollView horizontal style={styles.strip} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.sm }} showsHorizontalScrollIndicator={false}>
              {tiles.filter((t) => t !== main).map((t) => <TileView key={t.id} t={t} style={{ width: 120, height: 160 }} />)}
            </ScrollView>
          </View>
        )}
        {me.data?.room.settings.watermark ? <Watermark name={p.display_name} id={p.id} stamp={stamp} /> : null}
      </Pressable>

      {call.status === "connecting" || call.status === "reconnecting" ? (
        <View style={[styles.statusPill, { top: insets.top + 64 }]} testID="call-connection-status">
          <Label color={colors.onSurfaceSecondary}>{call.status === "connecting" ? "Connecting securely…" : "Connection lost. Reconnecting securely…"}</Label>
        </View>
      ) : null}

      {warning ? (
        <Animated.View entering={FadeInDown} style={[styles.warning, { top: insets.top + spacing.sm }]} testID="privacy-warning-banner">
          <Text style={styles.warningTitle}>{PRIVACY_WARNING}</Text>
          <Body style={{ color: colors.onError }}>{warning}</Body>
          <Pressable testID="privacy-warning-dismiss" onPress={() => setWarning(null)} hitSlop={10} style={styles.warnClose}><Icon name="x" size={18} color={colors.onError} /></Pressable>
        </Animated.View>
      ) : null}

      {chrome ? (
        <>
          <Animated.View entering={FadeIn} style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
            <View style={{ flex: 1 }}>
              <Heading size={18} testID="call-room-title">{me.data?.room.title}</Heading>
              <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: 4, flexWrap: "wrap" }}>
                <Badge label={`${n} in call`} tone="neutral" icon="users" />
                <Badge label="Encrypted transport" tone="brand" icon="lock" />
                <Badge testID="shield-status-badge" label={Platform.OS === "web" ? "Capture detection unavailable" : "Privacy Shield on"} tone={Platform.OS === "web" ? "neutral" : "success"} icon="shield" />
              </View>
            </View>
            {isHost ? <Button testID="call-dashboard-button" compact label="Security" icon="shield-alert" variant="secondary" onPress={() => router.push(`/host/${id}`)} /> : null}
          </Animated.View>

          <Animated.View entering={FadeInDown} style={[styles.controls, { bottom: insets.bottom + spacing.lg }]} testID="call-controls">
            <IconButton testID="toggle-mic-button" label="Microphone" icon={call.micOn ? "mic" : "mic-off"} active={!call.micOn} onPress={call.toggleMic} />
            <IconButton testID="toggle-camera-button" label="Camera" icon={call.camOn ? "video" : "video-off"} active={!call.camOn} onPress={call.toggleCam} />
            {Platform.OS !== "web" ? <IconButton testID="flip-camera-button" label="Switch camera" icon="switch-camera" onPress={call.flipCamera} /> : null}
            {supportsAudioRoute ? <IconButton testID="audio-route-button" label="Audio output" icon="volume-2" onPress={() => pickAudioRoute().catch(() => {})} /> : null}
            <IconButton testID="layout-toggle-button" label="Layout" icon={layout === "gallery" ? "layout-grid" : "square-user"} onPress={() => setLayout((l) => (l === "gallery" ? "speaker" : "gallery"))} />
            <View>
              <IconButton testID="open-chat-button" label="Chat" icon="message-square" onPress={() => { setChatOpen(true); setSeen(msgs.data?.length ?? 0); }} />
              {unread ? <View style={styles.unread}><Text style={styles.unreadText}>{unread}</Text></View> : null}
            </View>
            <IconButton testID="end-call-button" label="Leave call" icon="phone-off" tone="danger" onPress={exit} />
          </Animated.View>
        </>
      ) : null}

      <ChatSheet visible={chatOpen} onClose={() => { setChatOpen(false); setSeen(msgs.data?.length ?? 0); }} roomId={id} myId={p.id} messages={msgs.data ?? []} onSent={() => msgs.refetch()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.stage },
  stage: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, padding: spacing.xl, backgroundColor: colors.surface },
  galleryScroll: { flex: 1, minHeight: 0 },
  grid: { flexGrow: 1, flexDirection: "row", flexWrap: "wrap", alignContent: "flex-start" },
  tile: { padding: 4, overflow: "hidden", borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, borderWidth: 2, borderColor: "transparent" },
  speaking: { borderColor: colors.brandPrimary },
  avatarWrap: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  avatar: { width: 72, height: 72, borderRadius: 6, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.display, fontSize: 32, color: colors.onSurfaceSecondary },
  tileLabel: { position: "absolute", left: spacing.sm, bottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.scrim, paddingHorizontal: spacing.sm, height: 26, borderRadius: radius.pill, maxWidth: "90%" },
  tileName: { fontFamily: fonts.text, fontSize: 12, color: colors.onSurfaceSecondary, flexShrink: 1 },
  strip: { position: "absolute", bottom: 110, left: 0, right: 0, flexGrow: 0 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.scrim },
  controls: { position: "absolute", alignSelf: "center", flexDirection: "row", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border, flexWrap: "wrap", justifyContent: "center", maxWidth: "94%" },
  statusPill: { position: "absolute", alignSelf: "center", backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  warning: { position: "absolute", left: spacing.lg, right: spacing.lg, backgroundColor: colors.error, borderRadius: radius.md, padding: spacing.lg, paddingRight: 48, gap: 4, maxWidth: 560, alignSelf: "center" },
  warningTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.onError, letterSpacing: 1.5 },
  warnClose: { position: "absolute", right: spacing.md, top: spacing.md, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  unread: { position: "absolute", top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 6, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  unreadText: { fontFamily: fonts.text, fontSize: 11, color: colors.onBrandPrimary },
});
