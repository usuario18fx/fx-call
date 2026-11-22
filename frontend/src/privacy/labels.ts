export const EVENT_LABEL: Record<string, string> = {
  screenshot: "ꜱᴄʀᴇᴇɴꜱʜᴏᴛ ᴅᴇᴛᴇᴄᴛᴇᴅ",
  recording_started: "ʀᴇᴄᴏʀᴅɪɴɢ ᴀʟᴇʀᴛ",
  recording_stopped: "ʀᴇᴄᴏʀᴅɪɴɢ ᴇɴᴅᴇᴅ",
};

export const PRIVACY_WARNING = "ᴘʀɪᴠᴀᴄʏ ᴡᴀʀɴɪɴɢ";

export const ACTION_LABEL: Record<string, string> = {
  participant_warned: "Participant warned",
  video_restricted: "Video access restricted",
  participant_removed: "Removed automatically",
  rejoin_blocked: "Rejoin blocked",
};

export const SOURCE_LABEL: Record<string, string> = {
  "ios.UIApplication.userDidTakeScreenshotNotification": "iOS screenshot notification",
  "ios.UIScreen.capturedDidChangeNotification": "iOS screen capture state",
  "android.Activity.ScreenCaptureCallback": "Android ScreenCaptureCallback",
  "android.WindowManager.ScreenRecordingCallback": "Android screen recording callback",
};

export function platformIcon(p: string) {
  return p === "ios" ? "smartphone" : p === "android" ? "tablet-smartphone" : "monitor";
}

export function platformLabel(p: string) {
  return p === "ios" ? "iOS" : p === "android" ? "Android" : "Web";
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}
