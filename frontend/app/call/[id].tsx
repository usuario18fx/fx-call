import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { participantApi } from "@/src/api";
import { ChatMessage, ChatSheet } from "@/src/components/ChatSheet";
import { CallDock } from "@/src/components/CallDock";
import { Badge, Body, Button, Heading, Icon, Label, Loading } from "@/src/components/ui";
import { useLang } from "@/src/i18n";
import { Watermark } from "@/src/components/Watermark";
import { PRIVACY_WARNING } from "@/src/privacy/labels";
import { getCaptureCapabilities } from "@/src/privacy/shield";
import { useShield } from "@/src/privacy/useShield";
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
  const { t: tr } = useLang();
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
        <Text style={styles.tileName} numberOfLines={1}>{t.isLocal ? tr("call.you") : t.name}{t.role === "host" ? ` · ${tr("call.host")}` : ""}</Text>
        <Icon name={QUALITY_ICON[t.quality] ?? "signal"} size={13} color={t.quality === "poor" || t.quality === "lost" ? colors.onWarning : colors.onSurface} />
      </View>
    </View>
  );
}

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t: tr } = useLang();
  const { width, height } = useWindowDimensions();
  const [layout, setLayout] = useState<"gallery" | "speaker">("gallery");
  const [chrome, setChrome] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [selfNotice, setSelfNotice] = useState(false);
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
      if (m.actions?.includes("participant_warned")) setWarning(tr("call.captureWarn"));
      if (m.actions?.includes("video_restricted") || m.actions?.includes("restrict-video")) setWarning(tr("call.restricted"));
      me.refetch();
    }
    if (m.type === "room_ended" || m.type === "room_update") me.refetch();
  });

  // FX PRIVACY SHIELD — always-on protection + on-device notice for every capture; server report for the host timeline.
  useEffect(() => {
    if (!approved) return;
    const caps = getCaptureCapabilities();
    participantApi(id, "/state", { body: { capture: { screenshot: caps.screenshot, recording: caps.recording, source: caps.source.slice(0, 80) } } }).catch(() => {});
  }, [approved, id]);

  const shield = useShield({
    active: !!approved,
    report: async (e) => {
      const r = await participantApi<{ actions: string[] }>(id, "/security-events", { body: { event_type: e.type, detection_source: e.source } });
      if (r.actions.includes("participant_warned")) setWarning(tr("call.captureWarn"));
      me.refetch();
    },
  });
  useEffect(() => {
    if (shield.hits > 0) setSelfNotice(true);
    const off = setTimeout(() => setSelfNotice(false), 6000);
    return () => clearTimeout(off);
  }, [shield.hits]);

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

  if (me.isLoading) return <Loading label={tr("call.connecting")} />;
  if (me.isError || !p)
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Body>{tr("call.invalid")}</Body>
        <Button testID="call-home-button" label={tr("call.home")} onPress={() => router.replace("/")} />
      </View>
    );

  if (removed || ended || call.status === "ended") {
    const msg = ended ? tr("call.endedHost") : p.status === "removed" ? tr("call.endedRemoved") : p.status === "blocked" ? tr("call.endedBlocked") : call.error ?? tr("call.endedLeft");
    return (
      <View style={[styles.center, { paddingTop: insets.top }]} testID="call-ended-view">
        <Icon name="phone-off" size={36} color={colors.muted} />
        <Heading size={22}>{tr("call.endedTitle")}</Heading>
        <Body testID="call-ended-reason" style={{ textAlign: "center" }}>{msg}</Body>
        <Button testID="call-ended-home-button" label={tr("call.done")} onPress={() => router.replace("/")} />
      </View>
    );
  }

  const n = tiles.length;
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : width > 900 ? 4 : 3;
  const rows = Math.max(1, Math.ceil(n / cols));
  // Keep the title and the call controls clear of video tiles on narrow screens.
  const topChrome = chrome ? (width < 520 ? 124 : 92) : 0;
  const bottomChrome = chrome ? 128 : 0;
  const stageH = Math.max(160, height - insets.top - insets.bottom - topChrome - bottomChrome);
  const tileHeight = Math.max(104, Math.floor(stageH / rows) - 8);
  const isHost = p.role === "host";

  return (
    <View style={styles.root} testID="call-screen">
      <Pressable style={[styles.stage, { paddingTop: insets.top + topChrome, paddingBottom: insets.bottom + bottomChrome }]} onPress={() => setChrome((c) => !c)} testID="call-stage">
        {call.status === "unavailable" || call.status === "error" || !me.data?.video_configured ? (
          <View style={styles.center} testID="call-unavailable">
            <Icon name="video-off" size={36} color={colors.muted} />
            <Body style={{ textAlign: "center", maxWidth: 420 }}>{!me.data?.video_configured ? tr("call.noVideo") : call.error}</Body>
            {call.status === "error" ? <Button testID="call-retry-button" label={tr("call.retry")} variant="secondary" onPress={call.retry} /> : null}
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
        {me.data?.room.settings.watermark ? <Watermark name={p.display_name} id={p.id} stamp={stamp} boost={shield.boost} /> : null}
      </Pressable>

      {call.status === "connecting" || call.status === "reconnecting" ? (
        <View style={[styles.statusPill, { top: insets.top + 64 }]} testID="call-connection-status">
          <Label color={colors.onSurfaceSecondary}>{call.status === "connecting" ? tr("call.connectingSecure") : tr("call.reconnecting")}</Label>
        </View>
      ) : null}

      {warning ? (
        <Animated.View entering={FadeInDown} style={[styles.warning, { top: insets.top + spacing.sm }]} testID="privacy-warning-banner">
          <Text style={styles.warningTitle}>{PRIVACY_WARNING}</Text>
          <Body style={{ color: colors.onError }}>{warning}</Body>
          <Pressable testID="privacy-warning-dismiss" onPress={() => setWarning(null)} hitSlop={10} style={styles.warnClose}><Icon name="x" size={18} color={colors.onError} /></Pressable>
        </Animated.View>
      ) : null}

      {selfNotice ? (
        <Animated.View entering={FadeInDown} style={[styles.selfNotice, { top: insets.top + spacing.sm }]} testID="self-capture-notice">
          <Icon name="shield-alert" size={20} color="#FFD7A8" />
          <View style={{ flex: 1 }}>
            <Text style={styles.selfTitle}>{tr("call.captureSelf")}</Text>
            <Text style={styles.selfSub}>{tr("call.captureSelfSub")}</Text>
          </View>
        </Animated.View>
      ) : null}

      {chrome ? (
        <>
          <Animated.View entering={FadeIn} style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
            <View style={{ flex: 1 }}>
              <Heading size={18} testID="call-room-title">{me.data?.room.title}</Heading>
              <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: 4, flexWrap: "wrap" }}>
                <Badge label={tr("call.inCall", { n })} tone="neutral" icon="users" />
                <Badge label={tr("call.encrypted")} tone="brand" icon="lock" />
                <Badge testID="shield-status-badge" label={Platform.OS === "web" ? tr("call.shieldOff") : tr("call.shieldOn")} tone={Platform.OS === "web" ? "neutral" : "success"} icon="shield" />
              </View>
            </View>
            {isHost ? <Button testID="call-dashboard-button" compact label={tr("call.security")} icon="shield-alert" variant="secondary" onPress={() => router.push(`/host/${id}`)} /> : null}
          </Animated.View>

          <CallDock
            bottom={insets.bottom + spacing.md}
            micOn={call.micOn} camOn={call.camOn} layout={layout} unread={unread} isHost={isHost}
            showFlip={Platform.OS !== "web"} showAudio={supportsAudioRoute}
            onMic={call.toggleMic} onCam={call.toggleCam} onFlip={call.flipCamera}
            onAudio={() => pickAudioRoute().catch(() => {})}
            onLayout={() => setLayout((l) => (l === "gallery" ? "speaker" : "gallery"))}
            onChat={() => { setChatOpen(true); setSeen(msgs.data?.length ?? 0); }}
            onSecurity={() => router.push(`/host/${id}`)}
            onLeave={exit}
          />
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
  selfNotice: { position: "absolute", left: 16, right: 16, zIndex: 20, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, backgroundColor: "rgba(40,24,12,0.94)", borderWidth: 1, borderColor: "rgba(255,200,140,0.35)", maxWidth: 560, alignSelf: "center" },
  selfTitle: { fontFamily: fonts.text, fontSize: 14, color: "#FFE9CF", fontWeight: "700" },
  selfSub: { fontFamily: fonts.text, fontSize: 12, color: "#E8C9A5", marginTop: 2 },
  statusPill: { position: "absolute", alignSelf: "center", backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  warning: { position: "absolute", left: spacing.lg, right: spacing.lg, backgroundColor: colors.error, borderRadius: radius.md, padding: spacing.lg, paddingRight: 48, gap: 4, maxWidth: 560, alignSelf: "center" },
  warningTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.onError, letterSpacing: 1.5 },
  warnClose: { position: "absolute", right: spacing.md, top: spacing.md, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  unread: { position: "absolute", top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 6, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  unreadText: { fontFamily: fonts.text, fontSize: 11, color: colors.onBrandPrimary },
});
