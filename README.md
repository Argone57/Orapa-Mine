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

Triangle blanc, Losange blanc, Triangle bleu, Triangle jaune, Triangle transparent, Rectangle noir, Trapèze rouge — de vraies formes (pas de simples carrés), chacune en un seul exemplaire.

- Glisse une pièce sur la grille : elle s'aimante à la position valide la plus proche.
- Tape une pièce posée : elle pivote de **90°**.
- Reste appuyé un peu plus longtemps : elle se **retourne en miroir** (utile pour le trapèze rouge, seule pièce asymétrique — le triangle et le losange n'ont visuellement rien à gagner du miroir, ce qui est normal, leur forme est symétrique).
- Les cases à cocher permettent d'inclure ou non le **Triangle transparent** et le **Rectangle noir**.
- « Démarrer la partie » verrouille tout. « Recommencer » efface placement + historique (confirmation demandée).

## Pendant la partie

- Clique une lettre/chiffre en bordure : un rayon est lancé, sa trajectoire réelle (rebonds sur les arêtes des pièces) est calculée, et le résultat s'ajoute à l'historique au format `Entrée — Sortie — Couleur`. Les deux lettres/chiffres concernés se colorent.
- Clique une case intérieure (ex. B3) : la console indique si une gemme s'y trouve (nom de la pièce) ou si la case est vide — dans ce cas une petite croix reste visible sur la grille.
- Le trajet de chaque rayon reste tracé sur le plateau.
- « Copier » exporte l'historique en texte brut.

Tout est sauvegardé automatiquement dans le navigateur (localStorage) : un rafraîchissement ne fait rien perdre.

## Physique du rayon

Le rayon est simulé en géométrie réelle (pas case par case) : il avance en ligne droite et rebondit sur la première arête de pièce rencontrée.
- **Arête droite** (horizontale/verticale, ex. les côtés d'angle droit d'un triangle) → renvoie le rayon en sens inverse.
- **Arête oblique** (45°, ex. l'hypoténuse) → dévie le rayon à angle droit.
- **Triangle transparent** → dévie normalement mais ne colore jamais le rayon (résultat « Transparent » si c'est tout ce qu'il touche).
- **Rectangle noir** → dès que le rayon l'atteint, son parcours s'arrête (aucune sortie), quelle que soit l'orientation.

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

## Fichiers

- `index.html` — structure et styles.
- `app.js` — toute la logique (état, formes, rendu, glisser-déposer, calcul géométrique des rayons).
- `manifest.json`, `favicon.ico`, `icon-*.png` — icône de l'app (recadrée depuis la boîte du jeu) pour l'écran d'accueil iPhone et l'onglet du navigateur.
