import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { participantApi, publicApi, saveParticipantKey } from "@/src/api";
import { useAuth } from "@/src/auth";
import { CameraPreview } from "@/src/components/CameraPreview";
import { Screen } from "@/src/components/Screen";
import { Badge, Body, Button, Card, ErrorText, Field, Heading, Icon, Label, Loading, Logo } from "@/src/components/ui";
import { deviceInfo } from "@/src/device";
import { getCaptureCapabilities } from "@/src/privacy/shield";
import { useRoomSocket } from "@/src/realtime";
import { colors, radius, spacing } from "@/src/theme";

type InviteInfo = { room_title: string; host_name: string; invite_name: string; require_approval: boolean; state: string; expires_at: string | null; privacy_rules: string[]; watermark: boolean };
const WAITING_IMG = "https://images.unsplash.com/photo-1771707691434-12ea601b5c2b?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";
const STATE_MSG: Record<string, string> = {
  expired: "This invitation has expired. Contact the host for a new one.",
  revoked: "This invitation was revoked by the host.",
  used_up: "This invitation has reached its use limit.",
  locked: "The host has locked this room. Try again later.",
  ended: "This meeting has ended.",
};

export default function GuestEntry() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const info = useQuery({ queryKey: ["invite", token], queryFn: () => publicApi<InviteInfo>(`/invites/${token}`), retry: false });

  const [step, setStep] = useState<"verify" | "setup" | "waiting" | "denied">("verify");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState("");

  useEffect(() => {
    if (user) {
      setName((n) => n || user.display_name);
      setStep((s) => (s === "verify" ? "setup" : s));
    }
  }, [user]);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () => run(async () => {
    if (!email.trim()) throw new Error("Enter your email.");
    await publicApi(`/invites/${token}/email-code`, { body: { email: email.trim() } });
    setCodeSent(true);
  });

  const confirmCode = () => run(async () => {
    const r = await publicApi<{ guest_token: string }>(`/invites/${token}/email-confirm`, { body: { email: email.trim(), code } });
    setGuestToken(r.guest_token);
    setStep("setup");
  });

  const requestJoin = () => run(async () => {
    if (!name.trim()) throw new Error("Enter the name the host will see.");
    if (!accepted) throw new Error("Accept the privacy rules to continue.");
    const r = await publicApi<{ room_id: string; participant_key: string; status: string }>(
      `/invites/${token}/join`,
      { body: { display_name: name.trim(), accept_rules: true, guest_token: guestToken ?? undefined, device: deviceInfo() } },
      !!user,
    );
    await saveParticipantKey(r.room_id, r.participant_key);
    setRoomId(r.room_id);
    if (r.status === "approved") router.replace(`/call/${r.room_id}`);
    else setStep("waiting");
  });

  // Waiting room: realtime signal + polling fallback.
  const status = useQuery({
    queryKey: ["waiting", roomId],
    queryFn: () => participantApi<{ participant: { status: string }; room: { status: string } }>(roomId!, "/me"),
    enabled: step === "waiting" && !!roomId,
    refetchInterval: 3000,
  });
  useRoomSocket(roomId ?? undefined, step === "waiting", () => status.refetch());
  useEffect(() => {
    const s = status.data?.participant.status;
    if (!s || !roomId) return;
    if (s === "approved") router.replace(`/call/${roomId}`);
    if (["rejected", "blocked", "removed"].includes(s)) {
      setDenied(s === "rejected" ? "The host declined your request." : "You cannot join this meeting.");
      setStep("denied");
    }
    if (status.data?.room.status === "ended") {
      setDenied("This meeting has ended.");
      setStep("denied");
    }
  }, [status.data, roomId, router]);

  if (info.isLoading) return <Loading label="Opening secure invitation" />;
  const inv = info.data;

  if (!inv || inv.state !== "valid") {
    return (
      <Screen maxWidth={520} testID="invite-invalid">
        <View style={styles.brand}><Logo size={96} /></View>
        <Card style={{ gap: spacing.md }}>
          <Heading size={20}>Invitation unavailable</Heading>
          <Body testID="invite-invalid-reason">{inv ? STATE_MSG[inv.state] ?? "This invitation is not valid." : "Invite link not found. Contact the host."}</Body>
          <Button testID="invite-exit-button" label="Exit" variant="secondary" onPress={() => router.replace("/")} />
        </Card>
      </Screen>
    );
  }

  if (step === "waiting" || step === "denied") {
    return (
      <View style={styles.waitRoot} testID="waiting-room">
        <Image source={{ uri: WAITING_IMG }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
        <Card style={styles.waitCard}>
          <Logo size={72} />
          <Heading size={22}>{step === "waiting" ? "Waiting room" : "Request closed"}</Heading>
          {step === "waiting" ? (
            <>
              <Badge testID="waiting-status" label="ʀᴇǫᴜᴇꜱᴛ ᴘᴇɴᴅɪɴɢ" tone="brand" icon="hourglass" />
              <Body style={{ textAlign: "center" }}>Waiting for {inv.host_name} to let you in. You'll join automatically once approved.</Body>
            </>
          ) : (
            <Body testID="denied-reason" style={{ textAlign: "center" }}>{denied}</Body>
          )}
          <Button testID="waiting-leave-button" label="Leave" variant="ghost" onPress={() => router.replace("/")} />
        </Card>
      </View>
    );
  }

  const caps = getCaptureCapabilities();

  return (
    <Screen maxWidth={560} testID="guest-entry">
      <View style={styles.brand}>
        <Logo size={104} />
        <Label>Private meeting invitation</Label>
      </View>
      <Card style={{ gap: spacing.sm }} testID="invite-details">
        <Heading size={22}>{inv.room_title}</Heading>
        <Body>Hosted by {inv.host_name} · {inv.invite_name}</Body>
        <View style={{ flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" }}>
          {inv.require_approval ? <Badge label="Host approval" tone="brand" icon="user-check" /> : null}
          <Badge label="No screen sharing" tone="neutral" icon="monitor-off" />
          {inv.watermark ? <Badge label="Watermarked" tone="neutral" icon="stamp" /> : null}
        </View>
        {inv.expires_at ? <Label>Link expires {new Date(inv.expires_at).toLocaleString()}</Label> : null}
      </Card>

      {step === "verify" ? (
        <Card style={{ gap: spacing.md }} testID="guest-verify-card">
          <Heading size={18}>Confirm your identity</Heading>
          <Body style={{ color: colors.muted }}>A display name alone is not proof of identity. Verify your email, or sign in to your FX CALL account.</Body>
          <Field testID="guest-email-input" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" editable={!codeSent} />
          {codeSent ? (
            <Field testID="guest-code-input" label="6-digit code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" onSubmitEditing={confirmCode} />
          ) : null}
          <ErrorText testID="guest-verify-error">{error}</ErrorText>
          {codeSent ? (
            <Button testID="guest-confirm-code-button" label="Verify" icon="badge-check" loading={busy} onPress={confirmCode} />
          ) : (
            <Button testID="guest-send-code-button" label="Send code" icon="mail" loading={busy} onPress={sendCode} />
          )}
          <Button testID="guest-signin-button" label="Sign in instead" variant="ghost" onPress={() => router.push({ pathname: "/auth/login", params: { next: `/room/${token}` } })} />
        </Card>
      ) : (
        <>
          <Card style={{ gap: spacing.md }} testID="guest-setup-card">
            <Badge label={user ? `Signed in · ${user.email}` : `Email verified · ${email}`} tone="success" icon="badge-check" />
            <Field testID="guest-name-input" label="Your name in the meeting" value={name} onChangeText={setName} maxLength={40} />
          </Card>
          <Card style={{ gap: spacing.md }} testID="privacy-rules-card">
            <Heading size={18}>Privacy rules</Heading>
            {inv.privacy_rules.map((r) => (
              <View key={r} style={styles.rule}><Icon name="shield-check" size={16} color={colors.onBrandTertiary} /><Body style={{ flex: 1 }}>{r}</Body></View>
            ))}
            <Body style={{ color: colors.muted }}>On this device: {caps.screenshot || caps.recording ? `capture detection active (${[caps.screenshot && "screenshots", caps.recording && "recording"].filter(Boolean).join(", ")}).` : caps.note}</Body>
            <Pressable testID="accept-rules-checkbox" onPress={() => setAccepted((a) => !a)} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }}>
              <View style={[styles.box, accepted && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>{accepted ? <Icon name="check" size={14} color={colors.onBrandPrimary} /> : null}</View>
              <Body style={{ flex: 1 }}>I accept the privacy rules</Body>
            </Pressable>
          </Card>
          <CameraPreview onReady={() => {}} />
          <ErrorText testID="guest-join-error">{error}</ErrorText>
          <Button testID="request-to-join-button" label="ʀᴇǫᴜᴇꜱᴛ ᴛᴏ ᴊᴏɪɴ" icon="door-open" loading={busy} onPress={requestJoin} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", gap: spacing.sm },
  rule: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  check: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44 },
  box: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  waitRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: colors.surface },
  waitCard: { alignItems: "center", gap: spacing.md, maxWidth: 440, width: "100%" },
});
