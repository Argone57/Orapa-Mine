# Orapa Mine — Console du maître du jeu

Application web (un seul fichier HTML + un fichier JS, aucune dépendance à installer) pour animer facilement une partie d'Orapa Mine en tant que maître du jeu, utilisable sur iPhone.

## Mettre en ligne sur GitHub Pages

1. Crée un nouveau dépôt GitHub (ex. `orapa-mine`).
2. Ajoute les fichiers `index.html` et `app.js` à la racine du dépôt, puis commit/push.
3. Dans le dépôt : **Settings → Pages → Build and deployment → Source : Deploy from a branch**, choisis la branche `main` et le dossier `/ (root)`, puis Save.
4. Après ~1 minute, l'app est disponible à `https://<ton-pseudo>.github.io/orapa-mine/`.
5. Sur iPhone (Safari) : ouvre le lien, appuie sur **Partager → Sur l'écran d'accueil** pour l'installer comme une app en plein écran.

## Utilisation

**Phase de placement**
- Fais glisser une gemme depuis la palette vers la grille : elle s'aimante automatiquement à la case la plus proche.
- Tape une gemme posée : elle pivote de 45°.
- Reste appuyé un peu plus longtemps sur une gemme : elle se retourne en miroir.
- Les cases à cocher permettent d'inclure ou non les extensions **Diamant** et **Corps noir**.
- « Démarrer la partie » verrouille toutes les gemmes (plus aucun déplacement/rotation possible).
- « Recommencer » efface le placement et tout l'historique (confirmation demandée).

**Pendant la partie**
- Clique une lettre (A–R) ou un chiffre (1–18) en bordure : un rayon est envoyé depuis ce point, sa trajectoire est calculée, et le résultat (`Entrée — Sortie — Couleur`) s'ajoute à l'historique. Les deux lettres/chiffres concernés se colorent dans le résultat obtenu.
- Clique une case intérieure (ex. B3) : la console indique si une gemme s'y trouve, et l'ajoute à l'historique.
- Le trajet du rayon est aussi tracé visuellement sur la grille (traits de couleur superposés).
- Le bouton « Copier » exporte l'historique en texte brut (pratique pour le partager).

La partie (placement + historique) est sauvegardée automatiquement dans le navigateur (localStorage) : un rafraîchissement de page ne fait rien perdre.

## Hypothèses de modélisation (à ajuster si besoin)

Je n'ai pas pu accéder directement au PDF officiel des règles (bloqué aux robots), donc le moteur de simulation repose sur les recoupements suivants (confirmés avec toi) :

- Chaque gemme occupe **une seule case** et pivote par pas de **45°** (8 orientations).
- À une orientation **multiple de 90°** (0/90/180/270°), la gemme agit comme un **mur** : le rayon repart en sens inverse (ressort par son point d'entrée).
- À une orientation **impaire de 45°** (45/135/225/315°), la gemme agit comme un **miroir oblique** : le rayon dévie à angle droit. Le retournement miroir (appui long) permet de choisir l'autre diagonale sans faire deux clics.
- Table de mélange reprise du plateau d'aide officiel du jeu. Une même couleur touchée plusieurs fois ne compte qu'une fois :
  - 1 couleur : Rouge / Bleu / Jaune / Blanc
  - Rouge+Jaune = Orange · Rouge+Bleu = Violet · Jaune+Bleu = Vert
  - Rouge+Blanc = Rose · Jaune+Blanc = Jaune clair · Bleu+Blanc = Bleu ciel
  - Rouge+Jaune+Blanc = Orange clair · Rouge+Bleu+Blanc = Violet clair · Jaune+Bleu+Blanc = Vert clair
  - Rouge+Jaune+Bleu = **Noir** · Rouge+Jaune+Bleu+Blanc = Gris
  - Si besoin d'un ajustement (teinte exacte), modifie l'objet `CONFIG.MIX` en haut du fichier `app.js` — chaque entrée est `{ 'type1+type2': { name:'...', hex:'#...' } }` (types triés alphabétiquement, séparés par `+`).
- **Diamant** (transparent) : dévie le rayon comme une gemme normale mais ne modifie jamais sa couleur.
- **Corps noir** : dès que le rayon l'atteint, son parcours s'arrête immédiatement (aucun point de sortie, quelle que soit l'orientation).

Si le comportement réel de ton exemplaire diffère sur un point précis (par exemple si le mur ne réfléchit que dans un axe et laisse passer dans l'autre), tout est centralisé dans les fonctions `isWallOrientation`, `diagType` et `reflect` au début de `app.js` — facile à corriger sans toucher au reste.

## Fichiers

- `index.html` — structure et styles.
- `app.js` — toute la logique (état, rendu, glisser-déposer, calcul des rayons).
