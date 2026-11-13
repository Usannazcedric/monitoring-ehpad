import { Link } from "react-router-dom";
import { Armchair, BedDouble, Footprints, Moon, TriangleAlert, WifiOff } from "lucide-react";
import { AlertBadge } from "./AlertBadge";
import { fmtRelative, secondsSince, STALE_AFTER_S, ACTIVITY_LABELS, LEVEL_STYLE, isFallActivity } from "@/lib/format";
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

function vitalTone(v: number | null | undefined, warn: (x: number) => boolean, crit: (x: number) => boolean) {
  if (typeof v !== "number") return "text-zinc-600";
  if (crit(v)) return "text-rose-400";
  if (warn(v)) return "text-amber-400";
  return "text-zinc-200";
}

function Vital({ label, value, unit, tone }: { label: string; value?: number | null; unit: string; tone: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className={`text-[15px] font-semibold tabular ${tone}`}>
        {typeof value === "number" ? value : "—"}
        <span className="ml-0.5 text-[11px] font-normal text-zinc-500">{unit}</span>
      </div>
    </div>
  );
}

export function ResidentCard({ resident, level }: Props) {
  const v = resident.vitals;
  const m = resident.motion;
  const info = residentInfo(resident.resident_id);
  const style = LEVEL_STYLE[level] ?? LEVEL_STYLE[0];
  const isFall = isFallActivity(m?.activity);
  const stale = secondsSince(resident.last_seen) > STALE_AFTER_S;
  const isBracelet = resident.resident_id === BRACELET_RESIDENT;
  const ActivityIcon = isFall ? TriangleAlert : ACTIVITY_ICON[m?.activity ?? ""] ?? Moon;
  const activityLabel = m?.activity ? ACTIVITY_LABELS[m.activity] ?? m.activity : "Aucune donnée";

  return (
    <Link
      to={`/resident/${resident.resident_id}`}
      className="group relative block overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 transition-colors hover:border-zinc-600"
      title={`Chambre ${info.room} — voir le détail`}
    >
      {level > 0 && <span className={`absolute inset-y-0 left-0 w-[3px] ${style.bar}`} />}
      <div className="p-4 space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[13px] text-zinc-500">Chambre</div>
            <div className="text-[22px] font-semibold text-white tabular leading-tight tracking-tight">{info.room}</div>
            <div className="text-[13px] text-zinc-400 truncate">{info.name}</div>
          </div>
          {level > 0 ? (
            <AlertBadge level={level} />
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Calme
            </span>
          )}
        </div>

        <div className={`flex items-center gap-2 text-[13px] ${isFall ? "font-semibold text-rose-400" : "text-zinc-300"}`}>
          <ActivityIcon className={`h-4 w-4 shrink-0 ${isFall ? "animate-soft-pulse" : "text-zinc-500"}`} />
          <span className="truncate">{activityLabel}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-zinc-700 pt-3">
          <Vital label="Pouls" value={v?.hr} unit="bpm" tone={vitalTone(v?.hr, (x) => x > 100 || x < 55, (x) => x > 140 || x < 40)} />
          <Vital label="Oxygène" value={v?.spo2} unit="%" tone={vitalTone(v?.spo2, (x) => x < 95, (x) => x < 88)} />
          <Vital label="Temp." value={v?.temp} unit="°C" tone={vitalTone(v?.temp, (x) => x < 35.5 || x > 37.8, (x) => x < 35 || x > 38.5)} />
        </div>

        <div className="flex items-center justify-between gap-2 text-[12px]">
          <span className="text-zinc-500">{isBracelet ? "Bracelet Wokwi" : `Aile ${info.wing}`}</span>
          {stale ? (
            <span className="inline-flex items-center gap-1 font-medium text-amber-400" title="Plus aucune mesure : un silence n'est jamais « tout va bien »">
              <WifiOff className="h-3 w-3" /> Muet depuis {fmtRelative(resident.last_seen)}
            </span>
          ) : (
            <span className="text-zinc-500 tabular">il y a {fmtRelative(resident.last_seen)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
