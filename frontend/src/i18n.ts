// FX CALL i18n — two native voices: English (Canada, Gen Z) and Español (México, Gen Z).
// Tone: casual, warm, discreet. No stiff corporate copy.
import { useSyncExternalStore } from "react";

import { storage } from "@/src/utils/storage";

export type Lang = "en" | "es";

const en = {
  "lang.name": "English · CA",
  "lang.title": "Language",
  "lang.subtitle": "App voice",
  // call
  "call.connecting": "Getting you in…",
  "call.you": "You",
  "call.host": "Host",
  "call.inCall": "{n} in call",
  "call.encrypted": "Encrypted",
  "call.shieldOn": "Shield on",
  "call.shieldOff": "No capture detection",
  "call.security": "Security",
  "call.reconnecting": "Connection dropped. Reconnecting…",
  "call.connectingSecure": "Connecting securely…",
  "call.invalid": "Your access to this meeting isn't valid on this device.",
  "call.home": "Go home",
  "call.endedTitle": "Call ended",
  "call.endedHost": "The host ended this meeting.",
  "call.endedRemoved": "You were removed from this meeting.",
  "call.endedBlocked": "The host blocked you from this meeting.",
  "call.endedLeft": "You left the call.",
  "call.done": "Done",
  "call.retry": "Retry",
  "call.noVideo": "Video isn't set up yet.",
  "call.restricted": "The host limited your video access.",
  "call.captureWarn": "Heads up: your device reported a screen capture. The host got notified.",
  "call.captureSelf": "Screen capture detected on your device",
  "call.captureSelfSub": "This session is protected and watermarked with your name.",
  // dock
  "dock.mic": "Mic",
  "dock.cam": "Camera",
  "dock.more": "More",
  "dock.leave": "Leave",
  "dock.moreTitle": "Call controls",
  "dock.flip": "Flip camera",
  "dock.audio": "Audio output",
  "dock.layout": "Layout",
  "dock.layoutGrid": "Grid",
  "dock.layoutSpeaker": "Speaker",
  "dock.chat": "Chat",
  "dock.security": "Security",
  "dock.close": "Close",
  // host
  "host.eyebrow": "Private room",
  "host.heroLive": "Live now",
  "host.heroEnded": "Ended",
  "host.locked": "Locked",
  "host.open": "Open",
  "host.realtime": "Realtime",
  "host.reconnecting": "Reconnecting",
  "host.noShare": "No screen share",
  "host.enter": "Enter call",
  "host.lock": "Lock room",
  "host.unlock": "Unlock room",
  "host.end": "End for all",
  "host.people": "People",
  "host.waiting": "Waiting",
  "host.alerts": "Alerts",
  "host.invites": "Invites",
  "host.settings": "Settings",
  "host.endTitle": "End for everyone?",
  "host.endBody": "Everyone gets disconnected and every invite stops working.",
  "host.endConfirm": "End meeting",
  "host.cancel": "Cancel",
  "host.ended": "This meeting ended. The security timeline stays available for 30 days.",
  "host.loading": "Loading your room",
  "host.lost": "Lost connection to the server.",
  "host.empty": "Nobody here yet. Waiting for guests.",
  "host.noWaiting": "Nobody waiting.",
  "host.noAlerts": "No captures reported. Detection only works for people on the iOS or Android app.",
  "host.joinReq": "{name} wants to join",
  "host.protectedNote": "This screen is protected: screenshots show up black and everything is watermarked.",
  "privacy.captureLabel": "Screenshot detected",
  "privacy.recLabel": "Recording alert",
} as const;

export type Key = keyof typeof en;

const es: Record<Key, string> = {
  "lang.name": "Español · MX",
  "lang.title": "Idioma",
  "lang.subtitle": "Cómo te habla la app",
  "call.connecting": "Metiéndote a la sala…",
  "call.you": "Tú",
  "call.host": "Anfitrión",
  "call.inCall": "{n} en la llamada",
  "call.encrypted": "Cifrado",
  "call.shieldOn": "Escudo activo",
  "call.shieldOff": "Sin detección de capturas",
  "call.security": "Seguridad",
  "call.reconnecting": "Se cayó la conexión. Reconectando…",
  "call.connectingSecure": "Conectando de forma segura…",
  "call.invalid": "Tu acceso a esta reunión no es válido en este dispositivo.",
  "call.home": "Ir al inicio",
  "call.endedTitle": "Llamada terminada",
  "call.endedHost": "El anfitrión terminó la reunión.",
  "call.endedRemoved": "Te sacaron de la reunión.",
  "call.endedBlocked": "El anfitrión te bloqueó de esta reunión.",
  "call.endedLeft": "Saliste de la llamada.",
  "call.done": "Listo",
  "call.retry": "Reintentar",
  "call.noVideo": "El video todavía no está configurado.",
  "call.restricted": "El anfitrión limitó tu acceso al video.",
  "call.captureWarn": "Ojo: tu dispositivo reportó una captura de pantalla. Ya le avisamos al anfitrión.",
  "call.captureSelf": "Detectamos una captura en tu dispositivo",
  "call.captureSelfSub": "La sesión está protegida y marcada con tu nombre.",
  "dock.mic": "Micro",
  "dock.cam": "Cámara",
  "dock.more": "Más",
  "dock.leave": "Salir",
  "dock.moreTitle": "Controles de la llamada",
  "dock.flip": "Voltear cámara",
  "dock.audio": "Salida de audio",
  "dock.layout": "Vista",
  "dock.layoutGrid": "Cuadrícula",
  "dock.layoutSpeaker": "Orador",
  "dock.chat": "Chat",
  "dock.security": "Seguridad",
  "dock.close": "Cerrar",
  "host.eyebrow": "Sala privada",
  "host.heroLive": "En vivo",
  "host.heroEnded": "Terminada",
  "host.locked": "Cerrada",
  "host.open": "Abierta",
  "host.realtime": "Tiempo real",
  "host.reconnecting": "Reconectando",
  "host.noShare": "Sin compartir pantalla",
  "host.enter": "Entrar a la llamada",
  "host.lock": "Cerrar sala",
  "host.unlock": "Abrir sala",
  "host.end": "Terminar para todos",
  "host.people": "Gente",
  "host.waiting": "En espera",
  "host.alerts": "Alertas",
  "host.invites": "Invitaciones",
  "host.settings": "Ajustes",
  "host.endTitle": "¿Terminar para todos?",
  "host.endBody": "Todos se desconectan y las invitaciones dejan de servir.",
  "host.endConfirm": "Terminar reunión",
  "host.cancel": "Cancelar",
  "host.ended": "La reunión terminó. El historial de seguridad se queda 30 días.",
  "host.loading": "Cargando tu sala",
  "host.lost": "Se perdió la conexión con el servidor.",
  "host.empty": "Todavía no hay nadie. Esperando invitados.",
  "host.noWaiting": "Nadie en espera.",
  "host.noAlerts": "Sin capturas reportadas. La detección solo funciona en la app de iOS o Android.",
  "host.joinReq": "{name} quiere entrar",
  "host.protectedNote": "Esta pantalla está protegida: las capturas salen negras y todo lleva marca de agua.",
  "privacy.captureLabel": "Captura detectada",
  "privacy.recLabel": "Alerta de grabación",
};

const dict: Record<Lang, Record<Key, string>> = { en: en as Record<Key, string>, es };

function deviceLang(): Lang {
  try {
    return (Intl.DateTimeFormat().resolvedOptions().locale || "en").toLowerCase().startsWith("es") ? "es" : "en";
  } catch {
    return "en";
  }
}

let current: Lang = deviceLang();
const subs = new Set<() => void>();

storage.getItem<string>("fx_lang", "").then((v) => {
  if ((v === "en" || v === "es") && v !== current) {
    current = v;
    subs.forEach((f) => f());
  }
}).catch(() => {});

export function setLang(l: Lang) {
  if (l === current) return;
  current = l;
  storage.setItem("fx_lang", l).catch(() => {});
  subs.forEach((f) => f());
}

export function translate(l: Lang, key: Key, vars?: Record<string, string | number>): string {
  let out = dict[l][key] ?? en[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) out = out.replace(`{${k}}`, String(vars[k]));
  return out;
}

export function useLang() {
  const lang = useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => current,
    () => current,
  );
  return { lang, setLang, t: (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars) };
}

export const getLang = () => current;
