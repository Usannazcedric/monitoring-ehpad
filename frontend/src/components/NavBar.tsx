import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { BellRing, LayoutDashboard, Map, Users, Watch, Moon } from "lucide-react";
import { useStore } from "@/store/store";

const LINKS = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/alerts", label: "Alertes", icon: BellRing, end: false },
  { to: "/movements", label: "Plan & mouvements", icon: Map, end: false },
  { to: "/bracelet", label: "Bracelet Veilleur", icon: Watch, end: false },
  { to: "/personnel", label: "Personnel", icon: Users, end: false },
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 grid place-items-center shadow-lg shadow-brand-900/50">
        <Moon className="h-[18px] w-[18px] text-zinc-950" strokeWidth={2.5} />
      </div>
      <div className="leading-tight">
        <div className="font-bold text-white tracking-tight">Veilleur</div>
        <div className="text-[11px] text-zinc-400">Surveillance de nuit</div>
      </div>
    </div>
  );
}

function Status({ compact = false }: { compact?: boolean }) {
  const connected = useStore((s) => s.connected);
  return (
    <div className={`flex items-center gap-2 text-xs ${compact ? "" : "rounded-xl bg-zinc-900 ring-1 ring-zinc-800 px-3 py-2.5"}`}>
      <span className="relative flex h-2.5 w-2.5">
        {connected && <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ring-pulse" />}
        <span className={`relative h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-400" : "bg-rose-500"}`} />
      </span>
      <span className={connected ? "text-zinc-300" : "text-rose-300 font-semibold"}>
        {connected ? "Capteurs connectés" : "Capteurs déconnectés"}
      </span>
    </div>
  );
}

export function NavBar() {
  const alertCount = useStore((s) => s.alerts.size);
  const guards = useStore((s) => s.guards);
  const now = useClock();

  const item = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive ? "bg-brand-500/15 text-brand-200 ring-1 ring-inset ring-brand-500/30" : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100"
    }`;

  return (
    <>
      {/* Grand écran : barre latérale */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-zinc-800/80 bg-zinc-950/95 px-4 py-5">
        <Logo />
        <div className="mt-6 rounded-xl bg-zinc-900 ring-1 ring-zinc-800 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">Heure</div>
          <div className="text-2xl font-semibold text-white tabular">
            {now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="text-xs text-zinc-400 capitalize">
            {now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>
        <nav className="mt-6 flex flex-col gap-1">
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={item}>
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1">{label}</span>
              {to === "/alerts" && alertCount > 0 && (
                <span className="rounded-full bg-rose-500 text-white text-[11px] font-bold px-2 py-0.5 tabular">{alertCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="rounded-xl bg-zinc-900 ring-1 ring-zinc-800 px-3 py-3 text-xs">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">Garde de nuit</div>
            {Object.entries(guards).map(([wing, name]) => (
              <div key={wing} className="flex items-center justify-between py-0.5">
                <span className="text-zinc-400">Aile {wing}</span>
                <span className="text-zinc-100 font-medium">{name}</span>
              </div>
            ))}
          </div>
          <Status />
        </div>
      </aside>

      {/* Petit écran : barre du haut */}
      <header className="lg:hidden sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo />
          <Status compact />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 scrollbar-thin">
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={(s) => `${item(s)} whitespace-nowrap !py-2`}>
              <Icon className="h-4 w-4" />
              {label}
              {to === "/alerts" && alertCount > 0 && (
                <span className="rounded-full bg-rose-500 text-white text-[11px] font-bold px-1.5 tabular">{alertCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>
    </>
  );
}
