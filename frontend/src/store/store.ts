import { create } from "zustand";
import type { Alert, ResidentSnapshot, RoomSnapshot } from "@/lib/api";
import { BRACELET_RESIDENT } from "@/lib/residents";

function readPresentation(): boolean {
  try { return localStorage.getItem("veilleur-presentation") === "1"; } catch { return false; }
}

/** En mode présentation, seul le résident du bracelet est affiché. */
export function isShown(residentId: string, presentation: boolean): boolean {
  return !presentation || residentId === BRACELET_RESIDENT;
}

interface State {
  residents: Map<string, ResidentSnapshot>;
  alerts: Map<string, Alert>;
  rooms: Map<string, RoomSnapshot>;
  guards: Record<string, string>;   // wing → staff name
  connected: boolean;
  /** Mode présentation : n'afficher que le bracelet (chambre 121), pas les résidents simulés. */
  presentation: boolean;
  setPresentation: (on: boolean) => void;
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
  presentation: readPresentation(),
  setPresentation: (on) => {
    try { localStorage.setItem("veilleur-presentation", on ? "1" : "0"); } catch { /* navigation privée */ }
    set({ presentation: on });
  },
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
