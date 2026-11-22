import { Link, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useAuth } from "@/src/auth";
import { AuthShell } from "@/src/components/AuthShell";
import { Button, ErrorText, Field, s } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; next?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    const r = await login(email, password, needTotp ? totp : undefined);
    setBusy(false);
    if (r.ok) return router.replace((params.next as any) || "/(tabs)/meetings");
    if (r.reason === "totp_required" || r.reason === "invalid_totp") setNeedTotp(true);
    if (r.reason === "email_not_verified") return router.push({ pathname: "/auth/verify", params: { email: email.trim() } });
    setError(r.message);
  };

  return (
    <AuthShell title="Sign in" subtitle="One account for iPhone, Android and the web.">
      <Field testID="login-email-input" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@company.com" />
      <Field testID="login-password-input" label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" placeholder="••••••••••" onSubmitEditing={submit} />
      {needTotp ? (
        <Field testID="login-totp-input" label="Authenticator code" value={totp} onChangeText={(t) => setTotp(t.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" placeholder="123456" />
      ) : null}
      <ErrorText testID="login-error">{error}</ErrorText>
      <Button testID="login-submit-button" label="Sign in" icon="log-in" loading={busy} onPress={submit} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
        <Link href="/auth/forgot" asChild>
          <Pressable testID="forgot-password-link" hitSlop={8}><Text style={[s.body, { color: colors.onBrandTertiary }]}>Forgot password?</Text></Pressable>
        </Link>
        <Link href="/auth/register" asChild>
          <Pressable testID="go-register-link" hitSlop={8}><Text style={[s.body, { color: colors.onBrandTertiary }]}>Create account</Text></Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}
