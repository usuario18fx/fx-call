import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon, IconName } from "@/src/components/ui";
import { useLang } from "@/src/i18n";
import { fonts } from "@/src/theme";

const C = { card: "#12151A", line: "rgba(255,255,255,0.08)", text: "#F3F5F8", dim: "#9AA1AD", mint: "#6FE3C1", amber: "#F5B454", red: "#E5484D", blue: "#7DB7FF" };
const tap = () => { if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); };

function Pill({ icon, label, tone }: { icon: IconName; label: string; tone: "mint" | "amber" | "dim" }) {
  const col = tone === "mint" ? C.mint : tone === "amber" ? C.amber : C.dim;
  return (
    <View style={[s.pill, { borderColor: col + "44", backgroundColor: col + "14" }]}>
      <Icon name={icon} size={12} color={col} />
      <Text style={[s.pillText, { color: col }]}>{label}</Text>
    </View>
  );
}

function Action({ icon, label, onPress, tone, disabled, testID, wide }: { icon: IconName; label: string; onPress: () => void; tone: "primary" | "ghost" | "danger"; disabled?: boolean; testID: string; wide?: boolean }) {
  const bg = tone === "primary" ? C.mint : tone === "danger" ? "rgba(229,72,77,0.14)" : "rgba(255,255,255,0.06)";
  const fg = tone === "primary" ? "#0B1512" : tone === "danger" ? "#FF8A8E" : C.text;
  const bd = tone === "danger" ? "rgba(229,72,77,0.4)" : tone === "primary" ? C.mint : C.line;
  return (
    <Pressable testID={testID} accessibilityRole="button" disabled={disabled} onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [s.action, wide && { flexBasis: "100%" }, { backgroundColor: bg, borderColor: bd, opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}>
      <Icon name={icon} size={18} color={fg} />
      <Text style={[s.actionText, { color: fg }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export type HostHeroProps = {
  title: string; active: boolean; locked: boolean; realtime: boolean; entering: boolean;
  onEnter: () => void; onLock: () => void; onEnd: () => void;
};

export function HostHero(p: HostHeroProps) {
  const { t } = useLang();
  return (
    <View style={s.hero} testID="crown-room-banner">
      <LinearGradient colors={["rgba(111,227,193,0.16)", "rgba(125,183,255,0.06)", "rgba(18,21,26,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={s.top}>
        <View style={s.crown}><Icon name="crown" size={20} color={C.mint} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>{t("host.eyebrow").toUpperCase()}</Text>
          <Text style={s.title} numberOfLines={1}>{p.title}</Text>
        </View>
      </View>
      <View style={s.pills}>
        <Pill icon="radio" label={p.active ? t("host.heroLive") : t("host.heroEnded")} tone={p.active ? "mint" : "dim"} />
        <Pill icon={p.locked ? "lock" : "lock-open"} label={p.locked ? t("host.locked") : t("host.open")} tone={p.locked ? "amber" : "mint"} />
        <Pill icon="wifi" label={p.realtime ? t("host.realtime") : t("host.reconnecting")} tone={p.realtime ? "mint" : "amber"} />
        <Pill icon="monitor-off" label={t("host.noShare")} tone="dim" />
      </View>
      {p.active ? (
        <View style={s.actions}>
          <Action testID="enter-call-button" icon="video" label={t("host.enter")} tone="primary" wide disabled={p.entering} onPress={p.onEnter} />
          <Action testID="lock-room-button" icon={p.locked ? "lock-open" : "lock"} label={p.locked ? t("host.unlock") : t("host.lock")} tone="ghost" onPress={p.onLock} />
          <Action testID="end-call-all-button" icon="phone-off" label={t("host.end")} tone="danger" onPress={p.onEnd} />
        </View>
      ) : (
        <Text style={s.ended}>{t("host.ended")}</Text>
      )}
    </View>
  );
}

export function HostTabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: string; icon: IconName; count?: number; hot?: boolean }[]; value: T; onChange: (k: T) => void }) {
  return (
    <View style={s.tabsWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
        {tabs.map((tb) => {
          const on = tb.key === value;
          return (
            <Pressable key={tb.key} testID={`dashboard-tab-${tb.key}`} onPress={() => { tap(); onChange(tb.key); }} style={[s.tab, on && s.tabOn]}>
              <Icon name={tb.icon} size={16} color={on ? "#0B1512" : C.dim} />
              <Text style={[s.tabText, on && { color: "#0B1512" }]}>{tb.label}</Text>
              {tb.count ? <View style={[s.count, on && { backgroundColor: "rgba(11,21,18,0.18)" }, tb.hot && !on && { backgroundColor: C.red }]}><Text style={[s.countText, on && { color: "#0B1512" }]}>{tb.count}</Text></View> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function ProtectedNote({ text }: { text: string }) {
  return (
    <View style={s.note}>
      <Icon name="shield-check" size={14} color={C.mint} />
      <Text style={s.noteText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: 26, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, padding: 18, gap: 16, overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  crown: { width: 44, height: 44, borderRadius: 15, backgroundColor: "rgba(111,227,193,0.12)", borderWidth: 1, borderColor: "rgba(111,227,193,0.3)", alignItems: "center", justifyContent: "center" },
  eyebrow: { fontFamily: fonts.text, fontSize: 10.5, letterSpacing: 1.8, color: C.mint },
  title: { fontFamily: fonts.text, fontSize: 21, color: C.text, fontWeight: "700", marginTop: 2 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, height: 26, borderRadius: 13, borderWidth: 1 },
  pillText: { fontFamily: fonts.text, fontSize: 11.5, fontWeight: "600" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  action: { flexGrow: 1, flexBasis: "46%", height: 52, borderRadius: 16, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12 },
  actionText: { fontFamily: fonts.text, fontSize: 14, fontWeight: "700" },
  ended: { fontFamily: fonts.text, fontSize: 13, color: C.dim, lineHeight: 19 },
  tabsWrap: { marginHorizontal: -4 },
  tabs: { gap: 8, paddingHorizontal: 4, paddingVertical: 2 },
  tab: { flexDirection: "row", alignItems: "center", gap: 7, height: 42, paddingHorizontal: 14, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: C.line },
  tabOn: { backgroundColor: C.mint, borderColor: C.mint },
  tabText: { fontFamily: fonts.text, fontSize: 13.5, color: C.text, fontWeight: "600" },
  count: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  countText: { fontFamily: fonts.text, fontSize: 11, color: C.text, fontWeight: "700" },
  note: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: "rgba(111,227,193,0.07)", borderWidth: 1, borderColor: "rgba(111,227,193,0.18)" },
  noteText: { flex: 1, fontFamily: fonts.text, fontSize: 12, color: C.dim, lineHeight: 17 },
});
