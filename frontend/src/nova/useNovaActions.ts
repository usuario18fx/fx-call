import { useRouter } from "expo-router";
import { useCallback } from "react";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/ui";

export type NovaPacket = {
  __fxNova?: boolean;
  action?: string;
  payload?: { title?: string; id?: string; mode?: string };
};

type Send = (packet: Record<string, unknown>) => void;

type Room = {
  id: string;
  title: string;
  status: string;
};

/** Bridges the original NOVA Studio HTML to real FX CALL session-protected routes.
 * The HTML receives no bearer tokens or API secrets.
 */
export function useNovaActions(send: Send) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  return useCallback(async (packet: NovaPacket) => {
    if (!packet || packet.__fxNova !== true || !user) return;
    try {
      if (packet.action === "ready") {
        let rooms: Room[] = [];
        try {
          rooms = await api<Room[]>("/rooms");
        } catch {
          // Identity and navigation remain usable when room listing is offline.
        }
        send({
          type: "identity",
          displayName: user.display_name,
          email: user.email,
          verified: user.verified,
          totpEnabled: user.totp_enabled,
          rooms,
        });
      } else if (packet.action === "create-room") {
        const title = String(packet.payload?.title || "Private meeting").trim().slice(0, 80) || "Private meeting";
        // Only the existing private, host-approved meeting type is deployed.
        // 'live' in the studio creates an invite-only room, NOT a public broadcast.
        send({ type: "busy" });
        const room = await api<{ id: string }>("/rooms", { body: { title } });
        toast(packet.payload?.mode === "general" ? "Group room created. Manage invitations and approvals from the host dashboard." : packet.payload?.mode === "live" ? "Invite-only LiveKit room created. Public broadcast is not enabled." : "Private room created", "success");
        router.push(`/host/${room.id}`);
      } else if (packet.action === "open-account") {
        router.push("/(tabs)/account");
      } else if (packet.action === "open-meetings") {
        router.push("/(tabs)/meetings");
      } else if (packet.action === "open-room") {
        const id = String(packet.payload?.id || "");
        if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) throw new Error("Invalid room identifier");
        router.push(`/host/${id}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed";
      send({ type: "error", message });
      toast(message, "error");
    }
  }, [user, router, toast, send]);
}
