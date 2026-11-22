import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, RefreshControl, StyleSheet, useWindowDimensions, View } from "react-native";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Screen } from "@/src/components/Screen";
import { Badge, Body, Button, Card, ErrorText, Field, Heading, Icon, Label, Logo, useToast } from "@/src/components/ui";
import { timeAgo } from "@/src/privacy/labels";
import { colors, radius, spacing } from "@/src/theme";

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
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: () => api<RoomRow[]>("/rooms"), enabled: !!user, refetchInterval: 15000 });

  const create = async () => {
    setBusy(true);
    try {
      const r = await api<{ id: string }>("/rooms", { body: { title: title.trim() || "Private meeting" } });
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

  const actions = (
    <View style={{ gap: spacing.lg, flex: wide ? 1 : undefined }}>
      <Card style={{ gap: spacing.md }} testID="start-call-card">
        <Icon name="shield-check" size={26} color={colors.onBrandTertiary} />
        <Heading size={20}>Start a secure room</Heading>
        <Body style={{ color: colors.muted }}>You are the host. Guests enter only through your private invitations and your approval.</Body>
        <Field testID="new-room-title-input" label="Meeting name" value={title} onChangeText={setTitle} placeholder="Board review" maxLength={80} />
        <Button testID="start-call-button" label="Start call" icon="video" loading={busy} onPress={create} />
      </Card>
      <Card style={{ gap: spacing.md }} testID="join-call-card">
        <Icon name="link" size={24} color={colors.onSurface} />
        <Heading size={20}>Join with a link</Heading>
        <Field testID="join-link-input" label="Invitation link" value={link} onChangeText={setLink} autoCapitalize="none" placeholder="https://…/room/…" onSubmitEditing={join} />
        <ErrorText testID="join-link-error">{joinError}</ErrorText>
        <Button testID="join-call-button" label="Join call" icon="log-in" variant="secondary" onPress={join} />
      </Card>
    </View>
  );

  const list = (
    <View style={{ gap: spacing.md, flex: wide ? 1.2 : undefined }}>
      <Label>Your rooms</Label>
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
          <Pressable key={r.id} testID={`room-row-${r.id}`} onPress={() => router.push(`/host/${r.id}`)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceTertiary }]}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Body style={{ color: colors.onSurfaceSecondary, fontSize: 16 }} numberOfLines={1}>{r.title}</Body>
              <Label>{timeAgo(r.created_at)}</Label>
              <View style={{ flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" }}>
                <Badge label={r.status === "active" ? "Live" : "Ended"} tone={r.status === "active" ? "success" : "neutral"} />
                {r.locked ? <Badge label="Locked" tone="warning" icon="lock" /> : null}
                {r.pending_count ? <Badge label={`${r.pending_count} waiting`} tone="brand" /> : null}
                {r.alert_count ? <Badge label={`${r.alert_count} alerts`} tone="error" icon="triangle-alert" /> : null}
              </View>
            </View>
            <Icon name="chevron-right" size={20} color={colors.muted} />
          </Pressable>
        ))
      )}
    </View>
  );

  return (
    <Screen
      testID="meetings-screen"
      refreshControl={<RefreshControl refreshing={rooms.isRefetching} onRefresh={() => rooms.refetch()} tintColor={colors.onSurface} />}
    >
      <View style={styles.top}>
        <Logo size={48} />
        <View style={{ flex: 1 }}>
          <Heading size={26}>FX Call</Heading>
          <Label>Welcome, {user?.display_name}</Label>
        </View>
        <Badge label="No screen sharing" icon="monitor-off" tone="brand" testID="no-screenshare-badge" />
      </View>
      <View style={{ flexDirection: wide ? "row" : "column", gap: spacing.lg, alignItems: "flex-start" }}>
        {actions}
        {list}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, width: "100%" },
  skeleton: { height: 92, borderRadius: radius.lg, backgroundColor: colors.surfaceTertiary, width: "100%" },
});
