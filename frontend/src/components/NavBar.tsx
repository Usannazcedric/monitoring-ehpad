import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { BellRing, LayoutDashboard, Map, Moon, Sun, Users, Watch } from "lucide-react";
import { useStore } from "@/store/store";

const LINKS = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/alerts", label: "Alertes", icon: BellRing, end: false },
  { to: "/movements", label: "Plan & mouvements", icon: Map, end: false },
  { to: "/bracelet", label: "Bracelet", icon: Watch, end: false },
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

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
  );
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("veilleur-theme", next); } catch { /* navigation privée */ }
    setTheme(next);
  };
  return { theme, toggle };
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-7 w-7 rounded-lg bg-brand-600 grid place-items-center">
        <Moon className="h-3.5 w-3.5 text-[#fff]" strokeWidth={2.5} />
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold text-white tracking-tight">Veilleur</div>
      </div>
    </div>
  );
}

function Status() {
  const connected = useStore((s) => s.connected);
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-rose-500"}`} />
      <span className={connected ? "text-zinc-400" : "text-rose-400 font-medium"}>
        {connected ? "Capteurs connectés" : "Capteurs déconnectés"}
      </span>
    </div>
  );
}

function ThemeButton() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
      title="Changer de thème"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {theme === "dark" ? "Thème clair" : "Thème sombre"}
    </button>
  );
}

export function NavBar() {
  const alertCount = useStore((s) => s.alerts.size);
  const guards = useStore((s) => s.guards);
  const now = useClock();

  const item = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
      isActive ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
    }`;

  return (
    <>
      {/* Grand écran : barre latérale */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-zinc-700 bg-zinc-950 px-3 py-4">
        <div className="px-2"><Logo /></div>
        <div className="mt-6 px-2">
          <div className="text-[28px] font-semibold text-white tabular tracking-tight leading-none">
            {now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="mt-1 text-[13px] text-zinc-500 capitalize">
            {now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>
        <nav className="mt-6 flex flex-col gap-0.5">
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={item}>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {to === "/alerts" && alertCount > 0 && (
                <span className="rounded-md bg-rose-500/10 text-rose-400 text-[11px] font-semibold px-1.5 py-0.5 tabular">{alertCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-4 px-2">
          <div className="text-[13px]">
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2">Garde de nuit</div>
            {Object.entries(guards).map(([wing, name]) => (
              <div key={wing} className="flex items-center justify-between py-0.5">
                <span className="text-zinc-500">Aile {wing}</span>
                <span className="text-zinc-200">{name}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-zinc-700 pt-3 space-y-2">
            <Status />
            <div className="-mx-2"><ThemeButton /></div>
          </div>
        </div>
      </aside>

      {/* Petit écran : barre du haut */}
      <header className="lg:hidden sticky top-0 z-40 border-b border-zinc-700 bg-zinc-950/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo />
          <Status />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2.5 scrollbar-thin">
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={(s) => `${item(s)} whitespace-nowrap`}>
              <Icon className="h-4 w-4" />
              {label}
              {to === "/alerts" && alertCount > 0 && (
                <span className="rounded-md bg-rose-500/10 text-rose-400 text-[11px] font-semibold px-1.5 tabular">{alertCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>
    </>
  );
}
