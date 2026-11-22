// Native LiveKit bootstrap. The WebRTC engine exists only in FX CALL development/store builds,
// never in Expo Go — so we detect the native module before touching @livekit/react-native.
import { NativeModules, Platform, TurboModuleRegistry } from "react-native";

let ready: boolean | null = null;

export function liveKitAvailable(): boolean {
  if (ready !== null) return ready;
  const native = NativeModules.WebRTCModule ?? TurboModuleRegistry.get("WebRTCModule");
  if (!native) return (ready = false);
  try {
    require("@livekit/react-native").registerGlobals();
    ready = true;
  } catch {
    ready = false;
  }
  return ready;
}

export const unavailableReason =
  "Live video runs in the installed FX CALL app. Expo Go does not include the WebRTC engine — install the FX CALL build or join from the website.";

export function getLK(): typeof import("livekit-client") {
  return require("livekit-client");
}

export async function startAudio() {
  const { AudioSession } = require("@livekit/react-native");
  await AudioSession.startAudioSession();
}

export async function stopAudio() {
  const { AudioSession } = require("@livekit/react-native");
  await AudioSession.stopAudioSession();
}

export const supportsAudioRoute = true;

/** Native audio route selection: iOS system route picker; Android cycles available outputs. */
export async function pickAudioRoute(): Promise<string | null> {
  const { AudioSession } = require("@livekit/react-native");
  if (Platform.OS === "ios") {
    await AudioSession.showAudioRoutePicker();
    return null;
  }
  const outputs: string[] = await AudioSession.getAudioOutputs();
  if (!outputs.length) return null;
  routeIndex = (routeIndex + 1) % outputs.length;
  await AudioSession.selectAudioOutput(outputs[routeIndex]);
  return outputs[routeIndex];
}
let routeIndex = -1;

export function attachAudio(_track: any) {
  // Native SDK plays remote audio automatically.
  return () => {};
}
