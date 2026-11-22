import { useRouter } from "expo-router";
import React, { useState } from "react";

import { publicApi } from "@/src/api";
import { AuthShell } from "@/src/components/AuthShell";
import { Body, Button, ErrorText, Field, useToast } from "@/src/components/ui";

export default function Forgot() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const sendCode = () =>
    run(async () => {
      if (!email.trim()) throw new Error("Enter your email.");
      await publicApi("/auth/forgot", { body: { email: email.trim() } });
      setStep("reset");
    });

  const reset = () =>
    run(async () => {
      if (password.length < 10) throw new Error("Use at least 10 characters.");
      await publicApi("/auth/reset", { body: { email: email.trim(), code, password } });
      toast("Password updated. All devices were signed out.", "success");
      router.replace({ pathname: "/auth/login", params: { email: email.trim() } });
    });

  return (
    <AuthShell title="Reset password" subtitle={step === "email" ? "We'll email you a one-time reset code." : `If ${email} has an account, a code was sent.`}>
      {step === "email" ? (
        <>
          <Field testID="forgot-email-input" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" onSubmitEditing={sendCode} />
          <ErrorText testID="forgot-error">{error}</ErrorText>
          <Button testID="forgot-send-button" label="Send reset code" icon="mail" loading={busy} onPress={sendCode} />
        </>
      ) : (
        <>
          <Field testID="reset-code-input" label="Reset code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" />
          <Field testID="reset-password-input" label="New password (10+ characters)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" onSubmitEditing={reset} />
          <ErrorText testID="reset-error">{error}</ErrorText>
          <Button testID="reset-submit-button" label="Update password" icon="key-round" loading={busy} onPress={reset} />
          <Body>Resetting signs you out of every device.</Body>
        </>
      )}
      <Button testID="back-to-login-button" label="Back to sign in" variant="ghost" onPress={() => router.replace("/auth/login")} />
    </AuthShell>
  );
}
