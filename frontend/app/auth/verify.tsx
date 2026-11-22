import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";

import { publicApi } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AuthShell } from "@/src/components/AuthShell";
import { Button, ErrorText, Field, useToast } from "@/src/components/ui";

export default function Verify() {
  const { email: initial } = useLocalSearchParams<{ email?: string }>();
  const { verifyEmail } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState(initial ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (code.length !== 6) return setError("Enter the 6-digit code from your email.");
    setBusy(true);
    try {
      await verifyEmail(email, code);
      router.replace("/(tabs)/meetings");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await publicApi("/auth/resend-verification", { body: { email: email.trim() } });
      toast("A new code is on its way.", "success");
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <AuthShell title="Verify email" subtitle={`Enter the code we sent${email ? ` to ${email}` : ""}. It expires in 15 minutes.`}>
      {!initial ? <Field testID="verify-email-input" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /> : null}
      <Field testID="verify-code-input" label="Verification code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" placeholder="123456" onSubmitEditing={submit} />
      <ErrorText testID="verify-error">{error}</ErrorText>
      <Button testID="verify-submit-button" label="Verify & continue" icon="badge-check" loading={busy} onPress={submit} />
      <Button testID="verify-resend-button" label="Resend code" variant="ghost" onPress={resend} />
    </AuthShell>
  );
}
