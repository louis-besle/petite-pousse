# Petite pousse

Application locale de suivi des compétences pour une classe de maternelle (PS, MS et GS) : photos, objectifs du programme officiel 2026 et du programme EVAR, dossiers élèves et bilans A4 imprimables.

## État

Version applicative **1.1.1**, en ligne : <https://carnet-de-reussites.vercel.app>

Dépôt : <https://github.com/louis-besle/petite-pousse>

PWA installable et utilisable hors ligne, couverte par **344 tests unitaires**, **51 parcours E2E** (**45 Chromium** et **6 WebKit**) et **1 test de rechargement hors ligne**.

### Depuis la 1.1.1

- **Navigation** : trois onglets **Classe / Programme / Bilans**. Le profil, les réglages et la gestion des élèves sont accessibles par l’avatar de l’enseignante.
- **Bilans** : la période et l’année choisies sont conservées dans l’URL et restent sélectionnées au retour depuis l’aperçu d’un élève, y compris avec le bouton Retour du navigateur.
- **Accessibilité** : contraste de la navigation stabilisé et smoke WebKit fiabilisé.

Ces évolutions sont déployées depuis `main`, mais ne sont pas encore couvertes par un tag de release : la dernière release GitHub reste la **1.1.1**.

### Nouveautés de la v1.1

- **Nom définitif** : l’application s’appelle désormais **Petite pousse**. L’identifiant historique `carnet-de-reussites` est conservé pour la base locale, les sauvegardes et l’URL de production, afin de ne perdre aucune donnée.
- **Bilans en lot** : un ZIP contenant un PDF par élève, pour l’année et la période sélectionnées.
- **Sauvegarde chiffrée** : protection facultative par mot de passe (AES-256-GCM, PBKDF2-SHA256). Les anciennes sauvegardes en clair restent restaurables.
- **Programme EVAR** : éducation à la vie affective et relationnelle, BO n° 6 du 6 février 2025, intégrée au programme, à la capture, aux dossiers et aux bilans.
- **WebKit** : parcours de fumée sur le moteur de Safari, en plus de Chromium.

## Fonctionnalités

- **Classe** : liste des élèves filtrable par section (PS, MS, GS), nombre de réussites par élève, ajout et suppression d’élèves, accès au dossier individuel.
- **Capture** : choix de l’élève, de l’objectif puis d’une photo facultative prise avec l’appareil. Une réussite peut être enregistrée sans photo.
- **Programme** : référentiel officiel 2026 (six domaines) et programme EVAR, soit **407 objectifs** répartis en sept catégories, consultables par domaine, compétence et objectif.
- **Dossiers élèves** : réussites regroupées par domaine et par année scolaire, vignettes des photos, suppression d’une réussite et ajout sans photo.
- **Bilans** : deux bilans par année scolaire, choix de la période et de l’année, aperçu A4 fidèle, export PDF individuel, partage natif sur mobile et génération d’un ZIP contenant un PDF par élève.
- **Sauvegarde** : export ZIP de toutes les années, réussites et photos, avec protection facultative par mot de passe (AES-256-GCM, PBKDF2-SHA256). La restauration remplace les données existantes après confirmation. Un panneau indique l’espace utilisé, le quota et permet de demander la persistance du stockage.
- **Réglages** : école, classe, enseignante, années scolaires et dates des deux périodes.
- **PWA** : installation sur iPhone, iPad, Android et ordinateur, fonctionnement hors ligne et routage par hash sans réécriture serveur.

## Données et confidentialité

Tout reste sur l’appareil : élèves, photos et réussites sont stockés dans IndexedDB. Aucun compte, aucun serveur applicatif, aucune donnée envoyée. La sauvegarde et la restauration se font depuis le profil, dans un fichier local.

Une sauvegarde peut être protégée par un mot de passe. **Sans ce mot de passe, elle est définitivement illisible** : il n’existe aucun moyen de le récupérer. Une sauvegarde non chiffrée contient les données personnelles et les photos des enfants ; elle doit être conservée dans un endroit protégé.

## Commandes

Les commandes supposent **Node.js 24**, la version utilisée par la CI.

```bash
npm install                  # installer les dépendances
npm run dev                  # serveur de développement
npm run build                # build de production dans dist/
npm run preview              # servir le build local
npm run test:run             # tests unitaires (Vitest)
npm run test:e2e             # parcours E2E Chromium + WebKit
npm run test:e2e:webkit      # parcours WebKit seuls (Safari iPhone/iPad)
npm run test:e2e:offline     # rechargement hors ligne (build de production dédié)
npm run lint                 # ESLint
npm run typecheck            # TypeScript
npm run referential:check    # contrôle du référentiel embarqué
npm run referential:build    # régénère le référentiel depuis le CSV officiel
```

Le déploiement est un build statique Vite, configuré par `vercel.ts` (framework `vite`, sortie `dist/`). Le routage par hash ne nécessite aucune réécriture serveur.

Le projet Vercel est relié au dépôt GitHub : chaque push sur `main` déploie automatiquement la production, et les autres branches créent des déploiements de prévisualisation. Si nécessaire, un déploiement manuel reste possible avec `npx vercel@latest deploy --prod --project carnet-de-reussites`.

## Accessibilité

L’application est auditée selon WCAG 2.1/2.2 AA et le RGAA 4.1.2. Le rapport complet et la matrice des 106 critères sont dans `docs/accessibility/`.

Verdict actuel : **partiellement conforme** (audit du 7 novembre 2026). Les écrans et feuilles ne présentent aucune violation axe A/AA, et les parcours principaux sont couverts sur Chromium et WebKit.

Deux réserves subsistent :

- **RGAA 7.1** : la matrice VoiceOver/TalkBack n’a pas encore été exécutée sur appareils réels. Le protocole est prêt dans `docs/accessibility/PROTOCOLE-LECTEURS-ECRAN.md`.
- **RGAA 13.3** : le PDF n’est pas balisé. L’aperçu HTML A4 est la version accessible de référence.

L’audit doit être rafraîchi après les évolutions de navigation et le passage au référentiel `2026.2.0`.

## Limites connues

- **PDF non balisé** : le PDF ne respecte pas PDF/UA (RGAA 13.3). L’aperçu HTML A4 est la version accessible de référence.
- **Lecteurs d’écran** : la matrice VoiceOver / TalkBack n’a pas encore été exécutée sur appareils physiques (RGAA 7.1).
- **Stockage local uniquement** : aucune synchronisation entre appareils ni accès multi-utilisateur. Effacer les données du navigateur ou changer d’origine (domaine) rend les données existantes invisibles ; sur iOS, désinstaller la PWA peut aussi les supprimer. Une sauvegarde ZIP est indispensable avant toute migration.
- **Quota du navigateur** : les photos sont stockées dans IndexedDB et consomment l’espace alloué au site. La persistance peut être refusée ou révoquée par le navigateur, notamment sur iOS.
- **Restauration** : une sauvegarde remplace l’ensemble des données présentes. Il n’existe ni fusion de sauvegardes ni export limité à une année.
- **Bilans en lot** : les PDF sont générés l’un après l’autre, sans annulation possible. Une classe chargée en photos peut être longue à traiter.
- **Aperçu A4 sur petit écran** : à 320 px, la feuille est réduite et le texte devient petit ; le zoom du navigateur reste nécessaire.
- **Fonctionnalités absentes** : objectifs personnalisés, import CSV des élèves, statistiques de classe et PDF combiné du lot.
- **Identifiant historique** : `carnet-de-reussites` reste utilisé pour la base IndexedDB, les sauvegardes et l’URL de production afin de préserver les données déjà saisies.

## Licence

Distribué sous licence [MIT](./LICENSE). Copyright © 2026 Louis BESLE.

## Contenu

- `docs/accessibility/` : audit WCAG/RGAA, matrice des critères et protocole lecteurs d’écran.
- `docs/superpowers/specs/` : document de conception.
- `docs/superpowers/plans/` : plans d’implémentation.
- `scripts/referential/source/` : transcription officielle du référentiel et notes de vérification.
- `maquettes/` : prototype HTML cliquable, captures d’écran et exemple de bilan imprimé.

## Prototype

Ouvrir `maquettes/prototype.html` dans un navigateur.

Le prototype utilise des données fictives et des photos illustrées. Ce n’est pas le code de production : il sert de référence visuelle et fonctionnelle.
