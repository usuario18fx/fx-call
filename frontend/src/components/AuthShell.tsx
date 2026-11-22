import { Image } from "expo-image";
import React from "react";
import { StyleSheet, View } from "react-native";

import { Screen } from "@/src/components/Screen";
import { Body, Card, Heading, Logo } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";

const HERO = "https://images.unsplash.com/photo-1710438399422-2fca27686bcd?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600";

/** Shared auth layout: matte texture, crown, small-caps title, solid card. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
      <Screen maxWidth={460} contentStyle={{ paddingTop: spacing.xl }} testID="auth-screen">
        <View style={styles.brand}>
          <Logo size={112} />
          <Heading size={30} style={{ color: colors.onSurfaceSecondary }}>FX Call</Heading>
          <Body style={{ color: colors.muted, letterSpacing: 2, fontSize: 11 }}>SECURITY FIRST · PRIVACY ALWAYS</Body>
        </View>
        <Card style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <Heading size={20}>{title}</Heading>
            {subtitle ? <Body style={{ color: colors.muted }}>{subtitle}</Body> : null}
          </View>
          {children}
        </Card>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  brand: { alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
});
