/**
 * FX CALL — NOVA design foundations.
 * Shared visual language for Studio, Meetings, Account, Auth, and room controls.
 * The legacy theme remains unchanged until component migration and QA pass.
 */
export const nova = {
  color: {
    canvas: "#050607",
    stage: "#0B1014",
    surface: "#090C0F",
    surfaceRaised: "#121820",
    surfaceGlass: "rgba(9,12,15,0.82)",
    ink: "#F4F6F8",
    muted: "#89919A",
    subtle: "#69737C",
    line: "rgba(255,255,255,0.09)",
    lineStrong: "rgba(255,255,255,0.16)",
    mint: "#2ED3B7",
    mintInk: "#03201B",
    mintSoft: "rgba(46,211,183,0.10)",
    blue: "#0370FF",
    blueSoft: "rgba(3,112,255,0.12)",
    live: "#FF5A5F",
    liveSoft: "rgba(255,90,95,0.11)",
    warning: "#FFB020",
    scrim: "rgba(2,3,4,0.78)",
  },
  space: { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: {
    card: 6,
    input: 6,
    button: 6,
    badge: 6,
    // Circular/capsule geometry is intentional in the NOVA reference.
    capsule: 999,
    round: 999,
  },
  typography: {
    body: "DMSans",
    display: "DMSans",
    technical: "monospace",
    trackingTechnical: 1.6,
  },
  motion: { quick: 140, normal: 240, slow: 400 },
} as const;

export type NovaTokens = typeof nova;

/** False statuses must never be shown as real camera, network or security data. */
export const novaTelemetryPolicy = {
  showMockViewerCount: false,
  showMockLatency: false,
  showMockRecordingStatus: false,
  liveMeansActualMediaConnection: true,
  privacyDetectionMustReportSupport: true,
} as const;
