import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { api, saveParticipantKey } from "@/src/api";
import { Screen } from "@/src/components/Screen";
import { Badge, Body, Button, Card, Heading, Icon, Label, Loading, useToast } from "@/src/components/ui";
import { ChipRow, EventRow, Invite, InvitePanel, Participant, ParticipantRow, SecEvent, Settings, SettingsPanel } from "@/src/components/host-panels";
import { deviceInfo } from "@/src/device";
import { EVENT_LABEL } from "@/src/privacy/labels";
import { nova } from "@/src/nova/designTokens";
import { useRoomSocket } from "@/src/realtime";
import { colors, fonts, spacing } from "@/src/theme";

type Dashboard = {
  room: { id: string; title: string; status: string; locked: boolean; settings: Settings };
  participants: Participant[]; events: SecEvent[]; invites: Invite[];
  blocks: { id: string; email: string; display_name: string }[]; video_configured: boolean;
};
type Tab = "people" | "waiting" | "alerts" | "invites" | "settings";

export default function HostDashboard() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  // Three columns only when each panel can remain readable without horizontal overflow.
  const wide = width >= 1320;
  const narrow = width < 620;
  const [tab, setTab] = useState<Tab>(initialTab === "settings" || initialTab === "invites" ? initialTab : "people");
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
    if (m.type === "security_event") toast(`${EVENT_LABEL[m.event.event_type] ?? "Privacy warning"} — ${m.event.username}`, "error");
    if (m.type === "join_request" && m.status === "pending") toast(`${m.name} is requesting to join`, "info");
    q.refetch();
  });

  if (q.isLoading) return <Loading label="Loading security dashboard" />;
  if (q.isError || !q.data)
    return (
      <Screen back title="Dashboard">
        <Card style={{ gap: spacing.md }}>
          <Body>Connection to security server interrupted.</Body>
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
    { key: "people" as Tab, label: `Participants · ${people.length}` },
    { key: "waiting" as Tab, label: `Waiting · ${waiting.length}` },
    { key: "alerts" as Tab, label: `Alerts · ${alerts}` },
    { key: "invites" as Tab, label: "Invitations" },
    { key: "settings" as Tab, label: "Settings" },
  ];

  const panel = (t: Tab) => {
    if (t === "people")
      return people.length + others.length === 0 ? (
        <Card style={styles.empty}><Icon name="shield" size={32} color={colors.muted} /><Body style={{ color: colors.muted }}>Room is empty. Waiting for guests.</Body></Card>
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
    if (t === "waiting")
      return waiting.length === 0 ? (
        <Card style={styles.empty} testID="waiting-empty"><Icon name="armchair" size={32} color={colors.muted} /><Body style={{ color: colors.muted }}>No one is waiting.</Body></Card>
      ) : (
        <View style={{ gap: spacing.md }}>{waiting.map((p) => <ParticipantRow key={p.id} waiting p={p} roomId={id} onDone={() => q.refetch()} />)}</View>
      );
    if (t === "alerts")
      return (
        <Card style={{ paddingVertical: spacing.sm }} testID="alerts-timeline">
          {d.events.length === 0 ? (
            <Body style={{ color: colors.muted, paddingVertical: spacing.lg }}>No capture events reported. Detection is only available on participants using the iOS or Android app.</Body>
          ) : d.events.map((e) => <EventRow key={e.id} e={e} />)}
        </Card>
      );
    if (t === "invites") return <InvitePanel roomId={id} invites={d.invites} onDone={() => q.refetch()} />;
    return <SettingsPanel roomId={id} settings={d.room.settings} onDone={() => q.refetch()} />;
  };

  return (
    <Screen back title={d.room.title} testID="host-dashboard" maxWidth={1480} contentStyle={styles.dashboardContent}>
      <View style={styles.roomBreadcrumb} testID="room-breadcrumb">
        <Pressable testID="breadcrumb-meetings" accessibilityRole="button" accessibilityLabel="Back to Meetings" onPress={() => router.replace("/meetings")} style={styles.crumb}>
          <Icon name="arrow-left" size={18} color={nova.color.mint} />
          <Body style={styles.crumbLabel}>Meetings</Body>
        </Pressable>
        <Icon name="chevron-right" size={16} color={nova.color.muted} />
        <Pressable testID="breadcrumb-room" accessibilityRole="button" accessibilityLabel="Return to room dashboard" onPress={() => setTab("people")} style={styles.crumb}>
          <Body style={styles.crumbLabel} numberOfLines={1}>{d.room.title}</Body>
        </Pressable>
        {tab !== "people" ? (
          <>
            <Icon name="chevron-right" size={16} color={nova.color.muted} />
            <Body style={{ color: nova.color.ink }}>{TABS.find((t) => t.key === tab)?.label}</Body>
          </>
        ) : null}
      </View>
      <View testID="nova-room-banner" style={styles.novaBar}>
        <View style={styles.novaMark}>
          <Icon name="shield-check" color={nova.color.mint} size={23} />
        </View>
        <View style={styles.novaCopy}>
          <Label style={styles.novaEyebrow}>FX CALL / NOVA CONTROL</Label>
          <Body style={styles.novaSubtitle}>Manage access, invitations and room security</Body>
        </View>
        <Pressable testID="room-settings-gear" accessibilityRole="button" accessibilityLabel="Open room settings" onPress={() => setTab("settings")} style={styles.novaTool}>
          <Icon name="settings-2" color={nova.color.mint} size={21} />
        </Pressable>
        <Pressable testID="room-invites-link" accessibilityRole="button" accessibilityLabel="Manage invitation links" onPress={() => setTab("invites")} style={styles.novaTool}>
          <Icon name="link-2" color={nova.color.ink} size={20} />
        </Pressable>
      </View>
      <View style={styles.statusRow}>
        <Badge testID="room-status-badge" label={active ? "Open" : "Ended"} tone={active ? "success" : "neutral"} />
        <Badge testID="room-lock-badge" label={d.room.locked ? "Locked" : "Open to invitations"} tone={d.room.locked ? "warning" : "brand"} icon={d.room.locked ? "lock" : "lock-open"} />
        <Badge label={live ? "Realtime connected" : "Realtime reconnecting"} tone={live ? "success" : "warning"} icon="radio" testID="realtime-badge" />
        <Badge label="Screen sharing disabled" tone="neutral" icon="monitor-off" />
      </View>
      {!d.video_configured ? (
        <Card style={{ borderColor: colors.warning }} testID="video-not-configured"><Body>Video service is not configured yet — add LiveKit credentials to enable calls.</Body></Card>
      ) : null}
      {active ? (
        <View style={styles.controls}>
          <Button testID="enter-call-button" label="Enter call" icon="video" style={narrow ? styles.mobileAction : styles.desktopAction} onPress={() => router.push(`/call/${id}`)} disabled={!keyReady} />
          <Button testID="lock-room-button" label={d.room.locked ? "Unlock room" : "Lock room"} icon={d.room.locked ? "lock-open" : "lock"} variant="secondary" style={narrow ? styles.mobileAction : styles.desktopAction} onPress={setLock} />
          <Button testID="end-call-all-button" label="End for everyone" icon="phone-off" variant="danger" style={narrow ? styles.mobileAction : styles.desktopAction} onPress={() => setConfirmEnd(true)} />
        </View>
      ) : (
        <Body style={{ color: colors.muted }}>This meeting has ended. The security timeline remains available for 30 days.</Body>
      )}

      {wide ? (
        <View style={styles.desktopGrid}>
          <View style={[styles.dashboardColumn, { flex: 1.15 }]}>
            <Heading size={18}>Waiting room</Heading>
            {panel("waiting")}
            <Heading size={18}>Participants</Heading>
            {panel("people")}
          </View>
          <View style={[styles.dashboardColumn, { flex: 0.9 }]}>
            <Heading size={18}>Security timeline</Heading>
            {panel("alerts")}
          </View>
          <View style={[styles.dashboardColumn, { flex: 1.05 }]}>
            <ChipRow options={TABS.filter((t) => t.key === "invites" || t.key === "settings")} value={tab === "settings" ? "settings" : "invites"} onChange={setTab} testPrefix="dashboard-tab" />
            {panel(tab === "settings" ? "settings" : "invites")}
          </View>
        </View>
      ) : (
        <>
          <ChipRow options={TABS} value={tab} onChange={setTab} testPrefix="dashboard-tab" />
          {panel(tab)}
        </>
      )}

      <Modal visible={confirmEnd} transparent animationType="fade" onRequestClose={() => setConfirmEnd(false)}>
        <View style={styles.modalBg}>
          <Card style={styles.modal} testID="end-confirm-modal">
            <Text style={styles.modalTitle}>End for everyone?</Text>
            <Body>All participants are disconnected and every invitation stops working.</Body>
            <Button testID="end-confirm-button" label="End meeting" variant="danger" onPress={endAll} />
            <Button testID="end-cancel-button" label="Cancel" variant="ghost" onPress={() => setConfirmEnd(false)} />
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dashboardContent: { minWidth: 0, width: "100%", paddingHorizontal: spacing.lg },
  roomBreadcrumb: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm, paddingVertical: spacing.sm },
  crumb: { flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 44, maxWidth: 240 },
  crumbLabel: { color: nova.color.muted, fontSize: 14 },
  novaBar: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.md, minWidth: 0,
    backgroundColor: nova.color.surfaceRaised, borderColor: nova.color.lineStrong, borderWidth: 1,
    borderRadius: 6, padding: spacing.md,
  },
  novaMark: { width: 44, height: 44, borderRadius: 6, borderWidth: 1, borderColor: nova.color.mintSoft, backgroundColor: nova.color.stage, alignItems: "center", justifyContent: "center" },
  novaCopy: { flex: 1, minWidth: 150, gap: spacing.xs },
  novaEyebrow: { color: nova.color.mint, letterSpacing: 1.6, fontSize: 11 },
  novaSubtitle: { color: colors.onSurfaceSecondary, fontSize: 12 },
  novaTool: { width: 42, height: 42, borderRadius: 6, borderColor: nova.color.lineStrong, borderWidth: 1, justifyContent: "center", alignItems: "center" },
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
