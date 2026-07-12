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

Triangle blanc, Losange blanc, Triangle bleu, Triangle jaune, Diamant, Corps noir, Trapèze rouge, Saphir bleu ciel — de vraies formes, chacune en un seul exemplaire.
- Triangle jaune : triangle rectangle, cathètes de 2 cases.
- Triangle blanc / Triangle bleu : triangle isocèle, base de 4 cases, hauteur 2 cases.
- Diamant : même famille, base de 2 cases, hauteur 1 case (ne colore jamais le rayon).
- Losange blanc : losange 2×2. Corps noir : rectangle 2×1 (arrête le rayon). Trapèze rouge : parallélogramme.
- **Saphir bleu ciel** : carré plein 1×1. Chaque contact compte comme s'il touchait à la fois une gemme bleue ET une gemme blanche (donne « Bleu ciel » seul, ou se combine avec les autres couleurs touchées selon la table habituelle). **Doit être placé de façon à être atteint directement, sans rebond, par au moins 3 rayons** (au lieu d'1 seul pour les autres gemmes) — un placement qui ne laisse que 1 ou 2 accès directs est refusé.

- Glisse une pièce sur la grille : elle s'aimante à la position valide la plus proche.
- Tape une pièce posée : elle pivote de **90°**.
- Reste appuyé un peu plus longtemps : elle se **retourne en miroir** (utile surtout pour le trapèze rouge, seule pièce asymétrique).
- **Les pièces ne peuvent se toucher que par un coin** : tout déplacement, rotation ou miroir qui mettrait deux pièces en contact par un côté (ou les ferait se chevaucher) est automatiquement refusé et la pièce revient à sa position précédente (flash rouge + message). *Cette règle ne s'applique qu'à la grille du maître du jeu.*
- **Chaque gemme posée doit rester atteignable sans rebond** (3 rayons minimum pour le Saphir, 1 pour les autres). Un placement qui enfreint cette règle est refusé pour la même raison. *Idem, uniquement côté maître du jeu.*
- **En mode solo**, ces deux règles ne s'appliquent pas à tes propres gemmes (ta grille de réponse) : tu places librement tes hypothèses, à toi de te débrouiller. La grille secrète générée, elle, respecte toujours ces règles pour rester résoluble.
- Les cases à cocher permettent d'inclure ou non le **Diamant**, le **Corps noir** et le **Saphir bleu ciel**.
- **« 🎲 Aléatoire »** place automatiquement les gemmes de base (+ extensions cochées) sur la grille en respectant les règles ci-dessus. Chaque clic tire une nouvelle disposition (peut prendre quelques tentatives en interne si le Saphir est activé, sa contrainte des 3 rayons étant plus stricte — invisible pour toi, ça reste quasi instantané).
- « Démarrer la partie » verrouille tout. « Recommencer » efface placement + historique (confirmation demandée).

## Pendant la partie

- Clique une lettre/chiffre en bordure : un rayon est lancé, sa trajectoire réelle (rebonds sur les arêtes des pièces) est calculée, et le résultat s'ajoute à l'historique au format `Entrée — Sortie — Couleur`. Les deux lettres/chiffres concernés se colorent en pastille pleine (texte clair ou foncé selon la couleur pour rester lisible). Si le rayon ressort par son point d'entrée, un symbole ↔ apparaît. **Une lettre/chiffre déjà utilisé — comme entrée ou comme sortie — ne peut plus être recliqué.**
- Si le rayon atteint le Corps noir, l'historique n'indique que `Entrée — Absorbé`.
- Clique une case intérieure (ex. B3) : l'historique indique seulement `Vide` (avec une croix qui reste affichée) ou `Occupée` (sans révéler la pièce). **Une case déjà interrogée ne peut plus être recliquée.** *(En mode solo, ce comportement change — voir plus bas.)*
- Le trajet de chaque rayon reste tracé sur le plateau, en surbrillance pour bien le voir.
- Une lettre/chiffre déjà utilisé reste cliquable : ça n'relance pas de rayon, mais affiche une petite bulle rappelant où il était ressorti (ou « Absorbé », ou « Ressort ici même »).

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

Le bouton **🧩 Jouer en solo** ouvre d'abord une petite fenêtre pour choisir quelles extensions (Diamant, Corps noir, Saphir bleu ciel) peuvent apparaître dans la grille secrète, puis génère une grille aléatoire cachée que tu dois retrouver. La même fenêtre réapparaît si tu cliques **Recommencer** pendant une partie solo (tu peux changer les extensions à chaque nouveau défi) :

- Les gemmes de la grille secrète ne sont **jamais affichées**.
- Tu peux cliquer les bords (lettres/chiffres) comme d'habitude : le résultat (entrée/sortie/couleur) s'ajoute à l'historique, mais **le trajet du rayon n'est pas dessiné** sur la grille — seule l'info textuelle est donnée.
- **Cliquer une case intérieure ne révèle plus rien directement.** Il faut d'abord activer **🔍 Demander un indice** (le bouton se met à pulser pour indiquer qu'il est actif). Le clic suivant sur une case demande confirmation (« Révéler le contenu de la case B3 ? ») :
  - Si tu confirmes, la case est révélée (comme en maître du jeu — `Vide` + croix, ou un **rond plein de la couleur** de la gemme touchée) et le mode indice se désactive automatiquement.
  - Si tu annules, rien ne se passe et le mode indice reste actif : tu peux cliquer une autre case.
  - Recliquer sur **🔍 Demander un indice** désactive le mode sans révéler quoi que ce soit.
- En parallèle, tu places **tes propres gemmes** (palette identique, mêmes règles de contact coin-à-coin et d'accessibilité) pour construire ta réponse — exactement comme en phase de placement du maître du jeu.
- **✅ Proposer une solution** compare ta disposition à la grille secrète (une pièce est considérée juste si sa forme finale est identique, peu importe si la rotation/le miroir utilisés sont différents mais donnent le même résultat visuel) :
  - Tout est juste → 🏆 victoire, partie terminée.
  - Erreur au 1ᵉʳ essai → message d'échec, la partie continue.
  - Erreur au 2ᵉ essai → 💥 défaite, partie terminée. La grille secrète est alors révélée en plein, et tes gemmes restent visibles en **contour pointillé de leur couleur** par-dessus, pour comparer facilement.
- **↩ Retour maître du jeu** quitte le mode solo à tout moment (avec confirmation) et revient à la console habituelle.
- En cas de défaite, deux boutons **👁 Mes gemmes** / **👁 Gemmes à trouver** permettent de masquer temporairement l'une ou l'autre couche pour mieux comparer.

Le mode maître du jeu (placement manuel, bouton Aléatoire, Démarrer la partie) n'est pas affecté par cette fonctionnalité.

## Classements solo

Le bouton flottant **🏆** (en bas à gauche, visible partout) ouvre les classements. Un classement séparé existe pour chacune des 8 combinaisons d'extensions possibles (aucune, Diamant seul, Corps noir seul, Saphir seul, et toutes leurs combinaisons), avec les **10 meilleurs scores** de chacun.

- Le score privilégie le **coût** : chaque rayon lancé coûte **1 point**, chaque coordonnée révélée coûte **3 points** (les coordonnées sont plus « chères » qu'un simple rayon). Le détail (nombre de rayons 🔦 et de coordonnées 📍) est affiché à côté du score pour rester lisible en un coup d'œil, ex. `5 pts (2🔦 + 1📍) · 12s`.
- À coté égal, le **temps** départage — chronométré entre le tout premier indice demandé (rayon ou coordonnée, peu importe lequel vient en premier) et la victoire.
- À la victoire, une **saisie de nom** est proposée pour le classement (24 caractères max, « Anonyme » par défaut si laissé vide).
- Un score n'est enregistré qu'en cas de **victoire**, et seulement si la grille n'a pas été chargée via un identifiant (voir plus bas).
- Chaque grille secrète a un **identifiant unique** (ex. `7F3K9Q-101`), affiché — et copiable — sur les écrans de victoire et de défaite.
- Dans le classement, chaque ligne est **repliée par défaut** (rang, nom, points, date) ; un clic dessus déplie le détail (répartition rayons/coordonnées, temps, et l'identifiant de la grille, copiable).
- Chaque classement peut être **réinitialisé indépendamment** (bouton dédié, confirmation demandée).

## Rejouer une grille précise

Le bouton **🔑 Grille par identifiant** (accueil, avant de démarrer une partie) permet de ressaisir un identifiant (ex. `7F3K9Q-101`) pour régénérer exactement la même grille secrète — pratique pour défier quelqu'un d'autre sur la même disposition, ou reprendre un identifiant noté depuis le classement. Une partie lancée ainsi **ne compte pas pour le classement** (avertissement affiché avant de lancer).
- Chaque classement peut être **réinitialisé indépendamment** (bouton dédié, confirmation demandée).

## Fichiers

- `index.html` — structure et styles.
- `app.js` — toute la logique (état, formes, rendu, glisser-déposer, calcul géométrique des rayons).
- `manifest.json`, `favicon.ico`, `icon-*.png` — icône de l'app (recadrée depuis la boîte du jeu) pour l'écran d'accueil iPhone et l'onglet du navigateur.
