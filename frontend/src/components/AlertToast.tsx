import { BellRing, X } from "lucide-react";
import { useToasts } from "@/hooks/useToasts";
import { LEVEL_STYLE } from "@/lib/format";

export function AlertToast() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-[22rem] max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => {
        const style = LEVEL_STYLE[t.level ?? 0] ?? LEVEL_STYLE[0];
        return (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className="group relative overflow-hidden text-left rounded-xl border border-zinc-700 bg-zinc-900 shadow-lg shadow-black/10 pl-4 pr-3 py-3"
          >
            <span className={`absolute left-0 top-0 h-full w-[3px] ${style.bar}`} />
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 rounded-lg p-1.5 ${style.pill} ring-1 ring-inset`}>
                <BellRing className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-white">{t.title}</div>
                {t.description && <div className="text-xs text-zinc-300 mt-0.5">{t.description}</div>}
              </div>
              <X className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
