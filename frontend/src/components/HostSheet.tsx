import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Crumbs, H, HubRow, hubStyles, type Tone } from "@/src/components/SettingsHub";
import { IconName } from "@/src/components/ui";
import { fonts } from "@/src/theme";

export type SheetSub = { key: string; title: string; icon: IconName; meta?: string; node: React.ReactNode };
export type SheetView = { title: string; tone: Tone; subs?: SheetSub[]; node?: React.ReactNode };

/** Bottom sheet with one level of subcategories. `view.node` = single panel, `view.subs` = list → panel. */
export function HostSheet({ view, subKey, onSub, onClose, direct }: { view: SheetView | null; subKey: string | null; onSub: (k: string | null) => void; onClose: () => void; direct?: boolean }) {
  const insets = useSafeAreaInsets();
  const sub = view?.subs?.find((x) => x.key === subKey) ?? null;
  const body = !view ? null : view.node ? view.node : sub ? sub.node : (
    <View style={hubStyles.group}>
      {view.subs?.map((x) => <HubRow key={x.key} testID={`hsub-${x.key}`} icon={x.icon} title={x.title} meta={x.meta} tone={view.tone} onPress={() => onSub(x.key)} />)}
    </View>
  );
  return (
    <Modal visible={!!view} transparent animationType="fade" onRequestClose={() => (sub ? onSub(null) : onClose())}>
      <Pressable style={s.backdrop} onPress={onClose} testID="host-sheet-backdrop">
        <Animated.View entering={SlideInDown.springify().damping(20)} style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={{ flex: 1 }}>
            <View style={s.grab} />
            {view ? (
              <View style={s.head}>
                {sub && direct ? <Text style={s.title}>{sub.title}</Text> : sub ? <Crumbs trail={[view.title, sub.title]} onBack={() => onSub(null)} /> : <Text style={s.title}>{view.title}</Text>}
                <Pressable testID="host-sheet-close" accessibilityLabel="Close" onPress={onClose} hitSlop={10} style={s.close}><Text style={s.closeX}>✕</Text></Pressable>
              </View>
            ) : null}
            <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{body}</ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { height: "86%", backgroundColor: "#0F1115", borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, borderColor: H.line, paddingHorizontal: 16 },
  grab: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", marginVertical: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14, minHeight: 38 },
  title: { flex: 1, fontFamily: fonts.text, fontSize: 20, fontWeight: "800", color: H.text },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  closeX: { color: H.text, fontSize: 13 },
});
