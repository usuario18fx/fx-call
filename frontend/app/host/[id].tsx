import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { api, saveParticipantKey } from "@/src/api";
import { Screen } from "@/src/components/Screen";
import { Badge, Body, Button, Card, Heading, Icon, Label, Loading, useToast } from "@/src/components/ui";
import { ChipRow, EventRow, Invite, InvitePanel, Participant, ParticipantRow, SecEvent, Settings, SettingsPanel } from "@/src/components/host-panels";
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
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
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
    <Screen back title={d.room.title} testID="host-dashboard" maxWidth={1200}>
      <View style={styles.statusRow}>
        <Badge testID="room-status-badge" label={active ? "Live" : "Ended"} tone={active ? "success" : "neutral"} />
        <Badge testID="room-lock-badge" label={d.room.locked ? "Locked" : "Open to invitations"} tone={d.room.locked ? "warning" : "brand"} icon={d.room.locked ? "lock" : "lock-open"} />
        <Badge label={live ? "Realtime connected" : "Realtime reconnecting"} tone={live ? "success" : "warning"} icon="radio" testID="realtime-badge" />
        <Badge label="Screen sharing disabled" tone="neutral" icon="monitor-off" />
      </View>
      {!d.video_configured ? (
        <Card style={{ borderColor: colors.warning }} testID="video-not-configured"><Body>Video service is not configured yet — add LiveKit credentials to enable calls.</Body></Card>
      ) : null}
      {active ? (
        <View style={styles.controls}>
          <Button testID="enter-call-button" label="Enter call" icon="video" onPress={() => router.push(`/call/${id}`)} disabled={!keyReady} />
          <Button testID="lock-room-button" label={d.room.locked ? "Unlock room" : "Lock room"} icon={d.room.locked ? "lock-open" : "lock"} variant="secondary" onPress={setLock} />
          <Button testID="end-call-all-button" label="End for everyone" icon="phone-off" variant="danger" onPress={() => setConfirmEnd(true)} />
        </View>
      ) : (
        <Body style={{ color: colors.muted }}>This meeting has ended. The security timeline remains available for 30 days.</Body>
      )}

      {wide ? (
        <View style={{ flexDirection: "row", gap: spacing.lg, alignItems: "flex-start" }}>
          <View style={{ flex: 1.2, gap: spacing.lg }}>
            <Heading size={18}>Waiting room</Heading>
            {panel("waiting")}
            <Heading size={18}>Participants</Heading>
            {panel("people")}
          </View>
          <View style={{ flex: 1, gap: spacing.lg }}>
            <Heading size={18}>Security timeline</Heading>
            {panel("alerts")}
          </View>
          <View style={{ flex: 1, gap: spacing.lg }}>
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
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  empty: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl },
  blockRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.md },
  modalBg: { flex: 1, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  modal: { width: "100%", maxWidth: 420, gap: spacing.md },
  modalTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.onSurfaceSecondary, textTransform: "uppercase", letterSpacing: 2 },
});
