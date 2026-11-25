import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Platform, Pressable, StyleSheet, Switch, View } from "react-native";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Screen } from "@/src/components/Screen";
import { Badge, Body, Button, Card, ErrorText, Field, Heading, Icon, type IconName, Label, useToast } from "@/src/components/ui";
import { deviceInfo } from "@/src/device";
import { platformLabel, timeAgo } from "@/src/privacy/labels";
import { getCaptureCapabilities } from "@/src/privacy/shield";
import { colors, spacing } from "@/src/theme";
import { nova } from "@/src/nova/designTokens";

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
  const [editingName, setEditingName] = useState(false);
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

  return (
    <Screen title="Profile" testID="account-screen" maxWidth={760}>
      <Label style={{ color: nova.color.mint }}>NOVA / ACCOUNT CONTROL</Label>

      <Card style={styles.profileCard} testID="profile-card">
        <View style={styles.profileHeader}>
          <Pressable
            testID="edit-profile-photo"
            accessibilityRole="button"
            accessibilityLabel="Edit profile photo"
            accessibilityState={{ expanded: editingAvatar }}
            onPress={() => {
              setEditingAvatar((value) => !value);
              setAvatarDraft(null);
              setEditingName(false);
              setSection(null);
              setErr(null);
            }}
            style={styles.avatar}
          >
            {user?.avatar_data_url ? (
              <Image source={{ uri: user.avatar_data_url }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <Body style={styles.avatarText}>{(user?.display_name || "F").charAt(0).toUpperCase()}</Body>
            )}
            <View style={styles.avatarEditIcon}>
              <Body style={styles.editEmoji}>✏️</Body>
            </View>
          </Pressable>

          <View style={styles.profileIdentity}>
            <View style={styles.profileNameRow}>
              <Heading size={22} style={{ flexShrink: 1 }}>{user?.display_name || "FX CALL MEMBER"}</Heading>
              <Pressable
                testID="edit-display-name"
                accessibilityRole="button"
                accessibilityLabel="Edit display name"
                accessibilityState={{ expanded: editingName }}
                onPress={() => {
                  setName(user?.display_name ?? "");
                  setEditingName((value) => !value);
                  setEditingAvatar(false);
                  setAvatarDraft(null);
                  setSection(null);
                  setErr(null);
                }}
                style={styles.nameEditButton}
              >
                <Body style={styles.editEmoji}>✏️</Body>
              </Pressable>
            </View>
            <View style={styles.profileEmailRow}>
              <Body style={styles.profileEmail} numberOfLines={1} selectable>{user?.email || "Email unavailable"}</Body>
              {user?.verified ? (
                <Icon name="badge-check" size={18} color={nova.color.mint} />
              ) : (
                <Icon name="circle-alert" size={18} color={nova.color.warning} />
              )}
              <Pressable
                testID="edit-profile-email"
                accessibilityRole="button"
                accessibilityLabel="Edit email address"
                accessibilityState={{ expanded: section === "email" }}
                onPress={() => {
                  setEditingName(false);
                  setEditingAvatar(false);
                  setAvatarDraft(null);
                  toggle("email");
                }}
                style={styles.nameEditButton}
              >
                <Body style={styles.editEmoji}>✏️</Body>
              </Pressable>
            </View>
          </View>
        </View>

        {editingName ? (
          <View style={styles.inlineNameEditor} testID="profile-name-editor">
            <View style={{ flex: 1, minWidth: 160 }}>
              <Field testID="profile-name-input" label="Display name" value={name} onChangeText={setName} maxLength={60} autoComplete="name" />
            </View>
            <View style={styles.inlineEditorActions}>
              <Pressable
                testID="profile-save-button"
                accessibilityRole="button"
                accessibilityLabel="Save display name"
                disabled={busy || !name.trim()}
                onPress={() => run(async () => {
                  setUser(await api("/auth/me", { method: "PATCH", body: { display_name: name.trim() } }));
                  setEditingName(false);
                  toast("Profile saved", "success");
                })}
                style={[styles.iconAction, styles.confirmAction, (busy || !name.trim()) && styles.disabledAction]}
              >
                <Icon name="check" size={18} color={nova.color.mintInk} />
              </Pressable>
              <Pressable
                testID="profile-cancel-button"
                accessibilityRole="button"
                accessibilityLabel="Cancel editing display name"
                disabled={busy}
                onPress={() => { setName(user?.display_name ?? ""); setEditingName(false); }}
                style={styles.iconAction}
              >
                <Icon name="x" size={18} color={nova.color.ink} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {editingAvatar ? (
          <View style={styles.photoPanel} testID="profile-photo-editor">
            {avatarDraft ? (
              <View style={styles.photoPreviewRow}>
                <View style={styles.avatarPreviewCrop}>
                  <Image
                    source={{ uri: avatarDraft }}
                    style={{ width: 96, height: 96, transform: [{ scale: avatarZoom }] }}
                    contentFit="cover"
                  />
                </View>
                <View style={styles.photoPreviewControls}>
                  <Label>ZOOM · {Math.round(avatarZoom * 100)}%</Label>
                  <View style={styles.inlineEditorActions}>
                    <Pressable
                      testID="avatar-zoom-out"
                      accessibilityRole="button"
                      accessibilityLabel="Zoom out"
                      disabled={busy || avatarZoom <= 1}
                      style={[styles.iconAction, (busy || avatarZoom <= 1) && styles.disabledAction]}
                      onPress={() => setAvatarZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
                    >
                      <Icon name="minus" size={18} color={nova.color.ink} />
                    </Pressable>
                    <Pressable
                      testID="avatar-zoom-in"
                      accessibilityRole="button"
                      accessibilityLabel="Zoom in"
                      disabled={busy || avatarZoom >= 2.5}
                      style={[styles.iconAction, (busy || avatarZoom >= 2.5) && styles.disabledAction]}
                      onPress={() => setAvatarZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
                    >
                      <Icon name="plus" size={18} color={nova.color.ink} />
                    </Pressable>
                    <Pressable
                      testID="avatar-save"
                      accessibilityRole="button"
                      accessibilityLabel="Save profile photo"
                      disabled={busy}
                      onPress={saveAvatar}
                      style={[styles.iconAction, styles.confirmAction, busy && styles.disabledAction]}
                    >
                      <Icon name="check" size={18} color={nova.color.mintInk} />
                    </Pressable>
                    <Pressable
                      testID="avatar-cancel"
                      accessibilityRole="button"
                      accessibilityLabel="Cancel photo editing"
                      disabled={busy}
                      onPress={() => { setEditingAvatar(false); setAvatarDraft(null); }}
                      style={styles.iconAction}
                    >
                      <Icon name="x" size={18} color={nova.color.ink} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.photoPickerRow}>
                <Pressable
                  testID="avatar-choose"
                  accessibilityRole="button"
                  accessibilityLabel="Choose profile photo from gallery"
                  disabled={busy}
                  onPress={() => pickAvatar(false)}
                  style={styles.photoPickerButton}
                >
                  <Icon name="image" size={16} color={nova.color.mint} />
                  <Body>Gallery</Body>
                </Pressable>
                {Platform.OS !== "web" ? (
                  <Pressable
                    testID="avatar-camera"
                    accessibilityRole="button"
                    accessibilityLabel="Take profile photo"
                    disabled={busy}
                    onPress={() => pickAvatar(true)}
                    style={styles.photoPickerButton}
                  >
                    <Icon name="camera" size={16} color={nova.color.mint} />
                    <Body>Camera</Body>
                  </Pressable>
                ) : null}
                {user?.avatar_data_url ? (
                  <Pressable
                    testID="avatar-remove"
                    accessibilityRole="button"
                    accessibilityLabel="Remove current profile photo"
                    disabled={busy}
                    onPress={removeAvatar}
                    style={styles.photoPickerButton}
                  >
                    <Icon name="trash-2" size={16} color="#FF969B" />
                    <Body>Remove</Body>
                  </Pressable>
                ) : null}
                <Pressable
                  testID="avatar-cancel"
                  accessibilityRole="button"
                  accessibilityLabel="Close photo options"
                  disabled={busy}
                  onPress={() => { setEditingAvatar(false); setAvatarDraft(null); }}
                  style={styles.iconAction}
                >
                  <Icon name="x" size={18} color={nova.color.ink} />
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        {section === "email" ? (
          <View style={styles.emailInlinePanel} testID="email-settings-panel">
            <View style={styles.emailPanelHeader}>
              <Label>{emailStep === "request" ? "CHANGE EMAIL" : "VERIFY EMAIL"}</Label>
              <Pressable
                testID="email-edit-cancel"
                accessibilityRole="button"
                accessibilityLabel="Close email editing"
                disabled={busy}
                onPress={() => { setSection(null); setErr(null); }}
                style={styles.emailClose}
              >
                <Icon name="x" size={18} color={nova.color.muted} />
              </Pressable>
            </View>
            {emailStep === "request" ? (
              <>
                <Label>We will send a six-digit confirmation code to your new address.</Label>
                <Field testID="new-email-input" label="New email" value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
                <Field testID="email-change-password" label="Current password" value={emailPassword} onChangeText={setEmailPassword} secureTextEntry autoCapitalize="none" />
                {user?.totp_enabled ? (
                  <Field testID="email-change-totp" label="Authenticator code" value={emailTotp} onChangeText={(v) => setEmailTotp(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" />
                ) : null}
                <Button testID="email-change-request" label={busy ? "Sending..." : "Get code"} disabled={busy} icon="mail-check" onPress={requestEmailChange} />
              </>
            ) : (
              <>
                <Label>A code was sent to {newEmail}. It expires in 15 minutes.</Label>
                <Field testID="email-change-code" label="6-digit code" value={emailCode} onChangeText={(v) => setEmailCode(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" />
                <Button testID="email-change-confirm" label="Verify & update email" disabled={busy || emailCode.length !== 6} onPress={confirmEmailChange} />
                <Button testID="email-change-back" compact label="Change the new address" variant="ghost" onPress={() => { setEmailStep("request"); setEmailCode(""); }} />
              </>
            )}
            <ErrorText testID="account-error">{err}</ErrorText>
          </View>
        ) : null}

      </Card>

      <Card style={{ gap: spacing.xs }} testID="account-settings-card">
        <Heading size={18} style={styles.sectionHeading}>Account & Security</Heading>
        <MenuRow testID="settings-password" icon="lock-keyhole" title="Password" subtitle="Update your sign-in password" expanded={section === "password"} onPress={() => toggle("password")} />
        {section === "password" ? (
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
        ) : null}

        <MenuRow testID="settings-2fa" icon="shield-check" title="Two-factor authentication" subtitle={user?.totp_enabled ? "Enabled" : "Add an extra sign-in step"} expanded={section === "twofa"} onPress={() => toggle("twofa")} />
        {section === "twofa" ? (
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
        ) : null}

        <MenuRow testID="settings-devices" icon="smartphone" title="Devices & sessions" subtitle="Review and sign out devices" expanded={section === "devices"} onPress={() => toggle("devices")} />
        {section === "devices" ? (
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
        ) : null}

        <MenuRow testID="settings-privacy" icon="shield" title="Privacy Shield" subtitle="Security capabilities on this device" expanded={section === "privacy"} onPress={() => toggle("privacy")} />
        {section === "privacy" ? (
          <View style={styles.panel} testID="capability-report-card">
            <Label>{dev.os} · {dev.model}</Label>
            <CapRow label="Screenshot detection" on={caps.screenshot} />
            <CapRow label="Recording / mirroring detection" on={caps.recording} offText="Native build required" />
            <CapRow label="Screen sharing" on={false} offText="Disabled everywhere" />
            <Label>{caps.note || `Engine: ${caps.engine}`}</Label>
            <Label>No app can detect another device filming the screen.{Platform.OS === "web" ? " Browsers cannot reliably detect screenshots or recordings." : ""}</Label>
          </View>
        ) : null}
        {section !== "email" ? <ErrorText testID="account-error">{err}</ErrorText> : null}
      </Card>

      <Card style={{ gap: spacing.sm }} testID="sign-out-card">
        <Heading size={18}>Sessions</Heading>
        <Button testID="logout-button" label="Sign out" variant="secondary" icon="log-out" onPress={() => signOut(false)} />
        <Button testID="logout-all-button" label="Sign out of all devices" variant="danger" icon="shield-off" onPress={() => signOut(true)} />
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
  profileCard: { gap: spacing.md, backgroundColor: nova.color.surfaceRaised, borderColor: nova.color.lineStrong },
  profileHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexWrap: "wrap" },
  profileIdentity: { flex: 1, minWidth: 150, gap: spacing.xs },
  profileNameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  profileEmailRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, minWidth: 0 },
  profileEmail: { fontSize: 14, color: nova.color.ink, flexShrink: 1 },
  emailInlinePanel: { padding: spacing.md, gap: spacing.md, backgroundColor: nova.color.stage, borderWidth: 1, borderColor: nova.color.lineStrong, borderRadius: 6 },
  emailPanelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  emailClose: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  nameEditButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  editEmoji: { fontSize: 15, lineHeight: 21 },
  avatar: { width: 54, height: 54, borderRadius: 6, borderWidth: 1, borderColor: nova.color.mint, backgroundColor: nova.color.mintSoft, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 23, fontWeight: "700", color: nova.color.mint },
  avatarImage: { width: 52, height: 52, borderRadius: 5 },
  avatarEditIcon: { position: "absolute", right: -6, bottom: -6, backgroundColor: nova.color.mint, width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 6, borderWidth: 1, borderColor: nova.color.canvas },
  inlineNameEditor: { flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap", gap: spacing.sm },
  inlineEditorActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  iconAction: { width: 42, height: 42, borderWidth: 1, borderColor: nova.color.lineStrong, borderRadius: 6, justifyContent: "center", alignItems: "center", backgroundColor: nova.color.surface },
  confirmAction: { backgroundColor: nova.color.mint, borderColor: nova.color.mint },
  disabledAction: { opacity: 0.4 },
  photoPanel: { padding: spacing.sm, backgroundColor: nova.color.stage, borderWidth: 1, borderColor: nova.color.lineStrong, borderRadius: 6 },
  photoPickerRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  photoPickerButton: { flexDirection: "row", gap: spacing.sm, alignItems: "center", paddingHorizontal: spacing.md, minHeight: 42, backgroundColor: nova.color.surface, borderRadius: 6, borderColor: nova.color.lineStrong, borderWidth: 1 },
  photoPreviewRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexWrap: "wrap" },
  photoPreviewControls: { flex: 1, minWidth: 180, gap: spacing.sm },
  avatarPreviewCrop: { width: 96, height: 96, overflow: "hidden", alignItems: "center", justifyContent: "center", borderRadius: 6, backgroundColor: nova.color.surface },
  passwordInput: { backgroundColor: "#14272B", color: nova.color.ink },
  switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  smallSwitch: { transform: [{ scaleX: 0.78 }, { scaleY: 0.78 }] },
  revokeIcon: { width: 38, height: 38, borderRadius: 6, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  sectionHeading: { marginBottom: spacing.xs },
  menuRow: { minHeight: 60, paddingVertical: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  menuRowPressed: { backgroundColor: nova.color.mintSoft },
  menuIcon: { width: 38, height: 38, borderRadius: 6, backgroundColor: nova.color.mintSoft, alignItems: "center", justifyContent: "center" },
  menuCopy: { flex: 1, gap: spacing.xs },
  menuTitle: { fontSize: 15, fontWeight: "600", color: colors.onSurfaceSecondary },
  menuSubtitle: { fontSize: 12 },
  panel: { padding: spacing.md, borderWidth: 1, borderColor: nova.color.lineStrong, backgroundColor: nova.color.stage, borderRadius: 6, gap: spacing.md, marginBottom: spacing.sm },
  panelTitle: { fontSize: 16, fontWeight: "600", color: colors.onSurfaceSecondary },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  qr: { width: 200, height: 200, alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 6 },
  session: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
});
