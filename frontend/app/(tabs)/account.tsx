import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Screen } from "@/src/components/Screen";
import { Badge, Body, Button, Card, Divider, ErrorText, Field, Heading, Icon, Label, useToast } from "@/src/components/ui";
import { deviceInfo } from "@/src/device";
import { platformLabel, timeAgo } from "@/src/privacy/labels";
import { getCaptureCapabilities } from "@/src/privacy/shield";
import { colors, spacing } from "@/src/theme";

type Session = { id: string; platform: string; os: string; device_name: string; created_at: string; last_used_at: string; current: boolean };

export default function Account() {
  const { user, setUser, refreshUser, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(user?.display_name ?? "");
  const [setup, setSetup] = useState<{ secret: string; qr_png_base64: string } | null>(null);
  const [code, setCode] = useState("");
  const [disablePw, setDisablePw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => api<Session[]>("/auth/sessions") });
  const caps = getCaptureCapabilities();
  const dev = deviceInfo();

  const run = async (fn: () => Promise<void>) => {
    setErr(null);
    try {
      await fn();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const signOut = async (all: boolean) => {
    await logout(all);
    router.replace("/auth/login");
  };

  return (
    <Screen title="Account" testID="account-screen" maxWidth={760}>
      <Card style={{ gap: spacing.md }}>
        <Heading size={18}>Profile</Heading>
        <Label>{user?.email}</Label>
        <Field testID="profile-name-input" label="Display name" value={name} onChangeText={setName} maxLength={60} />
        <Button testID="profile-save-button" compact label="Save" variant="secondary" onPress={() => run(async () => {
          setUser(await api("/auth/me", { method: "PATCH", body: { display_name: name } }));
          toast("Profile saved", "success");
        })} />
      </Card>

      <Card style={{ gap: spacing.md }} testID="twofa-card">
        <View style={styles.rowBetween}>
          <Heading size={18}>Two-factor sign-in</Heading>
          <Badge testID="twofa-status" label={user?.totp_enabled ? "On" : "Off"} tone={user?.totp_enabled ? "success" : "neutral"} />
        </View>
        <Body style={{ color: colors.muted }}>Require a code from an authenticator app (Google Authenticator, 1Password, Authy) at every sign-in.</Body>
        {!user?.totp_enabled && !setup ? (
          <Button testID="twofa-setup-button" compact label="Set up" icon="key-round" onPress={() => run(async () => setSetup(await api("/auth/2fa/setup", { body: {} })))} />
        ) : null}
        {setup ? (
          <View style={{ gap: spacing.md }}>
            <Image testID="twofa-qr" source={{ uri: `data:image/png;base64,${setup.qr_png_base64}` }} style={styles.qr} contentFit="contain" />
            <Label>Or enter this key</Label>
            <Body testID="twofa-secret" style={{ letterSpacing: 2, color: colors.onSurfaceSecondary }} selectable>{setup.secret}</Body>
            <Field testID="twofa-code-input" label="6-digit code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" />
            <Button testID="twofa-confirm-button" compact label="Turn on" onPress={() => run(async () => {
              await api("/auth/2fa/confirm", { body: { code } });
              setSetup(null);
              setCode("");
              await refreshUser();
              toast("Two-factor sign-in enabled", "success");
            })} />
          </View>
        ) : null}
        {user?.totp_enabled ? (
          <View style={{ gap: spacing.md }}>
            <Field testID="twofa-disable-password-input" label="Password" value={disablePw} onChangeText={setDisablePw} secureTextEntry />
            <Field testID="twofa-disable-code-input" label="Authenticator code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" />
            <Button testID="twofa-disable-button" compact variant="ghost" label="Turn off" onPress={() => run(async () => {
              await api("/auth/2fa/disable", { body: { password: disablePw, code } });
              setDisablePw("");
              setCode("");
              await refreshUser();
              toast("Two-factor sign-in disabled", "info");
            })} />
          </View>
        ) : null}
        <ErrorText testID="account-error">{err}</ErrorText>
      </Card>

      <Card style={{ gap: spacing.sm }} testID="sessions-card">
        <Heading size={18}>Devices & sessions</Heading>
        {(sessions.data ?? []).map((s) => (
          <View key={s.id} style={styles.session} testID={`session-row-${s.id}`}>
            <Icon name={s.platform === "web" ? "monitor" : "smartphone"} size={20} color={colors.onSurface} />
            <View style={{ flex: 1 }}>
              <Body style={{ color: colors.onSurfaceSecondary }}>{s.device_name || platformLabel(s.platform)} · {s.os}</Body>
              <Label>Signed in {timeAgo(s.created_at)}</Label>
            </View>
            {s.current ? <Badge label="This device" tone="brand" /> : (
              <Button testID={`revoke-session-${s.id}`} compact variant="ghost" label="Sign out" onPress={() => run(async () => {
                await api(`/auth/sessions/${s.id}`, { method: "DELETE" });
                sessions.refetch();
              })} />
            )}
          </View>
        ))}
        <Divider />
        <Button testID="logout-button" label="Sign out" variant="secondary" icon="log-out" onPress={() => signOut(false)} />
        <Button testID="logout-all-button" label="Sign out of all devices" variant="danger" icon="shield-off" onPress={() => signOut(true)} />
      </Card>

      <Card style={{ gap: spacing.sm }} testID="capability-report-card">
        <Heading size={18}>Privacy Shield · this device</Heading>
        <Label>{dev.os} · {dev.model}</Label>
        <CapRow label="Screenshot detection" on={caps.screenshot} />
        <CapRow label="Recording / mirroring detection" on={caps.recording} />
        <CapRow label="Screen sharing" on={false} offText="Disabled everywhere" />
        <Body style={{ color: colors.muted }}>{caps.note || `Engine: ${caps.engine}`}</Body>
        <Body style={{ color: colors.muted }}>
          No app can detect an external camera or another device filming the screen.
          {Platform.OS === "web" ? " Browsers offer no reliable screenshot or recording signal." : ""}
        </Body>
      </Card>
    </Screen>
  );
}

function CapRow({ label, on, offText = "Unavailable" }: { label: string; on: boolean; offText?: string }) {
  return (
    <View style={styles.rowBetween}>
      <Body>{label}</Body>
      <Badge label={on ? "Available" : offText} tone={on ? "success" : "neutral"} />
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  qr: { width: 200, height: 200, alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 8 },
  session: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
});
