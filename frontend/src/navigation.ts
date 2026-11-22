import { Platform } from "react-native";

// NativeTabs (Liquid Glass) only on iOS 26+; everything else uses classic JS tabs.
export const usesNativeTabs = Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
