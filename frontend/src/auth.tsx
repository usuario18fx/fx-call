import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, ApiError, clearTokens, loadTokens, publicApi, saveTokens, setAuthLostHandler } from "@/src/api";
import { sessionDevice } from "@/src/device";

export type User = { id: string; email: string; display_name: string; verified: boolean; totp_enabled: boolean; avatar_data_url?: string | null; created_at: string };
type TokenOut = { access_token: string; refresh_token: string; user: User };

export type LoginResult = { ok: true } | { ok: false; reason: "totp_required" | "invalid_totp" | "email_not_verified" | "error"; message: string };

type Ctx = {
  user: User | null;
  ready: boolean;
  login(email: string, password: string, totp?: string): Promise<LoginResult>;
  register(email: string, password: string, displayName: string): Promise<void>;
  verifyEmail(email: string, code: string): Promise<void>;
  logout(all?: boolean): Promise<void>;
  setUser(u: User): void;
  refreshUser(): Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const refreshUser = useCallback(async () => {
    setUser(await api<User>("/auth/me"));
  }, []);

  useEffect(() => {
    setAuthLostHandler(() => setUser(null));
    (async () => {
      try {
        if (await loadTokens()) await refreshUser();
      } catch {
        // offline or expired — stay signed out
      } finally {
        setReady(true);
      }
    })();
  }, [refreshUser]);

  const accept = async (out: TokenOut) => {
    await saveTokens(out.access_token, out.refresh_token);
    setUser(out.user);
  };

  const value = useMemo<Ctx>(
    () => ({
      user,
      ready,
      async login(email, password, totp) {
        try {
          const out = await publicApi<TokenOut>("/auth/login", {
            body: { email: email.trim(), password, totp_code: totp || undefined, device: sessionDevice() },
          });
          await accept(out);
          return { ok: true };
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Sign in failed";
          if (msg === "totp_required") return { ok: false, reason: "totp_required", message: "Enter the 6-digit code from your authenticator app." };
          if (msg === "invalid_totp") return { ok: false, reason: "invalid_totp", message: "That authenticator code is not valid." };
          if (msg === "email_not_verified")
            return { ok: false, reason: "email_not_verified", message: "Verify your email first. We just sent a new code." };
          return { ok: false, reason: "error", message: msg };
        }
      },
      async register(email, password, displayName) {
        await publicApi("/auth/register", { body: { email: email.trim(), password, display_name: displayName.trim() } });
      },
      async verifyEmail(email, code) {
        await accept(await publicApi<TokenOut>("/auth/verify-email", { body: { email: email.trim(), code, device: sessionDevice() } }));
      },
      async logout(all = false) {
        try {
          await api(all ? "/auth/logout-all" : "/auth/logout", { body: {} });
        } catch (e) {
          if (!(e instanceof ApiError)) throw e;
        }
        await clearTokens();
        setUser(null);
      },
      setUser,
      refreshUser,
    }),
    [user, ready, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
