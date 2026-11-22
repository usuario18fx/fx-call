import React, { useEffect, useRef } from "react";
import { StyleProp, View, ViewStyle } from "react-native";

type Props = { track: any; mirror?: boolean; fit?: "cover" | "contain"; style?: StyleProp<ViewStyle> };

/** react-native-web renders View as a DOM node; LiveKit attaches its own <video> element into it. */
export function VideoTile({ track, mirror, fit = "cover", style }: Props) {
  const ref = useRef<View>(null);
  useEffect(() => {
    const host = ref.current as unknown as HTMLElement | null;
    if (!host || !track) return;
    const el = track.attach() as HTMLVideoElement;
    el.muted = true;
    el.playsInline = true;
    Object.assign(el.style, { width: "100%", height: "100%", objectFit: fit, transform: mirror ? "scaleX(-1)" : "none", display: "block" });
    host.appendChild(el);
    return () => {
      track.detach(el);
      el.remove();
    };
  }, [track, mirror, fit]);
  return <View ref={ref} style={[{ overflow: "hidden" }, style]} />;
}
