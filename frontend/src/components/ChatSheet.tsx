import React, { useEffect, useRef, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { participantApi } from "@/src/api";
import { Heading, Icon, Label } from "@/src/components/ui";
import { colors, fonts, radius, spacing } from "@/src/theme";

export type ChatMessage = { id: string; participant_id: string; name: string; role: string; text: string; created_at: string };

export function ChatSheet({ visible, onClose, roomId, myId, messages, onSent }: {
  visible: boolean; onClose: () => void; roomId: string; myId: string; messages: ChatMessage[]; onSent: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList>(null);

  useEffect(() => {
    if (visible) setTimeout(() => list.current?.scrollToEnd({ animated: false }), 50);
  }, [visible, messages.length]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await participantApi(roomId, "/messages", { body: { text: t } });
      setText("");
      onSent();
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="chat-backdrop" />
      <KeyboardAvoidingView behavior="translate-with-padding" style={[styles.sheet, { height: Math.min(620, Math.max(280, height * 0.7)), maxHeight: Math.max(260, height - insets.top - 12), paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.header}>
          <Heading size={18}>Private chat</Heading>
          <Pressable testID="chat-close-button" onPress={onClose} hitSlop={12} style={styles.close}>
            <Icon name="x" size={20} color={colors.onSurface} />
          </Pressable>
        </View>
        <Label style={{ paddingHorizontal: spacing.lg }}>Visible only to admitted participants · kept 24h</Label>
        <FlatList
          ref={list}
          style={styles.messages}
          keyboardShouldPersistTaps="handled"
          testID="chat-message-list"
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          ListEmptyComponent={<Text style={styles.empty}>No messages yet.</Text>}
          renderItem={({ item }) => {
            const mine = item.participant_id === myId;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                {!mine ? <Text style={styles.author}>{item.name}{item.role === "host" ? " · HOST" : ""}</Text> : null}
                <Text style={styles.msg}>{item.text}</Text>
              </View>
            );
          }}
        />
        <View style={styles.inputRow}>
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder="Message"
            placeholderTextColor={colors.muted}
            style={styles.input}
            maxLength={1000}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <Pressable testID="chat-send-button" onPress={send} style={styles.send} accessibilityLabel="Send message">
            <Icon name="send-horizontal" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim },
  sheet: { backgroundColor: colors.surfaceTertiary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, width: "100%", maxWidth: 640, alignSelf: "center" },
  messages: { flex: 1, minHeight: 0 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg, paddingBottom: spacing.xs },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  empty: { fontFamily: fonts.text, color: colors.muted, textAlign: "center", marginTop: spacing.xl },
  bubble: { maxWidth: "80%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  mine: { alignSelf: "flex-end", backgroundColor: colors.brandPrimary },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surfaceSecondary },
  author: { fontFamily: fonts.text, fontSize: 11, color: colors.onBrandTertiary, marginBottom: 2, letterSpacing: 0.6 },
  msg: { fontFamily: fonts.text, fontSize: 14, color: colors.onSurfaceSecondary },
  inputRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  input: { flex: 1, minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.surface, color: colors.onSurfaceSecondary, paddingHorizontal: spacing.lg, fontFamily: fonts.text, borderWidth: 1, borderColor: colors.border },
  send: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
});
