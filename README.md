# Carnet de réussites

Application locale de suivi des compétences pour une classe de maternelle (PS, MS et GS) : photos, objectifs du programme officiel 2026, dossiers élèves et bilans A4 imprimables.

## État

Application terminée et en ligne : <https://carnet-de-reussites.vercel.app>

PWA installable et utilisable hors ligne, couverte par 296 tests unitaires et des parcours E2E (capture, dossiers, bilans, sauvegarde, accessibilité, performance, rechargement hors ligne).

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

## Contenu

- `docs/superpowers/specs/` : document de conception.
- `maquettes/` : prototype HTML cliquable, captures d'écran et exemple de bilan imprimé.

## Prototype

Ouvrir `maquettes/prototype.html` dans un navigateur.

Le prototype utilise des données fictives et des photos illustrées. Ce n'est pas le code de production : il sert de référence visuelle et fonctionnelle.
