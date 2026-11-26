import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Stable React Navigation tabs while running inside Expo Go.
 *
 * Expo Router's experimental iOS NativeTabs can fail to activate a tab whose
 * first screen is a WebView when tested through the Expo Go host. The actual
 * installed build can continue using Liquid Glass NativeTabs.
 */
const insideExpoGo = String(Constants.executionEnvironment) === "storeClient";
export const usesNativeTabs =
  Platform.OS === "ios" &&
  Number.parseInt(String(Platform.Version), 10) >= 26 &&
  !insideExpoGo;
