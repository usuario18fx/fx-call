// Browser LiveKit (WebRTC). Screen capture is never requested: getDisplayMedia is blocked app-wide.
export function liveKitAvailable(): boolean {
  return typeof window !== "undefined" && typeof (window as any).RTCPeerConnection !== "undefined";
}

export const unavailableReason = "This browser does not support WebRTC video calls.";

export function getLK(): typeof import("livekit-client") {
  return require("livekit-client");
}

export async function startAudio() {}
export async function stopAudio() {}

export const supportsAudioRoute = false;
export async function pickAudioRoute(): Promise<string | null> {
  return null;
}

/** Remote audio needs an <audio> element in browsers. */
export function attachAudio(track: any) {
  const el: HTMLMediaElement = track.attach();
  el.style.display = "none";
  document.body.appendChild(el);
  return () => {
    track.detach(el);
    el.remove();
  };
}
