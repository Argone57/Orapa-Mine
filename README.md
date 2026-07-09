# Orapa Mine — Console du maître du jeu

Application web (fichiers statiques, aucune dépendance à installer) pour animer une partie d'Orapa Mine en tant que maître du jeu, utilisable sur iPhone.

## Mettre en ligne sur GitHub Pages

1. Ajoute tous les fichiers de ce dossier (`index.html`, `app.js`, `manifest.json`, `favicon.ico`, `icon-*.png`) à la racine de ton dépôt GitHub, commit/push.
2. **Settings → Pages → Build and deployment → Source : Deploy from a branch**, branche `main`, dossier `/ (root)`, Save.
3. L'app est disponible à `https://<ton-pseudo>.github.io/<ton-repo>/`.
4. Sur iPhone (Safari) : **Partager → Sur l'écran d'accueil** pour l'installer en plein écran avec l'icône de la boîte du jeu.

## La grille

10 colonnes × 8 lignes, étiquetées sur les 4 bords :
- Haut : chiffres **1 → 10**
- Bas : lettres **I → R**
- Gauche : lettres **A → H**
- Droite : chiffres **11 → 18**

Chaque bord est un point d'entrée indépendant pour un rayon (une même ligne a une entrée « lettre » à gauche et une entrée « chiffre » à droite ; une même colonne a une entrée « chiffre » en haut et une entrée « lettre » en bas).

## Les pièces

Triangle blanc, Losange blanc, Triangle bleu, Triangle jaune, Diamant, Corps noir, Trapèze rouge — de vraies formes, chacune en un seul exemplaire.
- Triangle jaune : triangle rectangle, cathètes de 2 cases.
- Triangle blanc / Triangle bleu : triangle isocèle, base de 4 cases, hauteur 2 cases.
- Diamant : même famille, base de 2 cases, hauteur 1 case (ne colore jamais le rayon).
- Losange blanc : losange 2×2. Corps noir : rectangle 2×1 (arrête le rayon). Trapèze rouge : parallélogramme.

- Glisse une pièce sur la grille : elle s'aimante à la position valide la plus proche.
- Tape une pièce posée : elle pivote de **90°**.
- Reste appuyé un peu plus longtemps : elle se **retourne en miroir** (utile surtout pour le trapèze rouge, seule pièce asymétrique).
- **Les pièces ne peuvent se toucher que par un coin** : tout déplacement, rotation ou miroir qui mettrait deux pièces en contact par un côté (ou les ferait se chevaucher) est automatiquement refusé et la pièce revient à sa position précédente (petit flash rouge).
- **Chaque gemme posée doit rester atteignable sans rebond** : il doit exister au moins un bord (lettre ou chiffre) d'où un rayon tiré en ligne droite touche cette gemme avant toute autre pièce. Un placement qui enfermerait une gemme (aucun tir direct possible) est refusé pour la même raison.
- Les cases à cocher permettent d'inclure ou non le **Diamant** et le **Corps noir**.
- **« 🎲 Aléatoire »** place automatiquement les 5 gemmes de base (+ Diamant et/ou Corps noir si cochés) sur la grille en respectant les deux règles ci-dessus (contact coin-à-coin uniquement, chaque gemme atteignable sans rebond). Chaque clic tire une nouvelle disposition.
- « Démarrer la partie » verrouille tout. « Recommencer » efface placement + historique (confirmation demandée).

## Pendant la partie

- Clique une lettre/chiffre en bordure : un rayon est lancé, sa trajectoire réelle (rebonds sur les arêtes des pièces) est calculée, et le résultat s'ajoute à l'historique au format `Entrée — Sortie — Couleur`. Les deux lettres/chiffres concernés se colorent en pastille pleine (texte clair ou foncé selon la couleur pour rester lisible). Si le rayon ressort par son point d'entrée, un symbole ↔ apparaît. **Une lettre/chiffre déjà utilisé — comme entrée ou comme sortie — ne peut plus être recliqué.**
- Si le rayon atteint le Corps noir, l'historique n'indique que `Entrée — Absorbé`.
- Clique une case intérieure (ex. B3) : l'historique indique seulement `Vide` (avec une croix qui reste affichée) ou `Occupée` (sans révéler la pièce). **Une case déjà interrogée ne peut plus être recliquée.**
- Le trajet de chaque rayon reste tracé sur le plateau, en surbrillance pour bien le voir.

Tout est sauvegardé automatiquement dans le navigateur (localStorage) : un rafraîchissement ne fait rien perdre.

## Physique du rayon

Le rayon est simulé en géométrie réelle (pas case par case) : il avance en ligne droite et rebondit sur la première arête de pièce rencontrée.
- **Arête droite** (horizontale/verticale, ex. les côtés d'angle droit d'un triangle) → renvoie le rayon en sens inverse.
- **Arête oblique** (45°, ex. l'hypoténuse) → dévie le rayon à angle droit.
- **Diamant** → dévie normalement mais ne colore jamais le rayon (résultat « Transparent » si c'est tout ce qu'il touche).
- **Corps noir** → dès que le rayon l'atteint, son parcours s'arrête (aucune sortie), quelle que soit l'orientation.

## Table de mélange des couleurs

Reprise exactement du plateau d'aide officiel (visible aussi dans l'app via le bouton « ? ») :
- 1 couleur : Rouge / Bleu / Jaune / Blanc
- Rouge+Jaune = Orange · Rouge+Bleu = Violet · Jaune+Bleu = Vert
- Rouge+Blanc = Rose · Jaune+Blanc = Jaune clair · Bleu+Blanc = Bleu ciel
- Rouge+Jaune+Blanc = Orange clair · Rouge+Bleu+Blanc = Violet clair · Jaune+Bleu+Blanc = Vert clair
- Rouge+Jaune+Bleu = **Noir** · Rouge+Jaune+Bleu+Blanc = Gris

Pour ajuster une teinte exacte, modifie l'objet `CONFIG.MIX` en haut de `app.js` (`{ 'type1+type2': { name:'...', hex:'#...' } }`, types triés alphabétiquement).

## Ajuster la forme ou la taille d'une pièce

Tout est centralisé dans l'objet `SHAPES` en haut de `app.js` : chaque pièce est une liste de sommets `[x,y]` relatifs à son centre (unité = 1 case). Modifie ces coordonnées si une forme ou une taille ne correspond pas exactement à ton exemplaire physique — le reste du moteur (rotation, miroir, calcul du rayon) s'adapte automatiquement.

## Mode solo

Le bouton **🧩 Jouer en solo** (visible avant de démarrer une partie maître du jeu) génère une grille aléatoire cachée que tu dois retrouver :

- Les gemmes de la grille secrète ne sont **jamais affichées**.
- Tu peux cliquer les bords (lettres/chiffres) comme d'habitude : le résultat (entrée/sortie/couleur) s'ajoute à l'historique, mais **le trajet du rayon n'est pas dessiné** sur la grille — seule l'info textuelle est donnée.
- Cliquer une case intérieure fonctionne comme en maître du jeu, avec une différence : si elle touche une gemme secrète, un **rond plein de sa couleur** apparaît sur la grille (en plus de la ligne dans l'historique).
- En parallèle, tu places **tes propres gemmes** (palette identique, mêmes règles de contact coin-à-coin et d'accessibilité) pour construire ta réponse — exactement comme en phase de placement du maître du jeu.
- **✅ Proposer une solution** compare ta disposition à la grille secrète (une pièce est considérée juste si sa forme finale est identique, peu importe si la rotation/le miroir utilisés sont différents mais donnent le même résultat visuel) :
  - Tout est juste → 🏆 victoire, partie terminée.
  - Erreur au 1ᵉʳ essai → message d'échec, la partie continue.
  - Erreur au 2ᵉ essai → 💥 défaite, partie terminée. La grille secrète est alors révélée en plein, et tes gemmes restent visibles en **contour pointillé de leur couleur** par-dessus, pour comparer facilement.
- **↩ Retour maître du jeu** quitte le mode solo à tout moment (avec confirmation) et revient à la console habituelle.

Le mode maître du jeu (placement manuel, bouton Aléatoire, Démarrer la partie) n'est pas affecté par cette fonctionnalité.

## Fichiers

- `index.html` — structure et styles.
- `app.js` — toute la logique (état, formes, rendu, glisser-déposer, calcul géométrique des rayons).
- `manifest.json`, `favicon.ico`, `icon-*.png` — icône de l'app (recadrée depuis la boîte du jeu) pour l'écran d'accueil iPhone et l'onglet du navigateur.
