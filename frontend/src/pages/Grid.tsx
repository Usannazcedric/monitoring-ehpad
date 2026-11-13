import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BellRing, CircleCheck, Search, ShieldAlert, Users, WifiOff } from "lucide-react";
import { useStore, highestLevelFor, isShown } from "@/store/store";
import { ResidentCard } from "@/components/ResidentCard";
import { AlertBadge } from "@/components/AlertBadge";
import { AckButton } from "@/components/AckButton";
import { fmtRelative, isFallActivity, reasonLabel, secondsSince, STALE_AFTER_S, LEVEL_STYLE } from "@/lib/format";
import { residentInfo, BRACELET_RESIDENT } from "@/lib/residents";

type Filter = "tous" | "alertes" | "chutes" | "muets";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "alertes", label: "En alerte" },
  { key: "chutes", label: "Chutes" },
  { key: "muets", label: "Capteurs muets" },
];

/** Re-rendu toutes les secondes : « il y a 3 s » et « muet » restent justes. */
function useTick(ms = 1000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

function Kpi({ icon: Icon, label, value, tone, active, onClick }: {
  icon: typeof Users; label: string; value: number; tone: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border bg-zinc-900 px-4 py-3.5 text-left transition-colors ${
        active ? "border-zinc-500" : "border-zinc-700 hover:border-zinc-600"
      }`}
    >
      <span className="flex items-center gap-1.5 text-[13px] text-zinc-500">
        <Icon className={`h-3.5 w-3.5 ${tone}`} /> {label}
      </span>
      <span className="mt-1.5 block text-[28px] font-semibold text-white tabular leading-none tracking-tight">{value}</span>
    </button>
  );
}

export function GridPage() {
  useTick();
  const residents = useStore((s) => s.residents);
  const alerts = useStore((s) => s.alerts);
  const presentation = useStore((s) => s.presentation);
  const [filter, setFilter] = useState<Filter>("tous");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const arr = Array.from(residents.values()).filter((r) => isShown(r.resident_id, presentation)).map((r) => ({
      r,
      level: highestLevelFor(r.resident_id, alerts),
      info: residentInfo(r.resident_id),
    }));
    // À gravité égale, le bracelet Wokwi (chambre 121, le vrai capteur de la démo) passe en tête.
    const braceletFirst = (id: string) => (id === BRACELET_RESIDENT ? 0 : 1);
    arr.sort((a, b) => b.level - a.level || braceletFirst(a.r.resident_id) - braceletFirst(b.r.resident_id) || a.info.room.localeCompare(b.info.room));
    return arr;
  }, [residents, alerts, presentation]);

  const stats = {
    total: rows.length,
    urgent: rows.filter((x) => x.level >= 4).length,
    toCheck: rows.filter((x) => x.level >= 1 && x.level <= 3).length,
    calm: rows.filter((x) => x.level === 0).length,
    silent: rows.filter((x) => secondsSince(x.r.last_seen) > STALE_AFTER_S).length,
  };

  const priority = useMemo(
    () =>
      Array.from(alerts.values())
        .filter((a) => a.status === "active" && a.level >= 4 && isShown(a.resident_id, presentation))
        .sort((a, b) => b.level - a.level || a.created_at.localeCompare(b.created_at))
        .slice(0, 3),
    [alerts, presentation],
  );

  const visible = rows.filter(({ r, level, info }) => {
    if (filter === "alertes" && level === 0) return false;
    if (filter === "chutes" && !isFallActivity(r.motion?.activity) && ![...alerts.values()].some((a) => a.resident_id === r.resident_id && /fall|chute/i.test(a.reason))) return false;
    if (filter === "muets" && secondsSince(r.last_seen) <= STALE_AFTER_S) return false;
    const q = query.trim().toLowerCase();
    if (q && !info.room.includes(q) && !info.name.toLowerCase().includes(q) && !r.resident_id.toLowerCase().includes(q)) return false;
    return true;
  });

  if (rows.length === 0 && presentation) {
    return (
      <div className="p-12 flex flex-col items-center gap-2 text-center text-zinc-500">
        <div className="text-[15px] font-medium text-zinc-200">Le bracelet de la chambre 121 n'envoie rien pour l'instant.</div>
        <div className="text-[13px]">Lancez la carte dans Wokwi (▶), ou quittez le mode présentation dans l'onglet <Link to="/demo" className="underline">Démo</Link>.</div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="p-12 flex flex-col items-center gap-3 text-zinc-400">
        <div className="h-6 w-6 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin" />
        <div className="text-lg font-medium text-zinc-200">Connexion aux capteurs en cours…</div>
        <div className="text-sm">Les données des résidents arrivent dans quelques secondes.</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-10 sm:py-10 space-y-8 max-w-[1440px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Tableau de bord</h1>
          <p className="mt-1 text-[14px] text-zinc-500">
            Les chambres qui demandent une intervention passent en premier.
          </p>
        </div>
        {presentation && (
          <Link to="/demo" className="rounded-md bg-zinc-800 px-2.5 py-1 text-[12px] font-medium text-zinc-300 ring-1 ring-zinc-700 hover:text-white">
            Mode présentation : chambre 121 seulement
          </Link>
        )}
      </header>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi icon={Users} label="Résidents surveillés" value={stats.total} tone="text-zinc-400" active={filter === "tous"} onClick={() => setFilter("tous")} />
        <Kpi icon={ShieldAlert} label="Urgences en cours" value={stats.urgent} tone="text-rose-400" active={filter === "alertes"} onClick={() => setFilter("alertes")} />
        <Kpi icon={BellRing} label="À vérifier" value={stats.toCheck} tone="text-amber-400" active={false} onClick={() => setFilter("alertes")} />
        <Kpi icon={WifiOff} label="Capteurs muets" value={stats.silent} tone="text-zinc-400" active={filter === "muets"} onClick={() => setFilter("muets")} />
      </section>

      {priority.length > 0 ? (
        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-white">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-soft-pulse" /> À traiter maintenant
            </h2>
            <Link to="/alerts" className="inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-white">
              Toutes les alertes <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {priority.map((a) => {
              const info = residentInfo(a.resident_id);
              const st = LEVEL_STYLE[a.level] ?? LEVEL_STYLE[0];
              return (
                <div key={a.id} className={`relative overflow-hidden rounded-xl border bg-zinc-900 p-4 ${st.border}`}>
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/resident/${a.resident_id}`} className="min-w-0">
                      <div className="text-[13px] text-zinc-500">Chambre</div>
                      <div className="text-[28px] font-semibold text-white tabular leading-tight tracking-tight">{info.room}</div>
                      <div className="text-[13px] text-zinc-400 truncate">{info.name}</div>
                    </Link>
                    <AlertBadge level={a.level} />
                  </div>
                  <div className="mt-3 text-[14px] font-medium text-white">{reasonLabel(a.reason)}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">il y a {fmtRelative(a.created_at)}</div>
                  <div className="mt-3">
                    <AckButton alert={a} compact />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-4 text-[14px] text-zinc-300">
          <CircleCheck className="h-5 w-5 text-emerald-500" /> Aucune urgence en cours : toutes les chambres sont sous surveillance.
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg bg-zinc-800 p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-md px-3 py-1 text-[13px] font-medium transition ${
                  filter === f.key ? "bg-zinc-900 text-white shadow-sm ring-1 ring-zinc-700" : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="relative ml-auto w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chambre ou nom…"
              className="w-full rounded-lg bg-zinc-900 py-1.5 pl-9 pr-3 text-[13px] text-white ring-1 ring-zinc-700 placeholder:text-zinc-500 focus:outline-none focus:ring-zinc-500"
            />
          </label>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 py-12 text-center text-[14px] text-zinc-500">
            Aucune chambre ne correspond à ce filtre.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            {visible.map(({ r, level }) => (
              <ResidentCard key={r.resident_id} resident={r} level={level} />
            ))}
          </div>
        )}
        <p className="text-[12px] text-zinc-500">
          {stats.calm} chambre{stats.calm > 1 ? "s" : ""} sans alerte. Un capteur muet depuis plus de {STALE_AFTER_S} s est
          signalé : un silence n'est jamais lu comme « tout va bien ».
        </p>
      </section>
    </div>
  );
}
