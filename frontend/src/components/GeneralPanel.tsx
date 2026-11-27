import Constants from "expo-constants";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { H, HubRow } from "@/src/components/SettingsHub";
import { LanguageSwitch } from "@/src/components/LanguageSwitch";
import { Icon, Logo } from "@/src/components/ui";
import { getStartTab, setStartTab, type StartTab } from "@/src/generalPreferences";
import { fonts } from "@/src/theme";

type Props = {
  onOpenStudio: () => void;
  onOpenMeetings: () => void;
  onOpenSecurity: () => void;
};

export function GeneralPanel({ onOpenStudio, onOpenMeetings, onOpenSecurity }: Props) {
  const [home, setHome] = useState<StartTab>("meetings");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void getStartTab().then((value) => {
      if (mounted) setHome(value);
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const chooseHome = async (next: StartTab) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await setStartTab(next);
      setHome(next);
    } catch {
      setError("Could not save this preference on your device. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View testID="general-settings-panel" style={styles.root}>
      <View style={styles.hero}>
        <View style={styles.heroBrand}>
          <View style={styles.logoFrame}><Logo size={48} /></View>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={styles.eyebrow}>FX CALL / NOVA CONTROL</Text>
            <Text style={styles.title}>General</Text>
            <Text style={styles.description}>Your workspace. Your defaults.</Text>
          </View>
        </View>
        <View style={styles.heroStatus}>
          <Icon name="shield-check" color={H.mint} size={15} />
          <Text style={styles.heroStatusText}>DEVICE SETTINGS</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>01 / STARTUP</Text>
        <Text style={styles.sectionTitle}>Open FX CALL to</Text>
        <Text style={styles.hint}>Choose the first screen shown after signing in. Stored on this device.</Text>
        <View style={styles.options}>
          {([{ key: "meetings", title: "Meetings", subtitle: "Your rooms & invitations", icon: "video" }, { key: "studio", title: "Studio", subtitle: "Camera & call setup", icon: "camera" }] as const).map((option) => (
            <Pressable
              key={option.key}
              testID={`general-home-${option.key}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: home === option.key, disabled: loading || saving }}
              disabled={loading || saving}
              onPress={() => { void chooseHome(option.key); }}
              style={({ pressed }) => [styles.option, home === option.key && styles.optionSelected, pressed && { opacity: 0.75 }]}
            >
              <View style={styles.optionIcon}><Icon name={option.icon} size={19} color={home === option.key ? H.mint : H.dim} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionMeta}>{option.subtitle}</Text>
              </View>
              <Icon name={home === option.key ? "circle-check" : "circle"} size={20} color={home === option.key ? H.mint : H.dim} />
            </Pressable>
          ))}
        </View>
        {error ? <Text style={styles.error} testID="general-save-error">{error}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>02 / LANGUAGE</Text>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.sectionTitle}>Call controls</Text>
            <Text style={styles.hint}>Changes labels in the Host & Call Dock components that support translation.</Text>
          </View>
          <Icon name="languages" size={20} color={H.mint} />
        </View>
        <LanguageSwitch />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>03 / WORKSPACE</Text>
        <Text style={styles.sectionTitle}>Quick access</Text>
        <View style={styles.list}>
          <HubRow testID="general-open-studio" icon="camera" title="Camera & Studio" meta="Local preview, camera and audio" onPress={onOpenStudio} />
          <HubRow testID="general-open-meetings" icon="video" title="Meetings & Rooms" meta="Create, manage and join rooms" onPress={onOpenMeetings} />
          <HubRow testID="general-open-security" icon="shield-check" title="Privacy & Security" meta="Account protection and device capabilities" onPress={onOpenSecurity} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>04 / ABOUT</Text>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutKey}>App version</Text>
          <Text style={styles.aboutValue}>{Constants.expoConfig?.version ?? "Unknown"}</Text>
        </View>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutKey}>Platform</Text>
          <Text style={styles.aboutValue}>{Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : "Web"}</Text>
        </View>
        <Text style={styles.bottomNote}>FX CALL · SECURITY FIRST / PRIVACY ALWAYS</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%", gap: 14 },
  hero: { backgroundColor: "#0D151D", borderColor: "#263D4B", borderWidth: 1, borderRadius: 6, padding: 17, gap: 16 },
  heroBrand: { flexDirection: "row", alignItems: "center", gap: 14 },
  logoFrame: { width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: 6, borderWidth: 1, borderColor: "#2E637E", backgroundColor: "#0B1B2B" },
  eyebrow: { fontFamily: fonts.text, fontSize: 10, letterSpacing: 1.6, color: H.mint, fontWeight: "700" },
  title: { fontFamily: fonts.display, fontSize: 30, letterSpacing: 3.5, color: H.text },
  description: { color: H.dim, fontFamily: fonts.text, fontSize: 12 },
  heroStatus: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#112820", alignSelf: "flex-start", borderWidth: 1, borderColor: "#275B50", borderRadius: 5, paddingHorizontal: 10, paddingVertical: 7 },
  heroStatusText: { color: H.mint, fontFamily: fonts.text, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  card: { borderWidth: 1, borderColor: "#283A46", backgroundColor: "#10171F", borderRadius: 6, padding: 17, gap: 12 },
  sectionLabel: { fontFamily: fonts.text, fontSize: 10, color: H.mint, letterSpacing: 1.8, fontWeight: "700" },
  sectionTitle: { fontFamily: fonts.text, fontSize: 17, fontWeight: "700", color: H.text },
  hint: { fontFamily: fonts.text, color: H.dim, lineHeight: 18, fontSize: 12 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { flexGrow: 1, flexBasis: "44%", minWidth: 145, flexDirection: "row", alignItems: "center", gap: 8, padding: 10, minHeight: 68, backgroundColor: "#0B121A", borderWidth: 1, borderColor: "#31414F", borderRadius: 6 },
  optionSelected: { backgroundColor: "#10302C", borderColor: H.mint },
  optionIcon: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 6, backgroundColor: "#172A35" },
  optionTitle: { fontFamily: fonts.text, fontSize: 13, color: H.text, fontWeight: "700" },
  optionMeta: { fontFamily: fonts.text, fontSize: 10, color: H.dim, marginTop: 4 },
  error: { fontFamily: fonts.text, color: "#FF9298", fontSize: 12 },
  rowBetween: { flexDirection: "row", alignItems: "center", gap: 10 },
  list: { borderWidth: 1, borderColor: "#2C4050", backgroundColor: "#0B1119", borderRadius: 6, overflow: "hidden" },
  aboutRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 6 },
  aboutKey: { fontFamily: fonts.text, fontSize: 12, color: H.dim },
  aboutValue: { fontFamily: fonts.text, fontSize: 12, color: H.text, fontWeight: "700" },
  bottomNote: { fontFamily: fonts.text, fontSize: 9, letterSpacing: 1.2, color: H.dim, marginTop: 8 },
});
