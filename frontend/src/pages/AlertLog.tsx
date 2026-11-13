import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CircleCheck, Clock, Hand, Info, TrendingUp } from "lucide-react";
import { useStore } from "@/store/store";
import { AlertBadge } from "@/components/AlertBadge";
import { AckButton } from "@/components/AckButton";
import { fmtRelative, LEVEL_DESCRIPTIONS, LEVEL_LABELS, LEVEL_STYLE, reasonLabel } from "@/lib/format";
import { residentInfo } from "@/lib/residents";
import type { Alert } from "@/lib/api";

function useTick(ms = 1000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

function AlertRow({ a }: { a: Alert }) {
  const info = residentInfo(a.resident_id);
  const st = LEVEL_STYLE[a.level] ?? LEVEL_STYLE[0];
  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-4 pl-5 sm:flex-row sm:items-center">
      <span className={`absolute inset-y-0 left-0 w-1 ${st.bar}`} />
      <Link to={`/resident/${a.resident_id}`} className="flex w-28 shrink-0 flex-col">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">Chambre</span>
        <span className="text-2xl font-bold text-white tabular leading-none">{info.room}</span>
        <span className="mt-1 truncate text-xs text-zinc-400">{info.name}</span>
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <AlertBadge level={a.level} />
          <span className="font-medium text-white">{reasonLabel(a.reason)}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
          <Clock className="h-3.5 w-3.5" /> il y a {fmtRelative(a.created_at)} · {a.resident_id}
        </div>
      </div>
      <div className="shrink-0">
        <AckButton alert={a} />
      </div>
    </div>
  );
}

export function AlertLog() {
  useTick();
  const alertsMap = useStore((s) => s.alerts);
  const [levelFilter, setLevelFilter] = useState<number | null>(null);

  const { active, taken } = useMemo(() => {
    let list = Array.from(alertsMap.values());
    if (levelFilter !== null) list = list.filter((a) => a.level === levelFilter);
    list.sort((a, b) => b.level - a.level || a.created_at.localeCompare(b.created_at));
    return { active: list.filter((a) => a.status === "active"), taken: list.filter((a) => a.status === "acknowledged") };
  }, [alertsMap, levelFilter]);

  const counts = useMemo(() => {
    const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const a of alertsMap.values()) c[a.level] = (c[a.level] ?? 0) + 1;
    return c;
  }, [alertsMap]);

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-white">Alertes</h1>
        <p className="mt-1 text-sm text-zinc-400">Les plus graves d'abord, puis les plus anciennes.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setLevelFilter(null)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
            levelFilter === null ? "bg-zinc-100 text-zinc-900 ring-zinc-100" : "bg-zinc-900 text-zinc-300 ring-zinc-700 hover:ring-zinc-500"
          }`}
        >
          Tous les niveaux · {alertsMap.size}
        </button>
        {[5, 4, 3, 2, 1].map((l) => (
          <button
            key={l}
            onClick={() => setLevelFilter(levelFilter === l ? null : l)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
              levelFilter === l ? LEVEL_STYLE[l].pill : "bg-zinc-900 text-zinc-400 ring-zinc-800 hover:ring-zinc-600"
            }`}
          >
            {LEVEL_LABELS[l]} · {counts[l] ?? 0}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <span className="h-2 w-2 rounded-full bg-rose-400 animate-soft-pulse" />
              À prendre en charge <span className="text-zinc-500 font-normal">({active.length})</span>
            </h2>
            {active.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 text-sm text-emerald-200">
                <CircleCheck className="h-5 w-5" /> Personne n'attend : toutes les alertes ont un soignant.
              </div>
            ) : (
              active.map((a) => <AlertRow key={a.id} a={a} />)
            )}
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <Hand className="h-4 w-4 text-brand-300" />
              Prises en charge <span className="text-zinc-500 font-normal">({taken.length})</span>
            </h2>
            {taken.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 px-5 py-4 text-sm text-zinc-500">
                Aucune alerte en cours de traitement.
              </div>
            ) : (
              taken.map((a) => <AlertRow key={a.id} a={a} />)
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-5 text-sm">
            <div className="flex items-center gap-2 font-semibold text-zinc-100">
              <Info className="h-4 w-4 text-brand-300" /> Gérer une alerte
            </div>
            <ol className="mt-3 space-y-2 text-zinc-400">
              <li><span className="text-zinc-200 font-medium">Je prends en charge</span> : vous avez vu l'alerte et vous y allez. Elle reste visible, avec votre nom.</li>
              <li><span className="text-zinc-200 font-medium">Résolu</span> : la situation est réglée, l'alerte se ferme.</li>
            </ol>
          </div>
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-5 text-sm">
            <div className="flex items-center gap-2 font-semibold text-zinc-100">
              <TrendingUp className="h-4 w-4 text-brand-300" /> Escalade automatique
            </div>
            <p className="mt-2 text-zinc-400">
              Sans prise en charge, une alerte monte d'un niveau : Attention → Alerte en 10 min, Alerte → Urgence en 5 min,
              Urgence → Danger vital en 3 min.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-5">
            <div className="text-sm font-semibold text-zinc-100 mb-3">Les 5 niveaux</div>
            <div className="space-y-2.5">
              {[1, 2, 3, 4, 5].map((l) => (
                <div key={l} className="flex items-start gap-2.5">
                  <AlertBadge level={l} />
                  <span className="text-xs text-zinc-400">{LEVEL_DESCRIPTIONS[l]}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
