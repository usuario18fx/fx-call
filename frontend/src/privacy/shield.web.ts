// FX PRIVACY SHIELD — web. Standard browsers expose NO reliable screenshot or screen-recording
// signal for the operating system, so we report detection as unavailable and never simulate it.
import type { CaptureCaps, CaptureEvent } from "./types";

export function getCaptureCapabilities(): CaptureCaps {
  return {
    screenshot: false,
    recording: false,
    source: "none",
    engine: "browser",
    note: "Browsers cannot detect screenshots or screen recording. Detection is unavailable on the website.",
  };
}

export function startShield(_onEvent: (e: CaptureEvent) => void): () => void {
  return () => {};
}

export async function setCaptureProtection(_enabled: boolean): Promise<void> {}

export const shieldPlatformLabel = "Browser (detection unavailable)";
