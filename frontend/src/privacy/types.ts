export type CaptureEventType = "screenshot" | "recording_started" | "recording_stopped";

export type CaptureEvent = { type: CaptureEventType; source: string };

export type CaptureCaps = {
  screenshot: boolean;
  recording: boolean;
  source: string;
  engine: string;
  note: string;
};
