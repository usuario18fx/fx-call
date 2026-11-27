import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

export type Lang = "en" | "es";
const KEY = "@fxcall/language/v1";
let selected: Lang = "en";
const subscribers = new Set<() => void>();
const words: Record<Lang, Record<string, string>> = {
  en: {
    "dock.flip": "Flip", "dock.audio": "Audio", "dock.layout": "Layout",
    "dock.layoutGrid": "Gallery", "dock.layoutSpeaker": "Speaker",
    "dock.security": "Security", "dock.mic": "Mic", "dock.cam": "Camera",
    "dock.leave": "Leave", "dock.chat": "Chat", "dock.more": "More",
    "dock.moreTitle": "More controls", "dock.close": "Close",
    "host.eyebrow": "FX CALL / PRIVATE ROOM", "host.heroLive": "LIVE",
    "host.heroEnded": "ENDED", "host.locked": "Locked", "host.open": "Open",
    "host.realtime": "Connected", "host.reconnecting": "Reconnecting",
    "host.noShare": "No screen sharing", "host.enter": "Enter call",
    "host.unlock": "Unlock room", "host.lock": "Lock room",
    "host.end": "End for everyone", "host.ended": "This room has ended.",
  },
  es: {
    "dock.flip": "Voltear", "dock.audio": "Audio", "dock.layout": "Vista",
    "dock.layoutGrid": "Galería", "dock.layoutSpeaker": "Hablante",
    "dock.security": "Seguridad", "dock.mic": "Micrófono", "dock.cam": "Cámara",
    "dock.leave": "Salir", "dock.chat": "Chat", "dock.more": "Más",
    "dock.moreTitle": "Más controles", "dock.close": "Cerrar",
    "host.eyebrow": "FX CALL / SALA PRIVADA", "host.heroLive": "EN VIVO",
    "host.heroEnded": "FINALIZADA", "host.locked": "Bloqueada", "host.open": "Abierta",
    "host.realtime": "Conectado", "host.reconnecting": "Reconectando",
    "host.noShare": "Sin compartir pantalla", "host.enter": "Entrar",
    "host.unlock": "Desbloquear", "host.lock": "Bloquear",
    "host.end": "Finalizar para todos", "host.ended": "Esta sala terminó.",
  },
};
function notify() { subscribers.forEach((cb) => cb()); }
function subscribe(cb: () => void) { subscribers.add(cb); return () => { subscribers.delete(cb); }; }
function snapshot() { return selected; }

void AsyncStorage.getItem(KEY).then((value) => {
  if (value === "es" || value === "en") {
    selected = value;
    notify();
  }
}).catch(() => {});

export function useLang() {
  const lang = useSyncExternalStore(subscribe, snapshot, snapshot);
  const setLang = (next: Lang) => {
    selected = next;
    notify();
    void AsyncStorage.setItem(KEY, next).catch(() => {});
  };
  return { lang, setLang, t: (key: string) => words[lang][key] ?? key };
}
