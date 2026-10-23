# Carnet de réussites

Application locale de suivi des compétences pour une classe de maternelle (PS, MS et GS) : photos, objectifs du programme officiel 2026 et du programme EVAR, dossiers élèves et bilans A4 imprimables.

## État

Version **1.1.0**, en ligne : <https://carnet-de-reussites.vercel.app>

PWA installable et utilisable hors ligne, couverte par **338 tests unitaires**, **50 parcours E2E** (Chromium et WebKit) et **1 test de rechargement hors ligne**.

Nouveautés de la v1.1 :

- **Bilans en lot** : un ZIP contenant un PDF par élève, pour l’année et la période sélectionnées.
- **Sauvegarde chiffrée** : protection facultative par mot de passe (AES-256-GCM, PBKDF2-SHA256). Les anciennes sauvegardes en clair restent restaurables.
- **Programme EVAR** : éducation à la vie affective et relationnelle, BO n° 6 du 6 février 2025, intégrée au programme, à la capture, aux dossiers et aux bilans.
- **WebKit** : parcours de fumée sur le moteur de Safari, en plus de Chromium.

## Données et confidentialité

Tout reste sur l’appareil : élèves, photos et réussites sont stockés dans IndexedDB. Aucun compte, aucun serveur applicatif, aucune donnée envoyée. La sauvegarde et la restauration se font depuis les réglages, dans un fichier local.

Une sauvegarde peut être protégée par un mot de passe. **Sans ce mot de passe, elle est définitivement illisible** : il n’existe aucun moyen de le récupérer. Une sauvegarde non chiffrée contient les données personnelles et les photos des enfants ; elle doit être conservée dans un endroit protégé.

## Commandes

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

Verdict actuel : **partiellement conforme**. Les écrans et feuilles ne présentent aucune violation axe A/AA, et les parcours principaux sont couverts sur Chromium et WebKit. Le PDF n’est pas balisé : l’aperçu HTML A4 est la version accessible. La matrice de tests avec lecteurs d’écran reste à exécuter sur appareils réels ; le protocole VoiceOver/TalkBack est prêt dans `docs/accessibility/PROTOCOLE-LECTEURS-ECRAN.md`.

## Contenu

- `docs/accessibility/` : audit WCAG/RGAA, matrice des critères et protocole lecteurs d’écran.
- `docs/superpowers/specs/` : document de conception.
- `docs/superpowers/plans/` : plans d’implémentation.
- `scripts/referential/source/` : transcription officielle du référentiel et notes de vérification.
- `maquettes/` : prototype HTML cliquable, captures d’écran et exemple de bilan imprimé.

## Prototype

Ouvrir `maquettes/prototype.html` dans un navigateur.

Le prototype utilise des données fictives et des photos illustrées. Ce n’est pas le code de production : il sert de référence visuelle et fonctionnelle.
