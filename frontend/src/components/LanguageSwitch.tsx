import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Lang, useLang } from "@/src/i18n";
import { fonts } from "@/src/theme";

const OPTIONS: { key: Lang; short: string; long: string }[] = [
  { key: "en", short: "EN", long: "English · CA" },
  { key: "es", short: "ES", long: "Español · MX" },
];

/** Segmented EN-CA / ES-MX switch. `compact` = two small pills for headers. */
export function LanguageSwitch({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <View style={s.row} accessibilityRole="radiogroup">
      {OPTIONS.map((o) => {
        const on = o.key === lang;
        return (
          <Pressable key={o.key} testID={`lang-${o.key}`} accessibilityRole="radio" accessibilityState={{ selected: on }}
            onPress={() => { if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); setLang(o.key); }}
            style={[s.opt, compact ? s.optC : s.optL, on && s.on]}>
            <Text style={[s.txt, on && { color: "#0B1512" }]}>{compact ? o.short : o.long}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, padding: 3, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  opt: { alignItems: "center", justifyContent: "center", borderRadius: 15 },
  optC: { height: 28, paddingHorizontal: 10 },
  optL: { flex: 1, height: 38, paddingHorizontal: 12 },
  on: { backgroundColor: "#6FE3C1" },
  txt: { fontFamily: fonts.text, fontSize: 12, color: "#F3F5F8", fontWeight: "700", letterSpacing: 0.4 },
});
