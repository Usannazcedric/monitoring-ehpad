import { create } from "zustand";
import type { Alert, ResidentSnapshot, RoomSnapshot } from "@/lib/api";
import { BRACELET_RESIDENT } from "@/lib/residents";

function readPresentation(): boolean {
  // Valeur de départ seulement : useBootstrap la cale sur le simulateur (autres résidents coupés ou non).
  try { return localStorage.getItem("veilleur-presentation") !== "0"; } catch { return true; }
}

/** Autres résidents coupés : seul le résident du bracelet est affiché. */
export function isShown(residentId: string, presentation: boolean): boolean {
  return !presentation || residentId === BRACELET_RESIDENT;
}

interface State {
  residents: Map<string, ResidentSnapshot>;
  alerts: Map<string, Alert>;
  rooms: Map<string, RoomSnapshot>;
  guards: Record<string, string>;   // wing → staff name
  connected: boolean;
  /** Premier chargement terminé : avant, une grille vide veut dire « en cours », pas « rien ». */
  bootstrapped: boolean;
  setBootstrapped: () => void;
  /** Autres résidents coupés : n'afficher que le bracelet (chambre 121). Suit l'état du simulateur. */
  presentation: boolean;
  /** Date du dernier changement, pour ignorer une lecture du simulateur partie avant. */
  presentationChangedAt: number;
  setPresentation: (on: boolean) => void;
  /** Nombre de résidents fictifs du simulateur (19 dans docker-compose). */
  othersCount: number;
  setOthersCount: (n: number) => void;
  setResident: (snap: ResidentSnapshot) => void;
  setResidentBulk: (snaps: ResidentSnapshot[]) => void;
  upsertAlert: (a: Alert) => void;
  setAlertBulk: (alerts: Alert[]) => void;
  removeAlert: (id: string) => void;
  setRoom: (room: RoomSnapshot) => void;
  setRoomBulk: (rooms: RoomSnapshot[]) => void;
  setGuard: (wing: string, name: string) => void;
  setGuards: (guards: Record<string, string>) => void;
  setConnected: (ok: boolean) => void;
}

export const useStore = create<State>((set) => ({
  residents: new Map(),
  alerts: new Map(),
  rooms: new Map(),
  guards: { A: "Sophie Martin", B: "Marie Lambert" },
  connected: false,
  bootstrapped: false,
  setBootstrapped: () => set({ bootstrapped: true }),
  presentation: readPresentation(),
  presentationChangedAt: 0,
  setPresentation: (on) => {
    try { localStorage.setItem("veilleur-presentation", on ? "1" : "0"); } catch { /* navigation privée */ }
    set({ presentation: on, presentationChangedAt: Date.now() });
  },
  othersCount: 19,
  setOthersCount: (n) => set({ othersCount: n }),
  setResident: (snap) => set((s) => {
    const m = new Map(s.residents);
    const prev = m.get(snap.resident_id) ?? { resident_id: snap.resident_id };
    m.set(snap.resident_id, { ...prev, ...snap });
    return { residents: m };
  }),
  setResidentBulk: (snaps) => set(() => {
    const m = new Map<string, ResidentSnapshot>();
    for (const s of snaps) m.set(s.resident_id, s);
    return { residents: m };
  }),
  upsertAlert: (a) => set((s) => {
    const m = new Map(s.alerts);
    if (a.status === "resolved") m.delete(a.id);
    else m.set(a.id, a);
    return { alerts: m };
  }),
  setAlertBulk: (alerts) => set(() => {
    const m = new Map<string, Alert>();
    for (const a of alerts) if (a.status !== "resolved") m.set(a.id, a);
    return { alerts: m };
  }),
  removeAlert: (id) => set((s) => {
    const m = new Map(s.alerts);
    m.delete(id);
    return { alerts: m };
  }),
  setRoom: (room) => set((s) => {
    const m = new Map(s.rooms);
    m.set(room.room_id, room);
    return { rooms: m };
  }),
  setRoomBulk: (rooms) => set(() => {
    const m = new Map<string, RoomSnapshot>();
    for (const r of rooms) m.set(r.room_id, r);
    return { rooms: m };
  }),
  setGuard: (wing, name) => set((s) => ({ guards: { ...s.guards, [wing]: name } })),
  setGuards: (guards) => set({ guards }),
  setConnected: (ok) => set({ connected: ok }),
}));

export function highestLevelFor(residentId: string, alerts: Map<string, Alert>): number {
  let best = 0;
  for (const a of alerts.values()) {
    if (a.resident_id === residentId && a.status !== "resolved" && a.level > best) best = a.level;
  }
  return best;
}
