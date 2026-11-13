import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, ExternalLink, RotateCcw, Timer } from "lucide-react";
import { useStore } from "@/store/store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { secondsSince, STALE_AFTER_S } from "@/lib/format";
import { BRACELET_RESIDENT, residentInfo } from "@/lib/residents";

const WOKWI_URL = "https://wokwi.com/projects/480574192585000961";

// Déroulé de la démo : 5 minutes, 7 temps (guide « La démo idéale »), adapté au cas A.
const STEPS: { time: string; title: string; doIt: string; say: string }[] = [
  {
    time: "30 s", title: "Le persona",
    doIt: "Montrer la chambre 121 sur le tableau de bord.",
    say: "« Jeanne, 87 ans, déambulateur, deux chutes la nuit l'an dernier en allant aux toilettes. La nuit, deux soignants pour 80 résidents. »",
  },
  {
    time: "45 s", title: "Le montage dans Wokwi",
    doIt: "Montrer chaque composant de la carte.",
    say: "« Le MPU-6050, c'est l'accéléromètre du bracelet. Bouton rouge : appel. Bouton vert : annuler. Interrupteurs : bracelet porté, porte de la chambre. Le potentiomètre de pouls vient du module 1, il est hors finalité. »",
  },
  {
    time: "45 s", title: "La situation normale",
    doIt: "Carte calme sur le tableau de bord ; montrer un message dans le moniteur série.",
    say: "« Toutes les 2 secondes, la carte publie ce message MQTT, qui arrive ici. »",
  },
  {
    time: "1 min", title: "L'événement : une chute",
    doIt: "MPU-6050 : X à 2 g, puis X = 1 et Z = 0, ne plus toucher. Bips 15 s, puis Urgence. Cliquer « Je prends en charge ». Variante : appuyer sur ANNULER pendant les bips.",
    say: "« Choc, immobilité, position couchée : chute. Elle a 15 secondes pour annuler. L'alerte arrive chez le soignant de nuit ; sans réponse, elle monte jusqu'à l'opérateur, puis le 15. »",
  },
  {
    time: "1 min", title: "Les vraies données",
    doIt: "Montrer la figure SisFall du dossier (partie 4.2).",
    say: "« Sur 1 798 chutes du jeu public SisFall, notre règle en détecte 97 %, avec 3 fausses alertes par heure. La règle « chute libre » du module 2 n'en voit que 13 % : une personne ne tombe pas comme un téléphone. »",
  },
  {
    time: "30 s", title: "Robustesse et autonomie",
    doIt: "Basculer l'interrupteur « porté » : plus de mesures, puis alerte au bout de 30 s.",
    say: "« Bracelet retiré : on n'envoie rien de faux, et le poste est prévenu. Autonomie calculée : 21,5 jours sur 300 mAh, avec ces hypothèses. »",
  },
  {
    time: "30 s", title: "Les limites",
    doIt: "Rester sur le tableau de bord.",
    say: "« Nos chutes de référence sont jouées par des jeunes sur un tapis, avec un capteur à la taille. Le vrai bracelet et les vrais essais arrivent au Projet 2. »",
  },
];

const GESTURES: { gesture: string; result: string }[] = [
  { gesture: "MPU-6050 : X à 2, puis X = 1 et Z = 0, ne plus toucher", result: "Bips 15 s, puis Urgence : chute" },
  { gesture: "Même chute, puis bouton vert ANNULER pendant les bips", result: "Information « chute annulée » ; l'alerte repart si elle reste couchée 60 s" },
  { gesture: "MPU-6050 : X à 2, puis retour X = 0 et Z = 1", result: "Rien : « assis lourdement ? »" },
  { gesture: "Interrupteur de droite (bracelet retiré)", result: "Plus de mesures, puis Attention au bout de 30 s" },
  { gesture: "Bouton rouge", result: "Danger vital en moins d'une seconde" },
];

const SCENARIOS: { name: string; label: string }[] = [
  { name: "fall", label: "Chute" },
  { name: "cardiac", label: "Malaise cardiaque" },
  { name: "fugue", label: "Sortie de chambre" },
  { name: "normal", label: "Retour au calme" },
];

function Panel({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-700 bg-zinc-900">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-700 px-5 py-3.5">
        <h2 className="text-[15px] font-semibold text-white">{title}</h2>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatusRow({ ok, label, detail }: { ok: boolean | null; label: string; detail: string }) {
  const dot = ok === null ? "bg-zinc-600" : ok ? "bg-emerald-500" : "bg-amber-500";
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
      <span className="flex items-center gap-2 text-zinc-200"><span className={`h-2 w-2 rounded-full ${dot}`} />{label}</span>
      <span className="text-zinc-500 text-right">{detail}</span>
    </div>
  );
}

function CopyCommand({ cmd }: { cmd: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(cmd).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}
      className="flex w-full items-center justify-between gap-3 rounded-lg bg-zinc-950 px-3 py-2 font-mono text-[13px] text-zinc-200 ring-1 ring-zinc-700 hover:ring-zinc-500"
      title="Copier"
    >
      <span>$ {cmd}</span>
      {done ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-zinc-500" />}
    </button>
  );
}

export function DemoPage() {
  const connected = useStore((s) => s.connected);
  const residents = useStore((s) => s.residents);
  const alerts = useStore((s) => s.alerts);
  const upsertAlert = useStore((s) => s.upsertAlert);
  const presentation = useStore((s) => s.presentation);
  const setPresentation = useStore((s) => s.setPresentation);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [room, setRoom] = useState("R007");
  const [sent, setSent] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [calm, setCalm] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      api.health().then(() => !cancelled && setServerOk(true)).catch(() => !cancelled && setServerOk(false));
      api.getCalm().then((r) => !cancelled && setCalm(r.on)).catch(() => !cancelled && setCalm(null));
    };
    check();
    const t = setInterval(() => { check(); setTick((x) => x + 1); }, 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const bracelet = residents.get(BRACELET_RESIDENT);
  const braceletAge = secondsSince(bracelet?.last_seen);
  const open = useMemo(() => [...alerts.values()].filter((a) => a.status !== "resolved"), [alerts]);
  const simulated = useMemo(
    () => [...residents.keys()].filter((id) => id !== BRACELET_RESIDENT).sort(),
    [residents],
  );

  const toggleCalm = async (on: boolean) => {
    try { setCalm((await api.setCalm(on)).on); } catch { setCalm(null); }
  };

  // Sans mode calme, les résidents simulés renvoient leurs constantes anormales
  // et chaque alerte clôturée se rouvre à la mesure suivante (1 s).
  const resetAll = async () => {
    setBusy(true);
    try {
      if (!calm) {
        await toggleCalm(true);
        await new Promise((r) => setTimeout(r, 3000)); // laisser arriver des mesures saines
      }
      const current = [...useStore.getState().alerts.values()].filter((a) => a.status !== "resolved");
      for (const a of current) {
        try { upsertAlert(await api.resolveAlert(a.id)); } catch { /* déjà fermée */ }
      }
    } finally {
      setBusy(false);
    }
  };

  const inject = async (name: string) => {
    try {
      await api.injectScenario(room, name);
      setSent(`${SCENARIOS.find((s) => s.name === name)?.label} envoyé à la chambre ${residentInfo(room).room}`);
    } catch {
      setSent("Le simulateur ne répond pas");
    }
    setTimeout(() => setSent(null), 4000);
  };

  return (
    <div className="px-4 py-6 sm:px-10 sm:py-10 max-w-[1200px] space-y-8">
      <header>
        <h1 className="text-[26px] font-semibold tracking-tight text-white">Démo</h1>
        <p className="mt-1 text-[14px] text-zinc-500">
          Tout pour présenter en 5 minutes : préparer l'écran, repartir d'un tableau propre, dérouler l'histoire de Jeanne.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="1. Préparer l'écran">
          <div className="space-y-3">
            <CopyCommand cmd="./demo.sh" />
            <a
              href={WOKWI_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-lg px-3 py-2 text-[13px] text-zinc-200 ring-1 ring-zinc-700 hover:ring-zinc-500"
            >
              Ouvrir la carte dans Wokwi, puis ▶ et garder l'onglet visible
              <ExternalLink className="h-4 w-4 text-zinc-500" />
            </a>
          </div>
          <div className="mt-4 divide-y divide-zinc-700">
            <StatusRow ok={serverOk} label="Serveur" detail={serverOk === null ? "vérification…" : serverOk ? "répond" : "ne répond pas"} />
            <StatusRow ok={connected} label="Flux temps réel" detail={connected ? "connecté" : "déconnecté"} />
            <StatusRow
              ok={bracelet ? braceletAge <= STALE_AFTER_S : false}
              label="Carte Wokwi (chambre 121)"
              detail={!bracelet ? "aucune donnée : lancer ▶ dans Wokwi" : braceletAge <= STALE_AFTER_S ? "envoie ses mesures" : "muette : onglet Wokwi masqué ?"}
            />
            <StatusRow ok={null} label="Escalade accélérée (mode démo)" detail="Attention → Danger vital en ~10 min" />
          </div>
        </Panel>

        <Panel title="2. Repartir d'un tableau propre">
          <div className="space-y-4 text-[13px]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-zinc-100">Clôturer toutes les alertes</div>
                <div className="text-zinc-500">{open.length} alerte{open.length > 1 ? "s" : ""} ouverte{open.length > 1 ? "s" : ""}</div>
              </div>
              <Button variant="secondary" disabled={busy || open.length === 0} onClick={resetAll}>
                <RotateCcw className="h-4 w-4" /> {busy ? "Clôture…" : "Tout clôturer"}
              </Button>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <div>
                <div className="font-medium text-zinc-100">Résidents simulés au calme</div>
                <div className="text-zinc-500">
                  {calm === null ? "simulateur injoignable" : "Constantes saines : plus d'alerte qui se rouvre. Activé par « Tout clôturer »."}
                </div>
              </div>
              <button
                role="switch"
                aria-checked={!!calm}
                disabled={calm === null}
                onClick={() => toggleCalm(!calm)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${calm ? "bg-zinc-100" : "bg-zinc-700"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-zinc-950 shadow transition-all ${calm ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <div>
                <div className="font-medium text-zinc-100">Mode présentation</div>
                <div className="text-zinc-500">N'afficher que la chambre 121, le bracelet Wokwi.</div>
              </div>
              <button
                role="switch"
                aria-checked={presentation}
                onClick={() => setPresentation(!presentation)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${presentation ? "bg-zinc-100" : "bg-zinc-700"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-zinc-950 shadow transition-all ${presentation ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </label>
            <p className="rounded-lg bg-zinc-800 px-3 py-2.5 text-[12px] text-zinc-400">
              Les 20 résidents simulés du MBA 1 ont des constantes de départ anormales, exprès, pour montrer tous les niveaux.
              Sans le mode calme, leurs alertes reviennent dès la mesure suivante et montent seules en Danger vital en une
              dizaine de minutes. Le mode calme leur donne des constantes saines ; le plan B (scénarios) marche toujours.
            </p>
          </div>
        </Panel>
      </div>

      <Panel
        title="3. Le déroulé, en 5 minutes"
        right={
          <button onClick={() => setDone(new Set())} className="text-[12px] text-zinc-500 hover:text-zinc-200">
            Tout décocher
          </button>
        }
      >
        <ol className="space-y-2">
          {STEPS.map((s, i) => {
            const checked = done.has(i);
            return (
              <li key={s.title}>
                <button
                  onClick={() => setDone((d) => { const n = new Set(d); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                  className={`flex w-full gap-4 rounded-lg px-3 py-3 text-left transition-colors ${checked ? "opacity-50" : "hover:bg-zinc-800/60"}`}
                >
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md ring-1 ${checked ? "bg-zinc-100 ring-zinc-100" : "ring-zinc-600"}`}>
                    {checked && <Check className="h-3.5 w-3.5 text-zinc-950" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-3">
                      <span className="text-[14px] font-semibold text-white">{i + 1}. {s.title}</span>
                      <span className="inline-flex items-center gap-1 text-[12px] text-zinc-500"><Timer className="h-3 w-3" />{s.time}</span>
                    </span>
                    <span className="mt-1 block text-[13px] text-zinc-300">{s.doIt}</span>
                    <span className="mt-1 block text-[13px] italic text-zinc-500">{s.say}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Gestes dans Wokwi">
          <table className="w-full text-left text-[13px]">
            <tbody className="divide-y divide-zinc-700">
              {GESTURES.map((g) => (
                <tr key={g.gesture}>
                  <td className="py-2.5 pr-4 text-zinc-200">{g.gesture}</td>
                  <td className="py-2.5 text-zinc-500">{g.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link to="/bracelet" className="mt-4 inline-flex items-center gap-1 text-[13px] text-zinc-400 hover:text-white">
            Voir les états du bracelet →
          </Link>
        </Panel>

        <Panel title="Plan B : simuler sans Wokwi">
          <p className="text-[13px] text-zinc-500">
            Si Wokwi ne compile pas, on déclenche l'événement sur un résident simulé. Pensez à quitter le mode présentation pour le voir.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[13px] text-white ring-1 ring-zinc-700 focus:outline-none focus:ring-zinc-500"
            >
              {simulated.map((id) => (
                <option key={id} value={id}>Chambre {residentInfo(id).room} · {residentInfo(id).name}</option>
              ))}
            </select>
            {SCENARIOS.map((s) => (
              <Button key={s.name} variant={s.name === "normal" ? "ghost" : "secondary"} onClick={() => inject(s.name)}>
                {s.label}
              </Button>
            ))}
          </div>
          {sent && <div className="mt-3 text-[12px] text-zinc-400">{sent}</div>}
          <p className="mt-4 text-[12px] text-zinc-500">
            Dernier recours : la vidéo de secours (2 à 3 min, lien dans le README). Le critère 4 est alors noté sur 18.
          </p>
        </Panel>
      </div>
    </div>
  );
}
