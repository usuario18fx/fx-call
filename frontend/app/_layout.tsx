import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { usePreventScreenCapture } from "expo-screen-capture";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Platform, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/src/auth";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/ui";
import { queryClient } from "@/src/query-client";
import { colors } from "@/src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

// STRICT NO SCREEN SHARING: on the website, display capture can never be invoked by this app.
if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.mediaDevices) {
  try {
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      value: () => Promise.reject(new DOMException("Screen sharing is disabled in FX CALL", "NotAllowedError")),
      configurable: false,
      writable: false,
    });
  } catch {
    // already locked
  }
}

function NativeCaptureGuard() {
  // This component is only mounted on iOS/Android.
  // Calling usePreventScreenCapture on web throws: method unavailable.
  usePreventScreenCapture("fxcall-app");
  return null;
}

export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    Cormorant: require("../assets/fonts/CG.ttf"),
    DMSans: require("../assets/fonts/DMSans.ttf"),
  });

  useEffect(() => {
    if (loaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, fontError]);

  if (!loaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <KeyboardProvider>
              <AuthProvider>
                <ToastProvider>
                  <StatusBar style="light" />
                  {Platform.OS === "web" ? null : <NativeCaptureGuard />}
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface }, animation: "fade" }} />
                </ToastProvider>
              </AuthProvider>
            </KeyboardProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
});
