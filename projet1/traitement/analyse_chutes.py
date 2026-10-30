"""Projet 1, exercice 4 : vraies données phyphox -> détection de chute et fausses alertes.

Applique aux enregistrements de projet1/donnees/ les trois règles de détection
de chute du projet, et compte les vraies chutes attrapées et les fausses alertes :

  1. règle naïve du module 1        : norme > 2,5 g (une alerte au plus toutes les 10 s) ;
  2. règle à trois temps du TP M2-2 : chute libre < 0,4 g pendant >= 0,08 s,
                                      choc > 2 g dans la seconde, écart-type < 0,05 g
                                      de 1 à 4 s après le choc ;
  3. règle embarquée du Projet 1    : choc > 2 g, puis 3 s immobile (écart-type < 0,05 g)
                                      entre 1 et 15 s après le choc, puis pesanteur
                                      tournée de plus de 50 degrés (firmware/p1_wokwi).

Usage, depuis la racine du dépôt :
    python3 projet1/traitement/analyse_chutes.py

Fichiers attendus : AAAAMMJJ_eqNN_sNN_<activite>_<position>_rNN.csv (convention du
TP M2-2), export phyphox « Accélération avec g » (CSV ou .zip tel qu'exporté).
labels.csv (facultatif) : fichier,nb_chutes,nb_pas,commentaire. Sans lui, un fichier
« chute-objet » compte pour une chute, les autres pour zéro.

Sorties dans projet1/resultats/ : detections.csv, resume.md et deux figures.
Données d'équipe, pseudonymisées (s01, s02...). Aucune chute de personne.
"""
from __future__ import annotations

import io
import re
import sys
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

ICI = Path(__file__).resolve().parent
DONNEES = ICI.parent / "donnees"
RESULTATS = ICI.parent / "resultats"

FS = 100.0                 # Hz : on rééchantillonne tout à 100 Hz
G = 9.80665
NOM = re.compile(r"^(\d{8})_(eq\d{2})_(s\d{2})_([a-z-]+)_([a-z-]+)_(r\d{2})$")

# Paramètres des règles : identiques au TP M2-2 et au firmware P1.
NAIVE_G, REFRACT_S = 2.5, 10.0
CL_G, CL_MIN_S, CHOC_G, CHOC_DANS_S = 0.4, 0.08, 2.0, 1.0
IMMO_DEBUT_S, IMMO_FIN_S, IMMO_SD_G = 1.0, 4.0, 0.05
P1_FENETRE_S, P1_DELAI_MAX_S, P1_ANGLE_DEG, P1_AVANT_S = 3.0, 15.0, 50.0, 2.0


@dataclass
class Enregistrement:
    nom: str
    activite: str
    position: str
    t: np.ndarray          # s
    acc: np.ndarray        # (n, 3) en g
    nb_chutes: int = 0
    nb_pas: float | None = None
    alertes: dict[str, list[float]] = field(default_factory=dict)

    @property
    def norme(self) -> np.ndarray:
        return np.linalg.norm(self.acc, axis=1)

    @property
    def duree_s(self) -> float:
        return float(self.t[-1] - self.t[0])


# ------------------------------------------------------------------ lecture
def lire_csv_phyphox(texte: str) -> tuple[np.ndarray, np.ndarray]:
    """Lit un export phyphox, quel que soit le séparateur et la langue des en-têtes."""
    premiere = texte.splitlines()[0]
    sep = ";" if premiere.count(";") > premiere.count(",") else ","
    decimal = "," if sep == ";" else "."
    df = pd.read_csv(io.StringIO(texte), sep=sep, decimal=decimal)
    cols = {c.lower(): c for c in df.columns}

    def trouve(motif: str) -> str:
        for bas, c in cols.items():
            if re.search(motif, bas):
                return c
        raise ValueError(f"colonne introuvable ({motif}) parmi {list(df.columns)}")

    t = df[trouve(r"^(time|temps)")].to_numpy(float)
    acc = np.column_stack([df[trouve(rf"\b{ax}\b")].to_numpy(float) for ax in "xyz"])
    ok = np.isfinite(t) & np.isfinite(acc).all(axis=1)
    t, acc = t[ok], acc[ok]
    if np.median(np.linalg.norm(acc, axis=1)) > 3:   # m/s² -> g
        acc = acc / G
    return t, acc


def reechantillonner(t: np.ndarray, acc: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    t = t - t[0]
    tt = np.arange(0, t[-1], 1 / FS)
    return tt, np.column_stack([np.interp(tt, t, acc[:, i]) for i in range(3)])


def charger() -> list[Enregistrement]:
    labels = {}
    fichier_labels = DONNEES / "labels.csv"
    if fichier_labels.exists():
        lab = pd.read_csv(fichier_labels)
        for _, r in lab.iterrows():
            labels[Path(str(r["fichier"])).stem] = r

    recs = []
    for p in sorted(DONNEES.iterdir()):
        if p.suffix.lower() not in (".csv", ".zip") or p.name == "labels.csv":
            continue
        m = NOM.match(p.stem)
        if not m:
            print(f"  ignoré (nom hors convention) : {p.name}")
            continue
        if p.suffix.lower() == ".zip":
            with zipfile.ZipFile(p) as z:
                interne = next(n for n in z.namelist() if n.lower().endswith("raw data.csv"))
                texte = z.read(interne).decode("utf-8-sig")
        else:
            texte = p.read_text(encoding="utf-8-sig")
        t, acc = reechantillonner(*lire_csv_phyphox(texte))
        _, _, _, activite, position, _ = m.groups()
        rec = Enregistrement(p.stem, activite, position, t, acc)
        rec.nb_chutes = 1 if activite == "chute-objet" else 0
        if p.stem in labels:
            r = labels[p.stem]
            if "nb_chutes" in r and pd.notna(r["nb_chutes"]):
                rec.nb_chutes = int(r["nb_chutes"])
            if "nb_pas" in r and pd.notna(r["nb_pas"]):
                rec.nb_pas = float(r["nb_pas"])
        recs.append(rec)
    return recs


# ------------------------------------------------------------------ règles
def regle_naive(rec: Enregistrement) -> list[float]:
    alertes, derniere = [], -1e9
    for i in np.flatnonzero(rec.norme > NAIVE_G):
        if rec.t[i] - derniere > REFRACT_S:
            alertes.append(float(rec.t[i]))
            derniere = rec.t[i]
    return alertes


def _ecart_type(x: np.ndarray, debut: int, fin: int) -> float:
    seg = x[max(debut, 0):min(fin, len(x))]
    return float(np.std(seg)) if len(seg) > 1 else np.inf


def regle_trois_temps(rec: Enregistrement) -> list[float]:
    n, alertes, derniere = rec.norme, [], -1e9
    sous = n < CL_G
    # débuts et fins des plages de chute libre
    bords = np.diff(np.r_[0, sous.astype(int), 0])
    for d, f in zip(np.flatnonzero(bords == 1), np.flatnonzero(bords == -1)):
        if (f - d) / FS < CL_MIN_S:
            continue
        fen = n[f:f + int(CHOC_DANS_S * FS)]
        if len(fen) == 0 or fen.max() <= CHOC_G:
            continue
        i_choc = f + int(np.argmax(fen))
        sd = _ecart_type(n, i_choc + int(IMMO_DEBUT_S * FS), i_choc + int(IMMO_FIN_S * FS))
        if sd < IMMO_SD_G and rec.t[i_choc] - derniere > REFRACT_S:
            alertes.append(float(rec.t[i_choc]))
            derniere = rec.t[i_choc]
    return alertes


def _angle(u: np.ndarray, v: np.ndarray) -> float:
    c = np.dot(u, v) / (np.linalg.norm(u) * np.linalg.norm(v) + 1e-12)
    return float(np.degrees(np.arccos(np.clip(c, -1, 1))))


def regle_p1(rec: Enregistrement, journal: list[str] | None = None) -> list[float]:
    """Même logique que firmware/p1_wokwi/sketch.ino:updateFallDetector()."""
    n, acc, alertes = rec.norme, rec.acc, []
    w = int(P1_FENETRE_S * FS)
    i = 0
    while i < len(n):
        if n[i] <= CHOC_G:
            i += 1
            continue
        choc = i
        avant = acc[max(0, choc - int(P1_AVANT_S * FS)):max(1, choc - int(0.5 * FS))].mean(axis=0)
        trouve, j = False, choc + int(IMMO_DEBUT_S * FS) + w
        fin = min(len(n), choc + int(P1_DELAI_MAX_S * FS))
        while j <= fin:
            if np.std(n[j - w:j]) < IMMO_SD_G:
                apres = acc[j - w:j].mean(axis=0)
                ang = _angle(avant, apres)
                if ang > P1_ANGLE_DEG:
                    alertes.append(float(rec.t[choc]))
                elif journal is not None:
                    journal.append(f"{rec.nom} t={rec.t[choc]:.1f} s : choc {n[choc:j].max():.1f} g, "
                                   f"immobile, rotation {ang:.0f}° -> écartée")
                trouve = True
                break
            j += 1
        i = j if trouve else fin   # comme le firmware : on repart après la décision
    return alertes


REGLES = {"naive": regle_naive, "trois_temps": regle_trois_temps, "p1": regle_p1}
LIBELLES = {"naive": "Naïve (> 2,5 g)", "trois_temps": "Trois temps (TP M2-2)",
            "p1": "Embarquée P1 (choc + immobile + allongé)"}


# ------------------------------------------------------------------ pas (TP M2-2)
def compter_pas(rec: Enregistrement) -> int:
    from scipy.signal import butter, filtfilt, find_peaks
    b, a = butter(2, [0.5, 3.0], btype="band", fs=FS)
    x = filtfilt(b, a, rec.norme - rec.norme.mean())
    pics, _ = find_peaks(x, height=0.10, distance=int(0.30 * FS))
    return len(pics)


# ------------------------------------------------------------------ figures
def figures(recs: list[Enregistrement]) -> list[str]:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    RESULTATS.mkdir(exist_ok=True)
    noms = []
    couleurs = {"naive": "#9ca3af", "trois_temps": "#2563eb", "p1": "#ea580c"}

    # 1. vue d'ensemble : une ligne par fichier, alertes marquées
    fig, axes = plt.subplots(len(recs), 1, figsize=(11, 1.6 * len(recs) + 0.6), squeeze=False)
    for ax, rec in zip(axes[:, 0], recs):
        ax.plot(rec.t, rec.norme, lw=0.6, color="#334155")
        for k, ts in rec.alertes.items():
            for x in ts:
                ax.axvline(x, color=couleurs[k], lw=1.4, ls="-" if k == "p1" else "--")
        ax.set_ylabel("g")
        ax.set_title(f"{rec.nom}  ({rec.nb_chutes} chute(s) réelle(s))", fontsize=9, loc="left")
        ax.set_ylim(0, max(3.5, float(rec.norme.max()) * 1.05))
    axes[-1, 0].set_xlabel("temps (s)")
    handles = [plt.Line2D([], [], color=couleurs[k], lw=1.6) for k in REGLES]
    fig.legend(handles, [LIBELLES[k] for k in REGLES], loc="upper right", fontsize=8, ncol=3)
    fig.tight_layout(rect=(0, 0, 1, 0.97))
    p = RESULTATS / "vue_ensemble_alertes.png"
    fig.savefig(p, dpi=130)
    plt.close(fig)
    noms.append(p.name)

    # 2. zoom sur la première chute détectée par la règle P1
    for rec in recs:
        if rec.alertes.get("p1"):
            t0 = rec.alertes["p1"][0]
            sel = (rec.t > t0 - 3) & (rec.t < t0 + 6)
            fig, (a1, a2) = plt.subplots(2, 1, figsize=(9, 5), sharex=True)
            a1.plot(rec.t[sel] - t0, rec.norme[sel], color="#334155")
            a1.axhline(CHOC_G, color="#ea580c", ls=":", lw=1)
            a1.axhspan(0, CL_G, color="#2563eb", alpha=0.08)
            a1.axvspan(IMMO_DEBUT_S, IMMO_DEBUT_S + P1_FENETRE_S, color="#16a34a", alpha=0.12)
            a1.set_ylabel("norme (g)")
            a1.set_title(f"{rec.nom} : choc à t = 0, fenêtre d'immobilité en vert", fontsize=10)
            for i, ax_nom in enumerate("xyz"):
                a2.plot(rec.t[sel] - t0, rec.acc[sel, i], label=ax_nom, lw=1)
            a2.set_ylabel("axes (g)")
            a2.set_xlabel("temps depuis le choc (s)")
            a2.legend(fontsize=8, ncol=3)
            fig.tight_layout()
            p = RESULTATS / "zoom_chute_p1.png"
            fig.savefig(p, dpi=130)
            plt.close(fig)
            noms.append(p.name)
            break
    return noms


def tableau_md(df: pd.DataFrame) -> str:
    """Tableau Markdown sans dépendance (pandas.to_markdown exige tabulate)."""
    lignes = ["| " + " | ".join(map(str, df.columns)) + " |",
              "| " + " | ".join("---" for _ in df.columns) + " |"]
    lignes += ["| " + " | ".join(map(str, r)) + " |" for r in df.itertuples(index=False)]
    return "\n".join(lignes)


# ------------------------------------------------------------------ main
def main() -> int:
    global DONNEES, RESULTATS
    import argparse
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--donnees", type=Path, default=DONNEES, help="dossier des CSV phyphox")
    ap.add_argument("--resultats", type=Path, default=RESULTATS, help="dossier de sortie")
    args = ap.parse_args()
    DONNEES, RESULTATS = args.donnees, args.resultats

    if not DONNEES.exists() or not any(DONNEES.glob("*_*_*_*_*_r*.*")):
        print(f"Aucun enregistrement dans {DONNEES} : voir projet1/donnees/README.md.")
        return 1
    print(f"Lecture de {DONNEES}")
    recs = charger()
    if not recs:
        print("Aucun fichier exploitable.")
        return 1

    journal: list[str] = []
    lignes = []
    for rec in recs:
        rec.alertes = {k: (f(rec, journal) if k == "p1" else f(rec)) for k, f in REGLES.items()}
        ligne = {"fichier": rec.nom, "activite": rec.activite, "position": rec.position,
                 "duree_s": round(rec.duree_s, 1), "norme_mediane_g": round(float(np.median(rec.norme)), 3),
                 "norme_max_g": round(float(rec.norme.max()), 2), "chutes_reelles": rec.nb_chutes}
        for k in REGLES:
            a = len(rec.alertes[k])
            ligne[f"alertes_{k}"] = a
            ligne[f"vp_{k}"] = min(a, rec.nb_chutes)
            ligne[f"fp_{k}"] = max(0, a - rec.nb_chutes)
            ligne[f"fn_{k}"] = max(0, rec.nb_chutes - a)
        if rec.activite == "marche":
            ligne["pas_detectes"] = compter_pas(rec)
            ligne["pas_reels"] = rec.nb_pas
        lignes.append(ligne)

    df = pd.DataFrame(lignes)
    RESULTATS.mkdir(exist_ok=True)
    df.to_csv(RESULTATS / "detections.csv", index=False)

    duree_hors_chute_h = df.loc[df.chutes_reelles == 0, "duree_s"].sum() / 3600
    synthese = []
    for k in REGLES:
        vp, fp, fn = df[f"vp_{k}"].sum(), df[f"fp_{k}"].sum(), df[f"fn_{k}"].sum()
        prec = vp / (vp + fp) if vp + fp else float("nan")
        rap = vp / (vp + fn) if vp + fn else float("nan")
        fp_h = df.loc[df.chutes_reelles == 0, f"fp_{k}"].sum() / duree_hors_chute_h if duree_hors_chute_h else float("nan")
        synthese.append({"règle": LIBELLES[k], "chutes détectées": f"{vp} / {vp + fn}",
                         "fausses alertes": int(fp), "précision": round(prec, 2), "rappel": round(rap, 2),
                         "fausses alertes / h (hors chutes)": round(fp_h, 2)})
    syn = pd.DataFrame(synthese)
    figs = figures(recs)

    md = ["# Projet 1 : résultats sur les vraies données", "",
          f"Généré par `projet1/traitement/analyse_chutes.py` à partir de {len(recs)} enregistrement(s) "
          f"de `projet1/donnees/` ({df.duree_s.sum() / 60:.1f} min au total, dont "
          f"{duree_hors_chute_h * 60:.1f} min sans chute). Chutes d'objet seulement : aucune chute de personne.", "",
          tableau_md(syn), "",
          "Comptage par fichier : une alerte de trop dans un fichier compte comme fausse alerte, une alerte "
          "manquante comme chute ratée. L'instant des alertes est à contrôler sur la figure.", ""]
    if journal:
        md += ["## Chocs écartés par la règle P1", ""] + [f"- {j}" for j in journal] + [""]
    md += ["## Figures", ""] + [f"![{f}]({f})" for f in figs] + [""]
    (RESULTATS / "resume.md").write_text("\n".join(md), encoding="utf-8")

    print(syn.to_string(index=False))
    print(f"\nÉcrit dans {RESULTATS} : detections.csv, resume.md, {', '.join(figs)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
