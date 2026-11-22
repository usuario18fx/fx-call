// FX PRIVACY SHIELD — native (iOS / Android).
// Preferred engine: our own Swift/Kotlin module (modules/fx-privacy-shield), available in
// development / store builds. In Expo Go the custom module is absent, so we fall back to
// expo-screen-capture, which also wraps genuine OS APIs (screenshot notifications only).
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import * as ScreenCapture from "expo-screen-capture";

import type { CaptureCaps, CaptureEvent } from "./types";

type NativeShield = {
  getCapabilities(): { screenshot: boolean; recording: boolean; screenshotSource: string; recordingSource: string; engine: string };
  startMonitoring(): Promise<void>;
  stopMonitoring(): Promise<void>;
  setSecure?(enabled: boolean): Promise<void>;
  addListener(event: "onCaptureEvent", cb: (e: CaptureEvent) => void): { remove(): void };
};

const Native = requireOptionalNativeModule<NativeShield>("FxPrivacyShield");

const androidApi = Platform.OS === "android" ? Number(Platform.Version) : 0;

export function getCaptureCapabilities(): CaptureCaps {
  if (Native) {
    const c = Native.getCapabilities();
    const sources = [c.screenshot && c.screenshotSource, c.recording && c.recordingSource].filter(Boolean).join(",");
    return { screenshot: c.screenshot, recording: c.recording, source: sources || "none", engine: c.engine, note: "" };
  }
  if (Platform.OS === "ios") {
    return {
      screenshot: true, recording: false, source: "ios.UIApplication.userDidTakeScreenshotNotification", engine: "expo-screen-capture",
      note: "Recording detection needs the FX CALL app build (not Expo Go).",
    };
  }
  if (Platform.OS === "android" && androidApi >= 34) {
    return {
      screenshot: true, recording: false, source: "android.Activity.ScreenCaptureCallback", engine: "expo-screen-capture",
      note: "Recording detection needs Android 15 and the FX CALL app build.",
    };
  }
  return { screenshot: false, recording: false, source: "none", engine: "none", note: "This Android version has no supported capture detection API." };
}

export function startShield(onEvent: (e: CaptureEvent) => void): () => void {
  if (Native) {
    const sub = Native.addListener("onCaptureEvent", (e) => onEvent({ type: e.type, source: e.source }));
    Native.startMonitoring().catch(() => {});
    return () => {
      sub.remove();
      Native.stopMonitoring().catch(() => {});
    };
  }
  const caps = getCaptureCapabilities();
  if (!caps.screenshot) return () => {};
  const sub = ScreenCapture.addScreenshotListener(() => onEvent({ type: "screenshot", source: caps.source }));
  return () => sub.remove();
}

export async function setCaptureProtection(enabled: boolean): Promise<void> {
  try {
    if (Native?.setSecure && Platform.OS === "android") {
      await Native.setSecure(enabled);
      return;
    }
    if (enabled) await ScreenCapture.preventScreenCaptureAsync("fxcall-call");
    else await ScreenCapture.allowScreenCaptureAsync("fxcall-call");
  } catch {
    // Protection unsupported on this device; detection still applies.
  }
}

export const shieldPlatformLabel = Platform.OS === "ios" ? "iOS native APIs" : "Android native APIs";
