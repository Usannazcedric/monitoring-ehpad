export function fmtTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function fmtRelative(iso?: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${Math.round(s / 3600)} h`;
}

/** Secondes écoulées depuis la dernière mesure (Infinity si jamais reçue). */
export function secondsSince(iso?: string | null): number {
  if (!iso) return Infinity;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isNaN(ms) ? Infinity : ms / 1000;
}

/** Un capteur muet n'est pas un résident qui va bien : au-delà de ce délai, on le signale. */
export const STALE_AFTER_S = 20;

export const LEVEL_LABELS: Record<number, string> = {
  1: "Information",
  2: "Attention",
  3: "Alerte",
  4: "Urgence",
  5: "Danger vital",
};

export const LEVEL_COLORS: Record<number, string> = {
  1: "bg-level-1",
  2: "bg-level-2",
  3: "bg-level-3",
  4: "bg-level-4",
  5: "bg-level-5",
};

/** Styles par niveau : pastille, contour de carte, barre latérale, texte. Teintes discrètes,
 *  lisibles en thème clair comme en sombre ; seul « Danger vital » est en couleur pleine. */
export const LEVEL_STYLE: Record<number, { pill: string; ring: string; bar: string; text: string; dot: string }> = {
  0: { pill: "bg-zinc-800 text-zinc-400 ring-zinc-700", ring: "ring-transparent", bar: "bg-transparent", text: "text-zinc-400", dot: "bg-emerald-500" },
  1: { pill: "bg-sky-500/10 text-sky-400 ring-sky-500/25", ring: "ring-sky-500/30", bar: "bg-level-1", text: "text-sky-400", dot: "bg-level-1" },
  2: { pill: "bg-amber-500/10 text-amber-400 ring-amber-500/30", ring: "ring-amber-500/40", bar: "bg-level-2", text: "text-amber-400", dot: "bg-level-2" },
  3: { pill: "bg-orange-500/10 text-orange-400 ring-orange-500/30", ring: "ring-orange-500/40", bar: "bg-level-3", text: "text-orange-400", dot: "bg-level-3" },
  4: { pill: "bg-rose-500/10 text-rose-400 ring-rose-500/30", ring: "ring-rose-500/40", bar: "bg-level-4", text: "text-rose-400", dot: "bg-level-4" },
  5: { pill: "bg-level-5 text-pure-white ring-level-5", ring: "ring-level-5/50", bar: "bg-level-5", text: "text-red-400", dot: "bg-level-5" },
};

export const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Situation à surveiller, pas d'urgence",
  2: "Constante légèrement anormale, à vérifier",
  3: "Anomalie significative, intervention conseillée",
  4: "Situation grave, intervention immédiate requise",
  5: "Urgence vitale — appeler le 15",
};

export const ACTIVITY_LABELS: Record<string, string> = {
  walking: "En marche",
  sitting: "Assis(e)",
  lying: "Allongé(e)",
  idle: "Au calme",
  // Trois orthographes circulent pour la chute : "falling" vient du simulateur
  // Python, "fall" est la valeur que teste le moteur d'alertes du backend et que
  // publie le firmware ESP32, "fall_detected" était la seule attendue ici. Tant
  // que les producteurs ne sont pas alignés, le dashboard les accepte toutes —
  // sinon une chute s'affiche comme une activité inconnue.
  fall: "Chute détectée",
  falling: "Chute détectée",
  fall_detected: "Chute détectée",
  stationary: "Immobile",
};

/** Vrai pour toutes les orthographes de chute en circulation. */
export function isFallActivity(activity?: string | null): boolean {
  return activity === "fall" || activity === "falling" || activity === "fall_detected";
}

export const STATUS_BY_LEVEL: Record<number, { text: string; cls: string }> = {
  0: { text: "Tout va bien", cls: "text-emerald-400" },
  1: { text: "Information", cls: "text-sky-300" },
  2: { text: "Attention requise", cls: "text-amber-300" },
  3: { text: "Alerte active", cls: "text-orange-300" },
  4: { text: "Urgence", cls: "text-rose-300 font-semibold" },
  5: { text: "Danger vital", cls: "text-red-300 font-bold" },
};

/**
 * Motif d'alerte lisible par un soignant, en français. Le backend et le firmware
 * écrivent des motifs techniques (« hr critical (150) ») : on les traduit ici.
 */
export function reasonLabel(reason?: string | null): string {
  if (!reason) return "—";
  const r = reason.trim();
  const num = (m: RegExpMatchArray | null) => (m ? m[1] : "");
  if (/^fall detected/i.test(r)) {
    if (/toujours au sol/i.test(r)) return "Chute : toujours au sol après annulation";
    return "Chute détectée";
  }
  if (/^hr critical/i.test(r)) return `Rythme cardiaque critique (${num(r.match(/\((\d+)/))} bpm)`;
  if (/^hr elevated/i.test(r)) return `Rythme cardiaque élevé (${num(r.match(/\((\d+)/))} bpm)`;
  if (/^spo2 critical/i.test(r)) return `Oxygène critique (${num(r.match(/\((\d+)/))} %)`;
  if (/^spo2 low/i.test(r)) return `Oxygène bas (${num(r.match(/\((\d+)/))} %)`;
  if (/^spo2 borderline/i.test(r)) return `Oxygène limite (${num(r.match(/\((\d+)/))} %)`;
  if (/^temp deviation/i.test(r)) return `Température anormale (${num(r.match(/\(([\d.]+)/))} °C)`;
  if (/^ml risk/i.test(r)) return "Risque de dégradation calculé élevé";
  if (/^auto-escalated/i.test(r)) return "Escalade automatique : alerte non prise en charge";
  if (/appel SOS/i.test(r)) return "Appel SOS de la résidente";
  if (/bracelet non porte/i.test(r)) return "Bracelet non porté : mesures suspendues";
  if (/chute annulee/i.test(r)) return "Chute annulée par la résidente : passage à la ronde";
  return r.charAt(0).toUpperCase() + r.slice(1);
}
