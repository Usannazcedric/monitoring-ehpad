import { useEffect } from "react";
import { useStore, isShown } from "@/store/store";
import { api } from "@/lib/api";
import { createWebSocket } from "@/lib/ws";
import { useToasts } from "./useToasts";
import { LEVEL_LABELS, reasonLabel } from "@/lib/format";
import { residentInfo } from "@/lib/residents";

export function useBootstrap() {
  const setResidentBulk = useStore((s) => s.setResidentBulk);
  const setAlertBulk = useStore((s) => s.setAlertBulk);
  const setResident = useStore((s) => s.setResident);
  const upsertAlert = useStore((s) => s.upsertAlert);
  const setConnected = useStore((s) => s.setConnected);
  const setRoom = useStore((s) => s.setRoom);
  const setRoomBulk = useStore((s) => s.setRoomBulk);
  const setGuards = useStore((s) => s.setGuards);
  const pushToast = useToasts((s) => s.push);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [residents, alerts, rooms, guardMap] = await Promise.all([
          api.listResidents(),
          api.listAlerts(),
          api.listRooms().catch(() => []),
          api.getGuard().catch(() => ({} as Record<string, string>)),
        ]);
        if (cancelled) return;
        setResidentBulk(residents);
        setAlertBulk(alerts);
        setRoomBulk(rooms);
        if (Object.keys(guardMap).length > 0) setGuards(guardMap);
      } catch (err) {
        console.error("bootstrap_failed", err);
      }
    })();

    const close = createWebSocket(
      (env) => {
        const t = env.topic;
        if (t.startsWith("state/resident/")) {
          setResident(env.data);
        } else if (t === "alerts/new") {
          upsertAlert(env.data);
          if (env.data?.level >= 3 && isShown(env.data.resident_id as string, useStore.getState().presentation)) {
            const info = residentInfo(env.data.resident_id as string);
            const guard = useStore.getState().guards[info.wing];
            pushToast({
              title: `${LEVEL_LABELS[env.data.level] ?? "Alerte"} · chambre ${info.room}`,
              description: guard
                ? `${reasonLabel(env.data.reason)} · ${guard} prévenue`
                : reasonLabel(env.data.reason),
              level: env.data.level,
            });
          }
        } else if (t.startsWith("alerts/update/")) {
          upsertAlert(env.data);
        } else if (t.startsWith("state/room/")) {
          if (env.data?.room_id) setRoom(env.data);
        } else if (t.startsWith("risk/resident/")) {
          if (env.data?.resident_id && typeof env.data?.risk === "number") {
            setResident({ resident_id: env.data.resident_id, risk: env.data.risk });
          }
        }
      },
      (ok) => setConnected(ok),
    );

    return () => {
      cancelled = true;
      close();
    };
  }, [setResidentBulk, setAlertBulk, setResident, upsertAlert, setConnected, pushToast, setRoom, setRoomBulk, setGuards]);
}
