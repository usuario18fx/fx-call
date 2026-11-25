// FX CALL — NOVA visual foundation.
// Keep the established theme API so authentication, calls and account logic stay unchanged.
import { useMemo } from "react";
import { Appearance, type ViewStyle, type TextStyle, type ImageStyle } from "react-native";
import { nova } from "@/src/nova/designTokens";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: nova.color.canvas,
  onSurface: "#CBD3D8",
  surfaceSecondary: nova.color.surfaceRaised,
  onSurfaceSecondary: nova.color.ink,
  surfaceTertiary: nova.color.stage,
  onSurfaceTertiary: "#BFC9CF",
  surfaceInverse: nova.color.ink,
  onSurfaceInverse: nova.color.canvas,
  muted: nova.color.muted,
  brand: nova.color.mint,
  onBrand: nova.color.mintInk,
  brandPrimary: nova.color.mint,
  onBrandPrimary: nova.color.mintInk,
  brandSecondary: "#123D38",
  onBrandSecondary: "#A5FFE8",
  brandTertiary: nova.color.mintSoft,
  onBrandTertiary: nova.color.mint,
  success: "#145C4F",
  onSuccess: "#9EF4D9",
  warning: "#5C3719",
  onWarning: "#FFDCAD",
  error: "#70262B",
  onError: "#FFDEE0",
  info: "#16465C",
  onInfo: "#A8ECF9",
  border: nova.color.line,
  borderStrong: nova.color.lineStrong,
  divider: nova.color.line,
  stage: "#000000",
  scrim: nova.color.scrim,
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light: dark, dark };
export const colors = dark;

export const fonts = {
  display: "DMSans",
  text: "DMSans",
};

export const spacing = nova.space;
// Rectangular surfaces keep subtle corners; buttons and pills intentionally follow NOVA's capsule shape.
export const radius = { sm: 4, md: 6, lg: 6, pill: 999 } as const;

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}
setColorScheme?.("dark");

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  return { scheme: "dark", colors: dark };
}

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

export function makeStyles<T extends NamedStyles<T>>(
  factory: (colors: ThemeColors) => T,
): () => T {
  return function useStyles(): T {
    const { colors: c } = useTheme();
    return useMemo(() => factory(c), [c]);
  };
}
