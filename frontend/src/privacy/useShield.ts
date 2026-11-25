// One hook = full capture defence for any sensitive screen.
//  1. Capture protection ON for as long as the screen is mounted (iOS secure canvas → screenshots/recordings come out
//     black; Android FLAG_SECURE). Retries, because iOS needs the window attached first.
//  2. Local screenshot listener → immediate on-device notice for EVERYONE (hosts included) + watermark boost.
//  3. Optional server report so the host timeline records it.
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as ScreenCapture from "expo-screen-capture";

import { setCaptureProtection, startShield } from "./shield";
import type { CaptureEvent } from "./types";

export function useShield(opts: { active: boolean; report?: (e: CaptureEvent) => Promise<void> | void }) {
  const { active } = opts;
  const [hits, setHits] = useState(0);
  const [boost, setBoost] = useState(false);
  const reportRef = useRef(opts.report);
  reportRef.current = opts.report;

  useEffect(() => {
    if (!active || Platform.OS === "web") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = async (attempt: number) => {
      await setCaptureProtection(true);
      if (cancelled) return;
      // iOS can refuse until the window is attached; try again a few times.
      if (attempt < 3) timer = setTimeout(() => arm(attempt + 1), 600 * (attempt + 1));
    };
    arm(0);
    ScreenCapture.enableAppSwitcherProtectionAsync?.(0.6).catch(() => {});
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      setCaptureProtection(false);
      ScreenCapture.disableAppSwitcherProtectionAsync?.().catch(() => {});
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    let off: ReturnType<typeof setTimeout> | undefined;
    const stop = startShield(async (e) => {
      setHits((n) => n + 1);
      setBoost(true);
      if (off) clearTimeout(off);
      off = setTimeout(() => setBoost(false), 15000);
      try {
        await reportRef.current?.(e);
      } catch {
        // offline / rate-limited: the on-device notice already fired
      }
    });
    return () => {
      stop();
      if (off) clearTimeout(off);
    };
  }, [active]);

  return { hits, boost };
}
