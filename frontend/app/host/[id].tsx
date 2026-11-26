import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, saveParticipantKey } from "@/src/api";
import { HostSheet, type SheetView } from "@/src/components/HostSheet";
import { IndexList } from "@/src/components/IndexList";
import { HostHero, ProtectedNote } from "@/src/components/HostHero";
import { Body, Button, Card, Heading, Icon, Label, Loading, useToast } from "@/src/components/ui";
import { useLang } from "@/src/i18n";
import { useShield } from "@/src/privacy/useShield";
import { EventRow, Invite, InvitePanel, Participant, ParticipantRow, SecEvent, Settings, SettingsPanel } from "@/src/components/host-panels";
import { deviceInfo } from "@/src/device";
import { EVENT_LABEL } from "@/src/privacy/labels";
import { useRoomSocket } from "@/src/realtime";
import { colors, fonts, spacing } from "@/src/theme";

type Dashboard = {
  room: { id: string; title: string; status: string; locked: boolean; settings: Settings };
  participants: Participant[]; events: SecEvent[]; invites: Invite[];
  blocks: { id: string; email: string; display_name: string }[]; video_configured: boolean;
};
type Tab = "people" | "waiting" | "alerts" | "invites" | "settings";

export default function HostDashboard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { t } = useLang();
  const [keyReady, setKeyReady] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const q = useQuery({ queryKey: ["dashboard", id], queryFn: () => api<Dashboard>(`/rooms/${id}/dashboard`), refetchInterval: 5000 });

  useEffect(() => {
    // Host gets a participant credential for the authenticated realtime channel + media.
    if (q.data?.room.status !== "active" || keyReady) return;
    api<{ participant_key: string }>(`/rooms/${id}/host-key`, { body: deviceInfo() })
      .then((r) => saveParticipantKey(id, r.participant_key))
      .then(() => setKeyReady(true))
      .catch(() => {});
  }, [id, q.data?.room.status, keyReady]);

  const live = useRoomSocket(id, keyReady, (m) => {
    if (m.type === "security_event") toast(`${EVENT_LABEL[m.event.event_type] ?? "!"} — ${m.event.username}`, "error");
    if (m.type === "join_request" && m.status === "pending") toast(t("host.joinReq", { name: m.name }), "info");
    q.refetch();
  });

  const [sheet, setSheet] = useState<"people" | "waiting" | "security" | "access" | "room" | null>(null);
  const [subKey, setSubKey] = useState<string | null>(null);
  const [direct, setDirect] = useState(false);
  const openSheet = (k: typeof sheet) => { setDirect(false); setSubKey(null); setSheet(k); };
  const insets = useSafeAreaInsets();

  // This screen lists emails and devices: protect it like the call and tell the host on-device when a capture happens.
  const shield = useShield({ active: !!q.data });
  useEffect(() => {
    if (shield.hits > 0) toast(t("call.captureSelf"), "error");
  }, [shield.hits]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading) return <Loading label={t("host.loading")} />;
  if (q.isError || !q.data)
    return (
      <View style={[styles.page, { padding: 16, paddingTop: 64, gap: 16 }]}>
        <Card style={{ gap: spacing.md }}>
          <Body>{t("host.lost")}</Body>
          <Button testID="dashboard-retry-button" label="Retry" variant="secondary" onPress={() => q.refetch()} />
        </Card>
      </View>
    );

  const d = q.data;
  const active = d.room.status === "active";
  const people = d.participants.filter((p) => p.status === "approved");
  const waiting = d.participants.filter((p) => p.status === "pending");
  const others = d.participants.filter((p) => ["removed", "blocked", "rejected"].includes(p.status));
  const alerts = d.events.filter((e) => e.event_type !== "recording_stopped").length;

  const setLock = async () => {
    await api(`/rooms/${id}/lock`, { body: { locked: !d.room.locked } }).catch((e) => toast(e.message, "error"));
    q.refetch();
  };
  const endAll = async () => {
    setConfirmEnd(false);
    await api(`/rooms/${id}/end`, { body: {} }).catch((e) => toast(e.message, "error"));
    q.refetch();
  };

  const panel = (tb: Tab) => {
    if (tb === "people")
      return people.length === 0 ? (
        <Card style={styles.empty}><Icon name="shield" size={32} color={colors.muted} /><Body style={{ color: colors.muted }}>{t("host.empty")}</Body></Card>
      ) : (
        <View style={{ gap: spacing.md }}>{people.map((p) => <ParticipantRow key={p.id} p={p} roomId={id} onDone={() => q.refetch()} />)}</View>
      );
    if (tb === "waiting")
      return waiting.length === 0 ? (
        <Card style={styles.empty} testID="waiting-empty"><Icon name="armchair" size={32} color={colors.muted} /><Body style={{ color: colors.muted }}>{t("host.noWaiting")}</Body></Card>
      ) : (
        <View style={{ gap: spacing.md }}>{waiting.map((p) => <ParticipantRow key={p.id} waiting p={p} roomId={id} onDone={() => q.refetch()} />)}</View>
      );
    if (tb === "alerts")
      return (
        <Card style={{ paddingVertical: spacing.sm }} testID="alerts-timeline">
          {d.events.length === 0 ? (
            <Body style={{ color: colors.muted, paddingVertical: spacing.lg }}>{t("host.noAlerts")}</Body>
          ) : d.events.map((e) => <EventRow key={e.id} e={e} />)}
        </Card>
      );
    if (tb === "invites") return <InvitePanel roomId={id} invites={d.invites} onDone={() => q.refetch()} />;
    return <SettingsPanel roomId={id} settings={d.room.settings} onDone={() => q.refetch()} />;
  };

  const blockedPanel = d.blocks.length === 0 ? (
    <Card style={styles.empty}><Icon name="ban" size={30} color={colors.muted} /><Body style={{ color: colors.muted }}>—</Body></Card>
  ) : (
    <View style={{ gap: spacing.md }}>
      {d.blocks.map((b) => (
        <Card key={b.id} style={styles.blockRow} testID={`block-row-${b.id}`}>
          <Body style={{ flex: 1 }}>{b.display_name} · {b.email}</Body>
          <Button testID={`unblock-${b.id}`} compact variant="ghost" label="Unblock" onPress={async () => { await api(`/blocks/${b.id}`, { method: "DELETE" }); q.refetch(); }} />
        </Card>
      ))}
    </View>
  );
  const removedPanel = others.length === 0 ? (
    <Card style={styles.empty}><Icon name="user-x" size={30} color={colors.muted} /><Body style={{ color: colors.muted }}>—</Body></Card>
  ) : (
    <View style={{ gap: spacing.md }}>{others.map((p) => <ParticipantRow key={p.id} p={p} roomId={id} onDone={() => q.refetch()} />)}</View>
  );


  const views: Record<NonNullable<typeof sheet>, SheetView> = {
    people: { title: t("host.people"), tone: "mint", node: panel("people") },
    waiting: { title: t("host.waiting"), tone: "amber", node: panel("waiting") },
    security: { title: t("hc.security"), tone: "red", subs: [
      { key: "alerts", title: t("hc.alerts"), icon: "shield-alert", meta: String(alerts), node: panel("alerts") },
      { key: "rules", title: t("hc.rules"), icon: "settings-2", node: panel("settings") },
    ] },
    access: { title: t("hc.access"), tone: "blue", subs: [
      { key: "invites", title: t("hc.invites"), icon: "mail-plus", meta: String(d.invites.length), node: panel("invites") },
      { key: "blocked", title: t("hc.blocked"), icon: "ban", meta: String(d.blocks.length), node: blockedPanel },
    ] },
    room: { title: t("hc.room"), tone: "mint", subs: [
      { key: "removed", title: t("hc.removed"), icon: "user-x", meta: String(others.length), node: removedPanel },
    ] },
  };

  return (
    <View style={styles.page} testID="host-dashboard">
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="header-back-button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.backBtn} hitSlop={8}>
          <Icon name="chevron-left" size={22} color="#F3F5F8" />
        </Pressable>
        <View style={{ flex: 1 }} />
        <TopBtn testID="open-people" icon="users" label={t("host.people")} count={people.length} onPress={() => openSheet("people")} />
        <TopBtn testID="open-waiting" icon="armchair" label={t("host.waiting")} count={waiting.length} hot={waiting.length > 0} onPress={() => openSheet("waiting")} />
      </View>

      <View style={styles.center}>
        {!d.video_configured ? (
          <Card style={{ borderColor: colors.warning, marginBottom: 14 }} testID="video-not-configured"><Body>Video service is not configured yet — add LiveKit credentials to enable calls.</Body></Card>
        ) : null}
        <HostHero title={d.room.title} active={active} locked={d.room.locked} realtime={live} entering={!keyReady}
          onEnter={() => router.push(`/call/${id}`)} onLock={setLock} onEnd={() => setConfirmEnd(true)} />
        <ProtectedNote text={t("host.protectedNote")} />
      </View>

      <View style={[styles.index, { paddingBottom: insets.bottom + 8 }]}>
        <IndexList onOpen={(c, k) => { setSheet(c as typeof sheet); setSubKey(k); setDirect(true); }}
          sections={[
            { key: "security", title: t("hc.security"), tone: "red", badge: alerts, subs: [{ key: "alerts", title: t("hc.alerts"), meta: String(alerts) }, { key: "rules", title: t("hc.rules") }] },
            { key: "access", title: t("hc.access"), tone: "blue", subs: [{ key: "invites", title: t("hc.invites"), meta: String(d.invites.length) }, { key: "blocked", title: t("hc.blocked"), meta: String(d.blocks.length) }] },
            { key: "room", title: t("hc.room"), tone: "mint", subs: [{ key: "removed", title: t("hc.removed"), meta: String(others.length) }] },
          ]} />
      </View>

      <HostSheet view={sheet ? views[sheet] : null} subKey={subKey} onSub={setSubKey} direct={direct} onClose={() => setSheet(null)} />

      <Modal visible={confirmEnd} transparent animationType="fade" onRequestClose={() => setConfirmEnd(false)}>
        <View style={styles.modalBg}>
          <Card style={styles.modal} testID="end-confirm-modal">
            <Text style={styles.modalTitle}>{t("host.endTitle")}</Text>
            <Body>{t("host.endBody")}</Body>
            <Button testID="end-confirm-button" label={t("host.endConfirm")} variant="danger" onPress={endAll} />
            <Button testID="end-cancel-button" label={t("host.cancel")} variant="ghost" onPress={() => setConfirmEnd(false)} />
          </Card>
        </View>
      </Modal>
    </View>
  );
}

function TopBtn({ icon, label, count, hot, onPress, testID }: { icon: any; label: string; count: number; hot?: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.topBtn, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={16} color="#F3F5F8" />
      <Text style={styles.topBtnText}>{label}</Text>
      <View style={[styles.topCount, hot && { backgroundColor: "#E5484D" }]}><Text style={styles.topCountText}>{count}</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0B0C0E" },
  top: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" },
  topBtn: { flexDirection: "row", alignItems: "center", gap: 7, height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  topBtnText: { fontSize: 13, fontWeight: "700", color: "#F3F5F8" },
  topCount: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  topCountText: { fontSize: 11, fontWeight: "800", color: "#F3F5F8" },
  center: { flex: 1, justifyContent: "center", paddingBottom: 12, paddingHorizontal: 16,  gap: 12, maxWidth: 560, width: "100%", alignSelf: "center" },
  index: { paddingHorizontal: 20, maxWidth: 560, width: "100%", alignSelf: "center" },
  cats: { flexDirection: "row", gap: 10, paddingHorizontal: 16, maxWidth: 560, width: "100%", alignSelf: "center" },
  dashboardContent: { minWidth: 0, width: "100%", paddingHorizontal: spacing.lg },
  crownBar: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, minWidth: 0,
    backgroundColor: "#0D1A29", borderColor: "#205477", borderWidth: 1,
    borderRadius: 6, padding: spacing.md,
  },
  crownMark: {
    width: 44, height: 44, borderRadius: 6, borderWidth: 1,
    borderColor: "#2779A8", backgroundColor: "#081625",
    alignItems: "center", justifyContent: "center",
  },
  crownCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  crownEyebrow: { color: "#92D4F7", letterSpacing: 1.6, fontSize: 11 },
  crownSubtitle: { color: colors.onSurfaceSecondary, fontSize: 12 },
  desktopGrid: { flexDirection: "row", alignItems: "flex-start", gap: spacing.lg, width: "100%" },
  dashboardColumn: { minWidth: 0, gap: spacing.lg, flexShrink: 1 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, minWidth: 0 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, width: "100%" },
  mobileAction: { width: "100%" },
  desktopAction: { minWidth: 190, flexGrow: 0, flexShrink: 1 },
  empty: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl },
  blockRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", padding: spacing.md, gap: spacing.md, minWidth: 0 },
  modalBg: { flex: 1, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  modal: { width: "100%", maxWidth: 420, gap: spacing.md },
  modalTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.onSurfaceSecondary, textTransform: "uppercase", letterSpacing: 2 },
});
