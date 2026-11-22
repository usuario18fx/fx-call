import { storage } from "@/src/utils/storage";

export const API_BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
const ACCESS_KEY = "fx_access_token";
const REFRESH_KEY = "fx_refresh_token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let access: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onAuthLost: (() => void) | null = null;

export function setAuthLostHandler(fn: () => void) {
  onAuthLost = fn;
}

export async function saveTokens(a: string, r: string) {
  access = a;
  await storage.secureSet(ACCESS_KEY, a);
  await storage.secureSet(REFRESH_KEY, r);
}

export async function loadTokens(): Promise<boolean> {
  access = (await storage.secureGet(ACCESS_KEY, null)) as string | null;
  return !!access;
}

export async function clearTokens() {
  access = null;
  await storage.secureRemove(ACCESS_KEY);
  await storage.secureRemove(REFRESH_KEY);
}

type Opts = { method?: string; body?: unknown; headers?: Record<string, string> };

function errorMessage(data: any, status: number): string {
  const d = data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg).replace(/^Value error, /, "");
  return status >= 500 ? "Server unavailable. Please try again." : "Request failed.";
}

async function request<T>(path: string, opts: Opts, token: string | null): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "You appear to be offline. Check your connection.");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, errorMessage(data, res.status));
  return data as T;
}

async function refreshTokens(): Promise<boolean> {
  const r = (await storage.secureGet(REFRESH_KEY, null)) as string | null;
  if (!r) return false;
  try {
    const out = await request<{ access_token: string; refresh_token: string }>("/auth/refresh", { body: { refresh_token: r } }, null);
    await saveTokens(out.access_token, out.refresh_token);
    return true;
  } catch {
    return false;
  }
}

/** Authenticated account API with single-flight refresh-token rotation. */
export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  try {
    return await request<T>(path, opts, access);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401 || !access) throw e;
    refreshing = refreshing || refreshTokens().finally(() => setTimeout(() => (refreshing = null), 0));
    if (await refreshing) return request<T>(path, opts, access);
    await clearTokens();
    onAuthLost?.();
    throw e;
  }
}

/** Public API (no account token). Optional bearer passes through when signed in. */
export function publicApi<T>(path: string, opts: Opts = {}, withAccount = false): Promise<T> {
  return withAccount && access ? api<T>(path, opts) : request<T>(path, opts, null);
}

// ---- participant credentials (per room) — stored in the secure keychain on native
const pkey = (roomId: string) => `fx_pkey_${roomId}`;

export async function saveParticipantKey(roomId: string, key: string) {
  await storage.secureSet(pkey(roomId), key);
}

export async function getParticipantKey(roomId: string): Promise<string | null> {
  return (await storage.secureGet(pkey(roomId), null)) as string | null;
}

export async function participantApi<T>(roomId: string, path: string, opts: Opts = {}): Promise<T> {
  const key = await getParticipantKey(roomId);
  if (!key) throw new ApiError(401, "Missing participant credentials");
  return request<T>(`/rooms/${roomId}${path}`, { ...opts, headers: { ...(opts.headers || {}), "X-Participant-Key": key } }, null);
}
