import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { api } from "@/src/api";
import { Badge, Body, Button, Card, Field, Heading, Icon, Label, s, useToast } from "@/src/components/ui";
import { ACTION_LABEL, EVENT_LABEL, platformIcon, platformLabel, SOURCE_LABEL, timeAgo } from "@/src/privacy/labels";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { nova } from "@/src/nova/designTokens";

export type Participant = {
  id: string; display_name: string; role: string; status: string; platform: string; os: string; model?: string;
  verified_identity: string; camera_on: boolean; mic_on: boolean; in_call: boolean; video_restricted: boolean; warnings: number;
  capture?: { screenshot: boolean; recording: boolean; source: string }; email?: string;
};
export type SecEvent = {
  id: string; participant_id: string; username: string; device_type: string; os: string; detection_source: string;
  event_type: string; verified: boolean; verification_status: string; actions: string[]; created_at: string; verified_identity?: string;
};
export type Invite = { id: string; name: string; token_hint: string; require_approval: boolean; max_uses: number | null; uses: number; expires_at: string | null; revoked: boolean; state: string; created_at: string };
export type Settings = Record<"notify_host" | "warn_participant" | "restrict_video_on_capture" | "auto_remove_on_capture" | "block_rejoin_after_removal" | "watermark" | "capture_protection", boolean>;

/** Horizontal chip row — chrome, never wraps. */
export function ChipRow<T extends string>({ options, value, onChange, testPrefix }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void; testPrefix: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 56, flexGrow: 0 }} contentContainerStyle={{ gap: spacing.sm, alignItems: "center", paddingHorizontal: 2 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} testID={`${testPrefix}-${o.key}`} onPress={() => onChange(o.key)}
            style={[styles.chip, { backgroundColor: on ? colors.brandPrimary : colors.surfaceTertiary, borderColor: on ? colors.brandPrimary : colors.border }]}>
            <Text style={[styles.chipText, { color: on ? colors.onBrandPrimary : colors.onSurface }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Invitation options wrap into a two-column grid instead of overflowing or creating another scroll area. */
function InviteChoices<T extends string>({ options, value, onChange, testPrefix }: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testPrefix: string;
}) {
  // A discrete, accessible scale: each marked stop maps to an actual server value.
  return (
    <View style={styles.inviteScale}>
      <View pointerEvents="none" style={styles.scaleTrack} />
      {options.map((o) => {
        const selected = o.key === value;
        return (
          <Pressable
            key={o.key}
            testID={`${testPrefix}-${o.key}`}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(o.key)}
            style={styles.scaleStop}
          >
            <Body style={[styles.scaleLabel, selected && styles.scaleLabelSelected]} numberOfLines={1}>{o.label}</Body>
            <View style={[styles.scaleDot, selected && styles.scaleDotSelected]}>
              {selected ? <View style={styles.scaleDotCenter} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function CaptureBadge({ p }: { p: Participant }) {
  if (p.platform === "web") return <Badge label="Detection unavailable · browser" tone="neutral" icon="eye-off" />;
  const c = p.capture;
  if (!c || (!c.screenshot && !c.recording)) return <Badge label="Detection unavailable" tone="warning" icon="eye-off" />;
  return <Badge label={`Detects ${[c.screenshot && "screenshots", c.recording && "recording"].filter(Boolean).join(" + ")}`} tone="success" icon="scan-eye" />;
}

export function ParticipantRow({ p, roomId, onDone, waiting }: { p: Participant; roomId: string; onDone: () => void; waiting?: boolean }) {
  const toast = useToast();
  const act = async (action: string) => {
    try {
      await api(`/rooms/${roomId}/participants/${p.id}/${action}`, { body: {} });
      onDone();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };
  const isHost = p.role === "host";
  return (
    <Card style={{ gap: spacing.sm, padding: spacing.md }} testID={`participant-row-${p.id}`}>
      <View style={styles.rowTop}>
        <Icon name={platformIcon(p.platform) as any} size={20} color={colors.onSurface} />
        <View style={{ flex: 1 }}>
          <Body style={{ color: colors.onSurfaceSecondary, fontSize: 15 }} numberOfLines={1}>{p.display_name}{isHost ? " · Host" : ""}</Body>
          <Label>{platformLabel(p.platform)} · {p.os}{p.model ? ` · ${p.model}` : ""}</Label>
        </View>
        {!waiting ? (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Icon name={p.mic_on ? "mic" : "mic-off"} size={18} color={p.mic_on ? colors.onSurface : colors.onError} />
            <Icon name={p.camera_on ? "video" : "video-off"} size={18} color={p.camera_on ? colors.onSurface : colors.onError} />
          </View>
        ) : null}
      </View>
      <View style={styles.badges}>
        <Badge label={p.verified_identity === "account" ? "Verified account" : "Email verified"} tone="brand" icon="badge-check" />
        <CaptureBadge p={p} />
        {!waiting && p.in_call ? <Badge label="In call" tone="success" /> : null}
        {p.warnings ? <Badge label={`${p.warnings} warning${p.warnings > 1 ? "s" : ""}`} tone="warning" /> : null}
        {p.video_restricted ? <Badge label="Video restricted" tone="error" /> : null}
        {["removed", "blocked", "rejected"].includes(p.status) ? <Badge label={p.status} tone="error" /> : null}
      </View>
      {isHost ? null : waiting ? (
        <View style={styles.actions}>
          <Button testID={`approve-${p.id}`} compact label="Approve" icon="check" onPress={() => act("approve")} />
          <Button testID={`reject-${p.id}`} compact label="Reject" variant="secondary" onPress={() => act("reject")} />
          <Button testID={`block-${p.id}`} compact label="Block" variant="ghost" onPress={() => act("block")} />
        </View>
      ) : p.status === "approved" ? (
        <View style={styles.actions}>
          <Button testID={`mute-${p.id}`} compact label="Mute" icon="mic-off" variant="secondary" onPress={() => act("mute")} />
          <Button testID={`video-${p.id}`} compact label={p.video_restricted ? "Allow video" : "Restrict video"} variant="secondary" onPress={() => act(p.video_restricted ? "allow-video" : "restrict-video")} />
          <Button testID={`remove-${p.id}`} compact label="Remove" variant="danger" onPress={() => act("remove")} />
          <Button testID={`block-${p.id}`} compact label="Block" variant="ghost" onPress={() => act("block")} />
        </View>
      ) : null}
    </Card>
  );
}

export function EventRow({ e }: { e: SecEvent }) {
  const alert = e.event_type !== "recording_stopped";
  return (
    <View style={styles.event} testID={`security-event-${e.id}`}>
      <View style={[styles.dot, { backgroundColor: alert ? colors.error : colors.borderStrong }]} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.eventTitle, { color: alert ? colors.onError : colors.onSurface }]}>{EVENT_LABEL[e.event_type] ?? e.event_type}</Text>
        <Body style={{ color: colors.onSurfaceSecondary }}>{e.username} · {platformLabel(e.device_type)} · {e.os}</Body>
        <Label>{SOURCE_LABEL[e.detection_source] ?? e.detection_source} · {new Date(e.created_at).toLocaleTimeString()} · {timeAgo(e.created_at)}</Label>
        <Label>Participant {e.participant_id.slice(0, 8)} · {e.verified_identity === "account" ? "account" : "email-verified guest"}</Label>
        <View style={styles.badges}>
          <Badge label={e.verified ? "Verified device signal" : "Unverified"} tone={e.verified ? "success" : "warning"} icon="shield-check" />
          {e.actions.map((a) => <Badge key={a} label={ACTION_LABEL[a] ?? a} tone="warning" />)}
        </View>
      </View>
    </View>
  );
}

const USES = [{ key: "1", label: "1" }, { key: "10", label: "10" }, { key: "100", label: "100" }, { key: "0", label: "∞" }] as const;
const EXPIRY = [{ key: "1h", label: "1 hour" }, { key: "1d", label: "1 day" }, { key: "1w", label: "1 week" }, { key: "never", label: "∞" }] as const;

export function InvitePanel({ roomId, invites, onDone }: { roomId: string; invites: Invite[]; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [approval, setApproval] = useState(true);
  const [uses, setUses] = useState<string>("1");
  const [expiry, setExpiry] = useState<string>("1d");
  const [hours, setHours] = useState("48");
  const [created, setCreated] = useState<{ url: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const custom = expiry === "custom" ? new Date(Date.now() + Math.max(1, Number(hours) || 1) * 3600_000).toISOString() : undefined;
      const r = await api<{ url: string; name: string }>(`/rooms/${roomId}/invites`, {
        body: { name: name.trim() || "Guest invitation", require_approval: approval, max_uses: uses === "0" ? null : Number(uses), expires: expiry, custom_expires_at: custom },
      });
      setCreated(r);
      setName("");
      onDone();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    await api(`/rooms/${roomId}/invites/${id}/revoke`, { body: {} }).catch((e) => toast(e.message, "error"));
    onDone();
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <Card style={{ gap: spacing.md }} testID="invite-create-card">
        <View style={styles.rowBetween}>
          <Heading size={18}>New invitation</Heading>
          <Icon name="link-2" size={20} color={nova.color.mint} />
        </View>
        <Field testID="invite-name-input" label="Invitation name (optional)" value={name} onChangeText={setName} placeholder="Guest invitation" maxLength={60} />
        <Label>LIMIT BY TIME</Label>
        <InviteChoices options={EXPIRY} value={expiry} onChange={setExpiry} testPrefix="invite-expiry" />
        <View style={styles.inviteSummary}>
          <Body>Expiration</Body>
          <Body style={styles.inviteSummaryValue}>{expiry === "1h" ? "1 hour" : expiry === "1d" ? "1 day" : expiry === "1w" ? "1 week" : expiry === "never" ? "Never" : `${hours || "1"} hours`}</Body>
        </View>
        <Pressable testID="invite-custom-expiry" accessibilityRole="button" accessibilityLabel="Set custom invitation expiration" onPress={() => setExpiry(expiry === "custom" ? "1d" : "custom")} style={styles.customExpiry}>
          <Icon name="calendar-clock" size={17} color={nova.color.mint} />
          <Label>{expiry === "custom" ? "Use preset expiration" : "Custom expiration"}</Label>
        </Pressable>
        {expiry === "custom" ? (
          <Field testID="invite-custom-hours-input" label="Expire after (hours)" value={hours} onChangeText={(t) => setHours(t.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" />
        ) : null}
        <Label>LIMIT BY NUMBER OF USERS</Label>
        <InviteChoices options={USES} value={uses} onChange={setUses} testPrefix="invite-uses" />
        <View style={styles.inviteSummary}>
          <Body>Number of users</Body>
          <Body style={styles.inviteSummaryValue}>{uses === "0" ? "Unlimited" : uses}</Body>
        </View>
        <View style={styles.rowBetween}>
          <Body>Require host approval</Body>
          <Switch testID="invite-approval-switch" value={approval} onValueChange={setApproval} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor={colors.onSurfaceSecondary} />
        </View>
        <Button testID="invite-create-button" label="Generate secure link" icon="link-2" loading={busy} onPress={create} />
        {created ? (
          <View style={styles.created} testID="invite-created">
            <Label color={colors.onBrandTertiary}>Copy now — for security this link is shown only once</Label>
            <Text selectable style={[s.body, { color: colors.onSurfaceSecondary, flexShrink: 1 }]} testID="invite-url-text">{created.url}</Text>
            <Button testID="invite-copy-button" compact label="Copy link" icon="copy" variant="secondary" onPress={async () => {
              await Clipboard.setStringAsync(created.url);
              toast("Invitation link copied", "success");
            }} />
          </View>
        ) : null}
      </Card>
      <Label>Invitations</Label>
      {invites.length === 0 ? <Body style={{ color: colors.muted }}>No invitations yet.</Body> : null}
      {invites.map((i) => (
        <Card key={i.id} style={{ gap: spacing.sm, padding: spacing.md }} testID={`invite-row-${i.id}`}>
          <View style={styles.rowBetween}>
            <Body style={{ color: colors.onSurfaceSecondary, flex: 1 }} numberOfLines={1}>{i.name} · {i.token_hint}…</Body>
            <Badge label={i.state.replace("_", " ")} tone={i.state === "valid" ? "success" : "neutral"} testID={`invite-state-${i.id}`} />
          </View>
          <Label>
            {i.max_uses ? `${i.uses}/${i.max_uses} used` : `${i.uses} used · unlimited`} · {i.expires_at ? `expires ${new Date(i.expires_at).toLocaleString()}` : "never expires"} · {i.require_approval ? "approval required" : "auto-admit"}
          </Label>
          {!i.revoked ? <Button testID={`invite-revoke-${i.id}`} compact label="Revoke" variant="ghost" icon="ban" onPress={() => revoke(i.id)} /> : null}
        </Card>
      ))}
    </View>
  );
}

const SETTING_ROWS: { key: keyof Settings; title: string; desc: string }[] = [
  { key: "notify_host", title: "Immediate security notifications", desc: "Alert you the moment a device reports a capture event." },
  { key: "warn_participant", title: "Participant warnings", desc: "Show the participant a privacy warning after their device reports a capture." },
  { key: "restrict_video_on_capture", title: "Restrict video access", desc: "Stop the participant receiving others' audio/video after a verified capture." },
  { key: "auto_remove_on_capture", title: "Automatic removal", desc: "Remove a participant after a verified, device-reported screenshot or recording. Never applied when detection is unavailable." },
  { key: "block_rejoin_after_removal", title: "Rejoining restrictions", desc: "Removed participants cannot rejoin this meeting." },
  { key: "watermark", title: "Dynamic watermarks", desc: "Overlay each participant's name, ID and time on their video view." },
  { key: "capture_protection", title: "Capture protection", desc: "Android FLAG_SECURE and iOS secure view block in-app screenshots and recordings where supported." },
];

export function SettingsPanel({ roomId, settings, onDone }: { roomId: string; settings: Settings; onDone: () => void }) {
  const toast = useToast();
  const [local, setLocal] = useState(settings);
  const toggle = async (key: keyof Settings, v: boolean) => {
    const next = { ...local, [key]: v };
    setLocal(next);
    try {
      await api(`/rooms/${roomId}/settings`, { method: "PATCH", body: next });
      onDone();
    } catch (e: any) {
      setLocal(local);
      toast(e.message, "error");
    }
  };
  return (
    <Card style={{ gap: spacing.md }} testID="settings-panel">
      <Heading size={18}>Privacy protection</Heading>
      <Label>Enforced by the FX CALL server</Label>
      {SETTING_ROWS.map((r) => (
        <View key={r.key} style={styles.settingRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Body style={{ color: colors.onSurfaceSecondary }}>{r.title}</Body>
            <Label style={{ textTransform: "none", letterSpacing: 0 }}>{r.desc}</Label>
          </View>
          <Switch testID={`setting-${r.key}`} value={local[r.key]} onValueChange={(v) => toggle(r.key, v)} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor={colors.onSurfaceSecondary} />
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  chip: { height: 36, paddingHorizontal: spacing.lg, borderRadius: 6, alignItems: "center", justifyContent: "center", borderWidth: 1, flexShrink: 0 },
  chipText: { fontFamily: fonts.text, fontSize: 13, letterSpacing: 0.6 },
  inviteScale: { width: "100%", flexDirection: "row", alignItems: "stretch", position: "relative", paddingBottom: spacing.xs },
  scaleTrack: { position: "absolute", left: "12.5%", right: "12.5%", bottom: 15, height: 3, borderRadius: 2, backgroundColor: nova.color.mintSoft },
  scaleStop: { flex: 1, minWidth: 0, minHeight: 64, alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm, gap: spacing.sm },
  scaleLabel: { color: nova.color.muted, fontSize: 12 },
  scaleLabelSelected: { color: nova.color.mint, fontWeight: "700" },
  scaleDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: nova.color.lineStrong, backgroundColor: nova.color.surface, alignItems: "center", justifyContent: "center" },
  scaleDotSelected: { borderColor: nova.color.mint, backgroundColor: nova.color.mint },
  scaleDotCenter: { width: 8, height: 8, borderRadius: 4, backgroundColor: nova.color.mintInk },
  inviteSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, padding: spacing.md, backgroundColor: nova.color.stage, borderRadius: 6 },
  inviteSummaryValue: { color: nova.color.mint },
  customExpiry: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  event: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  eventTitle: { fontFamily: fonts.display, fontSize: 18, letterSpacing: 1.5 },
  created: { gap: spacing.sm, padding: spacing.md, borderRadius: 6, backgroundColor: colors.brandTertiary, minWidth: 0 },
  settingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
});
