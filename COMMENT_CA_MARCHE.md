# Trouve ta moitié — Comment ça marche ?

> Ce document explique le projet sans jargon technique. Il est destiné à toute personne curieuse de comprendre ce qui a été construit, même sans expérience en programmation.

---

## C'est quoi ce projet ?

**Trouve ta moitié** est un jeu de brise-glace numérique. L'idée : un animateur (le "maître du jeu") crée une liste de paires de mots (ex : *Soleil / Lune*, *Pain / Beurre*, *Batman / Robin*). Chaque joueur reçoit l'un des mots en secret, et doit circuler dans la salle pour retrouver la personne qui détient l'autre moitié de sa paire.

Tout se passe sur smartphone, sans application à télécharger — c'est un site web.

---

## Comment joue-t-on ? (Côté joueurs)

### Étape 1 — La page d'accueil
Le joueur ouvre le site et entre le **code de salle** à 5 lettres que l'animateur lui a communiqué (ex : `AB3KP`). C'est comme un mot de passe pour rejoindre la bonne partie.

### Étape 2 — S'inscrire
Il entre son prénom. Le site lui attribue alors un **code joueur à 4 chiffres** (ex : `0001`) et lui révèle son **mot secret** (sa "moitié").

> Si la partie n'a pas encore démarré, le joueur peut quand même entrer son prénom. Il sera inscrit automatiquement dès que l'animateur lance la partie.

### Étape 3 — La mission
Le joueur voit :
- Son code à 4 chiffres + un **QR code** (pour partager facilement)
- Son **mot secret** affiché en couleur

Il doit maintenant circuler dans la salle et parler aux autres pour deviner qui est sa moitié.

### Étape 4 — Valider un match
Quand il pense avoir trouvé sa moitié, il scanne le QR code de l'autre joueur avec son téléphone, ou tape son code à 4 chiffres manuellement. S'ils forment bien une paire, le match est confirmé. Sinon, il doit continuer à chercher.

### Étape 5 — Célébration !
Une fois la bonne paire trouvée, les deux joueurs voient un écran de félicitations.

---

## Comment ça marche pour l'animateur ? (Côté admin)

L'animateur accède à une page secrète protégée par un **code PIN** (3112). De là, il peut :

1. **Créer une nouvelle partie** → le site génère automatiquement un code de salle unique
2. **Entrer les paires de mots** (autant qu'il veut)
3. **Choisir une couleur** qui sera appliquée à l'interface des joueurs
4. **Lancer la partie** → les joueurs qui attendaient sont automatiquement inscrits
5. **Suivre en direct** qui s'est inscrit et qui a trouvé sa moitié
6. **Arrêter ou réinitialiser** la partie

---

## Les grandes "pièces" du projet

Le projet est découpé en **pages web** (chaque page = une étape du jeu) et quelques fichiers de configuration. Voici le plan :

```
Site web
│
├── / (page d'accueil)          → saisir le code de salle
├── /join                       → s'inscrire (entrer son prénom)
├── /mission                    → voir son code et son mot secret
├── /find                       → scanner ou saisir le code d'un autre joueur
├── /confirm                    → confirmer ou refuser le match
├── /done                       → félicitations
│
└── /admin                      → interface animateur (protégée par PIN)
```

---

## Où sont stockées les données ?

Toutes les données (joueurs, paires, statut de la partie) sont stockées dans **Firebase Firestore**, un service cloud de Google. C'est comme une feuille de calcul en ligne, partagée en temps réel entre tous les téléphones.

Concrètement :
- Chaque partie = un document dans la base de données, identifié par le code de salle
- Quand un joueur s'inscrit, son prénom et son code s'ajoutent à ce document
- Quand deux joueurs se matchent, leur statut passe à "trouvé"
- L'animateur voit tout ça en direct, sans rafraîchir la page

---

## Ce qui protège contre la triche / les bugs

| Risque | Solution mise en place |
|---|---|
| Deux joueurs prennent le même slot en même temps | Transaction atomique Firebase (le serveur réserve le slot avant de confirmer) |
| Le joueur ouvre la page avant le lancement | Inscription "en attente" → automatique au lancement |
| Un joueur n'a pas de partenaire (nombre impair) | La page affiche un message d'attente et se met à jour dès que quelqu'un complète la paire |
| La connexion est lente | Toutes les requêtes ont un délai maximum de 8 secondes, puis un message d'erreur clair |
| Confirmer un mauvais match | Le site vérifie côté serveur que les deux codes correspondent réellement avant d'écrire quoi que ce soit |

---

## La langue

Le jeu supporte le **français et l'anglais**. Un bouton en haut à droite de la page d'accueil (et de l'interface admin) permet de basculer entre les deux. Le choix est mémorisé sur l'appareil.

---

## Où est hébergé le site ?

Le site est déployé sur **Vercel**, une plateforme d'hébergement gratuite pour ce type de projet. L'adresse est en HTTPS, ce qui est indispensable pour que la caméra (scan QR) fonctionne sur mobile. Le code source est stocké sur **GitHub** (dépôt : `Allyuna/Icebreaker`). Chaque modification publiée sur GitHub est automatiquement mise en ligne en quelques minutes.

---

## Pour aller plus loin — Personnalisation visuelle

Pour rendre le jeu plus beau et à votre image, voici ce dont j'aurais besoin :

### 🎨 Couleurs
- Une **couleur principale** (utilisée pour les boutons, les accents, les QR codes) — en code hexadécimal si possible, ex : `#E91E63`, ou sinon une description : "rose vif", "bleu marine", etc.
- Une **couleur de fond** (actuellement blanc pur) — même chose
- Une **couleur de texte** principale (actuellement gris très foncé)

### 🔤 Police de caractères
- Avez-vous une police en tête ? (ex : une police Google Fonts comme *Poppins*, *Playfair Display*, *Inter*…)
- Ou une image / un document existant qui illustre le style typographique souhaité ?
- Actuellement le site utilise **Geist** (police moderne, technique) pour le texte courant et **Geist Mono** (police à chasse fixe) pour les codes chiffres.

### 🖼 Visuels & illustrations
- Souhaitez-vous un **logo** ? Si oui, avez-vous un fichier (PNG, SVG) ?
- Des **icônes** personnalisées (actuellement on utilise des emojis)
- Des **illustrations ou animations** sur certains écrans (ex : confettis sur la page de félicitations) ?
- Un **fond texturé ou dégradé** plutôt qu'une couleur unie ?

### ✨ Style général
- Plutôt **minimaliste / épuré** (comme maintenant) ou **plus coloré / joueur / festif** ?
- Cartes avec **ombres prononcées** ou design plat ?
- **Coins très arrondis** (bulles) ou angles plus droits ?
- Des **animations** (transitions entre les pages, apparition des éléments) ?

Envoyez-moi une charte graphique, une moodboard, des captures d'écran d'une appli que vous aimez, ou simplement vos couleurs et votre police — je m'occupe du reste.
