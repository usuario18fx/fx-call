import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Switch, useWindowDimensions, View } from "react-native";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Screen } from "@/src/components/Screen";
import type { Settings } from "@/src/components/host-panels";
import { Badge, Body, Button, Card, ErrorText, Field, Heading, Icon, Label, Logo, useToast } from "@/src/components/ui";
import { nova } from "@/src/nova/designTokens";
import { timeAgo } from "@/src/privacy/labels";
import { colors, radius, spacing } from "@/src/theme";

const ROOM_DEFAULTS: Settings = {
  notify_host: true,
  warn_participant: true,
  restrict_video_on_capture: false,
  auto_remove_on_capture: false,
  block_rejoin_after_removal: true,
  watermark: true,
  capture_protection: false,
};
const ROOM_OPTIONS: { key: keyof Settings; label: string }[] = [
  { key: "notify_host", label: "Security notifications" },
  { key: "warn_participant", label: "Warn participants on detection" },
  { key: "restrict_video_on_capture", label: "Restrict video after detection" },
  { key: "auto_remove_on_capture", label: "Auto-remove after verified capture" },
  { key: "block_rejoin_after_removal", label: "Block rejoining after removal" },
  { key: "watermark", label: "Participant watermark" },
  { key: "capture_protection", label: "Native capture protection where supported" },
];

type RoomRow = { id: string; title: string; status: string; locked: boolean; created_at: string; pending_count: number; active_count: number; alert_count: number };

export function extractToken(input: string): string | null {
  const t = input.trim();
  const m = t.match(/\/room\/([A-Za-z0-9_-]{16,64})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{16,64}$/.test(t) ? t : null;
}

export default function Meetings() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [showCreateSettings, setShowCreateSettings] = useState(false);
  const [roomPrefs, setRoomPrefs] = useState<Settings>(ROOM_DEFAULTS);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoomTitle, setEditingRoomTitle] = useState("");
  const [savingRoomId, setSavingRoomId] = useState<string | null>(null);
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: () => api<RoomRow[]>("/rooms"), enabled: !!user, refetchInterval: 15000 });

  const create = async () => {
    setBusy(true);
    try {
      const r = await api<{ id: string }>("/rooms", { body: { title: title.trim() || "Private meeting", settings: roomPrefs } });
      setTitle("");
      rooms.refetch();
      router.push(`/host/${r.id}`);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const join = () => {
    const token = extractToken(link);
    if (!token) return setJoinError("Paste a full FX CALL invitation link.");
    setJoinError(null);
    router.push(`/room/${token}`);
  };

  const saveRoomName = async (id: string) => {
    const next = editingRoomTitle.trim();
    if (!next || next.length > 80) {
      toast("Enter a room name (1–80 characters).", "error");
      return;
    }
    setSavingRoomId(id);
    try {
      await api(`/rooms/${id}`, { method: "PATCH", body: { title: next } });
      setEditingRoomId(null);
      setEditingRoomTitle("");
      await rooms.refetch();
      toast("Room name updated", "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSavingRoomId(null);
    }
  };
  const goToRoomPanel = (id: string, tab: "settings" | "invites") => {
    router.push({ pathname: "/host/[id]", params: { id, tab } });
  };

  const actions = (
    <View style={{ gap: spacing.lg, flex: wide ? 1 : undefined, minWidth: 0, width: wide ? undefined : "100%" }}>
      <Card style={styles.actionCard} testID="start-call-card">
        <View style={styles.cardTitleRow}>
          <Icon name="shield-check" size={26} color={nova.color.mint} />
          <Pressable
            testID="new-room-settings-gear"
            accessibilityRole="button"
            accessibilityLabel="Configure room security settings"
            accessibilityState={{ expanded: showCreateSettings }}
            onPress={() => setShowCreateSettings((v) => !v)}
            style={styles.cardTool}
          >
            <Icon name="settings-2" size={23} color={nova.color.mint} />
          </Pressable>
        </View>
        <Heading size={20}>Create a private room</Heading>
        <Body style={{ color: colors.muted }}>Invite guests. Approve entry. Stay in control.</Body>
        <Field testID="new-room-title-input" label="Meeting name" value={title} onChangeText={setTitle} placeholder="Room name" maxLength={80} />
        {showCreateSettings ? (
          <View testID="new-room-security-options" style={styles.preferences}>
            <Label>SECURITY OPTIONS · APPLIED WHEN ROOM IS CREATED</Label>
            {ROOM_OPTIONS.map(({ key, label }) => (
              <View key={key} style={styles.optionRow}>
                <Body style={{ flex: 1, fontSize: 13 }}>{label}</Body>
                <Switch
                  testID={`new-room-option-${key}`}
                  accessibilityLabel={label}
                  value={roomPrefs[key]}
                  onValueChange={(value) => setRoomPrefs((prev) => ({ ...prev, [key]: value }))}
                  trackColor={{ true: nova.color.mint, false: nova.color.lineStrong }}
                  thumbColor={nova.color.ink}
                />
              </View>
            ))}
            <Label>Capture protections depend on device support; no browser screenshot detection is guaranteed.</Label>
          </View>
        ) : null}
        <Button testID="start-call-button" label="Start call" icon="video" loading={busy} onPress={create} />
      </Card>
      <Card style={styles.actionCard} testID="join-call-card">
        <View style={styles.cardTitleRow}>
          <Icon name="link" size={24} color={nova.color.ink} />
          <Pressable
            testID="edit-invitation-link"
            accessibilityRole="button"
            accessibilityLabel="Enter or edit invitation link"
            accessibilityState={{ expanded: showJoinInput }}
            onPress={() => setShowJoinInput((v) => !v)}
            style={styles.cardTool}
          >
            <Icon name="pencil" size={21} color={nova.color.mint} />
          </Pressable>
        </View>
        <Heading size={20}>Join with a link</Heading>
        {showJoinInput ? (
          <>
            <Field testID="join-link-input" label="Invitation link" value={link} onChangeText={setLink} autoCapitalize="none" placeholder="https://…/room/…" onSubmitEditing={join} />
            <ErrorText testID="join-link-error">{joinError}</ErrorText>
            <Button testID="join-call-button" label="Join call" icon="log-in" variant="secondary" onPress={join} />
          </>
        ) : <Label>Tap the pencil to enter your invitation.</Label>}
      </Card>
    </View>
  );

  const list = (
    <View style={{ gap: spacing.md, flex: wide ? 1.2 : undefined, minWidth: 0, width: wide ? undefined : "100%" }}>
      <Label style={{ color: nova.color.mint }}>02 / YOUR ROOMS</Label>
      {rooms.isLoading ? (
        [0, 1, 2].map((i) => <View key={i} style={styles.skeleton} />)
      ) : rooms.isError ? (
        <Card style={{ gap: spacing.md }}>
          <Body>Unable to sync your rooms. Please verify your connection.</Body>
          <Button testID="rooms-retry-button" label="Retry" variant="secondary" compact onPress={() => rooms.refetch()} />
        </Card>
      ) : !rooms.data?.length ? (
        <Card style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl }} testID="rooms-empty">
          <Icon name="shield" size={36} color={colors.muted} />
          <Body style={{ textAlign: "center", color: colors.muted }}>No private meetings yet. Start a secure room to invite guests.</Body>
        </Card>
      ) : (
        rooms.data.map((r) => (
          <View key={r.id} style={styles.row} testID={`room-row-${r.id}`}>
            <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
              {editingRoomId === r.id ? (
                <View style={styles.renamePanel} testID={`room-rename-panel-${r.id}`}>
                  <Field testID={`room-rename-input-${r.id}`} label="Room name" value={editingRoomTitle} onChangeText={setEditingRoomTitle} maxLength={80} />
                  <View style={styles.rowActions}>
                    <Button testID={`room-rename-save-${r.id}`} compact label="Save" icon="check" disabled={!!savingRoomId || !editingRoomTitle.trim()} onPress={() => { void saveRoomName(r.id); }} />
                    <Button testID={`room-rename-cancel-${r.id}`} compact label="Cancel" variant="secondary" onPress={() => setEditingRoomId(null)} />
                  </View>
                </View>
              ) : (
                <Pressable testID={`room-open-${r.id}`} accessibilityRole="button" accessibilityLabel={`Open room ${r.title}`} onPress={() => router.push(`/host/${r.id}`)}>
                  <Body style={{ color: colors.onSurfaceSecondary, fontSize: 16 }} numberOfLines={1}>{r.title}</Body>
                  <Label>{timeAgo(r.created_at)}</Label>
                  <View style={{ flexDirection: "row", gap: spacing.xs, flexWrap: "wrap", marginTop: spacing.xs }}>
                    <Badge label={r.status === "active" ? "Open" : "Ended"} tone={r.status === "active" ? "success" : "neutral"} />
                    {r.locked ? <Badge label="Locked" tone="warning" icon="lock" /> : null}
                    {r.pending_count ? <Badge label={`${r.pending_count} waiting`} tone="brand" /> : null}
                    {r.alert_count ? <Badge label={`${r.alert_count} alerts`} tone="error" icon="triangle-alert" /> : null}
                  </View>
                </Pressable>
              )}
            </View>
            {editingRoomId !== r.id ? (
              <View style={styles.rowActions}>
                <Pressable
                  testID={`room-edit-${r.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Rename ${r.title}`}
                  onPress={() => { setEditingRoomId(r.id); setEditingRoomTitle(r.title); }}
                  style={styles.cardTool}
                >
                  <Icon name="pencil" size={20} color={nova.color.mint} />
                </Pressable>
                <Pressable
                  testID={`room-settings-${r.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Settings for ${r.title}`}
                  onPress={() => goToRoomPanel(r.id, "settings")}
                  style={styles.cardTool}
                >
                  <Icon name="settings-2" size={21} color={nova.color.mint} />
                </Pressable>
                <Pressable
                  testID={`room-invites-${r.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Invitations for ${r.title}`}
                  onPress={() => goToRoomPanel(r.id, "invites")}
                  style={styles.cardTool}
                >
                  <Icon name="link-2" size={20} color={nova.color.ink} />
                </Pressable>
              </View>
            ) : null}
          </View>
        ))
      )}
    </View>
  );

  return (
    <Screen
      testID="meetings-screen"
      refreshControl={<RefreshControl refreshing={rooms.isRefetching} onRefresh={() => { void rooms.refetch(); }} tintColor={colors.onSurface} />}
    >
      <View style={styles.top}>
        <View style={styles.novaMark}><Logo size={46} /></View>
        <View style={{ flex: 1 }}>
          <Label style={{ color: nova.color.mint }}>NOVA / FX CALL</Label>
          <Heading size={26}>Meetings</Heading>
          <Label>Welcome, {user?.display_name}</Label>
        </View>
        <Badge label="No screen sharing" icon="monitor-off" tone="brand" testID="no-screenshare-badge" />
      </View>
      <View style={{ flexDirection: wide ? "row" : "column", gap: spacing.lg, alignItems: "stretch", width: "100%" }}>
        {actions}
        {list}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.md, paddingVertical: spacing.md },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTool: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 6, borderWidth: 1, borderColor: nova.color.lineStrong, backgroundColor: nova.color.stage },
  preferences: { gap: spacing.sm, padding: spacing.md, backgroundColor: nova.color.stage, borderRadius: 6, borderWidth: 1, borderColor: nova.color.lineStrong },
  optionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, justifyContent: "space-between", paddingVertical: spacing.xs },
  rowActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs },
  renamePanel: { gap: spacing.sm, width: "100%" },
  novaMark: { width: 52, height: 52, backgroundColor: "#0B1D29", borderWidth: 1, borderColor: "#31627A", borderRadius: 6, alignItems: "center", justifyContent: "center" },
  novaMarkText: { fontSize: 22, fontWeight: "800", color: nova.color.mintInk },
  actionCard: { gap: spacing.md, borderColor: nova.color.lineStrong, backgroundColor: nova.color.surfaceRaised, borderRadius: 6, padding: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: nova.color.surfaceRaised, borderWidth: 1, borderColor: nova.color.lineStrong, width: "100%" },
  skeleton: { height: 92, borderRadius: radius.lg, backgroundColor: colors.surfaceTertiary, width: "100%" },
});
