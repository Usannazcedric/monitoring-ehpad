"""Projet 1 : benchmark de notre règle de chute, à la taille ET au poignet.

Deux jeux publics, prétraités et partagés par les auteurs de github.com/mlgig/ts_fall_detection
(data.zip, non versionné : taille et licence) :

- SisFall (Sucerquia et al., Sensors 17(1):198, 2017) : capteur à la taille, 200 Hz,
  38 volontaires dont 15 seniors.
- FallAllD (Saleh, Abbas et Le Jeannès, IEEE Sensors Journal 21(2):1849-1858, 2021) :
  15 volontaires, capteurs au cou, à la taille et AU POIGNET, 238 Hz.
  Le poignet est la position de notre bracelet ; le cou, celle d'un pendentif.

Ce ne sont PAS nos enregistrements : on fait tourner NOS règles sur les données d'autrui.

Ce que fait le script :
1. compare 7 règles, de la plus simple (un seuil) à la nôtre (choc + immobile + allongé),
   en retirant une étape à la fois pour voir ce que chacune apporte ;
2. fait varier les 3 réglages de notre règle (seuil de choc, immobilité, rotation) pour
   montrer où se situe le réglage retenu dans le compromis détection / fausses alertes ;
3. mesure le délai entre le choc et la décision.

Usage, depuis la racine du dépôt :
    python3 projet1/traitement/benchmark_regles.py --sisfall /chemin/SisFall.pkl --fallalld /chemin/FallAllD.pkl

Sorties dans projet1/resultats/benchmark/ : resume.md, regles.csv, balayage.csv et deux figures.
"""
from __future__ import annotations

import argparse
import sys
from itertools import product
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyse_chutes import (  # noqa: E402
    CHOC_G, FS, IMMO_DEBUT_S, IMMO_SD_G, P1_ANGLE_DEG, P1_AVANT_S, P1_DELAI_MAX_S,
    P1_FENETRE_S, REFRACT_S, Enregistrement, regle_naive, regle_p1, regle_trois_temps, tableau_md,
)
from analyse_sisfall import charger, vers_enregistrement  # noqa: E402

SORTIE = Path(__file__).resolve().parent.parent / "resultats" / "benchmark"
FS_FALLALLD = 238.0           # Hz
FALLALLD_G_PAR_LSB = 0.244e-3  # LSM9DS1, ±8 g : 0,244 mg par pas (vérifié : norme médiane au repos ≈ 1 g)
ANNULER_S = 15.0               # compte à rebours du bouton ANNULER (firmware P1)

W = int(P1_FENETRE_S * FS)               # fenêtre d'immobilité : 3 s
DEBUT = int(IMMO_DEBUT_S * FS)           # on ignore 1 s de rebond après le choc
DELAI_MAX = int(P1_DELAI_MAX_S * FS)     # immobilité cherchée jusqu'à 15 s après le choc
AVANT, AVANT_FIN = int(P1_AVANT_S * FS), int(0.5 * FS)


# ------------------------------------------------------------------ données
def fallalld_poignet_ou_taille(df: pd.DataFrame, position: str) -> list[Enregistrement]:
    """FallAllD : 238 Hz -> 100 Hz par interpolation linéaire, pas bruts -> g."""
    recs = []
    for ligne in df[df.Device == position].itertuples(index=False):
        brut = np.asarray(ligne.Acc, dtype=float) * FALLALLD_G_PAR_LSB
        t0 = np.arange(len(brut)) / FS_FALLALLD
        t = np.arange(0, t0[-1], 1 / FS)
        acc = np.column_stack([np.interp(t, t0, brut[:, k]) for k in range(3)])
        rec = Enregistrement(f"S{ligne.SubjectID:02d}_A{ligne.ActivityID}_{ligne.TrialNo}",
                             str(ligne.ActivityID), position.lower(), t, acc)
        rec.nb_chutes = int(ligne.ActivityID >= 101)  # FallAllD : 1-44 activités, 101-135 chutes
        recs.append(rec)
    return recs


# ------------------------------------------------------------------ règle P1, version rapide
class Prepare:
    """Sommes cumulées d'un essai : écart-type et moyennes glissantes en O(1)."""

    def __init__(self, rec: Enregistrement):
        self.t, self.acc, self.n = rec.t, rec.acc, rec.norme
        z = np.zeros(1)
        self.S = np.r_[z, np.cumsum(self.n)]
        self.Q = np.r_[z, np.cumsum(self.n ** 2)]
        self.A = np.vstack([np.zeros((1, 3)), np.cumsum(self.acc, axis=0)])
        # écart-type de n[j-W:j], pour j = W..len(n)
        m = (self.S[W:] - self.S[:-W]) / W
        self.sd = np.sqrt(np.maximum((self.Q[W:] - self.Q[:-W]) / W - m ** 2, 0))

    def moyenne(self, a: int, b: int) -> np.ndarray:
        return (self.A[b] - self.A[a]) / (b - a)


def _angle(u: np.ndarray, v: np.ndarray) -> float:
    c = np.dot(u, v) / (np.linalg.norm(u) * np.linalg.norm(v) + 1e-12)
    return float(np.degrees(np.arccos(np.clip(c, -1, 1))))


def p1_rapide(p: Prepare, choc_g=CHOC_G, sd_g=IMMO_SD_G, angle_deg=P1_ANGLE_DEG,
              immobile=True, rotation=True) -> list[tuple[float, float]]:
    """Même décision que analyse_chutes.regle_p1 (vérifié), réglages variables.

    immobile=False : on ne cherche pas l'immobilité, on regarde la position de 1 à 4 s
    après le choc. rotation=False : l'immobilité suffit. Rend (instant du choc, délai de décision).
    """
    n, L, alertes, i = p.n, len(p.n), [], 0
    au_dessus = np.flatnonzero(n > choc_g)
    while True:
        k = int(np.searchsorted(au_dessus, i))  # premier choc à partir de i
        if k >= len(au_dessus):
            break
        choc = int(au_dessus[k])
        avant = p.moyenne(max(0, choc - AVANT), max(1, choc - AVANT_FIN))
        fin = min(L, choc + DELAI_MAX)
        if not immobile:
            a, b = choc + DEBUT, min(L, choc + DEBUT + W)
            if b - a > 10 and (not rotation or _angle(avant, p.moyenne(a, b)) > angle_deg):
                alertes.append((float(p.t[choc]), (b - choc) / FS))
            i = fin
            continue
        j0 = choc + DEBUT + W
        trouve = None
        if j0 <= fin:
            cand = np.flatnonzero(p.sd[j0 - W:fin - W + 1] < sd_g)
            if len(cand):
                trouve = j0 + int(cand[0])
        if trouve is None:
            i = fin
            continue
        if not rotation or _angle(avant, p.moyenne(trouve - W, trouve)) > angle_deg:
            alertes.append((float(p.t[choc]), (trouve - choc) / FS))
        i = trouve
    return alertes


def seuil(rec: Enregistrement, g: float) -> list[float]:
    alertes, derniere = [], -1e9
    for i in np.flatnonzero(rec.norme > g):
        if rec.t[i] - derniere > REFRACT_S:
            alertes.append(float(rec.t[i]))
            derniere = rec.t[i]
    return alertes


REGLES = {
    "seuil_2": ("Un seuil : choc > 2 g", lambda r, p: seuil(r, 2.0)),
    "naive": ("Un seuil : choc > 2,5 g (module 1)", lambda r, p: regle_naive(r)),
    "seuil_35": ("Un seuil : choc > 3,5 g", lambda r, p: seuil(r, 3.5)),
    "trois_temps": ("Chute libre + choc + immobile (TP M2-2)", lambda r, p: regle_trois_temps(r)),
    "choc_rot": ("Choc + allongé, sans immobilité", lambda r, p: [a for a, _ in p1_rapide(p, immobile=False)]),
    "choc_immo": ("Choc + immobile, sans rotation", lambda r, p: [a for a, _ in p1_rapide(p, rotation=False)]),
    "p1": ("**Notre règle P1 : choc + immobile + allongé**", lambda r, p: regle_p1(r)),
}


def scores(df: pd.DataFrame, col: str) -> dict:
    chutes, adl = df[df.chute == 1], df[df.chute == 0]
    vp = int((chutes[col] > 0).sum())
    fp_essais = int((adl[col] > 0).sum())
    h = adl.duree_s.sum() / 3600
    return {
        "rappel": vp / len(chutes),
        "fa_h": adl[col].sum() / h,
        "precision": vp / (vp + fp_essais) if vp + fp_essais else float("nan"),
        "detail": f"{vp} / {len(chutes)}",
        "fp_essais": f"{fp_essais} / {len(adl)}",
    }


def evaluer(nom: str, recs: list[Enregistrement]) -> tuple[pd.DataFrame, list[Prepare], list[float]]:
    lignes, prep, delais = [], [], []
    for rec in recs:
        p = Prepare(rec)
        prep.append(p)
        ligne = {"jeu": nom, "essai": rec.nom, "chute": rec.nb_chutes, "duree_s": rec.duree_s}
        for k, (_, f) in REGLES.items():
            ligne[k] = len(f(rec, p))
        if rec.nb_chutes:
            delais += [d for _, d in p1_rapide(p)]
        lignes.append(ligne)
    return pd.DataFrame(lignes), prep, delais


# ------------------------------------------------------------------ figures
SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"]  # palette de référence, créneaux 1 à 4 (barres : paires voisines)
ENCRE, ENCRE_2, GRILLE, FOND = "#0b0b0b", "#52514e", "#e4e3df", "#fcfcfb"


def _style(ax):
    ax.set_facecolor(FOND)
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.spines["bottom"].set_color(GRILLE)
    ax.tick_params(colors=ENCRE_2, labelsize=9, length=0)
    ax.grid(axis="x", color=GRILLE, linewidth=0.8)
    ax.set_axisbelow(True)


def figure_regles(tab: pd.DataFrame, jeux: list[str]) -> str:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    cles = list(REGLES)
    noms = [REGLES[k][0].replace("**", "") for k in cles]
    fig, axes = plt.subplots(1, 2, figsize=(12, 6.2), sharey=True, facecolor=FOND)
    h = 0.8 / len(jeux)
    y = np.arange(len(cles))[::-1]
    for ax, (metrique, titre) in zip(axes, [("rappel", "Chutes détectées (%)"), ("fa_h", "Fausses alertes par heure")]):
        _style(ax)
        for j, jeu in enumerate(jeux):
            v = [tab.loc[(tab.jeu == jeu) & (tab.regle == k), metrique].iloc[0] * (100 if metrique == "rappel" else 1)
                 for k in cles]
            yy = y + (len(jeux) - 1) * h / 2 - j * h
            ax.barh(yy, v, height=h - 0.04, color=SERIES[j], label=jeu, edgecolor=FOND, linewidth=1)
            for yi, vi in zip(yy, v):
                ax.text(vi, yi, f" {vi:.0f}" if metrique == "rappel" else f" {vi:.1f}",
                        va="center", ha="left", fontsize=7.5, color=ENCRE_2)
        ax.set_title(titre, loc="left", fontsize=11, color=ENCRE, pad=10)
    axes[0].set_yticks(y)
    axes[0].set_yticklabels(noms, fontsize=9, color=ENCRE)
    axes[0].get_yticklabels()[-1].set_fontweight("bold")
    axes[0].set_xlim(0, 112)
    axes[1].set_xlim(0, tab.fa_h.max() * 1.18)
    axes[0].legend(loc="lower left", bbox_to_anchor=(0, -0.2), ncol=len(jeux), frameon=False, fontsize=9)
    fig.suptitle("Chaque étape retire des fausses alertes ; au poignet, notre règle rate pourtant une chute sur deux",
                 x=0.01, ha="left", fontsize=12, color=ENCRE)
    fig.tight_layout()
    nom = "regles_par_jeu.png"
    fig.savefig(SORTIE / nom, dpi=160, facecolor=FOND)
    plt.close(fig)
    return nom


def figure_balayage(bal: pd.DataFrame, jeux: list[str]) -> str:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(9, 5.6), facecolor=FOND)
    _style(ax)
    ax.grid(axis="y", color=GRILLE, linewidth=0.8)
    for j, jeu in enumerate(jeux):
        d = bal[bal.jeu == jeu]
        ax.scatter(d.fa_h.clip(lower=0.05), d.rappel * 100, s=26, color=SERIES[j], alpha=0.75,
                   edgecolor=FOND, linewidth=0.8, label=jeu, zorder=2)
        r = d[(d.choc_g == CHOC_G) & (d.sd_g == IMMO_SD_G) & (d.angle_deg == P1_ANGLE_DEG)].iloc[0]
        ax.scatter(max(r.fa_h, 0.05), r.rappel * 100, s=150, facecolor="none", edgecolor=ENCRE, linewidth=1.6, zorder=3)
        ax.annotate(f"réglage retenu\n{r.rappel * 100:.0f} %, {r.fa_h:.1f} /h", (max(r.fa_h, 0.05), r.rappel * 100),
                    xytext=(12, -26), textcoords="offset points", fontsize=8, color=ENCRE,
                    bbox=dict(boxstyle="round,pad=0.25", facecolor=FOND, edgecolor="none", alpha=0.9), zorder=4)
    ax.set_xscale("log")
    graduations = [0.5, 1, 2, 5, 10, 20, 50]
    ax.set_xticks(graduations)
    ax.set_xticklabels([f"{g:g}".replace(".", ",") for g in graduations])
    ax.minorticks_off()
    ax.set_xlabel("Fausses alertes par heure (échelle log)", fontsize=9, color=ENCRE_2)
    ax.set_ylabel("Chutes détectées (%)", fontsize=9, color=ENCRE_2)
    ax.set_title("Les 75 réglages essayés : en haut à gauche, c'est mieux", loc="left", fontsize=11, color=ENCRE, pad=10)
    ax.legend(frameon=False, fontsize=9, loc="lower right")
    fig.tight_layout()
    nom = "balayage_reglages.png"
    fig.savefig(SORTIE / nom, dpi=160, facecolor=FOND)
    plt.close(fig)
    return nom


# ------------------------------------------------------------------ main
def main() -> int:
    global SORTIE
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--sisfall", type=Path, required=True, help="SisFall.pkl (non versionné)")
    ap.add_argument("--fallalld", type=Path, required=True, help="FallAllD.pkl (non versionné)")
    ap.add_argument("--resultats", type=Path, default=SORTIE)
    args = ap.parse_args()
    SORTIE = args.resultats
    SORTIE.mkdir(parents=True, exist_ok=True)

    sis = [vers_enregistrement(l) for l in charger(args.sisfall).itertuples(index=False)]
    fad = charger(args.fallalld)
    jeux = {
        "SisFall, taille": sis,
        "FallAllD, taille": fallalld_poignet_ou_taille(fad, "Waist"),
        "FallAllD, poignet": fallalld_poignet_ou_taille(fad, "Wrist"),
        "FallAllD, cou": fallalld_poignet_ou_taille(fad, "Neck"),
    }

    # 0. La version rapide de P1 doit décider exactement comme la règle de référence.
    ecarts = 0
    for rec in jeux["FallAllD, poignet"][:400] + sis[:400]:
        ecarts += len(regle_p1(rec)) != len(p1_rapide(Prepare(rec)))
    print(f"contrôle : P1 rapide et P1 de référence diffèrent sur {ecarts} essais sur 800")

    tables, preps, delais, infos = [], {}, {}, []
    for nom, recs in jeux.items():
        df, preps[nom], delais[nom] = evaluer(nom, recs)
        tables.append(df)
        adl = df[df.chute == 0]
        infos.append(f"| {nom} | {int(df.chute.sum())} | {len(adl)} | {adl.duree_s.sum() / 3600:.1f} h |")
        print(f"{nom} : {len(df)} essais")
    essais = pd.concat(tables)

    lignes = []
    for nom in jeux:
        d = essais[essais.jeu == nom]
        for k, (lib, _) in REGLES.items():
            lignes.append({"jeu": nom, "regle": k, "libelle": lib, **scores(d, k)})
    tab = pd.DataFrame(lignes)
    tab.drop(columns=["libelle"]).to_csv(SORTIE / "regles.csv", index=False)

    # 2. Balayage des réglages de P1.
    bal = []
    grille = list(product([1.5, 1.75, 2.0, 2.5, 3.0], [0.03, 0.05, 0.08], [30.0, 40.0, 50.0, 60.0, 70.0]))
    for nom, recs in jeux.items():
        chute = np.array([r.nb_chutes for r in recs])
        h = sum(r.duree_s for r, c in zip(recs, chute) if c == 0) / 3600
        for g, sd, ang in grille:
            nb = np.array([len(p1_rapide(p, g, sd, ang)) for p in preps[nom]])
            bal.append({"jeu": nom, "choc_g": g, "sd_g": sd, "angle_deg": ang,
                        "rappel": float((nb[chute == 1] > 0).mean()), "fa_h": float(nb[chute == 0].sum() / h)})
        print(f"balayage {nom} : {len(grille)} réglages")
    bal = pd.DataFrame(bal)
    bal.to_csv(SORTIE / "balayage.csv", index=False)

    figs = [figure_regles(tab, list(jeux)), figure_balayage(bal, list(jeux)[:3])]

    # Tableaux pour le résumé
    def bloc(nom: str) -> str:
        d = tab[tab.jeu == nom]
        t = pd.DataFrame({
            "règle": [REGLES[k][0] for k in d.regle],
            "chutes détectées": [f"{x} ({r * 100:.1f} %)" for x, r in zip(d.detail, d.rappel)],
            "essais de la vie courante avec fausse alerte": d.fp_essais,
            "fausses alertes / h": d.fa_h.round(1),
        })
        return tableau_md(t)

    retenu = bal[(bal.choc_g == CHOC_G) & (bal.sd_g == IMMO_SD_G) & (bal.angle_deg == P1_ANGLE_DEG)]
    meilleurs = []
    for nom in jeux:
        d = bal[bal.jeu == nom]
        r = retenu[retenu.jeu == nom].iloc[0]
        # réglages qui font au moins aussi bien sur les deux critères
        dom = d[(d.rappel >= r.rappel) & (d.fa_h <= r.fa_h) & ((d.rappel > r.rappel) | (d.fa_h < r.fa_h))]
        meilleurs.append(f"| {nom} | {r.rappel * 100:.1f} % / {r.fa_h:.1f} par h | {len(dom)} sur {len(d) - 1} |")
    dl = [f"| {nom} | {np.median(v):.1f} s | {np.percentile(v, 90):.1f} s | {np.median(v) + ANNULER_S:.0f} s |"
          for nom, v in delais.items() if v]

    md = [
        "# Benchmark de notre règle de chute, à la taille et au poignet", "",
        "Généré par `projet1/traitement/benchmark_regles.py`. **Ce ne sont pas nos enregistrements** : deux jeux "
        "publics, SisFall (Sucerquia et al., *Sensors*, 2017) et FallAllD (Saleh et al., *IEEE Sensors Journal*, 2021), "
        "dans la version prétraitée de github.com/mlgig/ts_fall_detection. Chutes simulées sur tapis par des volontaires. "
        "On y fait tourner **nos** règles, avec les réglages du firmware P1.", "",
        f"Contrôle : la version rapide de la règle P1 (balayage) et la version de référence diffèrent sur {ecarts} essais sur 800.", "",
        "| Jeu | Chutes | Essais de la vie courante | Durée de vie courante |", "| --- | --- | --- | --- |", *infos, "",
        "## 1. Sept règles, de la plus simple à la nôtre", "",
        "On ajoute ou on retire une étape à la fois pour voir ce que chacune apporte.", "",
        *sum([[f"### {nom}", "", bloc(nom), ""] for nom in jeux], []),
        "## 2. Le réglage retenu dans le compromis", "",
        "75 réglages essayés : seuil de choc 1,5 à 3 g, immobilité (écart-type) 0,03 à 0,08 g, rotation 30 à 70°. "
        "Dernière colonne : nombre de réglages qui feraient mieux sur un critère sans faire pire sur l'autre.", "",
        "| Jeu | Réglage retenu (2 g, 0,05 g, 50°) : détectées / fausses alertes | Réglages qui le dominent |",
        "| --- | --- | --- |", *meilleurs, "",
        "## 3. Délai entre le choc et la décision (chutes détectées par P1)", "",
        "La décision tombe quand 3 s d'immobilité sont trouvées. Le bracelet sonne ensuite 15 s (bouton ANNULER) "
        "avant d'envoyer l'alerte.", "",
        "| Jeu | Délai médian | 90 % des chutes en moins de | Alerte au soignant (médiane, avec les 15 s) |",
        "| --- | --- | --- | --- |", *dl, "",
        "## Figures", "", *[f"![{f}]({f})" for f in figs], "",
    ]
    (SORTIE / "resume.md").write_text("\n".join(md), encoding="utf-8")
    print("\n".join(md))
    return 0


if __name__ == "__main__":
    sys.exit(main())
