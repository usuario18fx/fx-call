import { Image } from "expo-image";
import { Lucide } from "@react-native-vector-icons/lucide";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle,
} from "react-native";
import Animated, { FadeInDown, FadeOutUp, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, radius, spacing } from "@/src/theme";

export const Icon = Lucide;
export type IconName = React.ComponentProps<typeof Lucide>["name"];

export const LOGO = require("../../assets/images/logo.png");

export function Logo({ size = 96 }: { size?: number }) {
  return <Image testID="fx-logo" source={LOGO} style={{ width: size, height: size }} contentFit="contain" accessibilityLabel="FX CALL crown logo" />;
}

export function Heading({ children, size = 24, style, testID }: { children: React.ReactNode; size?: number; style?: StyleProp<TextStyle>; testID?: string }) {
  return (
    <Text testID={testID} style={[{ fontFamily: fonts.display, fontSize: size, color: colors.onSurfaceSecondary, textTransform: "uppercase", letterSpacing: size * 0.12 }, style]}>
      {children}
    </Text>
  );
}

export function Label({ children, style, color = colors.muted }: { children: React.ReactNode; style?: StyleProp<TextStyle>; color?: string }) {
  return <Text style={[s.label, { color }, style]}>{children}</Text>;
}

export function Body({ children, style, testID, numberOfLines, selectable }: { children: React.ReactNode; style?: StyleProp<TextStyle>; testID?: string; numberOfLines?: number; selectable?: boolean }) {
  return <Text testID={testID} numberOfLines={numberOfLines} selectable={selectable} style={[s.body, style]}>{children}</Text>;
}

type BtnProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  testID: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

export function Button({ label, onPress, variant = "primary", icon, loading, disabled, testID, style, compact }: BtnProps) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const palette = {
    primary: { bg: colors.brandPrimary, fg: colors.onBrandPrimary, border: colors.brandPrimary },
    secondary: { bg: colors.surfaceSecondary, fg: colors.onSurfaceSecondary, border: colors.borderStrong },
    danger: { bg: colors.error, fg: colors.onError, border: colors.error },
    ghost: { bg: "transparent", fg: colors.onSurface, border: colors.borderStrong },
  }[variant];
  const off = disabled || loading;
  return (
    <Animated.View style={[anim, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        disabled={off}
        onPress={onPress}
        onPressIn={() => (scale.value = withTiming(0.97, { duration: 90 }))}
        onPressOut={() => (scale.value = withTiming(1, { duration: 140 }))}
        style={[s.btn, compact && s.btnCompact, { backgroundColor: palette.bg, borderColor: palette.border, opacity: off ? 0.5 : 1 }]}
      >
        {loading ? <ActivityIndicator color={palette.fg} /> : icon ? <Icon name={icon} size={compact ? 16 : 18} color={palette.fg} /> : null}
        <Text style={[s.btnText, { color: palette.fg }, compact && { fontSize: 13 }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function IconButton({ icon, onPress, testID, tone = "default", size = 52, label, active }: {
  icon: IconName; onPress: () => void; testID: string; tone?: "default" | "danger" | "brand"; size?: number; label: string; active?: boolean;
}) {
  const bg = tone === "danger" ? colors.error : tone === "brand" || active ? colors.brandPrimary : colors.surfaceSecondary;
  const fg = tone === "danger" ? colors.onError : colors.onSurfaceSecondary;
  return (
    <Pressable testID={testID} accessibilityLabel={label} accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: radius.md, backgroundColor: bg, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
      <Icon name={icon} size={size * 0.42} color={fg} />
    </Pressable>
  );
}

export function Field({ label, error, testID, style, inputStyle, ...rest }: TextInputProps & { label: string; error?: string | null; testID: string; inputStyle?: StyleProp<TextStyle> }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ gap: spacing.xs }, style as any]}>
      <Label>{label}</Label>
      <TextInput
        testID={testID}
        placeholderTextColor={colors.muted}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={[s.input, inputStyle, { borderColor: error ? colors.error : focus ? colors.brandPrimary : colors.border }]}
        {...rest}
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <View testID={testID} style={[s.card, style]}>{children}</View>;
}

export function Badge({ label, tone = "neutral", icon, testID }: { label: string; tone?: "neutral" | "success" | "warning" | "error" | "brand"; icon?: IconName; testID?: string }) {
  const p = {
    neutral: [colors.surfaceTertiary, colors.onSurfaceTertiary],
    success: [colors.success, colors.onSuccess],
    warning: [colors.warning, colors.onWarning],
    error: [colors.error, colors.onError],
    brand: [colors.brandTertiary, colors.onBrandTertiary],
  }[tone];
  return (
    <View testID={testID} style={[s.badge, { backgroundColor: p[0] }]}>
      {icon ? <Icon name={icon} size={12} color={p[1]} /> : null}
      <Text style={[s.badgeText, { color: p[1] }]}>{label}</Text>
    </View>
  );
}

export function ErrorText({ children, testID }: { children?: string | null; testID?: string }) {
  if (!children) return null;
  return <Text testID={testID} style={s.error}>{children}</Text>;
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginVertical: spacing.sm }} />;
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={s.center} testID="loading-state">
      <ActivityIndicator color={colors.onSurface} />
      {label ? <Label style={{ marginTop: spacing.md }}>{label}</Label> : null}
    </View>
  );
}

// ---------------------------------------------------------------- toasts
type Toast = { id: number; text: string; tone: "info" | "error" | "success" | "warning" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const insets = useSafeAreaInsets();
  const show = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <View pointerEvents="none" style={[s.toastWrap, { top: insets.top + spacing.sm }]}>
        {toasts.map((t) => {
          const bg = { info: colors.surfaceInverse, error: colors.error, success: colors.success, warning: colors.warning }[t.tone];
          const fg = { info: colors.onSurfaceInverse, error: colors.onError, success: colors.onSuccess, warning: colors.onWarning }[t.tone];
          return (
            <Animated.View key={t.id} entering={FadeInDown.duration(220)} exiting={FadeOutUp.duration(200)} style={[s.toast, { backgroundColor: bg }]} testID="toast-message">
              <Text style={[s.body, { color: fg }]}>{t.text}</Text>
            </Animated.View>
          );
        })}
      </View>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

export const s = StyleSheet.create({
  label: { fontFamily: fonts.text, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase" },
  body: { fontFamily: fonts.text, fontSize: 14, color: colors.onSurface, lineHeight: 20 },
  btn: { minHeight: 50, borderRadius: radius.pill, paddingHorizontal: spacing.xl, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderWidth: 1 },
  btnCompact: { minHeight: 40, paddingHorizontal: spacing.lg },
  btnText: { fontFamily: fonts.text, fontSize: 14, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase" },
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, backgroundColor: colors.surfaceTertiary, color: colors.onSurfaceSecondary, paddingHorizontal: spacing.lg, fontFamily: fonts.text, fontSize: 15 },
  error: { fontFamily: fonts.text, fontSize: 13, color: colors.onError },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, height: 24, borderRadius: radius.pill, alignSelf: "flex-start", flexShrink: 0 },
  badgeText: { fontFamily: fonts.text, fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: colors.surface },
  toastWrap: { position: "absolute", left: spacing.lg, right: spacing.lg, alignItems: "center", gap: spacing.sm },
  toast: { maxWidth: 520, width: "100%", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
});
