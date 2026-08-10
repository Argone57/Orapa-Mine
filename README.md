# Orapa Mine — Console du maître du jeu

## Mises à jour Supabase

Les évolutions de la base sont rangées dans le dossier `Supabase` et numérotées dans
l’ordre d’exécution. Sur une base déjà utilisée, exécute uniquement les scripts qui
n’ont pas encore été appliqués, dans l’ordre `01` à `08`.

Ces fichiers complètent une installation Supabase existante. Les fonctions historiques
de création de compte, de connexion, de changement de pseudo et de statistiques du
compte ne sont pas encore regroupées dans un script d’installation initiale autonome.

Application web (fichiers statiques, aucune dépendance à installer) pour animer une partie d'Orapa Mine en tant que maître du jeu, utilisable sur iPhone.

## Mettre en ligne sur GitHub Pages

1. Ajoute tous les fichiers de ce dossier (`index.html`, `app.js`, `version.json`, `manifest.json`, `favicon.ico`, `icon-*.png`) à la racine de ton dépôt GitHub, commit/push.
2. **Settings → Pages → Build and deployment → Source : Deploy from a branch**, branche `main`, dossier `/ (root)`, Save.
3. L'app est disponible à `https://<ton-pseudo>.github.io/<ton-repo>/`.
4. Sur iPhone (Safari) : **Partager → Sur l'écran d'accueil** pour l'installer en plein écran avec l'icône de la boîte du jeu.

## La grille

10 colonnes × 8 lignes, étiquetées sur les 4 bords :
- Haut : chiffres **1 → 10**
- Bas : lettres **I → R**
- Gauche : lettres **A → H**
- Droite : chiffres **11 → 18**

Chaque bord est un point d'entrée indépendant pour une onde (une même ligne a une entrée « lettre » à gauche et une entrée « chiffre » à droite ; une même colonne a une entrée « chiffre » en haut et une entrée « lettre » en bas).

## Les pièces

Triangle blanc, Losange blanc, Triangle bleu, Triangle jaune, Diamant, Corps noir, Trapèze rouge, Saphir bleu ciel — de vraies formes, chacune en un seul exemplaire.
- Triangle jaune : triangle rectangle, cathètes de 2 cases.
- Triangle blanc / Triangle bleu : triangle isocèle, base de 4 cases, hauteur 2 cases.
- Diamant : même famille, base de 2 cases, hauteur 1 case (ne colore jamais l'onde).
- Losange blanc : losange 2×2. Corps noir : rectangle 2×1 (arrête l'onde). Trapèze rouge : parallélogramme.
- **Saphir bleu ciel** : carré plein 1×1. Chaque contact compte comme s'il touchait à la fois une gemme bleue ET une gemme blanche (donne « Bleu ciel » seul, ou se combine avec les autres couleurs touchées selon la table habituelle). **Il doit pouvoir être atteint directement, sans rebond, par au moins 3 ondes différentes**, contre une seule pour les autres gemmes. Un placement qui ne laisse que 1 ou 2 accès directs est refusé.

- Glisse une pièce sur la grille : elle s'aimante à la position valide la plus proche.
- Tape une pièce posée : elle pivote de **90°**.
- Reste appuyé un peu plus longtemps : elle se **retourne en miroir** (utile surtout pour le trapèze rouge, seule pièce asymétrique).
- **Les pièces ne peuvent se toucher que par un coin, et chaque gemme doit rester atteignable sans rebond** (3 ondes minimum pour le Saphir, 1 pour les autres). Ces règles ne bloquent plus le placement en temps réel (ça pouvait ralentir l'app sur certains appareils) : tu peux poser une gemme n'importe où, et si son placement enfreint une règle, elle **s'affiche en rouge** ainsi que les pièces concernées, tant que ce n'est pas corrigé. « Démarrer la partie » reste désactivé (avec un message explicatif) tant qu'il reste une gemme en rouge ou une gemme non placée. *Ces règles ne s'appliquent qu'à la grille du maître du jeu.*
- **En mode solo**, ces deux règles ne s'appliquent pas à tes propres gemmes (ta grille de réponse) : tu places librement tes hypothèses, à toi de te débrouiller. La grille secrète générée, elle, respecte toujours ces règles pour rester résoluble.
- Les cases à cocher permettent d'inclure ou non le **Diamant**, le **Corps noir** et le **Saphir bleu ciel**.
- **« 🎲 Aléatoire »** place automatiquement les gemmes de base (+ extensions cochées) sur la grille en respectant les règles ci-dessus. Chaque clic tire une nouvelle disposition (peut prendre quelques tentatives en interne si le Saphir est activé, sa contrainte des 3 ondes étant plus stricte — invisible pour toi, ça reste quasi instantané).
- « Démarrer la partie » verrouille tout. « Recommencer » efface placement + historique (confirmation demandée).

## Pendant la partie

- Clique une lettre ou un chiffre en bordure : une onde est envoyée, sa trajectoire réelle (rebonds sur les arêtes des pièces) est calculée et le résultat s'ajoute à l'historique au format `Entrée — Sortie — Couleur`. Les deux entrées concernées se colorent en pastille pleine. Si l'onde revient à son point de départ, un symbole ↔ apparaît. **Une entrée déjà utilisée — au départ ou à la sortie — ne peut pas servir à envoyer une nouvelle onde.**
- Si l'onde atteint le Corps noir, l'historique n'indique que `Entrée — Absorbé`.
- Clique une case intérieure (ex. B3) : l'historique indique seulement `Vide` (avec une croix qui reste affichée) ou `Occupée` (sans révéler la pièce). **Une case déjà interrogée ne peut plus être recliquée.** *(En mode solo, ce comportement change — voir plus bas.)*
- Le trajet de chaque onde reste tracé sur le plateau, en surbrillance pour bien le voir.
- Une entrée déjà utilisée reste cliquable : cela n'envoie pas de nouvelle onde, mais affiche une petite bulle rappelant sa sortie, ou les mentions « Absorbé » ou « Ressort ici même ».

Tout est sauvegardé automatiquement dans le navigateur (localStorage) : un rafraîchissement ne fait rien perdre.

## Physique de l'onde

L'onde est simulée en géométrie réelle, et non case par case : elle avance en ligne droite et rebondit sur la première arête de pièce rencontrée.
- **Arête droite** (horizontale ou verticale, par exemple les côtés d'angle droit d'un triangle) → renvoie l'onde en sens inverse.
- **Arête oblique** (45°, par exemple l'hypoténuse) → dévie l'onde à angle droit.
- **Diamant** → dévie normalement l'onde, mais ne modifie jamais sa couleur (résultat « Transparent » si elle ne rencontre que lui).
- **Corps noir** → absorbe l'onde dès qu'elle l'atteint : son parcours s'arrête, sans sortie, quelle que soit l'orientation.

## Table de mélange des couleurs

Reprise exactement du plateau d'aide officiel (visible aussi dans l'app via le bouton « ? ») :
- 1 couleur : Rouge / Bleu / Jaune / Blanc
- Rouge+Jaune = Orange · Rouge+Bleu = Violet · Jaune+Bleu = Vert
- Rouge+Blanc = Rose · Jaune+Blanc = Jaune clair · Bleu+Blanc = Bleu ciel
- Rouge+Jaune+Blanc = Orange clair · Rouge+Bleu+Blanc = Violet clair · Jaune+Bleu+Blanc = Vert clair
- Rouge+Jaune+Bleu = **Noir** · Rouge+Jaune+Bleu+Blanc = Gris

Pour ajuster une teinte exacte, modifie l'objet `CONFIG.MIX` en haut de `app.js` (`{ 'type1+type2': { name:'...', hex:'#...' } }`, types triés alphabétiquement).

## Ajuster la forme ou la taille d'une pièce

Tout est centralisé dans l'objet `SHAPES` en haut de `app.js` : chaque pièce est une liste de sommets `[x,y]` relatifs à son centre (unité = 1 case). Modifie ces coordonnées si une forme ou une taille ne correspond pas exactement à ton exemplaire physique — le reste du moteur (rotation, miroir et calcul de l'onde) s'adapte automatiquement.

## Mode solo

Le bouton **🧩 Jouer en solo** demande d’abord une connexion par pseudo et code à 4 chiffres, sans adresse mail. Il ouvre ensuite le choix entre Défi du jour, Grille aléatoire et Par identifiant.

- Les gemmes de la grille secrète ne sont **jamais affichées**.
- Tu peux cliquer les bords comme d'habitude : le résultat (entrée, sortie et couleur) s'ajoute à l'historique, mais **le trajet de l'onde n'est pas dessiné** sur la grille — seule l'information textuelle est donnée.
- **Cliquer une case intérieure ne révèle plus rien directement.** Il faut d'abord activer **🔍 Demander un indice** (le bouton se met à pulser pour indiquer qu'il est actif). Le clic suivant sur une case demande confirmation (« Révéler le contenu de la case B3 ? ») :
  - Si tu confirmes, la case est révélée (comme en maître du jeu — `Vide` + croix, ou un **rond plein de la couleur** de la gemme touchée) et le mode indice se désactive automatiquement.
  - Si tu annules, rien ne se passe et le mode indice reste actif : tu peux cliquer une autre case.
  - Recliquer sur **🔍 Demander un indice** désactive le mode sans révéler quoi que ce soit.
- En parallèle, tu places **tes propres gemmes** (palette identique, mêmes règles de contact coin-à-coin et d'accessibilité) pour construire ta réponse — exactement comme en phase de placement du maître du jeu.
- **✅ Proposer une solution** compare ta disposition à la grille secrète (une pièce est considérée juste si sa forme finale est identique, peu importe si la rotation/le miroir utilisés sont différents mais donnent le même résultat visuel) :
  - Tout est juste → 🏆 victoire, partie terminée.
  - Erreur au 1ᵉʳ essai → message d'échec, la partie continue.
  - Erreur au 2ᵉ essai → 💥 défaite, partie terminée. La grille secrète est alors révélée en plein, et tes gemmes restent visibles en **contour pointillé de leur couleur** par-dessus, pour comparer facilement.
- **← Retour à l’accueil** quitte l’écran de jeu sans mélanger le parcours Solo et la création de grille.
- En cas de défaite, deux boutons **👁 Mes gemmes** / **👁 Gemmes à trouver** permettent de masquer temporairement l'une ou l'autre couche pour mieux comparer.

Le mode maître du jeu (placement manuel, bouton Aléatoire, Démarrer la partie) n'est pas affecté par cette fonctionnalité.

## Classements et historiques

Le bouton flottant **🏆** ouvre quatre sections Supabase :

- **Défis du jour** : classement quotidien et accès aux dates précédentes par le calendrier ;
- **Grilles** : dix grilles les plus jouées et recherche directe par identifiant ;
- **Historique** : dernières parties solo enregistrées, filtrables par configuration ;
- **Succès** : catalogue des succès et classement par points cumulés.

Chaque onde coûte **1 point** et chaque coordonnée révélée **3 points**. Les réussites
passent avant les échecs, puis le score et le temps départagent les joueurs. La première
partie terminée d’un profil sur une grille est conservée, qu’il s’agisse d’une réussite
ou d’un échec. Les classements d’une grille et d’un défi mettent en évidence la ligne
correspondant au compte connecté.

## Défi du jour

Depuis le choix « 🧩 Jouer en solo », un 3ᵉ bouton **📅 Défi du jour** propose une grille spéciale, **identique pour tout le monde** ce jour-là (calculée à partir de la date, minuit à minuit heure de Paris) :

- Entre **0 et 3 gemmes optionnelles** sont tirées au sort pour la journée (indépendamment de tes propres réglages).
- Une règle spéciale, ou les deux, est tirée aléatoirement :
  - une gemme peut être partiellement en dehors de la grille ;
  - une gemme peut partager un côté avec une autre gemme.
- Lorsque les deux règles sont actives, elles sont attribuées indépendamment : la gemme
  partiellement extérieure n’est donc pas nécessairement l’une des deux gemmes qui se touchent.
- Dans tous les cas, deux gemmes ne se chevauchent jamais.
- **Une seule proposition de solution** : la première réponse incorrecte termine immédiatement le défi. Une fois joué (victoire ou défaite), le défi du jour redevient inaccessible jusqu'au lendemain sur ce navigateur.
- **Les échecs sont aussi enregistrés** dans le classement du jour, avec la mention « Échec », toujours classés après les réussites.
- Les défis précédents restent consultables depuis le calendrier du classement.
- Le bouton de partage indique **« Défi du jour (AAAA-MM-JJ) »** à la place d'un identifiant de grille.

Le Défi du jour conserve un historique local sur l’appareil et envoie également les scores enregistrés au classement global Supabase.
Le succès visible **Triforce** est débloqué, y compris rétroactivement, après une victoire sur une grille aléatoire réunissant les trois gemmes optionnelles. Il constitue le prérequis pour lancer un nouveau Défi du jour ; un défi déjà terminé reste consultable.

## Rejouer une grille précise

Le bouton **🧩 Jouer en solo** propose notamment **🎲 Grille aléatoire** et **🔑 Par identifiant**. Ressaisir un identifiant régénère exactement la même grille secrète. La première partie terminée est enregistrée dans le classement global propre à cette grille.

## Grille du maître du jeu

**Démarrer la partie** lance uniquement l’assistance au jeu physique : aucune grille n’est envoyée à Supabase. **Partager la grille** est une action distincte disponible avant le démarrage ; elle exige un compte, associe le créateur, applique la protection et copie le défi.

## Partager un score

Que ce soit dans le classement (ligne dépliée) ou dans le popup de victoire (rappelable à tout moment via **🏆 Revoir la victoire** tant que la partie n'est pas quittée), deux boutons sont disponibles :
- **📋 Copier ID** — copie juste l'identifiant de la grille.
- **📋 Copier le résumé** — copie un texte prêt à coller ailleurs (réseaux, messages), au format :
  ```
  Orapa Mine · 💎 ✅ / ⬛️ ❌ / 🟦 ✅ · 12/07/2026
  Alice - 4 pts (1🔦/1📍) - ID: Q8RL5H-111
  ```

## Fichiers

- `index.html` — structure et styles.
- `app.js` — toute la logique (état, formes, rendu, glisser-déposer, calcul géométrique des ondes).
- `version.json` — version publiée utilisée pour empêcher le lancement d’un défi quotidien avec un ancien cache.
- `manifest.json`, `favicon.ico`, `icon-*.png` — icône de l'app (recadrée depuis la boîte du jeu) pour l'écran d'accueil iPhone et l'onglet du navigateur.

