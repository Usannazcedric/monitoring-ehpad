// Annuaire des résidents, miroir de backend/app/profiles.py (données fictives).
// Le soignant pense en numéros de chambre : c'est ce que le tableau de bord met en avant.
export interface ResidentInfo {
  name: string;
  age: number;
  room: string;
  wing: "A" | "B";
}

const RAW: Record<string, [string, number, string]> = {
  R001: ["Marie D.", 84, "101"], R002: ["Jean P.", 79, "102"], R003: ["Suzanne L.", 88, "103"],
  R004: ["Pierre M.", 81, "104"], R005: ["Yvette R.", 91, "105"], R006: ["Michel B.", 77, "106"],
  R007: ["Anne T.", 85, "107"], R008: ["Henri S.", 83, "108"], R009: ["Lucienne G.", 87, "109"],
  R010: ["Robert F.", 80, "110"], R011: ["Denise K.", 86, "111"], R012: ["Georges V.", 82, "112"],
  R013: ["Paulette H.", 89, "113"], R014: ["Bernard A.", 78, "114"], R015: ["Christiane O.", 85, "115"],
  R016: ["André N.", 84, "116"], R017: ["Madeleine C.", 90, "117"], R018: ["Roger W.", 76, "118"],
  R019: ["Simone E.", 88, "119"], R020: ["Claude J.", 81, "120"],
  // R021 : la carte ESP32 simulée dans Wokwi, qui porte le bracelet Veilleur.
  R021: ["Jeanne D.", 87, "121"],
};

/** Le résident alimenté par la carte Wokwi (firmware/p1_wokwi). */
export const BRACELET_RESIDENT = "R021";

export function residentInfo(id: string): ResidentInfo {
  const raw = RAW[id];
  const room = raw?.[2] ?? id.replace(/^R0?/, "1");
  const n = parseInt(room, 10);
  return { name: raw?.[0] ?? id, age: raw?.[1] ?? 0, room, wing: n <= 110 ? "A" : "B" };
}
