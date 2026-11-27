// Shared building blocks for the "hub" navigation: bento tiles, rows, breadcrumb, search.
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Icon, IconName } from "@/src/components/ui";
import { fonts } from "@/src/theme";

export const H = { card: "#101820", line: "rgba(113,171,204,0.20)", text: "#F3F8FB", dim: "#8FA6B7", mint: "#2ED3B7", amber: "#F5B454", red: "#FF8A8E", blue: "#7DB7FF" };
export const tap = () => { if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); };

const TONES = { mint: H.mint, blue: H.blue, amber: H.amber, red: H.red } as const;
export type Tone = keyof typeof TONES;

/** Big bento tile: gradient glow, icon, title, small meta line, optional hot badge. */
export function HubTile({ icon, title, meta, tone = "mint", badge, big, onPress, testID }: {
  icon: IconName; title: string; meta?: string; tone?: Tone; badge?: number; big?: boolean; onPress: () => void; testID: string;
}) {
  const c = TONES[tone];
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [s.tile, big && s.tileBig, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}>
      <LinearGradient colors={[c + "26", c + "00"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[s.tileIcon, { backgroundColor: c + "1F", borderColor: c + "40" }]}>
        <Icon name={icon} size={20} color={c} />
        {badge ? <View style={s.hot}><Text style={s.hotText}>{badge > 9 ? "9+" : badge}</Text></View> : null}
      </View>
      <View style={{ flex: big ? 0 : 1, justifyContent: "flex-end", gap: 2 }}>
        <Text style={s.tileTitle} numberOfLines={1}>{title}</Text>
        {meta ? <Text style={s.tileMeta} numberOfLines={1}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
}

export function HubRow({ icon, title, meta, tone = "mint", onPress, testID, danger }: {
  icon: IconName; title: string; meta?: string; tone?: Tone; onPress: () => void; testID: string; danger?: boolean;
}) {
  const c = danger ? H.red : TONES[tone];
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={() => { tap(); onPress(); }} style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}>
      <View style={[s.rowIcon, { backgroundColor: c + "1A" }]}><Icon name={icon} size={18} color={c} /></View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTitle, danger && { color: H.red }]}>{title}</Text>
        {meta ? <Text style={s.rowMeta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      <Icon name="chevron-right" size={18} color={H.dim} />
    </Pressable>
  );
}

export function Crumbs({ trail, onBack, onRoot }: { trail: string[]; onBack: () => void; onRoot?: () => void }) {
  return (
    <View style={s.crumbs}>
      <Pressable testID="hub-back" accessibilityRole="button" accessibilityLabel="Back" onPress={() => { tap(); onBack(); }} style={s.back} hitSlop={8}>
        <Icon name="chevron-left" size={20} color={H.text} />
      </Pressable>
      <View style={s.trail}>
        {trail.map((t, i) => (
          <React.Fragment key={t + i}>
            {i > 0 ? <Icon name="chevron-right" size={14} color={H.dim} /> : null}
            <Text onPress={i === 0 ? onRoot : undefined} style={[s.crumb, i === trail.length - 1 && { color: H.text, fontWeight: "700" }]} numberOfLines={1}>{t}</Text>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

export function HubSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={s.search}>
      <Icon name="search" size={17} color={H.dim} />
      <TextInput testID="hub-search" value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={H.dim} style={s.searchInput} autoCorrect={false} autoCapitalize="none" returnKeyType="search" />
      {value ? <Pressable onPress={() => onChange("")} hitSlop={8}><Icon name="x" size={16} color={H.dim} /></Pressable> : null}
    </View>
  );
}

export const hubStyles = { group: { backgroundColor: H.card, borderRadius: 6, borderWidth: 1, borderColor: H.line, overflow: "hidden" as const } };

const s = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: "46%", minHeight: 96, borderRadius: 6, borderWidth: 1, borderColor: H.line, backgroundColor: H.card, padding: 14, gap: 10, overflow: "hidden" },
  tileBig: { flexBasis: "100%", minHeight: 96, flexDirection: "row", alignItems: "center" },
  tileIcon: { width: 42, height: 42, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  hot: { position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#E5484D", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  hotText: { fontFamily: fonts.text, fontSize: 10.5, color: "#fff", fontWeight: "800" },
  tileTitle: { fontFamily: fonts.text, fontSize: 16, color: H.text, fontWeight: "700" },
  tileMeta: { fontFamily: fonts.text, fontSize: 12, color: H.dim },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: H.line },
  rowIcon: { width: 36, height: 36, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: fonts.text, fontSize: 15, color: H.text, fontWeight: "600" },
  rowMeta: { fontFamily: fonts.text, fontSize: 12, color: H.dim, marginTop: 2 },
  crumbs: { flexDirection: "row", alignItems: "center", gap: 10 },
  back: { width: 38, height: 38, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" },
  trail: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  crumb: { fontFamily: fonts.text, fontSize: 14, color: H.dim, flexShrink: 1 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, borderRadius: 6, paddingHorizontal: 14, backgroundColor: "rgba(17,37,49,0.65)", borderWidth: 1, borderColor: H.line },
  searchInput: { flex: 1, fontFamily: fonts.text, fontSize: 15, color: H.text },
});
