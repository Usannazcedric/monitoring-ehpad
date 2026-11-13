import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, Ban, BatteryFull, Bluetooth, Hand, Radio, ShieldCheck, Siren, Undo2, Vibrate,
} from "lucide-react";
import { useStore } from "@/store/store";
import { AlertBadge } from "@/components/AlertBadge";
import {
  ACTIVITY_LABELS, fmtRelative, isFallActivity, reasonLabel, secondsSince, STALE_AFTER_S,
} from "@/lib/format";
import { BRACELET_RESIDENT, residentInfo } from "@/lib/residents";

type BraceletState = "normal" | "compte" | "alerte" | "annule" | "retire" | "batterie";

const STATES: Record<BraceletState, { label: string; detail: string; ring: string; glow: string; pulse: boolean; vibrate: boolean; dashed?: boolean }> = {
  normal: { label: "Porté · tout va bien", detail: "Le bracelet surveille les mouvements et envoie un signe de vie toutes les 5 min.", ring: "#2dd4bf", glow: "#14b8a6", pulse: false, vibrate: false },
  compte: { label: "Chute détectée · 15 s pour annuler", detail: "Le bracelet vibre. Si la résidente va bien, elle appuie sur ANNULER ; sinon l'alerte part.", ring: "#fbbf24", glow: "#f59e0b", pulse: true, vibrate: true },
  alerte: { label: "Alerte envoyée au soignant", detail: "Urgence, chute : le soignant de garde est prévenu sur son téléphone. Sans réponse, l'alerte monte toute seule.", ring: "#f43f5e", glow: "#e11d48", pulse: true, vibrate: false },
  annule: { label: "Chute annulée · signalée au poste", detail: "Pas d'alarme, mais une information au soignant pour un passage à la ronde. Toujours couchée 60 s après ? L'alerte repart.", ring: "#38bdf8", glow: "#0ea5e9", pulse: false, vibrate: false },
  retire: { label: "Bracelet muet · mesures suspendues", detail: "Retiré, batterie vide ou hors réseau : jamais lu comme « tout va bien ». Alerte technique au poste au bout de 30 min (30 s en démo).", ring: "#64748b", glow: "#475569", pulse: false, vibrate: false, dashed: true },
  batterie: { label: "Batterie faible · à recharger", detail: "Alerte au poste 24 h avant l'arrêt. Un second bracelet est porté pendant la charge.", ring: "#fbbf24", glow: "#d97706", pulse: false, vibrate: false },
};

const PREVIEWS: { key: BraceletState | "live"; label: string }[] = [
  { key: "live", label: "En direct" },
  { key: "normal", label: "Normal" },
  { key: "compte", label: "Compte à rebours" },
  { key: "alerte", label: "Alerte envoyée" },
  { key: "annule", label: "Annulée" },
  { key: "retire", label: "Retiré / muet" },
  { key: "batterie", label: "Batterie faible" },
];

function BraceletDrawing({ state }: { state: BraceletState }) {
  const s = STATES[state];
  return (
    <svg viewBox="0 0 320 540" className="w-full max-w-[300px] drop-shadow-[0_30px_40px_rgba(0,0,0,0.55)]" role="img" aria-label={`Bracelet Veilleur : ${s.label}`}>
      <defs>
        <linearGradient id="strap" x1="0" x2="1">
          <stop offset="0" stopColor="#0f766e" />
          <stop offset="0.5" stopColor="#14b8a6" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
        <linearGradient id="case" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b3750" />
          <stop offset="1" stopColor="#0a0f1c" />
        </linearGradient>
        <radialGradient id="face" cx="0.5" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#1b2438" />
          <stop offset="1" stopColor="#0a0f1c" />
        </radialGradient>
        <radialGradient id="call" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset="1" stopColor="#be123c" />
        </radialGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {/* bracelet souple */}
      <rect x="100" y="0" width="120" height="190" rx="26" fill="url(#strap)" />
      <rect x="100" y="350" width="120" height="190" rx="26" fill="url(#strap)" />
      {[400, 432, 464, 496].map((y) => <circle key={y} cx="160" cy={y} r="5" fill="#0b3b38" />)}
      <rect x="100" y="0" width="120" height="190" rx="26" fill="none" stroke="#5eead4" strokeOpacity="0.25" />
      <rect x="100" y="350" width="120" height="190" rx="26" fill="none" stroke="#5eead4" strokeOpacity="0.25" />

      {/* vibrations du compte à rebours */}
      {s.vibrate && (
        <g stroke={s.ring} strokeWidth="4" fill="none" strokeLinecap="round" className="animate-soft-pulse">
          <path d="M44 230 q-14 40 0 80" /><path d="M24 214 q-22 56 0 112" />
          <path d="M276 230 q14 40 0 80" /><path d="M296 214 q22 56 0 112" />
        </g>
      )}

      {/* boîtier */}
      <rect x="62" y="160" width="196" height="220" rx="58" fill="url(#case)" stroke="#46546e" strokeWidth="2" />
      <rect x="70" y="168" width="180" height="204" rx="52" fill="url(#face)" />

      {/* bouton ANNULER, sur la tranche droite */}
      <rect x="254" y="236" width="16" height="68" rx="8" fill="#10b981" stroke="#065f46" strokeWidth="2" />
      <text x="292" y="270" fill="#6ee7b7" fontSize="11" fontWeight="700" textAnchor="middle" transform="rotate(90 292 270)" letterSpacing="2">ANNULER</text>

      {/* anneau lumineux d'état */}
      <circle cx="160" cy="270" r="66" fill="none" stroke={s.glow} strokeWidth="10" opacity="0.55" filter="url(#glow)" className={s.pulse ? "animate-soft-pulse" : ""} />
      <circle cx="160" cy="270" r="66" fill="none" stroke={s.ring} strokeWidth="5" strokeDasharray={s.dashed ? "10 8" : undefined} className={s.pulse ? "animate-soft-pulse" : ""} />

      {/* bouton d'appel */}
      <circle cx="160" cy="270" r="44" fill="url(#call)" stroke="#fecdd3" strokeOpacity="0.35" strokeWidth="2" />
      <text x="160" y="266" fill="#fff" fontSize="15" fontWeight="800" textAnchor="middle" letterSpacing="1.5">APPEL</text>
      <text x="160" y="284" fill="#ffe4e6" fontSize="10" fontWeight="600" textAnchor="middle" opacity="0.85">appui long</text>

      <text x="160" y="200" fill="#94a3b8" fontSize="10" fontWeight="700" textAnchor="middle" letterSpacing="4">VEILLEUR</text>
      {state === "batterie" && (
        <g transform="translate(144 348)">
          <rect width="28" height="12" rx="3" fill="none" stroke="#fbbf24" strokeWidth="2" />
          <rect x="28" y="4" width="3" height="4" rx="1" fill="#fbbf24" />
          <rect x="3" y="3" width="6" height="6" rx="1" fill="#fbbf24" />
        </g>
      )}
    </svg>
  );
}

function Feature({ icon: Icon, title, text }: { icon: typeof Activity; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-zinc-800 text-zinc-300">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div>
        <div className="text-sm font-semibold text-zinc-100">{title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-zinc-400">{text}</div>
      </div>
    </div>
  );
}

export function BraceletPage() {
  const resident = useStore((s) => s.residents.get(BRACELET_RESIDENT));
  const alertsMap = useStore((s) => s.alerts);
  const [preview, setPreview] = useState<BraceletState | "live">("live");
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const info = residentInfo(BRACELET_RESIDENT);
  const myAlerts = useMemo(
    () => Array.from(alertsMap.values()).filter((a) => a.resident_id === BRACELET_RESIDENT).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [alertsMap],
  );

  const live: BraceletState = useMemo(() => {
    if (!resident || secondsSince(resident.last_seen) > STALE_AFTER_S) return "retire";
    if (isFallActivity(resident.motion?.activity)) return "alerte";
    if (myAlerts.some((a) => a.status === "active" && /fall|chute : toujours/i.test(a.reason))) return "alerte";
    const last = myAlerts[0];
    if (last && /annulee/i.test(last.reason) && secondsSince(last.created_at) < 120) return "annule";
    return "normal";
  }, [resident, myAlerts]);

  const shown = preview === "live" ? live : preview;
  const st = STATES[shown];
  const m = resident?.motion;
  const g = (x?: number) => (typeof x === "number" ? (x / 9.80665).toFixed(2) : "—");
  const norm = m ? Math.sqrt(m.ax ** 2 + m.ay ** 2 + m.az ** 2) / 9.80665 : null;

  return (
    <div className="px-4 py-6 sm:px-10 sm:py-10 max-w-6xl space-y-6">
      <header>
        <h1 className="text-[26px] font-semibold tracking-tight text-white">Bracelet Veilleur</h1>
        <p className="mt-1 text-[14px] text-zinc-500">
          Ce que porte la résidente : pas d'écran, un anneau lumineux, un bouton d'appel et un bouton pour annuler une fausse alerte.
          Maquette de ce qu'on attend du bracelet acheté (dossier, partie 3.2).
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
          <div className="flex flex-wrap gap-1.5">
            {PREVIEWS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreview(p.key)}
                className={`rounded-md px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset transition ${
                  preview === p.key ? "bg-zinc-100 text-zinc-950 ring-zinc-100" : "bg-zinc-900 text-zinc-400 ring-zinc-700 hover:text-zinc-200"
                }`}
              >
                {p.key === "live" && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" />}
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-6 flex justify-center">
            <BraceletDrawing state={shown} />
          </div>
          <div className="mt-6 rounded-xl bg-zinc-950 p-4 ring-1 ring-zinc-700 text-center">
            <div className="text-base font-semibold" style={{ color: st.ring }}>{st.label}</div>
            <div className="mt-1 text-xs text-zinc-400">{st.detail}</div>
            {preview !== "live" && (
              <div className="mt-2 text-[11px] text-zinc-500">Aperçu d'un état. « En direct » suit la carte Wokwi.</div>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-zinc-700 bg-zinc-900 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[12px] font-medium text-emerald-500">
                  <Radio className="h-3.5 w-3.5" /> En direct · carte Wokwi
                </div>
                <Link to={`/resident/${BRACELET_RESIDENT}`} className="mt-1 block text-lg font-semibold text-white hover:underline">
                  Chambre {info.room} · {info.name}
                </Link>
              </div>
              <span className="rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset" style={{ color: STATES[live].ring, borderColor: STATES[live].ring }}>
                {STATES[live].label}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-xl bg-zinc-950 p-3 ring-1 ring-zinc-700">
                <dt className="text-[11px] text-zinc-500">Dernière mesure</dt>
                <dd className="mt-1 font-semibold text-white tabular">{resident ? `il y a ${fmtRelative(resident.last_seen)}` : "—"}</dd>
              </div>
              <div className="rounded-xl bg-zinc-950 p-3 ring-1 ring-zinc-700">
                <dt className="text-[11px] text-zinc-500">Activité</dt>
                <dd className={`mt-1 font-semibold ${isFallActivity(m?.activity) ? "text-rose-300" : "text-white"}`}>
                  {m?.activity ? ACTIVITY_LABELS[m.activity] ?? m.activity : "—"}
                </dd>
              </div>
              <div className="rounded-xl bg-zinc-950 p-3 ring-1 ring-zinc-700">
                <dt className="text-[11px] text-zinc-500">Accélération (g)</dt>
                <dd className="mt-1 font-semibold text-white tabular text-xs leading-5">x {g(m?.ax)} · y {g(m?.ay)} · z {g(m?.az)}</dd>
              </div>
              <div className="rounded-xl bg-zinc-950 p-3 ring-1 ring-zinc-700">
                <dt className="text-[11px] text-zinc-500">Norme</dt>
                <dd className="mt-1 font-semibold text-white tabular">{norm !== null ? `${norm.toFixed(2)} g` : "—"}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <div className="text-xs font-semibold text-zinc-300 mb-2">Dernières alertes de ce bracelet</div>
              {myAlerts.length === 0 ? (
                <div className="text-xs text-zinc-500">Aucune alerte en cours.</div>
              ) : (
                <ul className="space-y-1.5">
                  {myAlerts.slice(0, 4).map((a) => (
                    <li key={a.id} className="flex items-center gap-2 text-sm">
                      <AlertBadge level={a.level} />
                      <span className="flex-1 truncate text-zinc-200">{reasonLabel(a.reason)}</span>
                      <span className="text-xs text-zinc-500 tabular">il y a {fmtRelative(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-4 text-[11px] text-zinc-500">
              Le compte à rebours se joue sur le bracelet : rien n'est envoyé pendant les 15 s où la résidente peut annuler.
              Pour la démo, lancer <code className="text-zinc-300">./demo.sh</code> puis ▶ dans Wokwi.
            </p>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <Feature icon={Activity} title="Accéléromètre basse consommation" text="Réveille le bracelet sur un choc. Chute = choc > 2 g, puis immobilité, puis position couchée." />
            <Feature icon={Hand} title="Détection de port" text="Contact avec la peau : un bracelet retiré coupe les mesures et prévient le poste, jamais de faux silence." />
            <Feature icon={Siren} title="Bouton d'appel" text="Un appui long : Danger vital chez le soignant de garde, en moins d'une seconde." />
            <Feature icon={Undo2} title="Bouton Annuler" text="15 s en démo, 30 s dans le produit, pour annuler une fausse alerte. L'annulation reste signalée." />
            <Feature icon={Vibrate} title="Vibreur" text="Le compte à rebours se sent, même sans écran ni lunettes." />
            <Feature icon={BatteryFull} title="Autonomie de 21,5 jours" text="Calculée sur 300 mAh (hypothèse). Recharge hebdomadaire, alerte 24 h avant l'arrêt." />
            <Feature icon={Bluetooth} title="Bluetooth basse consommation" text="Vers une passerelle par chambre ou couloir, puis le réseau de l'établissement." />
            <Feature icon={ShieldCheck} title="Étanche et désinfectable" text="IP67 pour la douche, matériaux testés pour la peau (ISO 10993)." />
          </section>

          <section className="flex gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-xs text-zinc-400">
            <Ban className="h-4 w-4 shrink-0 text-zinc-500" />
            <span>
              <span className="font-semibold text-zinc-200">Ce qu'il ne fait pas, exprès</span> : ni pouls ni oxygène (version 1 recentrée sur la chute),
              ni GPS, ni micro, ni caméra.
            </span>
          </section>
        </div>
      </div>
    </div>
  );
}
