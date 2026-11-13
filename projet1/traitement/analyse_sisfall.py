"""Projet 1, exercice 4.2 : nos règles de chute sur un jeu de données public, SisFall.

SisFall (Sucerquia, López et Vargas-Bonilla, « SisFall: A Fall and Movement Dataset »,
Sensors 17(1):198, 2017) : 38 volontaires (23 jeunes, 15 personnes âgées), capteur porté
à la taille, 200 Hz. 1 798 chutes simulées sur tapis (15 types, par les jeunes et un
senior) et 2 707 activités de la vie courante (19 types, dont 968 par des seniors).
Ce ne sont PAS nos enregistrements : on teste ici NOS règles sur les données d'autrui.

Le site officiel de SisFall étant hors ligne, la copie utilisée est la version prétraitée
partagée par les auteurs de github.com/mlgig/ts_fall_detection (fichier SisFall.pkl de
leur data.zip). Elle n'est pas versionnée ici (taille, licence) : on passe son chemin.

Le fichier est un pickle : il est chargé avec un dépaquetage restreint qui n'autorise que
les classes numpy et pandas qu'il contient (vérifié au préalable sans l'exécuter).

Usage, depuis la racine du dépôt :
    python3 projet1/traitement/analyse_sisfall.py --pkl /chemin/vers/SisFall.pkl

Sorties dans projet1/resultats/sisfall/ : essais.csv, resume.md et deux figures.
"""
from __future__ import annotations

import argparse
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
from analyse_chutes import (  # noqa: E402  mêmes règles, mêmes paramètres
    CHOC_G, FS, IMMO_DEBUT_S, P1_FENETRE_S, Enregistrement, regle_naive, regle_p1,
    regle_trois_temps, tableau_md,
)

SORTIE = ICI.parent / "resultats" / "sisfall"
FS_SISFALL = 200          # Hz
ADXL345_LSB_PAR_G = 256   # ±16 g sur 13 bits : g = valeur brute / 256

AUTORISE = {
    ("builtins", "slice"),
    ("numpy", "dtype"), ("numpy", "ndarray"),
    ("numpy.core.multiarray", "_reconstruct"), ("numpy._core.multiarray", "_reconstruct"),
    ("numpy.core.numeric", "_frombuffer"), ("numpy._core.numeric", "_frombuffer"),
    ("pandas._libs.internals", "_unpickle_block"),
    ("pandas.core.frame", "DataFrame"),
    ("pandas.core.indexes.base", "_new_Index"), ("pandas.core.indexes.base", "Index"),
    ("pandas.core.indexes.range", "RangeIndex"),
    ("pandas.core.internals.managers", "BlockManager"),
}

REGLES = {"naive": regle_naive, "trois_temps": regle_trois_temps, "p1": regle_p1}
LIBELLES = {"naive": "Naïve du module 1 (> 2,5 g)", "trois_temps": "Trois temps (TP M2-2)",
            "p1": "Embarquée P1 (choc + immobile + allongé)"}


class DepaquetageRestreint(pickle.Unpickler):
    def find_class(self, module, name):
        if (module, name) not in AUTORISE:
            raise pickle.UnpicklingError(f"classe refusée : {module}.{name}")
        return super().find_class(module, name)


def charger(chemin: Path) -> pd.DataFrame:
    with open(chemin, "rb") as f:
        return DepaquetageRestreint(f).load()


def vers_enregistrement(ligne) -> Enregistrement:
    brut = np.asarray(ligne.Acc, dtype=float)[:: FS_SISFALL // int(FS)]  # 200 Hz -> 100 Hz
    acc = brut / ADXL345_LSB_PAR_G
    t = np.arange(len(acc)) / FS
    nom = f"{ligne.SubjectID}_{ligne.Activity[:30]}_{ligne.TrialNo}"
    rec = Enregistrement(nom, ligne.Activity, "taille", t, acc)
    rec.nb_chutes = int(ligne.Target)
    return rec


def synthese(df: pd.DataFrame, masque_adl: pd.Series, titre: str) -> pd.DataFrame:
    chutes = df[df.target == 1]
    adl = df[(df.target == 0) & masque_adl]
    heures_adl = adl.duree_s.sum() / 3600
    lignes = []
    for k in REGLES:
        vp = int((chutes[f"alertes_{k}"] > 0).sum())
        fp_essais = int((adl[f"alertes_{k}"] > 0).sum())
        fp_alertes = int(adl[f"alertes_{k}"].sum())
        lignes.append({
            "règle": LIBELLES[k],
            "chutes détectées": f"{vp} / {len(chutes)}",
            "rappel": round(vp / len(chutes), 3),
            f"essais {titre} avec fausse alerte": f"{fp_essais} / {len(adl)}",
            "précision (par essai)": round(vp / (vp + fp_essais), 3) if vp + fp_essais else float("nan"),
            "fausses alertes / h": round(fp_alertes / heures_adl, 1) if heures_adl else float("nan"),
        })
    return pd.DataFrame(lignes)


def figures(df: pd.DataFrame, exemple: Enregistrement | None) -> list[str]:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    noms = []
    # 1. rappel par type de chute, règle P1 contre règle à trois temps
    chutes = df[df.target == 1]
    par_type = chutes.groupby("activite")[[f"alertes_{k}" for k in REGLES]].apply(lambda g: (g > 0).mean())
    par_type = par_type.sort_values("alertes_p1")
    fig, ax = plt.subplots(figsize=(10, 6.5))
    y = np.arange(len(par_type))
    ax.barh(y - 0.2, par_type["alertes_trois_temps"], height=0.38, color="#2563eb", label=LIBELLES["trois_temps"])
    ax.barh(y + 0.2, par_type["alertes_p1"], height=0.38, color="#ea580c", label=LIBELLES["p1"])
    ax.set_yticks(y, [a[:62] for a in par_type.index], fontsize=8)
    ax.set_xlim(0, 1)
    ax.set_xlabel("part des chutes détectées (rappel)")
    ax.set_title("SisFall : chutes détectées par type de chute", fontsize=11, loc="left")
    ax.legend(fontsize=8, loc="lower right")
    fig.tight_layout()
    p = SORTIE / "rappel_par_type_de_chute.png"
    fig.savefig(p, dpi=130)
    plt.close(fig)
    noms.append(p.name)

    # 2. un exemple de chute détectée par la règle P1
    if exemple is not None and exemple.alertes.get("p1"):
        t0 = exemple.alertes["p1"][0]
        sel = (exemple.t > t0 - 3) & (exemple.t < t0 + 8)
        fig, (a1, a2) = plt.subplots(2, 1, figsize=(9, 5), sharex=True)
        a1.plot(exemple.t[sel] - t0, exemple.norme[sel], color="#334155", lw=0.9)
        a1.axhline(CHOC_G, color="#ea580c", ls=":", lw=1)
        a1.axvspan(IMMO_DEBUT_S, IMMO_DEBUT_S + P1_FENETRE_S, color="#16a34a", alpha=0.12)
        a1.set_ylabel("norme (g)")
        a1.set_title(f"SisFall, {exemple.activite} : choc à t = 0", fontsize=10, loc="left")
        for i, nom in enumerate("xyz"):
            a2.plot(exemple.t[sel] - t0, exemple.acc[sel, i], label=nom, lw=0.9)
        a2.set_ylabel("axes (g)")
        a2.set_xlabel("temps depuis le choc (s)")
        a2.legend(fontsize=8, ncol=3)
        fig.tight_layout()
        p = SORTIE / "exemple_chute_detectee.png"
        fig.savefig(p, dpi=130)
        plt.close(fig)
        noms.append(p.name)
    return noms


def main() -> int:
    global SORTIE
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--pkl", type=Path, required=True, help="chemin de SisFall.pkl (non versionné)")
    ap.add_argument("--resultats", type=Path, default=SORTIE)
    args = ap.parse_args()
    SORTIE = args.resultats
    SORTIE.mkdir(parents=True, exist_ok=True)

    brut = charger(args.pkl)
    print(f"{len(brut)} essais chargés")
    lignes, exemple = [], None
    for i, ligne in enumerate(brut.itertuples(index=False)):
        rec = vers_enregistrement(ligne)
        rec.alertes = {k: f(rec) for k, f in REGLES.items()}
        # Exemple de figure : une chute dont le choc retenu par la règle est bien le pic
        # de la chute, et pas un pas de marche au-dessus de 2 g juste avant (la règle
        # détecte aussi ces cas-là, car elle cherche l'immobilité pendant 15 s).
        if (exemple is None and rec.nb_chutes and rec.alertes["p1"]
                and ligne.Activity.startswith("Lateral fall while walking")
                and abs(rec.alertes["p1"][0] - rec.t[int(np.argmax(rec.norme))]) < 0.5):
            exemple = rec
        lignes.append({"sujet": ligne.SubjectID, "groupe": "senior" if ligne.SubjectID.startswith("SE") else "jeune",
                       "activite": ligne.Activity, "essai": ligne.TrialNo, "target": int(ligne.Target),
                       "duree_s": round(rec.duree_s, 2),
                       **{f"alertes_{k}": len(v) for k, v in rec.alertes.items()}})
        if (i + 1) % 500 == 0:
            print(f"  {i + 1} essais traités")
    df = pd.DataFrame(lignes)
    df.to_csv(SORTIE / "essais.csv", index=False)

    tout = synthese(df, df.groupe.notna(), "de la vie courante")
    seniors = synthese(df, df.groupe == "senior", "seniors")
    adl = df[df.target == 0]
    fa = (adl.groupby("activite")[[f"alertes_{k}" for k in REGLES]].sum()
          .sort_values("alertes_naive", ascending=False).head(8).reset_index())
    chutes = df[df.target == 1]
    ratees = (chutes.assign(ratee=chutes.alertes_p1 == 0).groupby("activite").ratee.mean()
              .sort_values(ascending=False).head(5).round(2).reset_index())
    figs = figures(df, exemple)

    md = [
        "# Projet 1 : nos règles de chute sur le jeu public SisFall", "",
        "Généré par `projet1/traitement/analyse_sisfall.py`. **Ce ne sont pas nos enregistrements** : ",
        "SisFall (Sucerquia et al., *Sensors* 17(1):198, 2017), capteur à la taille, chutes simulées sur tapis ",
        "par des volontaires. On y fait tourner **nos** trois règles, avec les paramètres du firmware P1.", "",
        f"{len(df)} essais : {int((df.target == 1).sum())} chutes, {len(adl)} activités de la vie courante "
        f"({adl.duree_s.sum() / 3600:.1f} h, dont {int((adl.groupe == 'senior').sum())} essais de seniors, "
        f"{adl[adl.groupe == 'senior'].duree_s.sum() / 3600:.1f} h).", "",
        "## Toutes les activités de la vie courante", "", tableau_md(tout), "",
        "## Activités de la vie courante des seniors seulement", "", tableau_md(seniors), "",
        "## Les activités qui déclenchent le plus de fausses alertes (nombre d'alertes)", "", tableau_md(fa), "",
        "## Les types de chute que la règle P1 rate le plus (part ratée)", "", tableau_md(ratees), "",
        "## Figures", "", *[f"![{f}]({f})" for f in figs], "",
    ]
    (SORTIE / "resume.md").write_text("\n".join(md), encoding="utf-8")
    print(tableau_md(tout)); print(); print(tableau_md(seniors)); print(); print(tableau_md(fa)); print(); print(tableau_md(ratees))
    print(f"\nÉcrit dans {SORTIE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
