// FX CALL design tokens — dark only (Matte Luxe). Keys match design_guidelines.json "color".
import { useMemo } from "react";
import { Appearance, type ViewStyle, type TextStyle, type ImageStyle } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#060A0E",
  onSurface: "#AFC3D0",
  surfaceSecondary: "#111A23",
  onSurfaceSecondary: "#F3F8FB",
  surfaceTertiary: "#17232D",
  onSurfaceTertiary: "#B9CEDA",
  surfaceInverse: "#EAECEF",
  onSurfaceInverse: "#0D0D0E",
  muted: "#7E8490",
  brand: "#2ED3B7",
  onBrand: "#06241F",
  brandPrimary: "#2ED3B7",
  onBrandPrimary: "#06241F",
  brandSecondary: "#0D5448",
  onBrandSecondary: "#E4FFF8",
  brandTertiary: "#102A30",
  onBrandTertiary: "#55E1C5",
  success: "#2D6A4F",
  onSuccess: "#D8F3DC",
  warning: "#B5651D",
  onWarning: "#FDF0D5",
  error: "#9E2A2B",
  onError: "#FFCAD4",
  info: "#145B89",
  onInfo: "#FFFFFF",
  border: "#263947",
  borderStrong: "#375269",
  divider: "#1C2D39",
  // video stage (always black regardless of theme)
  stage: "#000000",
  scrim: "rgba(13,13,14,0.72)",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light: dark, dark };
export const colors = dark;

export const fonts = {
  display: "Cormorant",
  text: "DMSans",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
// All corners must be <= 7px, including badges, icon buttons and overlays.
export const radius = { sm: 4, md: 6, lg: 6, pill: 6 } as const;

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
