import { Platform } from "react-native";

import { getCaptureCapabilities } from "@/src/privacy/shield";

export type PlatformName = "ios" | "android" | "web";

export function deviceInfo() {
  const platform = Platform.OS as PlatformName;
  let model = "";
  if (platform === "android") model = String((Platform.constants as any)?.Model ?? "Android device");
  else if (platform === "ios") model = (Platform as any).isPad ? "iPad" : "iPhone";
  else model = typeof navigator !== "undefined" ? browserName(navigator.userAgent) : "Browser";
  const os = platform === "web" ? "Web" : `${platform === "ios" ? "iOS" : "Android"} ${Platform.Version}`;
  const c = getCaptureCapabilities();
  return {
    platform,
    os,
    model,
    capture: { screenshot: c.screenshot, recording: c.recording, source: c.source.slice(0, 80) },
  };
}

export function sessionDevice() {
  const d = deviceInfo();
  return { platform: d.platform, os: d.os, name: d.model };
}

function browserName(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "Browser";
}
