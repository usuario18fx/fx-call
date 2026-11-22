import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text } from "react-native";

import { useAuth } from "@/src/auth";
import { AuthShell } from "@/src/components/AuthShell";
import { Button, ErrorText, Field, s } from "@/src/components/ui";
import { colors } from "@/src/theme";

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!name.trim() || !email.trim()) return setError("Enter your name and email.");
    if (password.length < 10) return setError("Use at least 10 characters for your password.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      await register(email, password, name);
      router.replace({ pathname: "/auth/verify", params: { email: email.trim() } });
    } catch (e: any) {
      setError(e.message);
      if (e.status === 409) setTimeout(() => router.replace({ pathname: "/auth/login", params: { email: email.trim() } }), 1600);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create account" subtitle="We'll email you a code to verify it's really you.">
      <Field testID="register-name-input" label="Display name" value={name} onChangeText={setName} placeholder="Alex Morgan" maxLength={60} />
      <Field testID="register-email-input" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@company.com" />
      <Field testID="register-password-input" label="Password (10+ characters)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <Field testID="register-confirm-input" label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry onSubmitEditing={submit} />
      <ErrorText testID="register-error">{error}</ErrorText>
      <Button testID="register-submit-button" label="Create account" icon="user-plus" loading={busy} onPress={submit} />
      <Link href="/auth/login" asChild>
        <Pressable testID="go-login-link" hitSlop={8}><Text style={[s.body, { color: colors.onBrandTertiary }]}>Already have an account? Sign in</Text></Pressable>
      </Link>
    </AuthShell>
  );
}
