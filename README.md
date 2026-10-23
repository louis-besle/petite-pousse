# Carnet de réussites

Application locale de suivi des compétences pour une classe de maternelle (PS, MS et GS) : photos, objectifs du programme officiel 2026, dossiers élèves et bilans A4 imprimables.

## État

Application terminée et en ligne : <https://carnet-de-reussites.vercel.app>

PWA installable et utilisable hors ligne, couverte par 312 tests unitaires et des parcours E2E (capture, dossiers, bilans, sauvegarde, accessibilité, performance, rechargement hors ligne).

## Données et confidentialité

Tout reste sur l'appareil : élèves, photos et réussites sont stockés dans IndexedDB. Aucun compte, aucun serveur applicatif, aucune donnée envoyée. La sauvegarde et la restauration se font depuis les réglages, dans un fichier local.

## Commandes

```bash
npm install               # installer les dépendances
npm run dev               # serveur de développement
npm run build             # build de production dans dist/
npm run preview           # servir le build local
npm run test:run          # tests unitaires (Vitest)
npm run test:e2e          # parcours E2E (Playwright, serveur de dev)
npm run test:e2e:offline  # rechargement hors ligne (build de production dédié)
npm run lint              # ESLint
npm run typecheck         # TypeScript
```

Le déploiement est un build statique Vite, configuré par `vercel.ts` (framework `vite`, sortie `dist/`). Le routage par hash ne nécessite aucune réécriture serveur.

Le projet Vercel est relié au dépôt GitHub : chaque push sur `main` déploie automatiquement la production, et les autres branches créent des déploiements de prévisualisation. Si nécessaire, un déploiement manuel reste possible avec `npx vercel@latest deploy --prod --project carnet-de-reussites`.

## Accessibilité

L’application est auditée selon WCAG 2.1/2.2 AA et le RGAA 4.1.2. Le rapport complet et la matrice des 106 critères sont dans `docs/accessibility/`.

Verdict actuel : **partiellement conforme**. Les écrans et feuilles ne présentent aucune violation axe A/AA, mais le PDF n’est pas balisé (l’aperçu HTML A4 est la version accessible) et la matrice de tests avec lecteurs d’écran reste à compléter.

## Contenu

- `docs/accessibility/` : audit WCAG/RGAA et matrice des critères.
- `docs/superpowers/specs/` : document de conception.
- `maquettes/` : prototype HTML cliquable, captures d'écran et exemple de bilan imprimé.

## Prototype

Ouvrir `maquettes/prototype.html` dans un navigateur.

Le prototype utilise des données fictives et des photos illustrées. Ce n'est pas le code de production : il sert de référence visuelle et fonctionnelle.
