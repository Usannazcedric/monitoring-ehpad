import { FloorPlan } from "@/components/FloorPlan";
import { useStore } from "@/store/store";

export function MovementsPage() {
  const rooms = useStore((s) => s.rooms);
  const activePir = Array.from(rooms.values()).filter((r) => r.pir === 1).length;
  const openDoors = Array.from(rooms.values()).filter((r) => r.door === 1).length;

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-5xl space-y-6">
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Plan & mouvements</h1>
          <div className="text-sm text-zinc-400 mt-1">
            Présence et portes de chaque chambre, en temps réel. Ces capteurs voient aussi une chute que le bracelet aurait ratée.
          </div>
        </div>
        <div className="ml-auto flex gap-3">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/70 px-4 py-3">
            <div className="text-2xl font-bold text-emerald-300 tabular leading-none">{activePir}</div>
            <div className="mt-1 text-xs text-zinc-400">Pièces avec mouvement</div>
          </div>
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/70 px-4 py-3">
            <div className="text-2xl font-bold text-amber-300 tabular leading-none">{openDoors}</div>
            <div className="mt-1 text-xs text-zinc-400">Portes ouvertes</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-5">
        <FloorPlan />
      </div>
    </div>
  );
}
