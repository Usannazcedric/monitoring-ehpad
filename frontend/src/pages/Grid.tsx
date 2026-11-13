import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BellRing, CircleCheck, Search, ShieldAlert, TriangleAlert, Users, WifiOff } from "lucide-react";
import { useStore, highestLevelFor } from "@/store/store";
import { ResidentCard } from "@/components/ResidentCard";
import { AlertBadge } from "@/components/AlertBadge";
import { AckButton } from "@/components/AckButton";
import { fmtRelative, isFallActivity, reasonLabel, secondsSince, STALE_AFTER_S, LEVEL_STYLE } from "@/lib/format";
import { residentInfo } from "@/lib/residents";

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
      className={`flex items-center gap-4 rounded-2xl border bg-zinc-900/70 px-4 py-4 text-left transition ${
        active ? "border-brand-500/60 ring-1 ring-brand-500/40" : "border-zinc-800/80 hover:border-zinc-700"
      }`}
    >
      <span className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-2xl font-bold text-white tabular leading-none">{value}</span>
        <span className="mt-1 block text-xs text-zinc-400">{label}</span>
      </span>
    </button>
  );
}

export function GridPage() {
  useTick();
  const residents = useStore((s) => s.residents);
  const alerts = useStore((s) => s.alerts);
  const [filter, setFilter] = useState<Filter>("tous");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const arr = Array.from(residents.values()).map((r) => ({
      r,
      level: highestLevelFor(r.resident_id, alerts),
      info: residentInfo(r.resident_id),
    }));
    arr.sort((a, b) => b.level - a.level || a.info.room.localeCompare(b.info.room));
    return arr;
  }, [residents, alerts]);

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
        .filter((a) => a.status === "active" && a.level >= 4)
        .sort((a, b) => b.level - a.level || a.created_at.localeCompare(b.created_at))
        .slice(0, 3),
    [alerts],
  );

  const visible = rows.filter(({ r, level, info }) => {
    if (filter === "alertes" && level === 0) return false;
    if (filter === "chutes" && !isFallActivity(r.motion?.activity) && ![...alerts.values()].some((a) => a.resident_id === r.resident_id && /fall|chute/i.test(a.reason))) return false;
    if (filter === "muets" && secondsSince(r.last_seen) <= STALE_AFTER_S) return false;
    const q = query.trim().toLowerCase();
    if (q && !info.room.includes(q) && !info.name.toLowerCase().includes(q) && !r.resident_id.toLowerCase().includes(q)) return false;
    return true;
  });

  if (rows.length === 0) {
    return (
      <div className="p-12 flex flex-col items-center gap-3 text-zinc-400">
        <div className="h-8 w-8 border-4 border-zinc-700 border-t-brand-400 rounded-full animate-spin" />
        <div className="text-lg font-medium text-zinc-200">Connexion aux capteurs en cours…</div>
        <div className="text-sm">Les données des résidents arrivent dans quelques secondes.</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 space-y-6 max-w-[1600px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Tableau de bord</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Les chambres qui demandent une intervention passent en premier.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi icon={Users} label="Résidents surveillés" value={stats.total} tone="bg-zinc-800 text-zinc-200" active={filter === "tous"} onClick={() => setFilter("tous")} />
        <Kpi icon={ShieldAlert} label="Urgences en cours" value={stats.urgent} tone="bg-rose-500/15 text-rose-300" active={filter === "alertes"} onClick={() => setFilter("alertes")} />
        <Kpi icon={BellRing} label="À vérifier" value={stats.toCheck} tone="bg-amber-400/15 text-amber-300" active={false} onClick={() => setFilter("alertes")} />
        <Kpi icon={WifiOff} label="Capteurs muets" value={stats.silent} tone="bg-zinc-800 text-amber-300" active={filter === "muets"} onClick={() => setFilter("muets")} />
      </section>

      {priority.length > 0 ? (
        <section className="rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-zinc-900/70 to-zinc-900/70 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-rose-200">
              <TriangleAlert className="h-4 w-4" /> À traiter maintenant
            </h2>
            <Link to="/alerts" className="inline-flex items-center gap-1 text-xs font-medium text-zinc-300 hover:text-white">
              Toutes les alertes <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {priority.map((a) => {
              const info = residentInfo(a.resident_id);
              const st = LEVEL_STYLE[a.level] ?? LEVEL_STYLE[0];
              return (
                <div key={a.id} className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 pl-5">
                  <span className={`absolute inset-y-0 left-0 w-1 ${st.bar}`} />
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/resident/${a.resident_id}`} className="min-w-0">
                      <div className="text-xs text-zinc-500">Chambre</div>
                      <div className="text-3xl font-bold text-white tabular leading-none">{info.room}</div>
                      <div className="mt-1 text-sm text-zinc-300 truncate">{info.name}</div>
                    </Link>
                    <AlertBadge level={a.level} />
                  </div>
                  <div className="mt-3 text-sm font-medium text-white">{reasonLabel(a.reason)}</div>
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
        <section className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 text-sm text-emerald-200">
          <CircleCheck className="h-5 w-5" /> Aucune urgence en cours : toutes les chambres sont sous surveillance.
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl bg-zinc-900 p-1 ring-1 ring-zinc-800">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  filter === f.key ? "bg-zinc-700 text-white shadow" : "text-zinc-400 hover:text-zinc-200"
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
              className="w-full rounded-xl bg-zinc-900 py-2 pl-9 pr-3 text-sm text-white ring-1 ring-zinc-800 placeholder:text-zinc-500 focus:outline-none focus:ring-brand-500"
            />
          </label>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 py-12 text-center text-sm text-zinc-400">
            Aucune chambre ne correspond à ce filtre.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            {visible.map(({ r, level }) => (
              <ResidentCard key={r.resident_id} resident={r} level={level} />
            ))}
          </div>
        )}
        <p className="text-xs text-zinc-500">
          {stats.calm} chambre{stats.calm > 1 ? "s" : ""} sans alerte. Un capteur muet depuis plus de {STALE_AFTER_S} s est
          signalé : un silence n'est jamais lu comme « tout va bien ».
        </p>
      </section>
    </div>
  );
}
