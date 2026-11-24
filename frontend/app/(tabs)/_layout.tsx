import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

import { Icon } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { colors, fonts } from "@/src/theme";

export default function TabsLayout() {
  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.onSurfaceSecondary}>
        <NativeTabs.Trigger name="studio">
          <NativeTabs.Trigger.Icon sf="camera.fill" />
          <NativeTabs.Trigger.Label>Studio</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="meetings">
          <NativeTabs.Trigger.Icon sf="video.fill" />
          <NativeTabs.Trigger.Label>Meetings</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="account">
          <NativeTabs.Trigger.Icon sf="person.crop.circle" />
          <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onSurfaceSecondary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surfaceTertiary, borderTopColor: colors.border, ...(Platform.OS === "web" ? { height: 64 } : {}) },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.text, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
      }}
    >
      <Tabs.Screen name="studio" options={{ title: "Studio", tabBarIcon: ({ color }) => <Icon name="video" size={22} color={color} /> }} />
      <Tabs.Screen name="meetings" options={{ title: "Meetings", tabBarButtonTestID: "tab-meetings", tabBarIcon: ({ color }) => <Icon name="video" size={22} color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarButtonTestID: "tab-account", tabBarIcon: ({ color }) => <Icon name="circle-user-round" size={22} color={color} /> }} />
    </Tabs>
  );
}
