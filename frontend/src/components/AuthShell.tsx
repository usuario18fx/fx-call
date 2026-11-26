import React from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { Screen } from "@/src/components/Screen";
import { Body, Card, Heading, Logo } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";
import { nova } from "@/src/nova/designTokens";

/** Shared auth layout: matte texture, crown, small-caps title, solid card. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { height, width } = useWindowDimensions();
  const compact = height < 750 || width < 360;
  return (
    <View style={styles.root}>
      <Screen maxWidth={460} contentStyle={{ paddingTop: compact ? spacing.sm : spacing.xl, paddingBottom: spacing.lg, gap: compact ? spacing.md : spacing.lg }} testID="auth-screen">
        <View style={[styles.brand, { gap: compact ? spacing.xs : spacing.sm }]}>
          <Logo size={compact ? 88 : 104} />
          <Heading size={30} style={{ color: colors.onSurfaceSecondary }}>FX Call</Heading>
          <Body style={{ color: colors.muted, letterSpacing: 2, fontSize: 11 }}>SECURITY FIRST · PRIVACY ALWAYS</Body>
        </View>
        <Card style={styles.authPanel}>
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
  brand: { alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  authPanel: { gap: spacing.md, backgroundColor: nova.color.surfaceRaised, borderColor: nova.color.lineStrong, borderWidth: 1, borderRadius: 10 },
});
