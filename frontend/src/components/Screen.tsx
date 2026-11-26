import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Heading, Icon } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";
import { nova } from "@/src/nova/designTokens";

type Props = {
  title?: string;
  back?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  maxWidth?: number;
  bottomPad?: number;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<any>;
  testID?: string;
};

/** Full-bleed dark screen with a sticky, safe-area aware header and a centered max-width column for web. */
export function Screen({ title, back, right, children, scroll = true, maxWidth = 1100, bottomPad, contentStyle, refreshControl, testID }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const header = title || back || right ? (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={[styles.headerInner, { maxWidth }]}>
        {back ? (
          <Pressable testID="header-back-button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.back} hitSlop={8}>
            <Icon name="chevron-left" size={24} color={colors.onSurfaceSecondary} />
          </Pressable>
        ) : null}
        {title ? <Heading size={22} style={{ flex: 1 }}>{title}</Heading> : <View style={{ flex: 1 }} />}
        {right}
      </View>
    </View>
  ) : null;
  const pad = bottomPad ?? insets.bottom + spacing.xl;
  const inner = <View style={[styles.content, { maxWidth }, contentStyle]}>{children}</View>;
  const scrollContent = [
    styles.scrollContent,
    { paddingBottom: pad, paddingTop: header ? spacing.md : insets.top + spacing.lg },
  ];
  return (
    <View style={styles.root} testID={testID}>
      <LinearGradient
        pointerEvents="none"
        colors={["#101B25", "#090F16", nova.color.canvas]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {header}
      {scroll ? Platform.OS === "web" ? (
        <ScrollView
          style={styles.scroller}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          contentContainerStyle={scrollContent}
        >
          {inner}
        </ScrollView>
      ) : (
        <KeyboardAwareScrollView
          style={styles.scroller}
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          refreshControl={refreshControl}
          contentContainerStyle={scrollContent}
        >
          {inner}
        </KeyboardAwareScrollView>
      ) : (
        <View style={[styles.fixedContent, { paddingBottom: pad }]}>{inner}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: colors.surface },
  scroller: { flex: 1, minHeight: 0 },
  scrollContent: { flexGrow: 1 },
  fixedContent: { flex: 1, minHeight: 0 },
  header: { backgroundColor: "rgba(5,6,7,0.82)", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, paddingBottom: spacing.md, paddingHorizontal: spacing.lg },
  headerInner: { width: "100%", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44 },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -spacing.sm },
  content: { width: "100%", alignSelf: "center", paddingHorizontal: spacing.lg, gap: spacing.lg },
});
