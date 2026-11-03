# Journal des modifications

Toutes les évolutions notables de **Petite pousse** sont consignées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet
applique le [versionnage sémantique](https://semver.org/lang/fr/).

## [Unreleased]

### Ajouté

- Licence **MIT** (`LICENSE`), copyright 2026 Louis BESLE.
- Modèles légaux dans `docs/legal/` : information des familles sur les données
  personnelles (RGPD) et déclaration d'accessibilité, à compléter et à faire
  valider avant diffusion.

### Modifié

- **Programme** : la fiche d’un objectif permet de valider plusieurs élèves
  d’affilée. Elle reste ouverte après chaque validation, la ligne de l’élève
  passe à « déjà validé », les compteurs se mettent à jour en direct et le focus
  suit l’élève suivant ; **Terminer** referme la fiche.
- **README** actualisé : état de la version, fonctionnalités, commandes de
  vérification, accessibilité, limites connues et licence.
- **Navigation** : trois onglets **Classe / Programme / Bilans**. Le profil, les
  réglages et la gestion des élèves sont accessibles depuis l'avatar de
  l'enseignante ; l'onglet « Élèves » et l'onglet « Profil » séparés disparaissent.
- **Documentation** : guide utilisateur, index de la documentation, runbook de
  release (`docs/operations/RELEASE.md`) et modèles légaux.
- **Capture photo** : « Prendre la photo » ouvre un choix entre **Caméra** et
  **Photothèque**, pour ajouter une image déjà enregistrée sur le téléphone au
  lieu de passer systématiquement par l’appareil photo.
- **Branches** : `dev` devient la branche d'intégration. Hors release, les
  branches courtes partent de `dev` et leurs PR y sont fusionnées ; `main` n'est
  mise à jour qu'au moment d'une release, avec son tag (voir `CONTRIBUTING.md` et
  `docs/operations/RELEASE.md`).
- **Audit d'accessibilité** révisé pour le référentiel `2026.2.0` et la
  navigation Classe / Programme / Bilans, avec réexécution des scans Chromium et
  WebKit.

### Corrigé

- **Référentiel EVAR** : deux libellés alignés sur le texte officiel du BO n°6
  (« apprendre à faire appel à eux », point-virgule dans l'objectif « respecter
  les autres dans leur différence ; être respecté par eux »).
- **Bilans** : la période et l'année sélectionnées sont conservées dans l'URL et
  restent actives au retour depuis l'aperçu d'un élève, y compris avec le bouton
  Retour du navigateur.
- **Accessibilité** : contraste de la barre de navigation stabilisé pendant les
  changements de route.

### Tests

- Scans axe fiabilisés sur WebKit : attente de la stabilisation des couleurs de
  navigation avant l'analyse, et rendu « mouvement réduit » forcé pour ne plus
  capturer une transition à mi-parcours.
- CI verte sur `main` au 16 novembre 2026 : 344 tests unitaires, 51 parcours E2E
  (45 Chromium, 6 WebKit) et 1 test de rechargement hors ligne.

## [1.1.1] - 2026-11-07

### Modifié

- L'application s'appelle désormais **Petite pousse**.
- Les identifiants historiques `carnet-de-reussites` sont conservés pour la base
  IndexedDB, le format de sauvegarde et l'URL de production : aucune donnée
  existante n'est perdue.
- Le nom et le sous-titre de la PWA, les titres de page, les bilans HTML/PDF et la
  documentation sont mis à jour.

### Tests

- Stabilisation des scans axe : le test WebKit force le rendu « mouvement réduit »
  pour ne plus capturer la transition de l'onglet actif à mi-parcours.
- 338 tests unitaires, 50 parcours E2E et 1 test hors ligne ; CI `main` verte
  (Chromium, WebKit, hors ligne).

### Compatibilité

- Aucun changement fonctionnel : capture, dossiers, programme, EVAR, bilans en lot
  et sauvegarde chiffrée restent identiques.
- Les sauvegardes existantes, chiffrées ou non, restent restaurables.
- L'URL de production reste <https://carnet-de-reussites.vercel.app> pour préserver
  les données locales des appareils déjà installés.

## [1.1.0] - 2026-11-07

### Ajouté

- **Bilans en lot** : un ZIP par année et par période, avec un PDF par élève, y
  compris ceux sans réussite. Progression accessible pendant la génération et noms
  de fichiers dédoublonnés.
- **Sauvegarde chiffrée** : protection facultative par mot de passe
  (AES-256-GCM, PBKDF2-SHA256, 310 000 itérations). Mot de passe requis, mot de
  passe incorrect et fichier corrompu sont distingués ; les anciennes sauvegardes
  en clair restent restaurables.
- **Programme EVAR** : éducation à la vie affective et relationnelle,
  BO n° 6 du 6 février 2025. Trois axes et neuf objectifs, intégrés au programme,
  à la capture, aux dossiers et aux bilans.

### Modifié

- Référentiel 2026.2.0 : 407 objectifs, 40 compétences et 7 catégories.
- Version 1.1.0, titre de visionneuse dans les PDF, documentation à jour.

### Accessibilité

- Protocole VoiceOver / TalkBack prêt à être exécuté sur appareils réels.
- Couverture WebKit (Safari iPhone/iPad) et job CI dédié.
- 19 états audités sans violation axe A/AA.

### Tests

- 338 tests unitaires, 50 parcours E2E, 1 test de rechargement hors ligne.

### Limites connues

- Le PDF n'est pas balisé : l'aperçu HTML A4 reste la version accessible.
- Le protocole lecteurs d'écran n'a pas encore été exécuté sur appareil réel :
  l'audit reste « partiellement conforme ».
- Nom définitif choisi ensuite : **Petite pousse** (release 1.1.1).

## [1.0.0] - 2026-11-07

Première version publique, publiée sous le nom de travail « Carnet de réussites »,
déjà en production : <https://carnet-de-reussites.vercel.app>

### Ajouté

- Capture photo des réussites et validation sans photo.
- Programme officiel 2026 : 398 objectifs, 6 domaines.
- Dossiers élèves par domaine, avec compteurs et dates.
- Bilans A4 imprimables, deux périodes par année scolaire.
- Sauvegarde et restauration ZIP locales.
- PWA installable, utilisable hors ligne.
- Audit WCAG 2.1/2.2 AA et RGAA 4.1.2 publié.

### Note de version

Cette release correspond à l'état déployé au commit `d2a2588`, avant l'incrément
v1.1. Le champ `version` de `package.json` était encore à `0.0.0` ; le versionnage
sémantique démarre avec la 1.1.0.

[Unreleased]: https://github.com/louis-besle/petite-pousse/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/louis-besle/petite-pousse/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/louis-besle/petite-pousse/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/louis-besle/petite-pousse/releases/tag/v1.0.0
