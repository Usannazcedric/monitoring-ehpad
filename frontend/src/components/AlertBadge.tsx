import { LEVEL_LABELS, LEVEL_STYLE } from "@/lib/format";

export function AlertBadge({ level, size = "sm" }: { level: number; size?: "sm" | "md" }) {
  if (!level) return null;
  const style = LEVEL_STYLE[level] ?? LEVEL_STYLE[0];
  const pad = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset whitespace-nowrap ${pad} ${style.pill}`}
      title={`Niveau ${level} sur 5`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {level >= 4 && <span className={`absolute inset-0 rounded-full ${style.dot} animate-ring-pulse`} />}
        <span className={`relative h-1.5 w-1.5 rounded-full ${level === 5 ? "bg-white" : style.dot}`} />
      </span>
      {LEVEL_LABELS[level] ?? "?"}
    </span>
  );
}
