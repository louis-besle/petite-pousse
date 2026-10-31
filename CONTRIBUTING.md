# Contribuer à Petite pousse

Merci de votre intérêt. **Petite pousse** est une PWA locale de suivi des
compétences pour une classe de maternelle : les données restent sur l'appareil,
dans IndexedDB, et rien n'est envoyé à un serveur applicatif.

Ce document décrit l'installation, les vérifications attendues et les règles de
contribution. En cas de doute, ouvrez une issue avant d'écrire du code.

## Prérequis

- **Node.js 24** (version utilisée par la CI).
- **npm** (le dépôt fournit `package-lock.json`).
- Git.
- Pour les tests E2E : les navigateurs Playwright, installés à la demande.

## Installation

```bash
git clone https://github.com/louis-besle/petite-pousse.git
cd petite-pousse
npm install
npm run dev
```

Le serveur de développement Vite affiche l'application en local. Le routage est
par hash : aucune réécriture serveur n'est nécessaire.

## Commandes de vérification

| Commande | Ce qu'elle couvre |
| --- | --- |
| `npm run lint` | ESLint sur tout le dépôt. |
| `npm run typecheck` | TypeScript en mode strict, sans émission. |
| `npm run test:run` | Tests unitaires et de composants (Vitest, Testing Library). |
| `npm run test:e2e` | Parcours E2E Chromium et WebKit (Playwright). |
| `npm run test:e2e:webkit` | Parcours E2E WebKit seuls (Safari iPhone/iPad). |
| `npm run test:e2e:offline` | Rechargement hors ligne sur un build de production dédié. |
| `npm run referential:check` | Contrôle du référentiel embarqué (objectifs, compétences, catégories). |
| `npm run build` | Build de production TypeScript + Vite dans `dist/`. |

Avant la première exécution E2E :

```bash
npx playwright install --with-deps chromium webkit
```

Le référentiel peut être régénéré depuis le CSV officiel avec
`npm run referential:build` ; vérifiez ensuite `npm run referential:check` et le
diff produit.

## Style de code

- **TypeScript strict** : pas de `any` gratuit, pas de `@ts-ignore` sans raison
  documentée. Les types se placent au plus près de leur usage.
- **React** : composants fonctionnels, hooks, pas de classe. Découpez les écrans
  par fonctionnalité (`src/features/...`) et gardez la logique métier testable
  hors des composants.
- **CSS Modules** : un fichier `*.module.css` par composant ou écran. Pas de style
  global nouveau sans nécessité ; réutilisez les variables existantes.
- **Langue** : l'interface, les libellés, les messages d'erreur et les commentaires
  métier sont en **français**. Le code (noms de variables, fonctions, types) reste
  en anglais.
- **Messages de commit** : en **anglais**, au format Conventional Commits, par
  exemple `fix(bilans): keep the selected period in the URL` ou
  `docs: refresh README and add MIT license`.
- **Formatage** : respectez le style du fichier que vous modifiez ; ne mélangez pas
  un reformatage global avec un correctif ciblé.

## Branches et pull requests

- Créez une **branche courte** depuis `main`, par exemple
  `fix/bilans-periode-url` ou `docs/guide-utilisateur`.
- Limitez chaque PR à un sujet : une correction, une fonctionnalité ou une mise à
  jour de documentation.
- La **CI doit être verte** (jobs « Lint, types, unités et build », « Playwright
  (en ligne et hors ligne) » et « Playwright WebKit (Safari iOS) ») avant toute
  fusion. Une PR rouge n'est pas fusionnée.
- Décrivez le problème, la solution et les vérifications exécutées dans la
  description de la PR.
- **Aucun secret** dans le dépôt : pas de clé, de jeton, de mot de passe ni de
  fichier `.env` réel.
- **Aucune donnée personnelle réelle** dans le code, les tests, les captures ou la
  documentation. Utilisez des prénoms fictifs et des photos de démonstration.

## Accessibilité

L'application vise **WCAG 2.1/2.2 AA** et le **RGAA 4.1.2**. Toute contribution
d'interface doit respecter ces exigences :

- cibles tactiles d'au moins **44 px** ;
- **focus visible** sur tous les éléments interactifs, ordre de tabulation
  cohérent ;
- respect de **`prefers-reduced-motion`** pour les transitions et animations ;
- libellés explicites, contrastes suffisants, structure de titres correcte ;
- scans **axe** sans violation A/AA sur les écrans et feuilles modales ;
- parcours vérifiés sur **WebKit** en plus de Chromium.

Toute évolution d'interface doit passer `npm run test:e2e`. Si elle modifie un
écran, une feuille modale ou un parcours audité, mettez à jour
`docs/accessibility/AUDIT-WCAG-RGAA.md` et, le cas échéant, la matrice RGAA.
Les limites connues (PDF non balisé, protocole lecteurs d'écran non exécuté sur
appareil réel) doivent rester documentées.

## Documentation

- Mettez à jour `README.md` si les fonctionnalités, les commandes ou les limites
  changent.
- Ajoutez une entrée dans `CHANGELOG.md`, section `## [Unreleased]`, pour toute
  évolution notable : ajout, modification, correction, accessibilité ou sécurité.
- Mettez à jour le guide utilisateur lorsque le comportement visible change
  (navigation, capture, bilans, sauvegarde).
- Pour une release, suivez `docs/operations/RELEASE.md` ; ne créez pas de tag ni de
  release sans décision explicite.

## Licence et règles de contribution

Le projet est distribué sous **licence MIT** (voir `LICENSE`). En proposant une
contribution, vous acceptez qu'elle soit publiée sous cette même licence.

- Travaillez sur votre propre fork ou une branche du dépôt, jamais directement
  sur `main`.
- Ne supprimez pas de fonctionnalité, de donnée ou de fichier sans discussion
  préalable dans une issue.
- Les données des familles ne doivent jamais quitter l'appareil : toute
  proposition ajoutant un service réseau, une analytique ou un stockage distant
  doit être discutée avant implémentation.
- Signalez les failles de sécurité en privé au mainteneur plutôt que dans une
  issue publique.
