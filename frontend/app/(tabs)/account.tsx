import { LanguageSwitch } from "@/src/components/LanguageSwitch";
import { Crumbs, H, HubRow, HubSearch, HubTile, hubStyles, type Tone } from "@/src/components/SettingsHub";
import { useLang } from "@/src/i18n";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { BackHandler, Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import Animated, { FadeIn, SlideInRight } from "react-native-reanimated";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Screen } from "@/src/components/Screen";
import { Badge, Body, Button, Card, Divider, ErrorText, Field, Heading, Icon, type IconName, Label, useToast } from "@/src/components/ui";
import { deviceInfo } from "@/src/device";
import { platformLabel, timeAgo } from "@/src/privacy/labels";
import { getCaptureCapabilities } from "@/src/privacy/shield";
import { colors, spacing } from "@/src/theme";

type Session = { id: string; platform: string; os: string; device_name: string; created_at: string; last_used_at: string; current: boolean };
type Section = "email" | "password" | "twofa" | "devices" | "privacy";

function MenuRow({ icon, title, subtitle, expanded, onPress, testID }: {
  icon: IconName; title: string; subtitle: string; expanded: boolean; onPress: () => void; testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
    >
      <View style={styles.menuIcon}><Icon name={icon} size={19} color={colors.onSurfaceSecondary} /></View>
      <View style={styles.menuCopy}>
        <Body style={styles.menuTitle}>{title}</Body>
        <Label style={styles.menuSubtitle}>{subtitle}</Label>
      </View>
      <Icon name={expanded ? "chevron-up" : "chevron-right"} size={19} color={colors.muted} />
    </Pressable>
  );
}

export default function Account() {
  const { user, setUser, refreshUser, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { t, lang } = useLang();
  const [section, setSection] = useState<Section | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(user?.display_name ?? "");
  const [err, setErr] = useState<string | null>(null);

  // Email change is verified at the new address before the account email changes.
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailTotp, setEmailTotp] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailStep, setEmailStep] = useState<"request" | "confirm">("request");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordCode, setPasswordCode] = useState("");
  const [passwordCodeSent, setPasswordCodeSent] = useState(false);
  const [passwordTotp, setPasswordTotp] = useState("");
  const [confirmOtherSessions, setConfirmOtherSessions] = useState(false);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null);
  const [avatarZoom, setAvatarZoom] = useState(1);

  const [setup, setSetup] = useState<{ secret: string; qr_png_base64: string } | null>(null);
  const [code, setCode] = useState("");
  const [disablePw, setDisablePw] = useState("");
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => api<Session[]>("/auth/sessions") });
  const caps = getCaptureCapabilities();
  const dev = deviceInfo();

  const toggle = (next: Section) => {
    setErr(null);
    setSection((previous) => previous === next ? null : next);
  };

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async (all: boolean) => {
    await logout(all);
    router.replace("/auth/login");
  };

  const requestEmailChange = () => run(async () => {
    const next = newEmail.trim().toLowerCase();
    if (!next || !emailPassword) throw new Error("Enter your new email and current password.");
    await api("/auth/email/change/request", {
      body: { new_email: next, current_password: emailPassword, totp_code: user?.totp_enabled ? emailTotp : undefined },
    });
    setNewEmail(next);
    setEmailPassword("");
    setEmailTotp("");
    setEmailStep("confirm");
    toast("Verification code sent to your new email", "success");
  });

  const confirmEmailChange = () => run(async () => {
    if (!/^\d{6}$/.test(emailCode)) throw new Error("Enter the six-digit email code.");
    const updated = await api<NonNullable<typeof user>>("/auth/email/change/confirm", {
      body: { new_email: newEmail, code: emailCode },
    });
    setUser(updated);
    setEmailCode("");
    setNewEmail("");
    setEmailStep("request");
    setSection(null);
    toast("Email address updated", "success");
  });

  const requestPasswordCode = () => run(async () => {
    if (!oldPassword) throw new Error("Enter your current password first.");
    await api("/auth/password/change/request", {
      body: { current_password: oldPassword, totp_code: user?.totp_enabled ? passwordTotp : undefined },
    });
    setPasswordCodeSent(true);
    toast("Verification code sent to your current email", "success");
  });

  const changePassword = () => run(async () => {
    if (!passwordCodeSent) throw new Error("Request a verification code first.");
    if (!/^\d{6}$/.test(passwordCode)) throw new Error("Enter the six-digit code from your email.");
    if (!oldPassword) throw new Error("Enter your current password.");
    if (newPassword.length < 10) throw new Error("Use at least 10 characters for the new password.");
    if (newPassword !== confirmPassword) throw new Error("New passwords do not match.");
    await api("/auth/password/change/confirm", {
      body: {
        current_password: oldPassword, code: passwordCode, new_password: newPassword,
        totp_code: user?.totp_enabled ? passwordTotp : undefined,
      },
    });
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordCode("");
    setPasswordCodeSent(false);
    setPasswordTotp("");
    setSection(null);
    toast("Password changed. Other sessions signed out.", "success");
  });

  const pickAvatar = (camera: boolean) => run(async () => {
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true,
    };
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error("Allow camera access to take a profile photo.");
    }
    const result = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.base64) throw new Error("This photo could not be loaded. Choose another image.");
    const mime = asset.mimeType === "image/png" || asset.mimeType === "image/webp" ? asset.mimeType : "image/jpeg";
    setAvatarDraft(`data:${mime};base64,${asset.base64}`);
    setAvatarZoom(1);
    setEditingAvatar(true);
  });

  const saveAvatar = () => run(async () => {
    if (!avatarDraft) throw new Error("Select a photo first.");
    setUser(await api<NonNullable<typeof user>>("/auth/avatar", {
      body: { data_url: avatarDraft, zoom: avatarZoom },
    }));
    setAvatarDraft(null);
    setEditingAvatar(false);
    toast("Profile photo updated", "success");
  });

  const removeAvatar = () => run(async () => {
    setUser(await api<NonNullable<typeof user>>("/auth/avatar", { method: "DELETE" }));
    setAvatarDraft(null);
    setEditingAvatar(false);
    toast("Profile photo removed", "info");
  });

  const PROFILE = (
      <Card style={styles.profileCard} testID="profile-card">
        <View style={styles.profileHeader}>
          <Pressable
            testID="edit-profile-photo"
            accessibilityRole="button"
            accessibilityLabel="Edit profile photo"
            onPress={() => { setEditingAvatar((v) => !v); setAvatarDraft(null); setErr(null); }}
            style={styles.avatar}
          >
            {user?.avatar_data_url ? (
              <Image source={{ uri: user.avatar_data_url }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <Body style={styles.avatarText}>{(user?.display_name || "F").charAt(0).toUpperCase()}</Body>
            )}
            <View style={styles.avatarEditIcon}><Icon name="camera" size={12} color={colors.onSurfaceSecondary} /></View>
          </Pressable>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Heading size={22}>{user?.display_name || "FX CALL MEMBER"}</Heading>
            <Label>{user?.email}</Label>
          </View>
          <Badge label={user?.verified ? "Verified" : "Unverified"} tone={user?.verified ? "success" : "warning"} />
        </View>
        {editingAvatar ? (
          <View style={styles.photoPanel} testID="profile-photo-editor">
            <Body style={styles.panelTitle}>Edit profile photo</Body>
            {avatarDraft ? (
              <>
                <View style={styles.avatarPreviewCrop}>
                  <Image source={{ uri: avatarDraft }} style={{ width: 128, height: 128, transform: [{ scale: avatarZoom }] }} contentFit="cover" />
                </View>
                <Label>Crop & zoom</Label>
                <View style={styles.avatarEditorActions}>
                  <Button testID="avatar-zoom-out" label="−" variant="secondary" compact disabled={busy || avatarZoom <= 1} onPress={() => setAvatarZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))} />
                  <Body>{Math.round(avatarZoom * 100)}%</Body>
                  <Button testID="avatar-zoom-in" label="+" variant="secondary" compact disabled={busy || avatarZoom >= 2.5} onPress={() => setAvatarZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))} />
                </View>
                <Button testID="avatar-save" label="Save photo" icon="check" disabled={busy} onPress={saveAvatar} />
              </>
            ) : null}
            <View style={styles.avatarEditorActions}>
              <Button testID="avatar-choose" compact label="Choose photo" icon="image" variant="secondary" disabled={busy} onPress={() => pickAvatar(false)} />
              {Platform.OS !== "web" ? (
                <Button testID="avatar-camera" compact label="Take photo" icon="camera" variant="secondary" disabled={busy} onPress={() => pickAvatar(true)} />
              ) : null}
            </View>
            {user?.avatar_data_url ? <Button testID="avatar-remove" compact label="Remove current photo" icon="trash-2" variant="ghost" disabled={busy} onPress={removeAvatar} /> : null}
            <Button testID="avatar-cancel" compact label="Close editor" variant="ghost" onPress={() => { setEditingAvatar(false); setAvatarDraft(null); }} />
          </View>
        ) : null}
        <Divider />
        <Field testID="profile-name-input" label="Display name" value={name} onChangeText={setName} maxLength={60} autoComplete="name" />
        <Button testID="profile-save-button" compact label="Save display name" variant="secondary" disabled={busy || !name.trim()} onPress={() => run(async () => {
          setUser(await api("/auth/me", { method: "PATCH", body: { display_name: name.trim() } }));
          toast("Profile saved", "success");
        })} />
      </Card>
  );

  const P_EMAIL = (
          <View style={styles.panel} testID="email-settings-panel">
            <View style={styles.inlineStatus}>
              <Label>Current email</Label>
              <Badge label={user?.verified ? "Verified" : "Not verified"} tone={user?.verified ? "success" : "warning"} />
            </View>
            <View style={styles.verifiedEmailRow}>
              <Body style={styles.currentEmailText}>{user?.email}</Body>
              {user?.verified ? <Icon name="badge-check" size={24} color="#4AAE83" /> : null}
            </View>
            <Divider />
            {emailStep === "request" ? (
              <>
                <Body style={styles.panelTitle}>Change email address</Body>
                <Label>We will send a six-digit confirmation code to your new address.</Label>
                <Field testID="new-email-input" label="New email" value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
                <Field testID="email-change-password" label="Current password" value={emailPassword} onChangeText={setEmailPassword} secureTextEntry autoCapitalize="none" />
                {user?.totp_enabled ? (
                  <Field testID="email-change-totp" label="Authenticator code" value={emailTotp} onChangeText={(v) => setEmailTotp(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" />
                ) : null}
                <Button testID="email-change-request" label={busy ? "Sending..." : "Send verification code"} disabled={busy} icon="mail-check" onPress={requestEmailChange} />
              </>
            ) : (
              <>
                <Body style={styles.panelTitle}>Verify your new email</Body>
                <Label>A code was sent to {newEmail}. It expires in 15 minutes.</Label>
                <Field testID="email-change-code" label="6-digit code" value={emailCode} onChangeText={(v) => setEmailCode(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" />
                <Button testID="email-change-confirm" label="Verify & update email" disabled={busy || emailCode.length !== 6} onPress={confirmEmailChange} />
                <Button testID="email-change-back" compact label="Change the new address" variant="ghost" onPress={() => { setEmailStep("request"); setEmailCode(""); }} />
              </>
            )}
          </View>
  );

  const P_PASSWORD = (
          <View style={styles.panel} testID="password-settings-panel">
            <Body style={styles.panelTitle}>Change password</Body>
            <Label>A six-digit code will be sent to your verified email. Codes expire in 15 minutes.</Label>
            <Field testID="current-password-input" label="Current password" inputStyle={styles.passwordInput} value={oldPassword} onChangeText={(v) => { setOldPassword(v); setPasswordCodeSent(false); setPasswordCode(""); }} secureTextEntry autoCapitalize="none" />
            {user?.totp_enabled ? (
              <Field testID="password-totp-input" label="Authenticator code" value={passwordTotp} onChangeText={(v) => setPasswordTotp(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" />
            ) : null}
            <Button testID="change-password-request-code" label={passwordCodeSent ? "Resend code" : "Get code"} variant="secondary" icon="mail-check" disabled={busy || !oldPassword || (user?.totp_enabled && passwordTotp.length !== 6)} onPress={requestPasswordCode} />
            {passwordCodeSent ? (
              <>
                <Field testID="change-password-code-input" label="Verification code" value={passwordCode} onChangeText={(v) => setPasswordCode(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} />
                <Field testID="new-password-input" label="New password (10+ characters)" inputStyle={styles.passwordInput} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" />
                <Field testID="confirm-new-password-input" label="Confirm new password" inputStyle={styles.passwordInput} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" />
                <Button testID="change-password-save" label="Change password" disabled={busy || passwordCode.length !== 6 || newPassword.length < 10 || newPassword !== confirmPassword} icon="key-round" onPress={changePassword} />
              </>
            ) : null}
          </View>
  );

  const P_TWOFA = (
          <View style={styles.panel} testID="twofa-card">
            <View style={styles.rowBetween}>
              <Body style={styles.panelTitle}>Authenticator app</Body>
              <View style={styles.switchRow}>
                <Label>{user?.totp_enabled ? "ON" : "OFF"}</Label>
                <Switch
                  testID="twofa-switch"
                  accessibilityLabel="Two-factor authentication"
                  value={!!user?.totp_enabled}
                  disabled={busy}
                  trackColor={{ false: colors.borderStrong, true: colors.success }}
                  thumbColor={colors.onSurfaceSecondary}
                  style={styles.smallSwitch}
                  onValueChange={(enabled) => {
                    if (enabled) {
                      if (!setup) run(async () => setSetup(await api("/auth/2fa/setup", { body: {} })));
                    } else {
                      toast("Enter your password and authenticator code below to turn off 2FA.", "info");
                    }
                  }}
                />
              </View>
            </View>
            <Label>Require a code from Google Authenticator, 1Password or Authy when signing in.</Label>
            {!user?.totp_enabled && !setup ? (
              <Button testID="twofa-setup-button" compact label="Set up authentication" disabled={busy} icon="key-round" onPress={() => run(async () => setSetup(await api("/auth/2fa/setup", { body: {} })))} />
            ) : null}
            {setup ? (
              <View style={{ gap: spacing.md }}>
                <Image testID="twofa-qr" source={{ uri: `data:image/png;base64,${setup.qr_png_base64}` }} style={styles.qr} contentFit="contain" />
                <Label>Or enter this key</Label>
                <Body testID="twofa-secret" style={{ letterSpacing: 2, color: colors.onSurfaceSecondary }} selectable>{setup.secret}</Body>
                <Field testID="twofa-code-input" label="6-digit code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" />
                <Button testID="twofa-confirm-button" compact label="Turn on" disabled={busy} onPress={() => run(async () => {
                  await api("/auth/2fa/confirm", { body: { code } });
                  setSetup(null);
                  setCode("");
                  await refreshUser();
                  toast("Two-factor authentication enabled", "success");
                })} />
              </View>
            ) : null}
            {user?.totp_enabled ? (
              <View style={{ gap: spacing.md }}>
                <Field testID="twofa-disable-password-input" label="Current password" value={disablePw} onChangeText={setDisablePw} secureTextEntry />
                <Field testID="twofa-disable-code-input" label="Authenticator code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" />
                <Button testID="twofa-disable-button" compact variant="ghost" label="Turn off" disabled={busy} onPress={() => run(async () => {
                  await api("/auth/2fa/disable", { body: { password: disablePw, code } });
                  setDisablePw("");
                  setCode("");
                  await refreshUser();
                  toast("Two-factor authentication disabled", "info");
                })} />
              </View>
            ) : null}
          </View>
  );

  const P_DEVICES = (
          <View style={styles.panel} testID="sessions-card">
            <Body style={styles.panelTitle}>Active sessions</Body>
            {(sessions.data ?? []).map((s) => (
              <View key={s.id} style={styles.session} testID={`session-row-${s.id}`}>
                <Icon name={s.platform === "web" ? "monitor" : "smartphone"} size={19} color={colors.onSurface} />
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Body style={{ color: colors.onSurfaceSecondary }}>{s.device_name || platformLabel(s.platform)} · {s.os}</Body>
                  <Label>Signed in {timeAgo(s.created_at)}</Label>
                </View>
                {s.current ? <Badge label="This device" tone="brand" /> : (
                  <Pressable testID={`revoke-session-${s.id}`} accessibilityRole="button" accessibilityLabel="Sign out this device" disabled={busy} style={styles.revokeIcon} onPress={() => run(async () => {
                    await api(`/auth/sessions/${s.id}`, { method: "DELETE" });
                    await sessions.refetch();
                    toast("Device signed out", "success");
                  })}>
                    <Icon name="log-out" size={19} color={colors.onSurfaceSecondary} />
                  </Pressable>
                )}
              </View>
            ))}
            {(sessions.data ?? []).some((s) => !s.current) ? (
              confirmOtherSessions ? (
                <View style={styles.confirmRow}>
                  <Body style={{ flex: 1 }}>Sign out every other device?</Body>
                  <Button testID="sessions-cancel-revoke" compact label="Cancel" variant="secondary" onPress={() => setConfirmOtherSessions(false)} />
                  <Button testID="sessions-confirm-revoke" compact label="Sign out" variant="danger" disabled={busy} onPress={() => run(async () => {
                    await api("/auth/sessions/revoke-others", { body: {} });
                    await sessions.refetch();
                    setConfirmOtherSessions(false);
                    toast("Other sessions signed out", "success");
                  })} />
                </View>
              ) : <Button testID="sessions-revoke-others" label="Sign out other devices" compact variant="secondary" icon="log-out" onPress={() => setConfirmOtherSessions(true)} />
            ) : null}
            {sessions.isLoading ? <Label>Loading sessions...</Label> : null}
            {sessions.isError ? <Label>Could not load sessions. Please try again.</Label> : null}
          </View>
  );

  const P_PRIVACY = (
          <View style={styles.panel} testID="capability-report-card">
            <Label>{dev.os} · {dev.model}</Label>
            <CapRow label="Screenshot detection" on={caps.screenshot} />
            <CapRow label="Recording / mirroring detection" on={caps.recording} offText="Native build required" />
            <CapRow label="Screen sharing" on={false} offText="Disabled everywhere" />
            <Label>{caps.note || `Engine: ${caps.engine}`}</Label>
            <Label>No app can detect another device filming the screen.{Platform.OS === "web" ? " Browsers cannot reliably detect screenshots or recordings." : ""}</Label>
          </View>
  );

  // ───────── hub navigation: Home → Category → Subcategory ─────────
  type Sub = { key: string; title: string; icon: IconName; meta?: string; node: React.ReactNode; danger?: boolean };
  type Cat = { key: string; title: string; icon: IconName; tone: Tone; subs: Sub[] };
  const [catKey, setCatKey] = useState<string | null>(null);
  const [subKey, setSubKey] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const cats: Cat[] = [
    { key: "profile", title: t("cat.profile"), icon: "user-round", tone: "mint", subs: [
      { key: "photo", title: t("cat.profile.photo"), icon: "camera", meta: user?.display_name, node: PROFILE },
      { key: "email", title: t("cat.profile.email"), icon: "mail", meta: user?.email, node: P_EMAIL },
    ] },
    { key: "security", title: t("cat.security"), icon: "shield-check", tone: "blue", subs: [
      { key: "password", title: t("cat.security.password"), icon: "lock-keyhole", node: P_PASSWORD },
      { key: "twofa", title: t("cat.security.twofa"), icon: "key-round", meta: user?.totp_enabled ? "ON" : "OFF", node: P_TWOFA },
      { key: "devices", title: t("cat.security.devices"), icon: "smartphone", meta: sessions.data ? String(sessions.data.length) : undefined, node: P_DEVICES },
    ] },
    { key: "privacy", title: t("cat.privacy"), icon: "eye-off", tone: "amber", subs: [
      { key: "shield", title: t("cat.privacy.shield"), icon: "scan-eye", meta: caps.screenshot ? "ON" : "—", node: P_PRIVACY },
    ] },
    { key: "settings", title: t("cat.settings"), icon: "settings-2", tone: "mint", subs: [
      { key: "language", title: t("cat.settings.language"), icon: "languages", meta: lang === "es" ? "Español · MX" : "English · CA", node: (
        <View style={styles.panel} testID="language-switch-row">
          <Body style={styles.panelTitle}>{t("lang.title")}</Body>
          <Label>{t("lang.hint")}</Label>
          <LanguageSwitch />
        </View>
      ) },
      { key: "design", title: t("cat.settings.design"), icon: "crown", node: (
        <View style={styles.panel}>
          <Button testID="crown-preview-entry" label="Try Crown Edition" icon="crown" variant="secondary" onPress={() => router.push("/crown-preview")} />
        </View>
      ) },
      { key: "session", title: t("cat.settings.session"), icon: "log-out", danger: true, node: (
        <View style={styles.panel} testID="sign-out-card">
          <Button testID="logout-button" label="Sign out" variant="secondary" icon="log-out" onPress={() => signOut(false)} />
          <Button testID="logout-all-button" label="Sign out of all devices" variant="danger" icon="shield-off" onPress={() => signOut(true)} />
        </View>
      ) },
    ] },
  ];

  const cat = cats.find((c) => c.key === catKey) ?? null;
  const sub = cat?.subs.find((x) => x.key === subKey) ?? null;
  const go = (c: string | null, sKey: string | null = null) => { setErr(null); setCatKey(c); setSubKey(sKey); setQ(""); };
  const back = () => { if (sub) go(catKey, null); else go(null, null); };

  useEffect(() => {
    if (!cat) return;
    const h = BackHandler.addEventListener("hardwareBackPress", () => { back(); return true; });
    return () => h.remove();
  }, [catKey, subKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const term = q.trim().toLowerCase();
  const hits = term ? cats.flatMap((c) => c.subs.filter((x) => (x.title + " " + c.title).toLowerCase().includes(term)).map((x) => ({ c, x }))) : [];

  return (
    <Screen testID="account-screen" maxWidth={760} contentStyle={{ gap: spacing.lg }}>
      {!cat ? (
        <Animated.View entering={FadeIn} style={{ gap: spacing.lg }}>
          <View style={styles.hubHero}>
            <LinearGradient colors={["rgba(111,227,193,0.18)", "rgba(125,183,255,0.05)", "rgba(18,21,26,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.hubAvatar}>
              {user?.avatar_data_url ? <Image source={{ uri: user.avatar_data_url }} style={{ width: 62, height: 62, borderRadius: 22 }} contentFit="cover" /> : <Text style={styles.hubAvatarText}>{(user?.display_name || "F").charAt(0).toUpperCase()}</Text>}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.hubName} numberOfLines={1}>{user?.display_name || "FX CALL"}</Text>
              <Text style={styles.hubMail} numberOfLines={1}>{user?.email}</Text>
              <Text style={styles.hubTag}>{t("hub.tag")}</Text>
            </View>
            <Badge label={user?.verified ? "✓" : "!"} tone={user?.verified ? "success" : "warning"} />
          </View>

          <HubSearch value={q} onChange={setQ} placeholder={t("hub.search")} />

          {term ? (
            <View style={hubStyles.group}>
              {hits.length === 0 ? <Body style={{ padding: spacing.lg, color: H.dim }}>{t("hub.noResults")}</Body> : hits.map(({ c, x }) => (
                <HubRow key={c.key + x.key} testID={`hit-${c.key}-${x.key}`} icon={x.icon} title={x.title} meta={c.title} tone={c.tone} onPress={() => go(c.key, x.key)} />
              ))}
            </View>
          ) : (
            <View style={styles.bento}>
              {cats.map((c, i) => (
                <HubTile key={c.key} testID={`cat-${c.key}`} icon={c.icon} title={c.title} tone={c.tone} big={i === 0}
                  meta={t("hub.items", { n: c.subs.length })} onPress={() => go(c.key)} />
              ))}
            </View>
          )}
        </Animated.View>
      ) : (
        <Animated.View key={catKey + String(subKey)} entering={SlideInRight.duration(220)} style={{ gap: spacing.lg }}>
          <Crumbs trail={sub ? [cat.title, sub.title] : [cat.title]} onBack={back} onRoot={() => go(null)} />
          {sub ? (
            <>
              {sub.node}
              <ErrorText testID="account-error">{err}</ErrorText>
            </>
          ) : (
            <View style={hubStyles.group}>
              {cat.subs.map((x) => <HubRow key={x.key} testID={`sub-${cat.key}-${x.key}`} icon={x.icon} title={x.title} meta={x.meta} tone={cat.tone} danger={x.danger} onPress={() => go(cat.key, x.key)} />)}
            </View>
          )}
        </Animated.View>
      )}
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
  hubHero: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderRadius: 26, borderWidth: 1, borderColor: H.line, backgroundColor: H.card, overflow: "hidden" },
  hubAvatar: { width: 62, height: 62, borderRadius: 22, backgroundColor: "rgba(111,227,193,0.14)", borderWidth: 1, borderColor: "rgba(111,227,193,0.35)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  hubAvatarText: { fontSize: 26, fontWeight: "800", color: H.mint },
  hubName: { fontSize: 20, fontWeight: "800", color: H.text },
  hubMail: { fontSize: 12.5, color: H.dim },
  hubTag: { fontSize: 12, color: H.mint, marginTop: 4, fontWeight: "600" },
  bento: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  profileCard: { gap: spacing.md },
  profileHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 6, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 21, fontWeight: "700", color: colors.onBrandTertiary },
  avatarImage: { width: 46, height: 46, borderRadius: 5 },
  avatarEditIcon: { position: "absolute", right: -5, bottom: -5, backgroundColor: colors.brandPrimary, padding: 3, borderRadius: 5, borderWidth: 1, borderColor: colors.surface },
  photoPanel: { padding: spacing.md, gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 6 },
  avatarPreviewCrop: { width: 128, height: 128, alignSelf: "center", overflow: "hidden", alignItems: "center", justifyContent: "center", borderRadius: 6, backgroundColor: colors.surface },
  avatarEditorActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.sm },
  passwordInput: { backgroundColor: "#17232D", color: "#F1F6FA" },
  currentEmailText: { color: colors.onSurfaceSecondary, fontSize: 20, flexShrink: 1, letterSpacing: 0.1 },
  verifiedEmailRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  smallSwitch: { transform: [{ scaleX: 0.78 }, { scaleY: 0.78 }] },
  revokeIcon: { width: 38, height: 38, borderRadius: 6, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  sectionHeading: { marginBottom: spacing.xs },
  menuRow: { minHeight: 72, paddingVertical: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  menuRowPressed: { backgroundColor: colors.surfaceTertiary },
  menuIcon: { width: 38, height: 38, borderRadius: 6, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  menuCopy: { flex: 1, gap: spacing.xs },
  menuTitle: { fontSize: 15, fontWeight: "600", color: colors.onSurfaceSecondary },
  menuSubtitle: { fontSize: 12 },
  panel: { padding: spacing.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceTertiary, borderRadius: 6, gap: spacing.md, marginBottom: spacing.sm },
  panelTitle: { fontSize: 16, fontWeight: "600", color: colors.onSurfaceSecondary },
  inlineStatus: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  qr: { width: 200, height: 200, alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 6 },
  session: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
});
