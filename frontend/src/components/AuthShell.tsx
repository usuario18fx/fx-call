import React from "react";
import { Platform, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Screen } from "@/src/components/Screen";
import { Body, Heading, Logo } from "@/src/components/ui";
import { spacing } from "@/src/theme";

const blue = "#286586";
const texture = Platform.OS === "web" ? ({
  backgroundImage: "radial-gradient(ellipse at 20% 15%, rgba(47,110,139,.16), transparent 53%), radial-gradient(ellipse at 88% 80%, rgba(3,10,18,.35), transparent 52%), repeating-linear-gradient(119deg, rgba(107,156,169,.035) 0px, rgba(107,156,169,.035) 1px, transparent 1px, transparent 5px)",
} as any) : {};

/** Crown-blue antique sign-in plate. Decorative views do not intercept touch. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { height, width } = useWindowDimensions();
  const compact = height < 950 || width < 420;
  return (
    <View style={styles.root}>
      <Screen maxWidth={520} contentStyle={{ paddingTop: compact ? 2 : spacing.lg, paddingBottom: spacing.sm, gap: compact ? 7 : spacing.md }} testID="auth-screen">
        <View style={[styles.brand, { gap: compact ? spacing.xs : spacing.sm }]}>
          <Logo size={compact ? 68 : 96} />
          <Heading size={compact ? 26 : 30} style={{ color: "#f1eee8", letterSpacing: 5 }}>FX CALL</Heading>
          <Body style={{ color: "#b2bac2", letterSpacing: 2, fontSize: 11 }}>SECURITY FIRST · PRIVACY ALWAYS</Body>
        </View>
        <View style={styles.frameWrap}>
          <View style={styles.outerFrame}>
            <View style={[styles.innerFrame, texture]}>
              <View style={styles.plate}>
                <View style={{ gap: spacing.xs }}>
                  <Heading size={compact ? 23 : 27} style={styles.heading}>{title.toUpperCase()}</Heading>
                  {subtitle ? <Body style={styles.subtitle}>{subtitle}</Body> : null}
                </View>
                {children}
              </View>
            </View>
          </View>
          <View pointerEvents="none" style={styles.topCrown}>
            <View style={styles.crownBacking}><Text style={styles.crownSymbol}>♛</Text></View>
          </View>
          <View pointerEvents="none" style={[styles.rivet, styles.topLeft]} />
          <View pointerEvents="none" style={[styles.rivet, styles.topRight]} />
          <View pointerEvents="none" style={[styles.rivet, styles.bottomLeft]} />
          <View pointerEvents="none" style={[styles.rivet, styles.bottomRight]} />
          <View pointerEvents="none" style={[styles.corner, styles.cornerTL]} />
          <View pointerEvents="none" style={[styles.corner, styles.cornerTR]} />
          <View pointerEvents="none" style={[styles.corner, styles.cornerBL]} />
          <View pointerEvents="none" style={[styles.corner, styles.cornerBR]} />
          <View pointerEvents="none" style={styles.bottomDiamond} />
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#03080e" },
  brand: { alignItems: "center", gap: spacing.xs, marginBottom: 1 },
  frameWrap: { marginTop: 9, marginBottom: 12, position: "relative" },
  outerFrame: {
    backgroundColor: "#123a50",
    borderWidth: 3,
    borderColor: "#2d6986",
    borderRadius: 18,
    padding: 5,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 7,
  },
  innerFrame: {
    backgroundColor: "#092334",
    borderWidth: 2,
    borderColor: "#14435c",
    borderRadius: 13,
    padding: 4,
  },
  plate: {
    backgroundColor: "rgba(5,22,34,0.35)",
    borderWidth: 1,
    borderColor: "rgba(66,124,150,0.3)",
    borderRadius: 7,
    paddingTop: 19,
    paddingHorizontal: 19,
    paddingBottom: 18,
    gap: 10,
  },
  heading: { color: "#eeeae4", letterSpacing: 3, fontFamily: "serif" },
  subtitle: { color: "#abb9c4" },
  topCrown: { position: "absolute", top: -20, alignSelf: "center", zIndex: 4 },
  crownBacking: {
    width: 65, height: 43, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: blue, borderRadius: 7, backgroundColor: "#09283c",
  },
  crownSymbol: { color: "#3985a5", fontSize: 35, lineHeight: 42, textAlign: "center", textShadowColor: "#061521", textShadowRadius: 2 },
  rivet: {
    width: 17, height: 17, borderRadius: 9, position: "absolute",
    borderWidth: 3, borderColor: "#266a8d", backgroundColor: "#051b2c", zIndex: 4,
  },
  topLeft: { top: 18, left: 16 },
  topRight: { top: 18, right: 16 },
  bottomLeft: { bottom: 18, left: 16 },
  bottomRight: { bottom: 18, right: 16 },
  corner: {
    width: 55, height: 55, position: "absolute", borderColor: "#296b89",
    borderWidth: 0, zIndex: 3,
  },
  cornerTL: { top: 7, left: 8, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 44 },
  cornerTR: { top: 7, right: 8, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 44 },
  cornerBL: { bottom: 7, left: 8, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 44 },
  cornerBR: { bottom: 7, right: 8, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 44 },
  bottomDiamond: {
    width: 27, height: 27, backgroundColor: "#123c53", borderRightWidth: 2,
    borderBottomWidth: 2, borderColor: blue, transform: [{ rotate: "45deg" }],
    position: "absolute", bottom: -12, alignSelf: "center", zIndex: -1,
  },
});
