import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import React, { useState } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";

import { Badge, Body, Button, Card, Heading, Icon } from "@/src/components/ui";
import { colors, radius, spacing } from "@/src/theme";

/** Camera + microphone preview with a pre-permission explanation and a settings path after denial. */
export function CameraPreview({ onReady }: { onReady: (granted: { camera: boolean; mic: boolean }) => void }) {
  const [cam, requestCam] = useCameraPermissions();
  const [mic, requestMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [asked, setAsked] = useState(false);

  const granted = !!cam?.granted && !!mic?.granted;
  const blocked = (cam && !cam.granted && !cam.canAskAgain) || (mic && !mic.granted && !mic.canAskAgain);

  const ask = async () => {
    setAsked(true);
    const c = cam?.granted ? cam : await requestCam();
    const m = mic?.granted ? mic : await requestMic();
    onReady({ camera: !!c?.granted, mic: !!m?.granted });
  };

  if (!granted) {
    return (
      <Card testID="av-permission-card" style={{ gap: spacing.md }}>
        <Icon name="video" size={28} color={colors.onBrandTertiary} />
        <Heading size={18}>Camera & microphone</Heading>
        <Body>FX CALL uses your camera and microphone only while you preview or are in a call, so others can see and hear you.</Body>
        {blocked && asked ? (
          <>
            <Body style={{ color: colors.onWarning }}>Access is turned off for FX CALL. Enable it in settings to be seen and heard.</Body>
            {Platform.OS !== "web" ? (
              <Button testID="open-settings-button" label="Open settings" icon="settings" variant="secondary" onPress={() => Linking.openSettings()} />
            ) : (
              <Body>Use your browser's site settings (lock icon in the address bar) to allow camera and microphone.</Body>
            )}
          </>
        ) : (
          <Button testID="allow-av-button" label="Allow camera & mic" icon="shield-check" onPress={ask} />
        )}
        <Button testID="continue-without-av-button" label="Continue without video" variant="ghost" onPress={() => onReady({ camera: false, mic: false })} />
      </Card>
    );
  }

  return (
    <View style={styles.wrap} testID="camera-preview">
      <CameraView style={StyleSheet.absoluteFill} facing={facing} mirror={facing === "front"} />
      <View style={styles.overlay}>
        <Badge label="Preview · only you" tone="neutral" icon="eye" />
        {Platform.OS !== "web" ? (
          <Button testID="preview-flip-button" compact label="Flip" icon="switch-camera" variant="secondary" onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 300, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.stage, borderWidth: 1, borderColor: colors.border },
  overlay: { position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
