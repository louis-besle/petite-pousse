# Runbook de release — Petite pousse

> **Release 1.2.0 publiée** (tag `v1.2.0`). Ce document décrit la procédure à
> suivre pour les publications suivantes. La dernière release publiée est la
> **1.2.0** : `main` et `dev` partent du même commit versionné.

Application : **Petite pousse**, <https://carnet-de-reussites.vercel.app> — dépôt : <https://github.com/louis-besle/petite-pousse>.

L'identifiant Vercel et l'URL de production restent volontairement historiques
(`carnet-de-reussites`) pour préserver les données locales des appareils déjà
installés : ne pas les renommer pendant une release.

## 0. Flux de branches

| Branche | Rôle | Déploiement Vercel |
| --- | --- | --- |
| `dev` | Intégration de **tout ce qui n'est pas une release** : corrections, fonctionnalités, documentation, refactors. | Prévisualisation |
| `main` | **État publié** : ne reçoit `dev` qu'au moment d'une release, avec le tag et la GitHub Release. | Production |

- Les branches courtes partent de `dev` et leurs PR sont fusionnées dans `dev`.
- **Ce runbook est le seul cas où `main` est mis à jour.** Hors release, aucune
  fusion vers `main`, aucun tag, aucun bump de version : le travail s'arrête sur
  `dev`.
- Une release se prépare depuis `dev` (section 2), se fusionne dans `main`
  (section 4), puis `main` est reporté dans `dev` pour que les deux branches
  repartent du même commit versionné.

## 1. Prérequis

- [ ] Release décidée : numéro de version choisi et validé (correctif,
      fonctionnalités ou rupture), avec accord explicite du mainteneur.
- [ ] `dev` propre, synchronisé avec `origin` et CI verte : toutes les évolutions
      prévues pour la version y sont fusionnées.
- [ ] `main` propre et synchronisé avec `origin` :

  ```bash
  git switch main
  git fetch origin
  git status
  git log --oneline origin/main..main
  git log --oneline main..origin/main
  ```

  Les deux dernières commandes doivent ne rien afficher.
- [ ] CI verte sur `main` (jobs « Lint, types, unités et build », « Playwright
      (en ligne et hors ligne) » et « Playwright WebKit (Safari iOS) ») :
      `gh run list --branch main --limit 5`.
- [ ] `CHANGELOG.md` à jour : `## [Unreleased]` contient toutes les évolutions
      depuis le dernier tag, sans omission ni contenu inventé.
- [ ] Audit d'accessibilité (`docs/accessibility/AUDIT-WCAG-RGAA.md`) relu et, si
      l'interface a changé, rafraîchi ou annoté.
- [ ] Documents légaux (`docs/legal/`) relus et, s'ils sont diffusés, complétés et
      validés par le responsable compétent.
- [ ] Sauvegarde des données de production faite si la release touche au stockage,
      à IndexedDB, au format de sauvegarde ou à l'origine de l'application.

## 2. Préparer la version

- [ ] Créer une branche courte depuis `dev` :

  ```bash
  git switch dev
  git pull --ff-only
  git switch -c release/x.y.z
  ```
- [ ] Mettre à jour `package.json` et `package-lock.json`, sans commit ni tag
      automatique : `npm version X.Y.Z --no-git-tag-version`.
- [ ] Reporter le numéro dans `README.md` (section « État » et compteurs de tests).
- [ ] Dater le changelog : remplacer `## [Unreleased]` par `## [X.Y.Z] - AAAA-MM-JJ`,
      ajouter une section `## [Unreleased]` vide au-dessus et mettre à jour les
      liens de comparaison en bas de fichier.
- [ ] Relire le diff (`git diff`, `git status`) avant de commiter.

## 3. Vérifier localement

Avec Node.js 24 :

```bash
npm ci
npm run lint
npm run typecheck
npm run test:run
npx playwright install --with-deps chromium webkit
npm run test:e2e
npm run test:e2e:offline
npm run referential:check
npm run build
```

- [ ] Toutes les commandes réussissent avant de continuer.

## 4. Commit, PR et fusion

- [ ] Commiter et pousser la préparation :

  ```bash
  git add package.json package-lock.json README.md CHANGELOG.md
  git commit -m "chore(release): x.y.z"
  git push -u origin release/x.y.z
  ```

- [ ] Ouvrir la PR et attendre une CI verte :

  ```bash
  gh pr create --fill
  gh pr checks --watch
  ```

- [ ] Fusionner dans `main`, puis `git switch main` et `git pull --ff-only`.

- [ ] Reporter la fusion dans `dev` pour que les deux branches repartent du même
      commit versionné (hors release, on ne fusionne que vers `dev`) :

  ```bash
  git switch dev
  git merge --ff-only main
  git push origin dev
  ```

## 5. Vérifier la CI sur main

- [ ] Attendre la fin du run déclenché par la fusion et vérifier les trois jobs :

  ```bash
  gh run list --branch main --limit 3
  gh run watch <run-id>
  ```

- [ ] Les trois jobs — « Lint, types, unités et build », « Playwright (en ligne
      et hors ligne) » et « Playwright WebKit (Safari iOS) » — sont verts ; ne pas
      taguer si un job échoue.

## 6. Créer le tag et la release GitHub

- [ ] Créer un tag annoté sur le commit de `main` :

  ```bash
  git tag -a vX.Y.Z -m "Petite pousse X.Y.Z"
  git tag --list "vX.Y.Z"
  git push origin vX.Y.Z
  ```

- [ ] Publier la GitHub Release en reprenant la section datée du changelog :

  ```bash
  gh release create vX.Y.Z \
    --title "X.Y.Z - <titre court>" \
    --notes-file <fichier-notes.md>
  ```

- [ ] Vérifier avec `gh release view vX.Y.Z` puis `gh release list`.

## 7. Vérifier le déploiement de production

- [ ] Identifier le déploiement de production associé au commit fusionné :

  ```bash
  vercel list carnet-de-reussites
  ```

- [ ] Si le déploiement automatique n'est pas celui attendu, promouvoir le bon :

  ```bash
  vercel promote <url-du-deploiement>
  ```

- [ ] Contrôler l'URL <https://carnet-de-reussites.vercel.app> (l'ancienne URL doit
      rester servie, sinon les données locales sont perdues), le titre de la page
      et le nom de la PWA, puis installer la PWA depuis un navigateur propre.
- [ ] Couper le réseau, vérifier le rechargement hors ligne, puis ouvrir un dossier
      élève et générer un PDF de bilan : le fichier s'ouvre et contient les bonnes
      données.
- [ ] Parcourir **Classe / Programme / Bilans** et vérifier que l'avatar ouvre le
      profil, les réglages et la gestion des élèves.

## 8. Surveiller après la release

- [ ] Surveiller les erreurs des premières heures (`vercel logs <url-de-production>`),
      le tableau de bord Vercel et les retours d'usage ; en cas de régression
      bloquante, appliquer le retour arrière plutôt que de modifier la production.

## 9. Retour arrière

- [ ] Repérer le dernier déploiement sain (`vercel list carnet-de-reussites`) puis le
      promouvoir en production (`vercel rollback <url-du-deploiement>` fait de même) :

  ```bash
  vercel promote <url-du-deploiement-precedent>
  ```

- [ ] Vérifier de nouveau l'URL, l'installation PWA, le mode hors ligne et un PDF.
- [ ] Ne pas supprimer le tag ni la GitHub Release sans décision explicite : le tag
      documente l'état publié, même après un retour arrière.
- [ ] Consigner l'incident et préparer une version corrective (`X.Y.Z+1`).
