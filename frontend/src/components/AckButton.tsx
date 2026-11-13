import { useState } from "react";
import { Check, Hand, X } from "lucide-react";
import { Button } from "./ui/Button";
import { api, type Alert } from "@/lib/api";
import { useStore } from "@/store/store";

const STAFF_NAMES = [
  "Sophie Martin", "Pierre Dubois", "Nathalie Bernard", "Thomas Leroy",
  "Marie Lambert", "François Moreau", "Claire Fontaine", "Laurent Girard",
  "Dr. Isabelle Dupont", "Élise Rousseau",
];

export function AckButton({ alert, compact = false }: { alert: Alert; compact?: boolean }) {
  const upsertAlert = useStore((s) => s.upsertAlert);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState("");

  const confirmAck = async () => {
    setBusy(true);
    try {
      const updated = await api.ackAlert(alert.id, selectedStaff || undefined);
      upsertAlert(updated);
      setPicking(false);
    } catch (err) {
      console.error("ack_failed", err);
    } finally {
      setBusy(false);
    }
  };

  const onResolve = async () => {
    setBusy(true);
    try {
      const updated = await api.resolveAlert(alert.id);
      upsertAlert(updated);
    } catch (err) {
      console.error("resolve_failed", err);
    } finally {
      setBusy(false);
    }
  };

  const size = compact ? "!px-3 !py-1.5 !text-xs" : "";

  if (alert.status === "active" && picking) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={selectedStaff}
          onChange={(e) => setSelectedStaff(e.target.value)}
          className="flex-1 min-w-36 rounded-lg bg-zinc-900 text-white text-[13px] px-2.5 py-1.5 ring-1 ring-zinc-700 focus:outline-none focus:ring-zinc-500"
        >
          <option value="">Qui prend en charge ?</option>
          {STAFF_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <Button variant="primary" className={size} disabled={busy || !selectedStaff} onClick={confirmAck}>
          <Check className="h-4 w-4" /> Confirmer
        </Button>
        <button onClick={() => setPicking(false)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200" title="Annuler">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (alert.status === "active") {
    return (
      <div className="flex gap-2">
        <Button variant="primary" className={size} disabled={busy} onClick={() => setPicking(true)} title="Je vois l'alerte et je m'en occupe">
          <Hand className="h-4 w-4" /> Je prends en charge
        </Button>
        <Button variant="secondary" className={size} disabled={busy} onClick={onResolve} title="La situation est réglée">
          Résolu
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {alert.acknowledged_by && (
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
          <Hand className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-zinc-100 font-medium">{alert.acknowledged_by}</span> s'en occupe
        </span>
      )}
      <Button variant="secondary" className={size} disabled={busy} onClick={onResolve} title="La situation est réglée">
        <Check className="h-4 w-4" /> Résolu
      </Button>
    </div>
  );
}
