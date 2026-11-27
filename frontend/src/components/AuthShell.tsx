import React from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { Screen } from "@/src/components/Screen";
import { Body, Heading, Logo } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";

/** Antique crown-blue, matte auth shell. Shared across web, iOS and Android. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { height, width } = useWindowDimensions();
  const compact = height < 750 || width < 360;
  return (
    <View style={styles.root}>
      <Screen maxWidth={560} contentStyle={{ paddingTop: compact ? spacing.sm : spacing.xl, paddingBottom: spacing.lg, gap: compact ? spacing.md : spacing.lg }} testID="auth-screen">
        <View style={[styles.brand, { gap: compact ? spacing.xs : spacing.sm }]}>
          <Logo size={compact ? 88 : 104} />
          <Heading size={30} style={{ color: "#f1eee8", letterSpacing: 5 }}>FX CALL</Heading>
          <Body style={{ color: "#a2abb5", letterSpacing: 2, fontSize: 11 }}>SECURITY FIRST · PRIVACY ALWAYS</Body>
        </View>
        <View style={styles.outerFrame}>
          <View style={styles.innerFrame}>
            <View style={styles.plate}>
              <View style={styles.topLine} />
              <View style={{ gap: spacing.xs }}>
                <Heading size={compact ? 22 : 25} style={styles.heading}>{title.toUpperCase()}</Heading>
                {subtitle ? <Body style={styles.subtitle}>{subtitle}</Body> : null}
              </View>
              {children}
            </View>
          </View>
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05090d" },
  brand: { alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  outerFrame: {
    backgroundColor: "#10354b",
    borderWidth: 2,
    borderColor: "#225c7b",
    borderRadius: 6,
    padding: 5,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 7,
  },
  innerFrame: {
    backgroundColor: "#092235",
    borderWidth: 1,
    borderColor: "#34718c",
    borderRadius: 4,
    padding: 3,
  },
  plate: {
    backgroundColor: "#0b2739",
    borderWidth: 1,
    borderColor: "#16435b",
    borderRadius: 2,
    padding: 18,
    gap: spacing.md,
  },
  topLine: {
    height: 2,
    backgroundColor: "#1a4c65",
    opacity: 0.6,
    marginBottom: 3,
  },
  heading: {
    color: "#eeeae4",
    letterSpacing: 3,
    fontFamily: "serif",
  },
  subtitle: { color: "#abb9c4" },
});
