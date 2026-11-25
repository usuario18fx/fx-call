import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { api, saveParticipantKey } from "@/src/api";
import { Screen } from "@/src/components/Screen";
import { HostHero, HostTabs, ProtectedNote } from "@/src/components/HostHero";
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
  const { width } = useWindowDimensions();
  // Three columns only when each panel can remain readable without horizontal overflow.
  const wide = width >= 1320;
  const narrow = width < 620;
  const [tab, setTab] = useState<Tab>("people");
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

  // This screen lists emails and devices: protect it like the call and tell the host on-device when a capture happens.
  const shield = useShield({ active: !!q.data });
  useEffect(() => {
    if (shield.hits > 0) toast(t("call.captureSelf"), "error");
  }, [shield.hits]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading) return <Loading label={t("host.loading")} />;
  if (q.isError || !q.data)
    return (
      <Screen back title="Dashboard">
        <Card style={{ gap: spacing.md }}>
          <Body>{t("host.lost")}</Body>
          <Button testID="dashboard-retry-button" label="Retry" variant="secondary" onPress={() => q.refetch()} />
        </Card>
      </Screen>
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

  const TABS = [
    { key: "people" as Tab, label: t("host.people"), icon: "users" as const, count: people.length },
    { key: "waiting" as Tab, label: t("host.waiting"), icon: "armchair" as const, count: waiting.length, hot: waiting.length > 0 },
    { key: "alerts" as Tab, label: t("host.alerts"), icon: "shield-alert" as const, count: alerts, hot: alerts > 0 },
    { key: "invites" as Tab, label: t("host.invites"), icon: "mail-plus" as const },
    { key: "settings" as Tab, label: t("host.settings"), icon: "settings-2" as const },
  ];

  const panel = (tb: Tab) => {
    if (tb === "people")
      return people.length + others.length === 0 ? (
        <Card style={styles.empty}><Icon name="shield" size={32} color={colors.muted} /><Body style={{ color: colors.muted }}>{t("host.empty")}</Body></Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          {people.map((p) => <ParticipantRow key={p.id} p={p} roomId={id} onDone={() => q.refetch()} />)}
          {others.length ? <Label>Removed, blocked & rejected</Label> : null}
          {others.map((p) => <ParticipantRow key={p.id} p={p} roomId={id} onDone={() => q.refetch()} />)}
          {d.blocks.length ? <Label>Blocked people</Label> : null}
          {d.blocks.map((b) => (
            <Card key={b.id} style={styles.blockRow} testID={`block-row-${b.id}`}>
              <Body style={{ flex: 1 }}>{b.display_name} · {b.email}</Body>
              <Button testID={`unblock-${b.id}`} compact variant="ghost" label="Unblock" onPress={async () => { await api(`/blocks/${b.id}`, { method: "DELETE" }); q.refetch(); }} />
            </Card>
          ))}
        </View>
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

  return (
    <Screen back title={d.room.title} testID="host-dashboard" maxWidth={1480} contentStyle={styles.dashboardContent}>
      <HostHero title={d.room.title} active={active} locked={d.room.locked} realtime={live} entering={!keyReady}
        onEnter={() => router.push(`/call/${id}`)} onLock={setLock} onEnd={() => setConfirmEnd(true)} />
      <ProtectedNote text={t("host.protectedNote")} />
      {!d.video_configured ? (
        <Card style={{ borderColor: colors.warning }} testID="video-not-configured"><Body>Video service is not configured yet — add LiveKit credentials to enable calls.</Body></Card>
      ) : null}
      {wide ? (
        <View style={styles.desktopGrid}>
          <View style={[styles.dashboardColumn, { flex: 1.15 }]}>
            <Heading size={18}>{t("host.waiting")}</Heading>
            {panel("waiting")}
            <Heading size={18}>{t("host.people")}</Heading>
            {panel("people")}
          </View>
          <View style={[styles.dashboardColumn, { flex: 0.9 }]}>
            <Heading size={18}>{t("host.alerts")}</Heading>
            {panel("alerts")}
          </View>
          <View style={[styles.dashboardColumn, { flex: 1.05 }]}>
            <HostTabs tabs={TABS.filter((x) => x.key === "invites" || x.key === "settings")} value={tab === "settings" ? "settings" : "invites"} onChange={setTab} />
            {panel(tab === "settings" ? "settings" : "invites")}
          </View>
        </View>
      ) : (
        <>
          <HostTabs tabs={TABS} value={tab} onChange={setTab} />
          {panel(tab)}
        </>
      )}

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
    </Screen>
  );
}

const styles = StyleSheet.create({
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
