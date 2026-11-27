import { Link, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/src/auth";
import { AuthShell } from "@/src/components/AuthShell";
import { ErrorText, Field, s } from "@/src/components/ui";
import { spacing } from "@/src/theme";

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
    if (busy) return;
    setError(null);
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    try {
      const r = await login(email, password, needTotp ? totp : undefined);
      if (r.ok) return router.replace((params.next as any) || "/(tabs)/meetings");
      if (r.reason === "totp_required" || r.reason === "invalid_totp") setNeedTotp(true);
      if (r.reason === "email_not_verified") return router.push({ pathname: "/auth/verify", params: { email: email.trim() } });
      setError(r.message);
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Sign in" subtitle="One account for iPhone, Android and the web.">
      <Field testID="login-email-input" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@company.com" />
      <Field testID="login-password-input" label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" placeholder="••••••••••" onSubmitEditing={submit} />
      {needTotp ? (
        <Field testID="login-totp-input" label="Authenticator code" value={totp} onChangeText={(t) => setTotp(t.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" placeholder="123456" />
      ) : null}
      <ErrorText testID="login-error">{error}</ErrorText>
      <Pressable
        testID="login-submit-button"
        accessibilityRole="button"
        accessibilityLabel="Sign in"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={submit}
        style={({ pressed }) => [styles.signIn, pressed && styles.pressed, busy && styles.disabled]}
      >
        {busy ? <ActivityIndicator color="#3689b0" /> : <Text style={styles.signInIcon}>→</Text>}
        <Text style={styles.signInText}>SIGN IN</Text>
      </Pressable>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
        <Link href="/auth/forgot" asChild>
          <Pressable testID="forgot-password-link" hitSlop={8}><Text style={[s.body, styles.link]}>Forgot password?</Text></Pressable>
        </Link>
        <Link href="/auth/register" asChild>
          <Pressable testID="go-register-link" hitSlop={8}><Text style={[s.body, styles.link]}>Create account</Text></Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  signIn: {
    minHeight: 54,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#316c8b",
    backgroundColor: "#05090d",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  signInIcon: { color: "#3a91bc", fontSize: 25, lineHeight: 27 },
  signInText: {
    color: "#e8edf0",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 3,
    fontFamily: "serif",
  },
  link: { color: "#55a3c4" },
  pressed: { backgroundColor: "#0a1a25" },
  disabled: { opacity: 0.65 },
});
