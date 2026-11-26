// Editorial "index" list: no cards, no boxes. Big numbered rows on hairlines; a row opens a tree
// (vertical rail + dots) with its subcategories inline.
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { H, tap, type Tone } from "@/src/components/SettingsHub";
import { Icon } from "@/src/components/ui";
import { fonts } from "@/src/theme";

const COL = { mint: H.mint, blue: H.blue, amber: H.amber, red: H.red } as const;

export type IndexSub = { key: string; title: string; meta?: string; danger?: boolean };
export type IndexSection = { key: string; title: string; meta?: string; badge?: number; tone: Tone; subs: IndexSub[] };

export function IndexList({ sections, onOpen, initialOpen = null }: { sections: IndexSection[]; onOpen: (section: string, sub: string) => void; initialOpen?: string | null }) {
  const [open, setOpen] = useState<string | null>(initialOpen);
  return (
    <View testID="index-list">
      {sections.map((sec, i) => {
        const on = open === sec.key;
        const c = COL[sec.tone];
        return (
          <Animated.View key={sec.key} layout={LinearTransition.duration(220)} style={s.item}>
            <Pressable testID={`idx-${sec.key}`} accessibilityRole="button" accessibilityState={{ expanded: on }} onPress={() => { tap(); setOpen(on ? null : sec.key); }} style={({ pressed }) => [s.head, pressed && { opacity: 0.6 }]}>
              <Text style={[s.num, on && { color: c }]}>{String(i + 1).padStart(2, "0")}</Text>
              <Text style={[s.title, !on && { color: H.text }]} numberOfLines={1}>{sec.title}</Text>
              {sec.badge ? <View style={s.badge}><Text style={s.badgeText}>{sec.badge > 9 ? "9+" : sec.badge}</Text></View> : null}
              <View style={{ flex: 1 }} />
              {sec.meta ? <Text style={s.meta} numberOfLines={1}>{sec.meta}</Text> : null}
              <View style={{ transform: [{ rotate: on ? "90deg" : "0deg" }] }}><Icon name="chevron-right" size={20} color={on ? c : H.dim} /></View>
            </Pressable>
            {on ? (
              <View style={s.tree}>
                <View style={[s.rail, { backgroundColor: c + "55" }]} />
                {sec.subs.map((sub, j) => (
                  <Animated.View key={sub.key} entering={FadeInDown.delay(j * 55).duration(200)}>
                    <Pressable testID={`idx-${sec.key}-${sub.key}`} accessibilityRole="button" onPress={() => { tap(); onOpen(sec.key, sub.key); }} style={({ pressed }) => [s.sub, pressed && { opacity: 0.6 }]}>
                      <View style={[s.dot, { borderColor: sub.danger ? H.red : c }]} />
                      <Text style={[s.subTitle, sub.danger && { color: H.red }]} numberOfLines={1}>{sub.title}</Text>
                      <View style={{ flex: 1 }} />
                      {sub.meta ? <Text style={s.subMeta} numberOfLines={1}>{sub.meta}</Text> : null}
                      <Icon name="arrow-up-right" size={16} color={H.dim} />
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            ) : null}
          </Animated.View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  item: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.12)" },
  head: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 20 },
  num: { fontFamily: fonts.text, fontSize: 12, letterSpacing: 1.5, color: H.dim, width: 22, fontWeight: "700" },
  title: { fontFamily: fonts.text, fontSize: 24, fontWeight: "800", color: H.text, letterSpacing: -0.4, flexShrink: 1 },
  meta: { fontFamily: fonts.text, fontSize: 12.5, color: H.dim, maxWidth: 130 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "#E5484D", alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeText: { fontFamily: fonts.text, fontSize: 11, color: "#fff", fontWeight: "800" },
  tree: { marginLeft: 10, paddingLeft: 22, paddingBottom: 14 },
  rail: { position: "absolute", left: 10, top: 0, bottom: 22, width: 1 },
  sub: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  dot: { position: "absolute", left: -17, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, backgroundColor: "#0D0D0E" },
  subTitle: { fontFamily: fonts.text, fontSize: 17, color: H.text, fontWeight: "500" },
  subMeta: { fontFamily: fonts.text, fontSize: 12.5, color: H.dim, maxWidth: 140 },
});
