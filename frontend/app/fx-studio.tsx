/**
 * FX CALL / STUDIO — non-destructive route.
 * NAV only uses existing auth, room creation, join-link and profile routes.
 * No fake call, broadcast, recording, screen sharing or security indicators.
 */
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text,
  TextInput, useWindowDimensions, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Icon, Logo } from "@/src/components/ui";

const C = {
  bg: "#04070B", edge: "#243D53", accent: "#249ADB", accentSoft: "#143B58",
  accent2: "#42B9ED", ink: "#EDF4FB", muted: "#8193A4", steel: "#111D29",
  black: "#050608", danger: "#A83D45", divider: "#22313E",
};
type Mode = "host" | "join";
type Section = "identity" | "camera" | "audio" | "private" | "live" | "privacy" | "notifications" | "appearance" | "accessibility" | "network" | "advanced";
const SECTIONS: { id: Section; label: string; subtitle: string }[] = [
  { id: "identity", label: "Account & profile", subtitle: "Existing FX CALL account" },
  { id: "camera", label: "Camera & video", subtitle: "Local camera preview" },
  { id: "audio", label: "Audio", subtitle: "Call audio settings" },
  { id: "private", label: "Private meetings", subtitle: "Invitations and host approval" },
  { id: "live", label: "Live broadcasting", subtitle: "Disabled — private calls only" },
  { id: "privacy", label: "Privacy & security", subtitle: "Platform capabilities" },
  { id: "notifications", label: "Notifications", subtitle: "Current FX CALL options" },
  { id: "appearance", label: "Appearance", subtitle: "Crown visual system" },
  { id: "accessibility", label: "Accessibility", subtitle: "Platform accessibility" },
  { id: "network", label: "Network & performance", subtitle: "Real-time call diagnostics" },
  { id: "advanced", label: "Advanced", subtitle: "Existing FX CALL controls" },
];
const R = 6;
function Pill({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[s.pill, active && s.pillSelected]}>
    <Text style={[s.pillText, active && { color: C.ink }]}>{label}</Text>
  </Pressable>;
}
function Action({ label, icon, onPress, primary = false, disabled = false }: {
  label: string; icon?: React.ComponentProps<typeof Icon>["name"];
  onPress: () => void; primary?: boolean; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={[s.action, primary && s.primary, disabled && { opacity: 0.5 }]}>
    {icon ? <Icon name={icon} color={primary ? C.black : C.ink} size={17}/> : null}
    <Text style={[s.actionText, primary && { color: C.black }]}>{label}</Text>
  </Pressable>;
}

export default function FXStudio() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const { width, height } = useWindowDimensions();
  const safe = useSafeAreaInsets();
  const desktop = width >= 800;
  const [mode, setMode] = useState<Mode>("host");
  const [open, setOpen] = useState(false);
  const [command, setCommand] = useState(false);
  const [section, setSection] = useState<Section>("identity");
  const [search, setSearch] = useState("");
  const [roomTitle, setRoomTitle] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [cameraPermission, askCamera] = useCameraPermissions();
  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState<"front" | "back">("front");

  const filtered = useMemo(() => SECTIONS.filter(c =>
    `${c.label} ${c.subtitle}`.toLowerCase().includes(search.toLowerCase())
  ), [search]);

  const showCamera = async () => {
    if (cameraOn) return setCameraOn(false);
    try {
      const permission = cameraPermission?.granted ? cameraPermission : await askCamera();
      if (!permission?.granted) { setMessage("Camera permission is required for local preview."); return; }
      setCameraOn(true);
      setMessage("");
    } catch { setMessage("Could not enable camera preview."); }
  };
  const createRoom = async () => {
    if (!user) return router.replace("/auth/login");
    setWorking(true); setMessage("");
    try {
      const r = await api<{ id: string }>("/rooms", { body: { title: roomTitle.trim() || "Private meeting" } });
      setOpen(false);
      router.push(`/host/${r.id}`);
    } catch (error: any) {
      setMessage(error?.message || "Could not create the private room.");
    } finally { setWorking(false); }
  };
  const joinRoom = () => {
    const text = inviteLink.trim();
    const found = text.match(/\/room\/([A-Za-z0-9_-]{16,64})(?:[?#]|$)/);
    const token = found?.[1] || (/^[A-Za-z0-9_-]{16,64}$/.test(text) ? text : null);
    if (!token) { setMessage("Paste a valid FX CALL invitation link."); return; }
    setOpen(false);
    router.push(`/room/${token}`);
  };
  const goHome = () => router.push("/(tabs)/meetings");
  const goAccount = () => router.push("/(tabs)/account");
  const executeSetting = () => {
    setCommand(false);
    if (section === "identity" || section === "privacy") goAccount();
    else if (section === "private") goHome();
    else if (section === "camera") void showCamera();
    else if (section === "live") setMessage("Public broadcasting is not enabled in FX CALL.");
    else setMessage("Use the settings inside an active FX CALL call for this feature.");
  };
  if (!ready) return <View style={s.loading}><ActivityIndicator color={C.accent}/></View>;
  if (!user) return <View style={s.loading}><Text style={s.body}>Sign in to use FX CALL Studio.</Text>
    <Action label="Sign in" icon="log-in" primary onPress={() => router.replace("/auth/login")}/></View>;
  const big = desktop && height >= 600;
  return <View testID="fx-studio-screen" style={[s.root, { paddingTop: safe.top + 6, paddingBottom: safe.bottom + 8 }]}>
    <View style={[s.stage, { marginHorizontal: desktop ? 18 : 8, marginTop: 2 }]}>
      <View style={StyleSheet.absoluteFill}>
        {cameraOn && cameraPermission?.granted
          ? <CameraView style={StyleSheet.absoluteFill} facing={facing} mirror={facing === "front"}/>
          : <View style={s.noCamera}><View style={s.cameraGlow}/>
              <View style={[s.humanHead, { width: desktop ? 108 : 78, height: desktop ? 122 : 92 }]}/>
              <View style={[s.humanBody, { width: desktop ? 300 : 210, height: desktop ? 230 : 180 }]}/>
            </View>}
      </View>
      <View pointerEvents="none" style={s.stageShade}/>
      <View style={[s.top, { paddingHorizontal: desktop ? 22 : 14 }]}>
        <Pressable onPress={goAccount} style={s.brand} accessibilityLabel="Open profile">
          <Logo size={42}/>
          <View><Text style={s.micro}>FX CALL · STUDIO</Text><Text style={s.username} numberOfLines={1}>{user.display_name || "Member"}</Text></View>
        </Pressable>
        <View style={s.state}><View style={s.signal}/><Text style={s.micro}>LOCAL PREVIEW</Text></View>
        <Pressable onPress={() => setCommand(true)} style={s.settingsTop} accessibilityLabel="Open Command Center">
          <Text style={s.micro}>SETTINGS</Text><Icon name="arrow-up-right" size={16} color={C.accent2}/>
        </Pressable>
      </View>
      {big ? <View style={s.focusCorners} pointerEvents="none"><View style={s.cornerTL}/><View style={s.cornerTR}/><View style={s.cornerBL}/><View style={s.cornerBR}/></View> : null}
      <View style={s.rail}>
        <Pressable onPress={() => void showCamera()} accessibilityLabel={cameraOn ? "Turn off camera preview" : "Enable camera preview"} style={[s.railControl, cameraOn && s.railActive]}><Icon name={cameraOn ? "video" : "video-off"} size={22} color={C.ink}/></Pressable>
        <Pressable onPress={() => cameraOn ? setFacing(v => v === "front" ? "back" : "front") : setMessage("Enable the camera first.")} accessibilityLabel="Flip camera" style={s.railControl}><Icon name="switch-camera" size={21} color={C.ink}/></Pressable>
        <Pressable onPress={goHome} accessibilityLabel="Open meetings" style={s.railControl}><Icon name="users" size={21} color={C.ink}/></Pressable>
        <Pressable onPress={() => setCommand(true)} accessibilityLabel="Open settings" style={s.railControl}><Icon name="settings" size={21} color={C.ink}/></Pressable>
      </View>
      <View style={s.stageFooter}><View style={s.signal}/><Text style={s.footerText}>CAMERA {cameraOn ? "PREVIEW ON" : "OFF"} · NO RECORDING</Text></View>
      <View pointerEvents="none" style={s.hint}><Text style={s.micro}>SELECT A PRIVATE MODE · OPEN THE CENTER PANEL</Text></View>
      <View style={[s.dial, desktop && { width: 640 }]}>
        <Pressable onPress={() => setMode("host")} style={[s.modeOption, mode === "host" && s.modeActive]}>
          <Text style={s.modeNum}>01</Text><View><Text style={s.modeName}>HOST ROOM</Text><Text style={s.modeSubtitle}>Invitation only</Text></View>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setMessage(""); setOpen(true); }} style={s.core}>
          <Text style={s.coreCaption}>OPEN</Text><Text style={s.coreTitle}>{mode === "host" ? "HOST" : "JOIN"}</Text><Text style={s.coreArrow}>↗</Text>
        </Pressable>
        <Pressable onPress={() => setMode("join")} style={[s.modeOption, mode === "join" && s.modeActive]}>
          <Text style={s.modeNum}>02</Text><View><Text style={s.modeName}>PRIVATE</Text><Text style={s.modeSubtitle}>Join by link</Text></View>
        </Pressable>
      </View>
    </View>
    {message ? <Text accessibilityRole="alert" style={s.feedback}>{message}</Text> : null}

    <Modal transparent visible={open} onRequestClose={() => setOpen(false)} animationType="fade">
      <View style={s.scrim}><ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
        <View style={s.modalPanel}>
          <Pressable accessibilityLabel="Close" style={s.modalClose} onPress={() => setOpen(false)}><Icon name="x" color={C.ink} size={20}/></Pressable>
          <Text style={s.micro}>FX CALL · SECURE CONNECTION</Text>
          <Text style={s.panelTitle}>{mode === "host" ? "HOST PRIVATE ROOM" : "JOIN PRIVATE ROOM"}</Text>
          <Text style={s.panelHint}>{mode === "host" ? "Guests can join only with a private invitation and your approval." : "Enter the private invitation issued by your host."}</Text>
          <Text style={s.fieldLabel}>{mode === "host" ? "MEETING NAME" : "INVITATION LINK"}</Text>
          <TextInput value={mode === "host" ? roomTitle : inviteLink} onChangeText={mode === "host" ? setRoomTitle : setInviteLink}
            placeholder={mode === "host" ? "Private meeting" : "https://…/room/…"}
            placeholderTextColor={C.muted} style={s.input} autoCapitalize="none" selectionColor={C.accent2}/>
          {message ? <Text style={s.warning}>{message}</Text> : null}
          <Action icon={mode === "host" ? "shield-check" : "log-in"} label={working ? "CONNECTING…" : mode === "host" ? "CREATE PRIVATE ROOM" : "JOIN BY INVITATION"} primary disabled={working} onPress={mode === "host" ? () => void createRoom() : joinRoom}/>
        </View>
      </ScrollView></View>
    </Modal>
    <Modal transparent visible={command} onRequestClose={() => setCommand(false)} animationType="slide">
      <View style={s.commandRoot}>
        <View style={s.commandHeader}><Pressable onPress={() => setCommand(false)} style={s.commandBack}><Icon name="arrow-left" size={17} color={C.ink}/><Text style={s.small}> STUDIO</Text></Pressable>
          <View style={{ flex: 1 }}><Text style={s.micro}>FX CALL / CONTROL</Text><Text style={s.commandTitle}>COMMAND CENTER</Text></View>
          <Pressable onPress={() => setCommand(false)} style={s.commandBack}><Icon name="x" size={17} color={C.ink}/></Pressable>
        </View>
        <View style={s.searchBar}><Icon name="search" size={17} color={C.muted}/><TextInput value={search} onChangeText={setSearch} style={s.searchInput} placeholder="Search settings…" placeholderTextColor={C.muted}/></View>
        <View style={[s.commandBody, { flexDirection: desktop ? "row" : "column" }]}>
          <ScrollView style={[s.catRail, desktop ? { width: 270, flexGrow: 0 } : { flexGrow: 0, maxHeight: 188 }]} horizontal={!desktop} contentContainerStyle={desktop ? { gap: 6 } : { flexDirection: "row", gap: 6 }}>
            {filtered.map((item, i) => <Pressable key={item.id} onPress={() => setSection(item.id)} style={[s.catButton, section === item.id && s.catActive]}><Text style={s.catNum}>{String(i + 1).padStart(2, "0")}</Text><Text style={[s.small, { color: section === item.id ? C.ink : C.muted }]}>{item.label}</Text></Pressable>)}
          </ScrollView>
          <ScrollView contentContainerStyle={s.settingContent} style={{ flex: 1 }}>
            <Text style={s.micro}>MODULE · {section.toUpperCase()}</Text>
            <Text style={s.panelTitle}>{SECTIONS.find(item => item.id === section)?.label}</Text>
            <Text style={s.panelHint}>{SECTIONS.find(item => item.id === section)?.subtitle}</Text>
            <View style={s.settingCard}><Text style={s.fieldLabel}>EXISTING FX CALL FUNCTION</Text>
              <Text style={s.body}>{section === "identity" ? "Profile, email, password and trusted sessions remain in your existing verified account." :
                section === "private" ? "Invite-only rooms, host approvals and LiveKit call controls use your current app." :
                section === "privacy" ? "Screen sharing is disabled. Browser screenshot detection is not supported." :
                section === "camera" ? "Preview your local camera. Call camera and microphone controls stay inside LiveKit." :
                section === "live" ? "Public broadcasting is not enabled. FX CALL remains invitation-only and private." :
                "These controls are available inside the active call or current app settings. This panel does not simulate saving unsupported preferences."}</Text>
              <View style={{ marginTop: 18 }}><Action icon="arrow-up-right" primary label={section === "identity" || section === "privacy" ? "OPEN ACCOUNT" : section === "private" ? "OPEN MEETINGS" : section === "camera" ? "TOGGLE LOCAL PREVIEW" : "RETURN TO STUDIO"} onPress={executeSetting}/></View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: C.bg },
  stage: { flex: 1, minHeight: 350, backgroundColor: C.black, overflow: "hidden", borderWidth: 1, borderColor: C.edge, borderRadius: R },
  noCamera: { flex: 1, alignItems: "center", justifyContent: "flex-end", backgroundColor: "#0A141E", overflow: "hidden" },
  cameraGlow: { position: "absolute", top: "8%", width: "110%", height: "80%", backgroundColor: "rgba(25,88,132,.12)" },
  humanHead: { backgroundColor: "#273846", borderRadius: R, borderWidth: 1, borderColor: "#435263", marginBottom: -8 },
  humanBody: { backgroundColor: "#1D2B37", borderRadius: R, borderWidth: 1, borderColor: "#435263" },
  stageShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,.19)" },
  top: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "space-between", paddingVertical: 13, backgroundColor: "rgba(3,5,8,.67)" },
  brand: { flexDirection: "row", alignItems: "center", flexShrink: 1, gap: 9, minWidth: 0 },
  micro: { color: C.muted, fontSize: 9, fontWeight: "700", letterSpacing: 1.1 },
  username: { color: C.ink, fontSize: 13, fontWeight: "700", maxWidth: 115 },
  state: { flexDirection: "row", alignItems: "center", borderRadius: R, borderWidth: 1, borderColor: C.divider, padding: 8, gap: 8 },
  signal: { height: 6, width: 6, backgroundColor: C.accent2, borderRadius: 3 },
  settingsTop: { padding: 10, borderRadius: R, borderWidth: 1, borderColor: C.divider, flexDirection: "row", alignItems: "center", gap: 5 },
  rail: { position: "absolute", right: 12, top: "29%", backgroundColor: "rgba(2,5,9,.88)", borderColor: C.edge, borderWidth: 1, borderRadius: R, gap: 3, padding: 4 },
  railControl: { padding: 10, borderRadius: R, borderWidth: 1, borderColor: "transparent" },
  railActive: { borderColor: C.accent },
  focusCorners: { position: "absolute", top: 85, bottom: 135, left: 80, right: 85 },
  cornerTL: { position: "absolute", top: 0, left: 0, width: 30, height: 30, borderTopWidth: 1, borderLeftWidth: 1, borderColor: C.muted },
  cornerTR: { position: "absolute", top: 0, right: 0, width: 30, height: 30, borderTopWidth: 1, borderRightWidth: 1, borderColor: C.muted },
  cornerBL: { position: "absolute", bottom: 0, left: 0, width: 30, height: 30, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: C.muted },
  cornerBR: { position: "absolute", bottom: 0, right: 0, width: 30, height: 30, borderBottomWidth: 1, borderRightWidth: 1, borderColor: C.muted },
  stageFooter: { position: "absolute", left: 18, bottom: 124, flexDirection: "row", alignItems: "center", gap: 8 },
  footerText: { color: C.ink, fontSize: 10 },
  hint: { position: "absolute", bottom: 105, alignSelf: "center" },
  dial: { position: "absolute", bottom: 12, alignSelf: "center", width: "96%", height: 89, borderRadius: R, borderWidth: 1, borderColor: C.edge, backgroundColor: "rgba(2,5,10,.95)", flexDirection: "row", alignItems: "center", padding: 6 },
  modeOption: { flex: 1, minWidth: 0, height: "100%", paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: R },
  modeActive: { backgroundColor: "rgba(22,100,152,.3)", borderWidth: 1, borderColor: C.accentSoft },
  modeNum: { fontSize: 9, color: C.accent2, fontWeight: "800" },
  modeName: { fontSize: 11, color: C.ink, fontWeight: "800" },
  modeSubtitle: { fontSize: 9, color: C.muted },
  core: { width: 76, height: 76, borderRadius: R, alignItems: "center", justifyContent: "center", backgroundColor: C.accent2, borderWidth: 2, borderColor: "#66C7F6" },
  coreCaption: { color: C.black, fontSize: 8, fontWeight: "700", letterSpacing: 1 },
  coreTitle: { color: C.black, fontSize: 16, fontWeight: "900" },
  coreArrow: { color: C.black, fontSize: 14 },
  feedback: { color: "#F1AFB7", fontSize: 12, padding: 9 },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,.86)", justifyContent: "center" },
  modalScroll: { flexGrow: 1, justifyContent: "center", padding: 20 },
  modalPanel: { maxWidth: 700, width: "100%", alignSelf: "center", backgroundColor: C.steel, borderRadius: R, padding: 24, borderColor: C.edge, borderWidth: 1, gap: 16 },
  modalClose: { alignSelf: "flex-end", padding: 5 },
  panelTitle: { color: C.ink, fontSize: 24, fontWeight: "800", letterSpacing: 0.2 },
  panelHint: { color: C.muted, fontSize: 13, lineHeight: 20 },
  fieldLabel: { color: C.muted, fontSize: 10, letterSpacing: 1.5, fontWeight: "800" },
  input: { width: "100%", borderBottomWidth: 1, borderColor: C.accent, paddingVertical: 12, fontSize: 17, color: C.ink },
  action: { borderRadius: R, minHeight: 47, borderWidth: 1, borderColor: C.edge, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 14 },
  primary: { backgroundColor: C.accent2, borderColor: C.accent2 },
  actionText: { color: C.ink, fontSize: 11, letterSpacing: 1.0, fontWeight: "800" },
  pill: { padding: 8, borderRadius: R, borderColor: C.divider, borderWidth: 1 },
  pillSelected: { borderColor: C.accent, backgroundColor: C.accentSoft },
  pillText: { color: C.muted, fontSize: 11 },
  warning: { color: "#E1B0B8", fontSize: 12 },
  body: { color: C.ink, fontSize: 14, lineHeight: 21 },
  commandRoot: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 18, paddingTop: 35, paddingBottom: 18 },
  commandHeader: { flexDirection: "row", gap: 14, alignItems: "center", borderBottomWidth: 1, borderBottomColor: C.divider, paddingBottom: 16 },
  commandBack: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: R, borderWidth: 1, borderColor: C.edge },
  commandTitle: { color: C.ink, fontSize: 22, fontWeight: "800" },
  searchBar: { borderRadius: R, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8, padding: 11, borderWidth: 1, borderColor: C.edge },
  searchInput: { color: C.ink, fontSize: 14, flex: 1 },
  commandBody: { flex: 1, gap: 16, paddingTop: 16 },
  catRail: { flex: 1, minHeight: 0 },
  catButton: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 11, borderRadius: R, minWidth: 130 },
  catActive: { backgroundColor: "#122E40", borderLeftWidth: 2, borderLeftColor: C.accent2 },
  catNum: { color: C.accent2, fontSize: 10, fontWeight: "700" },
  small: { color: C.ink, fontSize: 12, fontWeight: "700" },
  settingContent: { paddingBottom: 90, gap: 12 },
  settingCard: { padding: 19, backgroundColor: C.steel, borderWidth: 1, borderColor: C.edge, borderRadius: R },
});
