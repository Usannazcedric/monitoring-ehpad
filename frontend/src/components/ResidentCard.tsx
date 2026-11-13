import { Link } from "react-router-dom";
import { Armchair, BedDouble, Footprints, HeartPulse, Droplet, Thermometer, TriangleAlert, WifiOff, Watch, Moon } from "lucide-react";
import { AlertBadge } from "./AlertBadge";
import {
  fmtRelative, secondsSince, STALE_AFTER_S, ACTIVITY_LABELS, STATUS_BY_LEVEL, LEVEL_STYLE, isFallActivity,
} from "@/lib/format";
import { residentInfo, BRACELET_RESIDENT } from "@/lib/residents";
import type { ResidentSnapshot } from "@/lib/api";

interface Props {
  resident: ResidentSnapshot;
  level: number;
}

const ACTIVITY_ICON: Record<string, typeof Armchair> = {
  walking: Footprints,
  sitting: Armchair,
  lying: BedDouble,
  idle: Moon,
};

function Vital({ icon: Icon, value, unit, state }: {
  icon: typeof HeartPulse; value?: number | null; unit: string; state: "ok" | "warn" | "crit" | "none";
}) {
  const cls = { ok: "text-zinc-100", warn: "text-amber-300", crit: "text-rose-400", none: "text-zinc-600" }[state];
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${state === "none" ? "text-zinc-700" : "text-zinc-500"}`} />
      <span className={`text-sm font-semibold tabular ${cls}`}>{typeof value === "number" ? value : "—"}</span>
      <span className="text-[10px] text-zinc-500">{unit}</span>
    </div>
  );
}

function state(v: number | null | undefined, warn: (x: number) => boolean, crit: (x: number) => boolean) {
  if (typeof v !== "number") return "none" as const;
  if (crit(v)) return "crit" as const;
  if (warn(v)) return "warn" as const;
  return "ok" as const;
}

export function ResidentCard({ resident, level }: Props) {
  const v = resident.vitals;
  const m = resident.motion;
  const info = residentInfo(resident.resident_id);
  const style = LEVEL_STYLE[level] ?? LEVEL_STYLE[0];
  const status = STATUS_BY_LEVEL[level] ?? STATUS_BY_LEVEL[0];
  const isFall = isFallActivity(m?.activity);
  const stale = secondsSince(resident.last_seen) > STALE_AFTER_S;
  const isBracelet = resident.resident_id === BRACELET_RESIDENT;
  const ActivityIcon = isFall ? TriangleAlert : ACTIVITY_ICON[m?.activity ?? ""] ?? Moon;
  const activityLabel = m?.activity ? ACTIVITY_LABELS[m.activity] ?? m.activity : "Aucune donnée";

  return (
    <Link
      to={`/resident/${resident.resident_id}`}
      className={`group relative block overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/70 ring-1 ${level ? style.ring : "ring-transparent"} transition hover:-translate-y-0.5 hover:border-zinc-700 hover:shadow-xl hover:shadow-black/40`}
      title={`Chambre ${info.room} — voir le détail`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${level ? style.bar : "bg-transparent"}`} />
      <div className="p-4 pl-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] uppercase tracking-wider text-zinc-500">Ch.</span>
              <span className="text-2xl font-bold text-white tabular leading-none">{info.room}</span>
            </div>
            <div className="mt-1 text-sm text-zinc-300 truncate">
              {info.name} <span className="text-zinc-600">· {resident.resident_id}</span>
            </div>
          </div>
          {level > 0 ? (
            <AlertBadge level={level} />
          ) : (
            <span className={`text-[11px] font-medium ${status.cls}`}>{status.text}</span>
          )}
        </div>

        <div
          className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm ${
            isFall ? "bg-rose-500/15 text-rose-200 ring-1 ring-inset ring-rose-500/40 font-semibold" : "bg-zinc-800/60 text-zinc-300"
          }`}
          title="Activité détectée par le capteur de mouvement"
        >
          <ActivityIcon className={`h-4 w-4 shrink-0 ${isFall ? "animate-soft-pulse" : "text-zinc-400"}`} />
          <span className="truncate">{activityLabel}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Vital icon={HeartPulse} value={v?.hr} unit="bpm" state={state(v?.hr, (x) => x > 100 || x < 55, (x) => x > 140 || x < 40)} />
          <Vital icon={Droplet} value={v?.spo2} unit="%" state={state(v?.spo2, (x) => x < 95, (x) => x < 88)} />
          <Vital icon={Thermometer} value={v?.temp} unit="°C" state={state(v?.temp, (x) => x < 35.5 || x > 37.8, (x) => x < 35 || x > 38.5)} />
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-800/80 pt-2.5 text-[11px]">
          {isBracelet ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-500/15 px-1.5 py-0.5 font-semibold text-brand-200">
              <Watch className="h-3 w-3" /> Bracelet Wokwi
            </span>
          ) : (
            <span className="text-zinc-500">Aile {info.wing}</span>
          )}
          {stale ? (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-300" title="Plus aucune mesure : un silence n'est jamais « tout va bien »">
              <WifiOff className="h-3 w-3" /> Muet depuis {fmtRelative(resident.last_seen)}
            </span>
          ) : (
            <span className="text-zinc-500 tabular" title="Dernière mesure reçue">il y a {fmtRelative(resident.last_seen)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
