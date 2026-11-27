import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, SlideInDown } from "react-native-reanimated";

import { Icon, IconName } from "@/src/components/ui";
import { useLang } from "@/src/i18n";
import { fonts } from "@/src/theme";

const G = { glass: "rgba(20,22,26,0.62)", line: "rgba(255,255,255,0.10)", text: "#F3F5F8", dim: "#9AA1AD", mint: "#6FE3C1", red: "#E5484D", sheet: "#111317" };
const tap = () => { if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); };

function DockBtn({ icon, label, onPress, active, badge, testID }: { icon: IconName; label: string; onPress: () => void; active?: boolean; badge?: number; testID: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={() => { tap(); onPress(); }} style={({ pressed }) => [s.btn, pressed && { opacity: 0.6, transform: [{ scale: 0.95 }] }]}>
      <View style={[s.circle, active && s.circleOff]}>
        <Icon name={icon} size={22} color={active ? "#111317" : G.text} />
        {badge ? <View style={s.badge}><Text style={s.badgeText}>{badge > 9 ? "9+" : badge}</Text></View> : null}
      </View>
      <Text style={s.label} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export type DockProps = {
  bottom: number;
  micOn: boolean; camOn: boolean; layout: "gallery" | "speaker"; unread: number; isHost: boolean; showFlip: boolean; showAudio: boolean;
  onMic: () => void; onCam: () => void; onFlip: () => void; onAudio: () => void; onLayout: () => void; onChat: () => void; onSecurity: () => void; onLeave: () => void;
};

export function CallDock(p: DockProps) {
  const { t } = useLang();
  const [more, setMore] = useState(false);
  const items: { key: string; icon: IconName; label: string; onPress: () => void; show: boolean; hint?: string }[] = [
    { key: "flip", icon: "switch-camera", label: t("dock.flip"), onPress: p.onFlip, show: p.showFlip },
    { key: "audio", icon: "volume-2", label: t("dock.audio"), onPress: p.onAudio, show: p.showAudio },
    { key: "layout", icon: p.layout === "gallery" ? "layout-grid" : "square-user", label: t("dock.layout"), hint: p.layout === "gallery" ? t("dock.layoutGrid") : t("dock.layoutSpeaker"), onPress: p.onLayout, show: true },
    { key: "security", icon: "shield-check", label: t("dock.security"), onPress: p.onSecurity, show: p.isHost },
  ];
  return (
    <>
      <Animated.View entering={FadeInDown} style={[s.wrap, { bottom: p.bottom }]} testID="call-controls">
        <BlurView intensity={40} tint="dark" style={s.dock}>
          <DockBtn testID="toggle-mic-button" icon={p.micOn ? "mic" : "mic-off"} label={t("dock.mic")} active={!p.micOn} onPress={p.onMic} />
          <DockBtn testID="toggle-camera-button" icon={p.camOn ? "video" : "video-off"} label={t("dock.cam")} active={!p.camOn} onPress={p.onCam} />
          <Pressable testID="end-call-button" accessibilityRole="button" accessibilityLabel={t("dock.leave")} onPress={() => { tap(); p.onLeave(); }} style={({ pressed }) => [s.leave, pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] }]}>
            <Icon name="phone-off" size={26} color="#fff" />
          </Pressable>
          <DockBtn testID="open-chat-button" icon="message-circle" label={t("dock.chat")} badge={p.unread} onPress={p.onChat} />
          <DockBtn testID="open-more-button" icon="layout-grid" label={t("dock.more")} onPress={() => setMore(true)} />
        </BlurView>
      </Animated.View>

      <Modal visible={more} transparent animationType="fade" onRequestClose={() => setMore(false)}>
        <Pressable style={s.backdrop} onPress={() => setMore(false)} testID="more-backdrop">
          <Animated.View entering={SlideInDown.springify().damping(18)} style={s.sheet}>
            <Pressable>
              <View style={s.grab} />
              <Text style={s.sheetTitle}>{t("dock.moreTitle")}</Text>
              <View style={s.grid}>
                {items.filter((i) => i.show).map((i) => (
                  <Pressable key={i.key} testID={`more-${i.key}`} onPress={() => { tap(); setMore(false); setTimeout(i.onPress, 120); }} style={({ pressed }) => [s.tile, pressed && { opacity: 0.6 }]}>
                    <View style={s.tileIcon}><Icon name={i.icon} size={22} color={G.mint} /></View>
                    <Text style={s.tileLabel}>{i.label}</Text>
                    {i.hint ? <Text style={s.tileHint}>{i.hint}</Text> : null}
                  </Pressable>
                ))}
              </View>
              <Pressable testID="more-close" onPress={() => setMore(false)} style={s.close}><Text style={s.closeText}>{t("dock.close")}</Text></Pressable>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 14, right: 14, alignItems: "center" },
  dock: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: 440, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 34, overflow: "hidden", backgroundColor: G.glass, borderWidth: 1, borderColor: G.line },
  btn: { alignItems: "center", gap: 5, width: 58 },
  circle: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center" },
  circleOff: { backgroundColor: "#F3F5F8" },
  label: { fontFamily: fonts.text, fontSize: 10.5, color: G.dim, letterSpacing: 0.2 },
  leave: { width: 62, height: 62, borderRadius: 31, backgroundColor: G.red, alignItems: "center", justifyContent: "center", marginBottom: 14, shadowColor: G.red, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  badge: { position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: G.mint, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { fontFamily: fonts.text, fontSize: 10.5, color: "#0B1512", fontWeight: "700" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: G.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34, borderWidth: 1, borderColor: G.line },
  grab: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.text, fontSize: 15, color: G.text, fontWeight: "600", marginBottom: 14, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { width: "47.8%", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, padding: 16, gap: 8, borderWidth: 1, borderColor: G.line },
  tileIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(111,227,193,0.12)", alignItems: "center", justifyContent: "center" },
  tileLabel: { fontFamily: fonts.text, fontSize: 14, color: G.text, fontWeight: "600" },
  tileHint: { fontFamily: fonts.text, fontSize: 12, color: G.dim, marginTop: -4 },
  close: { marginTop: 16, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  closeText: { fontFamily: fonts.text, fontSize: 14, color: G.text },
});
