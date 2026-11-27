import AsyncStorage from "@react-native-async-storage/async-storage";

export const GENERAL_PREFERENCES_KEY = "@fxcall/general/v1";
export type StartTab = "meetings" | "studio";

export async function getStartTab(): Promise<StartTab> {
  try {
    const value = await AsyncStorage.getItem(GENERAL_PREFERENCES_KEY);
    return value === "studio" ? "studio" : "meetings";
  } catch {
    return "meetings";
  }
}

export async function setStartTab(value: StartTab): Promise<void> {
  await AsyncStorage.setItem(GENERAL_PREFERENCES_KEY, value);
}
