import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/src/theme";

/** Participant-specific dynamic watermark: name + short id + timestamp, tiled and faint. */
export function Watermark({ name, id, stamp, boost }: { name: string; id: string; stamp: string; boost?: boolean }) {
  const text = `${name} · ${id.slice(0, 6).toUpperCase()} · ${stamp}`;
  const rows = useMemo(() => Array.from({ length: 14 }), []);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="call-watermark">
      <View style={styles.rotator}>
        {rows.map((_, i) => (
          <Text key={i} numberOfLines={1} style={[styles.text, { marginLeft: (i % 2) * 60, opacity: boost ? 0.55 : 0.2, fontSize: boost ? 15 : 13 }]}>
            {`${text}     ${text}     ${text}`}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rotator: { position: "absolute", top: "-20%", left: "-40%", width: "180%", height: "140%", justifyContent: "space-around", transform: [{ rotate: "-24deg" }] },
  text: { fontFamily: fonts.text, fontSize: 13, letterSpacing: 1, color: colors.onSurface },
});
