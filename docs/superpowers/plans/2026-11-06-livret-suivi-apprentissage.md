# Plan d'implémentation — nom de travail : Carnet de réussites

> **Note historique.** Ce plan a été écrit avant le choix du nom définitif. L’application s’appelle désormais **Petite pousse** ; les identifiants techniques `carnet-de-reussites` (base IndexedDB, format de sauvegarde, URL) sont conservés pour la compatibilité.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire une PWA locale qui permet à une enseignante de maternelle de valider les réussites de ses élèves avec ou sans photo, de consulter le programme officiel 2026 et de produire des bilans A4 imprimables, sans aucune donnée envoyée en ligne.

**Architecture:** Application React mono-page, 100 % statique, avec IndexedDB (Dexie) pour les élèves, les validations et les photos. Le référentiel officiel est embarqué et versionné. Les écrans suivent le prototype `maquettes/prototype.html`. Le PDF est composé à la demande avec `pdf-lib` ; la sauvegarde est un ZIP exporté/importé par l'enseignante.

**Tech Stack:** Vite, React, TypeScript strict, React Router (hash), Dexie + `dexie-react-hooks`, `date-fns`, `pdf-lib`, `fflate`, `zod`, CSS Modules, `vite-plugin-pwa`, Vitest + Testing Library + `fake-indexeddb`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-06-livret-suivi-apprentissage-design.md`

## Contraintes globales

- Interface en français, accents compris ; dates affichées au format français.
- 100 % local : aucune requête réseau au fonctionnement, aucun compte, aucun analytics, aucune police chargée depuis un CDN.
- Cibles : iOS/iPadOS 16+, Android 10+ avec Chrome à jour. Safari et Chrome sont les navigateurs de référence.
- Une seule validation par couple élève × objectif, toutes années scolaires confondues.
- Photos : côté long max 1600 px, JPEG qualité 0,82, cible < 300 Ko, vignette max 400 px, EXIF supprimé.
- PDF : A4, une ou plusieurs pages, en-tête/pied répétés, mention « Observation en classe » sans photo.
- Suppression d'un élève : définitive, en cascade sur toutes ses validations et photos, avec confirmation.
- Changement d'année : aucune donnée supprimée ; les réussites restent rattachées à leur année.
- Accessibilité : cibles ≥ 44 px, contraste texte ≥ 4,5:1, focus visible, `aria-label` sur les boutons icônes, information jamais portée par la couleur seule, `prefers-reduced-motion` respecté.
- Commits atomiques et Conventional Commits. Chaque commit est backdaté selon `AGENTS.md` : au moins 14 jours dans le passé (le projet dépasse 10 fichiers sources), heure entre 09:00 et 01:00, minutes et secondes aléatoires, jamais `:00`.

## Review Focus

1. **Aller-retour appareil photo sur iOS.** La PWA peut être suspendue ou rechargée quand l'appareil photo natif s'ouvre. Le brouillon de capture (élève + photo) doit survivre à un remontage ou à un rechargement, sans perdre la photo ni changer d'élève. Test dans la tâche 13 et dans `e2e/capture.spec.ts`.
2. **Suppression en cascade.** Supprimer un élève doit effacer ses validations et ses photos de toutes les années, sans laisser d'orphelins ni planter quand il n'a aucune validation. Test dans les tâches 9 et 10, puis en e2e.
3. **Frontière d'année et date de changement de semestre.** Une validation du 31 janvier et une du 1er février doivent tomber dans des bilans différents ; juillet-août reste hors bilan ; changer la date de changement déplace les validations sans en perdre. Tests dans les tâches 7 et 18, puis en e2e.
4. **Double validation.** Un double toucher ou deux onglets ne doivent jamais créer deux validations pour le même objectif ; l'index unique doit être appliqué et l'erreur affichée proprement. Test dans la tâche 10 et en e2e.
5. **Restauration de sauvegarde volumineuse.** Une sauvegarde invalide ou incomplète ne doit pas laisser la base à moitié remplacée ; une sauvegarde valide doit restaurer photos et années. Test dans la tâche 21.

## Structure des fichiers

```text
index.html
package.json
vite.config.ts
tsconfig.json
tsconfig.node.json
eslint.config.js
playwright.config.ts
pwa-assets.config.ts
vercel.ts
public/
  favicon.svg
  icons/                       # générés
scripts/referential/
  source/README.md
  source/objectives.csv
  source/VERIFICATION.md
  build.ts
  check.ts
  __fixtures__/objectives.csv
src/
  main.tsx
  App.tsx
  router.tsx
  styles/tokens.css
  styles/global.css
  ui/                          # Button, IconButton, Chip, Field, Sheet, Toast, NavBar, Avatar, SectionPill, FlowerMark, icons
  domain/
    types.ts
    referential.ts
    schoolYear.ts
    bilan.ts
    errors.ts
  data/referential.json
  db/
    db.ts
    seed.ts
    students.ts
    schoolYears.ts
    validations.ts
    photos.ts
    settings.ts
    drafts.ts
  lib/
    id.ts
    date.ts
    image.ts
    share.ts
  features/
    class/ClassScreen.tsx
    capture/StudentPickerScreen.tsx
    capture/PhotoScreen.tsx
    capture/ObjectiveScreen.tsx
    capture/SuccessScreen.tsx
    dossier/DossierScreen.tsx
    dossier/ValidationSheet.tsx
    students/ManageStudentsScreen.tsx
    students/StudentFormSheet.tsx
    programme/ProgrammeScreen.tsx
    programme/ObjectiveSheet.tsx
    bilans/BilansScreen.tsx
    bilans/PeriodEditor.tsx
    bilans/BilanPreviewScreen.tsx
    bilans/BilanSheet.tsx
    bilans/pdf.ts
    settings/SettingsScreen.tsx
    settings/BackupPanel.tsx
    settings/StoragePanel.tsx
    settings/backup.ts
  test/
    setup.ts
    fixtures.ts
    render.tsx
e2e/
  fixtures/photo.jpg
  helpers.ts
  capture.spec.ts
  students.spec.ts
  programme.spec.ts
  bilans.spec.ts
  backup.spec.ts
  year.spec.ts
  responsive.spec.ts
  offline.spec.ts
```

---

### Task 1 : Socle Vite + React + TypeScript + tests

**Fichiers :**
- Créer : `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `eslint.config.js`, `src/main.tsx`, `src/App.tsx`, `src/domain/types.ts`, `src/styles/tokens.css`, `src/styles/global.css`, `src/test/setup.ts`, `src/App.test.tsx`.
- Modifier : `.gitignore` si le scaffold ajoute des entrées utiles.

**Interfaces :**
- Produit : `App` (composant racine), variables CSS de `tokens.css`, scripts npm `dev`, `build`, `preview`, `test`, `test:run`, `test:e2e`, `lint`, `typecheck`, `referential:build`, `referential:check`.
- Produit aussi `src/domain/types.ts` : `Section`, `AgeBand`, `Student`, `SchoolYear`, `Domain`, `Competency`, `Objective`, `ValidationSnapshot`, `Validation`, `Photo`, `Settings`, `CompressedPhoto`.

- [ ] **Étape 1 : Scaffolder dans un dossier temporaire**

```bash
npm create vite@latest carnet-scaffold -- --template react-ts
```

Copier dans le dépôt `package.json`, `index.html`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `eslint.config.js` et le contenu de `src/` du scaffold. Ne pas écraser `docs/` ni `maquettes/`.

- [ ] **Étape 2 : Installer les dépendances applicatives**

```bash
npm install react-router-dom dexie dexie-react-hooks date-fns pdf-lib @pdf-lib/fontkit fflate zod @fontsource/fraunces @fontsource/nunito
npm install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom fake-indexeddb vite-plugin-pwa @vite-pwa/assets-generator @playwright/test @axe-core/playwright pdfjs-dist tsx csv-parse
```

- [ ] **Étape 3 : Configurer les scripts et l'alias**

Dans `package.json`, scripts : `dev`, `build` (`tsc -b && vite build`), `preview`, `test` (`vitest`), `test:run` (`vitest run`), `test:e2e` (`playwright test`), `lint`, `typecheck` (`tsc --noEmit`), `referential:build` (`tsx scripts/referential/build.ts`), `referential:check` (`tsx scripts/referential/check.ts`).

Dans `tsconfig.json` et `vite.config.ts`, ajouter l'alias `@/*` → `src/*`. Activer `resolveJsonModule` dans `tsconfig.json`. Dans `vite.config.ts`, ajouter la configuration Vitest : `environment: 'jsdom'`, `setupFiles: './src/test/setup.ts'`, `globals: true`.

- [ ] **Étape 4 : Écrire le test qui échoue**

`src/App.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

it('affiche le nom de l’application', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Carnet de réussites' })).toBeInTheDocument();
});
```

- [ ] **Étape 5 : Lancer le test et vérifier l'échec**

Run: `npm run test:run -- src/App.test.tsx`
Expected: FAIL, le scaffold Vite n'affiche pas ce titre.

- [ ] **Étape 6 : Implémenter le minimum**

`App` retourne `<main data-testid="app-root"><h1>Carnet de réussites</h1></main>`. `src/domain/types.ts` reprend les types du spec. `main.tsx` importe les graisses Nunito 400/600/700/800 et Fraunces 500/600/700 depuis `@fontsource`. `tokens.css` reprend les variables du prototype (papier, encre, terre cuite, sauge, moutarde, ciel, rose, domaines, rayons, ombres). `global.css` pose le reset, le fond crème, `focus-visible`, `prefers-reduced-motion` et les zones sûres iOS.

- [ ] **Étape 7 : Vérifier**

Run: `npm run test:run -- src/App.test.tsx` puis `npm run build`
Expected: PASS, build sans erreur.

- [ ] **Étape 8 : Commit**

```bash
git add package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.node.json eslint.config.js src
git commit -m "chore: scaffold vite react typescript app"
```

---

### Task 2 : Jetons visuels et composants de base

**Fichiers :**
- Créer : `src/ui/Button.tsx`, `src/ui/Button.module.css`, `src/ui/IconButton.tsx`, `src/ui/Chip.tsx`, `src/ui/Field.tsx`, `src/ui/Avatar.tsx`, `src/ui/SectionPill.tsx`, `src/ui/FlowerMark.tsx`, `src/ui/icons.tsx`, `src/ui/ui.module.css`.
- Test : `src/ui/ui.test.tsx`.

**Interfaces :**
- Produit :
  - `Button({ variant?: 'primary' | 'ghost' | 'danger' | 'dark'; fullWidth?: boolean; disabled?: boolean; children; onClick? })` avec `data-variant`.
  - `IconButton({ label: string; children; onClick? })` avec `aria-label`.
  - `Chip({ active?: boolean; children; onClick? })` avec `aria-pressed`.
  - `Field({ label: string; icon?: ReactNode; ...inputProps })`.
  - `Avatar({ name: string; section: Section; size?: 'sm' | 'md' | 'lg' })`.
  - `SectionPill({ section: Section })`.
  - `FlowerMark({ size?: number })` avec `aria-hidden`.

- [ ] **Étape 1 : Écrire les tests qui échouent**

`src/ui/ui.test.tsx` : vérifier que `Button variant="danger"` porte `data-variant="danger"` et que `disabled` désactive ; que `IconButton` expose `aria-label` ; que `Chip active` porte `aria-pressed="true"` ; que `Avatar name="Léa" section="MS"` affiche `L` et `MS` ; que `Field` associe son label à l'input.

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- src/ui/ui.test.tsx`
Expected: FAIL, les modules n'existent pas.

- [ ] **Étape 3 : Implémenter les composants**

Reprendre les styles du prototype : boutons pilules, terre cuite pour l'action principale, encre pour l'action secondaire, rose pour le danger ; chips avec état actif encre ; champs arrondis avec icône ; avatars colorés par section (PS rose, MS moutarde, GS sauge). Les couleurs de section sont toujours accompagnées de la lettre.

- [ ] **Étape 4 : Vérifier**

Run: `npm run test:run -- src/ui/ui.test.tsx`
Expected: PASS.

- [ ] **Étape 5 : Commit**

```bash
git add src/ui
git commit -m "feat(ui): add design tokens and base components"
```

---

### Task 3 : Feuilles modales, toasts et navigation

**Fichiers :**
- Créer : `src/ui/Sheet.tsx`, `src/ui/ConfirmSheet.tsx`, `src/ui/Toast.tsx`, `src/ui/ToastProvider.tsx`, `src/ui/NavBar.tsx`, `src/ui/AppShell.tsx`.
- Test : `src/ui/sheet.test.tsx`, `src/ui/toast.test.tsx`, `src/ui/nav.test.tsx`.

**Interfaces :**
- Produit :
  - `Sheet({ open: boolean; onClose: () => void; title: string; children })` : `role="dialog"`, `aria-modal="true"`, focus initial, piège de focus, fermeture Échap et clic sur le fond.
  - `ConfirmSheet({ open; title; description; confirmLabel; tone?: 'danger' | 'primary'; onConfirm; onClose })`.
  - `ToastProvider({ children })` et `useToast(): { showToast(message: string): void }`.
  - `NavBar()` : liens Élèves (`/`), Programme (`/programme`), Bilans (`/bilans`), `aria-current="page"` sur l'actif.
  - `AppShell()` : `<main id="main"><Outlet /></main>`, lien d'évitement, `NavBar` masquée sur `/capture/*` et `/success/*`.

- [ ] **Étape 1 : Écrire les tests qui échouent**

`sheet.test.tsx` : à l'ouverture, le focus est dans le dialogue ; `Tab` reste piégé ; `Échap` appelle `onClose`. `toast.test.tsx` : `showToast('Élève ajouté')` affiche le message puis le retire après 2,6 s avec `vi.useFakeTimers()`. `nav.test.tsx` : sur `/programme`, le lien Programme porte `aria-current="page"`.

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- src/ui`
Expected: FAIL.

- [ ] **Étape 3 : Implémenter**

`Sheet` monte un portail, mémorise l'élément actif, rend le focus au déclencheur à la fermeture. `ToastProvider` garde un seul message et un timer. `NavBar` utilise `NavLink` de React Router. `AppShell` utilise `useLocation` pour masquer la navigation pendant la capture.

- [ ] **Étape 4 : Vérifier**

Run: `npm run test:run -- src/ui`
Expected: PASS.

- [ ] **Étape 5 : Commit**

```bash
git add src/ui
git commit -m "feat(ui): add accessible sheets, toasts and navigation"
```

---

### Task 4 : Routage et squelette des écrans

**Fichiers :**
- Créer : `src/router.tsx`, `src/ui/ScreenPlaceholder.tsx`, `src/test/render.tsx`, `src/router.test.tsx`.
- Modifier : `src/App.tsx`, `src/main.tsx`, `src/App.test.tsx` (remplacer le test du socle par un test via `renderApp`).

**Interfaces :**
- Produit : `routes: RouteObject[]`, `router = createHashRouter(routes)`, `App` qui monte `ToastProvider` + `RouterProvider`, `renderApp({ route })` pour les tests.
- Routes : `/`, `/capture`, `/capture/:studentId/photo`, `/capture/objective`, `/success/:validationId`, `/students`, `/students/:studentId`, `/programme`, `/bilans`, `/bilans/:studentId`, `/settings`, `*`.

- [ ] **Étape 1 : Écrire les tests qui échouent**

`router.test.tsx` : `renderApp({ route: '/programme' })` affiche « Programme » ; `renderApp({ route: '/bilans' })` affiche « Bilans » ; la navigation n'apparaît pas sur `/capture`.

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- src/router.test.tsx`
Expected: FAIL.

- [ ] **Étape 3 : Implémenter le routeur et les placeholders**

Chaque route utilise `ScreenPlaceholder` avec son titre. `AppShell` est le layout parent. `renderApp` crée un `createMemoryRouter(routes, { initialEntries: [route] })` et enveloppe dans `ToastProvider`. `App` utilise `RouterProvider router={router}`.

- [ ] **Étape 4 : Vérifier**

Run: `npm run test:run -- src/router.test.tsx` puis `npm run build`
Expected: PASS.

- [ ] **Étape 5 : Commit**

```bash
git add src/App.tsx src/main.tsx src/router.tsx src/router.test.tsx src/test/render.tsx src/ui/ScreenPlaceholder.tsx
git commit -m "feat: add hash routing and screen skeleton"
```

---

### Task 5 : Schéma, construction et validation du référentiel

**Fichiers :**
- Créer : `src/domain/referential.ts`, `scripts/referential/build.ts`, `scripts/referential/check.ts`, `scripts/referential/__fixtures__/objectives.csv`, `scripts/referential/build.test.ts`.
- Modifier : `package.json` (scripts déjà prévus).

**Interfaces :**
- Consomme : les types de `src/domain/types.ts`.
- Produit :
  - `validateReferential(input: unknown): Referential`.
  - `buildReferentialFromCsv(csv: string): Referential`.
  - `referential: Referential` (JSON réel, importé dans `src/data/referential.json`).
  - `ageBandForSection(section: Section): AgeBand` (PS → `before4`, MS → `from4`, GS → `from5`).
  - `objectivesForSection(ref: Referential, section: Section): Objective[]`.
  - `domainById(ref: Referential, id: Domain['id']): Domain`.

- [ ] **Étape 1 : Écrire les tests qui échouent**

`scripts/referential/build.test.ts` : un CSV fixture de 3 objectifs produit 3 objectifs, les domaines présents, et un `version` non vide. Un identifiant dupliqué lève une erreur. Un objectif sans exemple pour une tranche déclarée lève une erreur. Un domaine inconnu lève une erreur.

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- scripts/referential/build.test.ts`
Expected: FAIL.

- [ ] **Étape 3 : Implémenter le schéma et le builder**

Le CSV a les colonnes : `objective_id, domain_id, competency_id, competency_label, objective_label, age_bands, example_before4, example_from4, example_from5, source_bo, source_page`. `age_bands` est séparé par `|`. Le builder parse avec `csv-parse/sync`, déduplique les domaines et compétences, valide avec Zod, et écrit `src/data/referential.json`. Le check imprime les comptes par domaine et par tranche, et avertit si les totaux s'éloignent de 114/140/162 de plus de 10 %.

- [ ] **Étape 4 : Vérifier**

Run: `npm run test:run -- scripts/referential/build.test.ts`
Expected: PASS.

- [ ] **Étape 5 : Commit**

```bash
git add src/domain/types.ts src/domain/referential.ts scripts/referential src/data/referential.json
git commit -m "feat(referential): add schema, csv builder and validator"
```

---

### Task 6 : Contenu du référentiel officiel 2026

**Fichiers :**
- Créer : `scripts/referential/source/README.md`, `scripts/referential/source/objectives.csv`, `scripts/referential/source/VERIFICATION.md`, `src/data/referential.json`.
- Test : `npm run referential:check`.

**Interfaces :**
- Consomme : le schéma et le builder de la tâche 5.
- Produit : le référentiel complet des six domaines, avec identifiants stables, tranches d'âge, exemples et source.

- [ ] **Étape 1 : Documenter la source**

Dans `source/README.md`, noter les URLs et références exactes : BO n°19 du 7 mai 2026 (arrêté du 16 avril 2026), et BO n°41 du 31 octobre 2024 pour les domaines langage et mathématiques. Télécharger le texte officiel dans le dossier de travail (ne pas le committer s'il est volumineux). Règles : recopier les intitulés sans reformulation, conserver les exemples, rattacher chaque objectif à une page/tableau. Si le texte officiel n'est pas accessible, arrêter et demander : ne jamais inventer ou reconstituer un objectif de mémoire.

- [ ] **Étape 2 : Remplir le domaine Langage**

Remplir les lignes du CSV pour le domaine `langage`. Lancer `npm run referential:build` puis `npm run referential:check`. Commit : `data(referential): add langage objectives`.

- [ ] **Étape 3 : Remplir les domaines Mathématiques, Corps, Arts, Temps et Vivant**

Répéter pour `maths`, `corps`, `arts`, `temps`, `vivant`. Un commit par domaine : `data(referential): add maths objectives`, etc.

- [ ] **Étape 4 : Vérifier les comptes et un échantillon**

`npm run referential:check` doit passer sans erreur de schéma. Noter dans `VERIFICATION.md` 20 objectifs tirés au hasard, leur page source et la correspondance constatée. Les comptes 114/140/162 sont des garde-fous : noter l'écart, ne pas inventer d'objectifs pour l'atteindre.

- [ ] **Étape 5 : Générer le JSON final et vérifier le build**

Run: `npm run referential:build && npm run referential:check && npm run build`
Expected: PASS, `src/data/referential.json` contient les six domaines.

- [ ] **Étape 6 : Commit**

```bash
git add scripts/referential/source src/data/referential.json
git commit -m "data(referential): build official 2026 referential"
```

---

### Task 7 : Logique d'année scolaire et de bilan

**Fichiers :**
- Créer : `src/domain/schoolYear.ts`, `src/domain/schoolYear.test.ts`.

**Interfaces :**
- Produit :
  - `schoolYearIdForDate(date: string): string` — `YYYY-MM-DD` → `"2026-2027"` ; juillet-août appartiennent à l'année qui vient de s'écouler.
  - `defaultSchoolYear(id: string): SchoolYear` — début 1er septembre, `period1End` 31 janvier, `period2End` 30 juin.
  - `nextSchoolYearId(id: string): string`.
  - `periodForDate(date: string, year: SchoolYear): 1 | 2 | null`.
  - `periodRange(year: SchoolYear, period: 1 | 2): { start: string; end: string }`.

- [ ] **Étape 1 : Écrire les tests qui échouent**

```ts
it('rattache septembre à la nouvelle année et juillet à la précédente', () => {
  expect(schoolYearIdForDate('2026-09-01')).toBe('2026-2027');
  expect(schoolYearIdForDate('2027-01-31')).toBe('2026-2027');
  expect(schoolYearIdForDate('2027-07-15')).toBe('2026-2027');
  expect(schoolYearIdForDate('2027-09-01')).toBe('2027-2028');
});

it('découpe les deux bilans', () => {
  const year = { id: '2026-2027', start: '2026-09-01', period1End: '2027-01-31', period2End: '2027-06-30' };
  expect(periodForDate('2026-09-01', year)).toBe(1);
  expect(periodForDate('2027-01-31', year)).toBe(1);
  expect(periodForDate('2027-02-01', year)).toBe(2);
  expect(periodForDate('2027-06-30', year)).toBe(2);
  expect(periodForDate('2027-07-01', year)).toBeNull();
});
```

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- src/domain/schoolYear.test.ts`
Expected: FAIL.

- [ ] **Étape 3 : Implémenter avec des comparaisons de chaînes**

Les dates `YYYY-MM-DD` se comparent lexicographiquement : pas de conversion timezone. `periodRange(1)` retourne `{ start: year.start, end: year.period1End }` ; `periodRange(2)` retourne `{ start: addDays(period1End, 1), end: year.period2End }` avec `date-fns`.

- [ ] **Étape 4 : Vérifier**

Run: `npm run test:run -- src/domain/schoolYear.test.ts`
Expected: PASS.

- [ ] **Étape 5 : Commit**

```bash
git add src/domain/schoolYear.ts src/domain/schoolYear.test.ts
git commit -m "feat(domain): add school year and bilan period logic"
```

---

### Task 8 : Base IndexedDB et amorçage

**Fichiers :**
- Créer : `src/db/db.ts`, `src/db/seed.ts`, `src/db/settings.ts`, `src/test/setup.ts` (compléter), `src/test/fixtures.ts`, `src/db/db.test.ts`.

**Interfaces :**
- Produit :
  - `db: CarnetDB` avec les tables `students`, `schoolYears`, `validations`, `photos`, `settings`, `drafts`.
  - `ensureSeed(): Promise<void>` : crée les réglages par défaut et l'année courante si absents ; idempotent.
  - `getSettings(): Promise<Settings>`.
  - `updateSettings(patch: Partial<Settings>): Promise<void>`.
  - `useSettings(): Settings | undefined`.

- [ ] **Étape 1 : Écrire le test qui échoue**

```ts
beforeEach(async () => { await db.delete(); await db.open(); });

it('sème les réglages et l’année courante', async () => {
  await ensureSeed();
  const settings = await db.settings.get('app');
  expect(settings?.schemaVersion).toBe(1);
  expect(settings?.currentSchoolYearId).toMatch(/^\d{4}-\d{4}$/);
  expect(await db.schoolYears.get(settings!.currentSchoolYearId)).toBeDefined();
});
```

- [ ] **Étape 2 : Lancer le test et vérifier l'échec**

Run: `npm run test:run -- src/db/db.test.ts`
Expected: FAIL.

- [ ] **Étape 3 : Implémenter le schéma Dexie**

```ts
this.version(1).stores({
  students: 'id, section, firstName',
  schoolYears: 'id, start',
  validations: 'id, studentId, objectiveId, date, schoolYearId, &[studentId+objectiveId]',
  photos: 'id, validationId',
  settings: 'id',
  drafts: 'id',
});
```

`ensureSeed` calcule la date du jour avec `new Date().toISOString().slice(0, 10)` (le helper `todayIso` arrive en tâche 11), puis utilise `schoolYearIdForDate`, `defaultSchoolYear` et la version du référentiel. `src/test/setup.ts` importe `fake-indexeddb/auto`, `@testing-library/jest-dom`, mocke `URL.createObjectURL`/`revokeObjectURL` et `matchMedia`, et remet la base à zéro entre les tests.

- [ ] **Étape 4 : Vérifier**

Run: `npm run test:run -- src/db/db.test.ts`
Expected: PASS.

- [ ] **Étape 5 : Commit**

```bash
git add src/db src/test
git commit -m "feat(db): add indexeddb schema and seed"
```

---

### Task 9 : Dépôt élèves

**Fichiers :**
- Créer : `src/db/students.ts`, `src/db/students.test.ts`.

**Interfaces :**
- Produit :
  - `createStudent(input: { firstName: string; lastNameInitial?: string; section: Section }): Promise<Student>`.
  - `updateStudent(id: string, patch: Partial<Pick<Student, 'firstName' | 'lastNameInitial' | 'section'>>): Promise<void>`.
  - `deleteStudentCascade(id: string): Promise<void>`.
  - `useStudents(): Student[] | undefined`.
  - `normalizeLastNameInitial(value: string): string | undefined` (majuscule, une lettre, vide → `undefined`).

- [ ] **Étape 1 : Écrire les tests qui échouent**

Créer un élève, le retrouver dans `useStudents`, modifier son prénom et sa section, normaliser l'initiale (`'m'` → `'M'`, `''` → `undefined`), supprimer un élève sans validation et vérifier qu'il disparaît.

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- src/db/students.test.ts`
Expected: FAIL.

- [ ] **Étape 3 : Implémenter**

`deleteStudentCascade` ouvre une transaction `rw` sur `students`, `validations`, `photos`, récupère les validations de l'élève, supprime les photos par `validationId` (guard si la liste est vide), puis les validations, puis l'élève.

- [ ] **Étape 4 : Vérifier**

Run: `npm run test:run -- src/db/students.test.ts`
Expected: PASS.

- [ ] **Étape 5 : Commit**

```bash
git add src/db/students.ts src/db/students.test.ts
git commit -m "feat(students): add student repository"
```

---

### Task 10 : Dépôt validations et photos

**Fichiers :**
- Créer : `src/db/schoolYears.ts`, `src/db/validations.ts`, `src/db/photos.ts`, `src/db/validations.test.ts`, `src/db/photos.test.ts`, `src/domain/errors.ts`.
- Modifier : `src/db/students.test.ts` (test de cascade avec validations).

**Interfaces :**
- Produit :
  - `getOrCreateSchoolYear(date: string): Promise<SchoolYear>`.
  - `updateSchoolYearPeriods(yearId: string, patch: { period1End?: string; period2End?: string }): Promise<void>`.
  - `startNextSchoolYear(currentId: string): Promise<SchoolYear>` (crée ou bascule, sans supprimer).
  - `createValidation(input: CreateValidationInput): Promise<Validation>` avec `AlreadyValidatedError`.
  - `deleteValidation(id: string): Promise<void>` (supprime la photo liée).
  - `updateValidationDate(id: string, date: string): Promise<void>` (reclasse l'année).
  - `addPhotoToValidation(id: string, photo: CompressedPhoto): Promise<void>`.
  - `useValidationsForStudent(studentId: string): Validation[] | undefined`.
  - `useValidationsForYear(yearId: string): Validation[] | undefined`.
  - `useAllValidations(): Validation[] | undefined`.

```ts
interface CreateValidationInput {
  studentId: string;
  objective: Objective;
  ageBand: AgeBand;
  date: string;
  referentialVersion: string;
  photo?: CompressedPhoto;
}
```

- [ ] **Étape 1 : Écrire les tests qui échouent**

```ts
it('refuse une deuxième validation du même objectif', async () => {
  await createValidation({ ...base, objective, ageBand: 'from4', date: '2026-10-12' });
  await expect(createValidation({ ...base, objective, ageBand: 'from4', date: '2026-10-13' }))
    .rejects.toThrow(AlreadyValidatedError);
});

it('reclasse la validation quand la date change d’année', async () => {
  const v = await createValidation({ ...base, date: '2026-10-12' });
  await updateValidationDate(v.id, '2027-10-12');
  expect((await db.validations.get(v.id))?.schoolYearId).toBe('2027-2028');
});
```

Ajouter : la suppression d'un élève supprime ses validations et photos ; `startNextSchoolYear` ne supprime aucun élève ni validation ; `updateSchoolYearPeriods` ne touche pas aux autres années.

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- src/db/validations.test.ts src/db/photos.test.ts src/db/students.test.ts`
Expected: FAIL.

- [ ] **Étape 3 : Implémenter**

`createValidation` crée l'instantané depuis l'objectif (`objectiveLabel`, `domainId`, `domainLabel`, `ageBand`, `example`, `referentialVersion`), résout l'année avec `getOrCreateSchoolYear`, insère la photo si fournie, puis la validation dans une transaction. Attraper `ConstraintError` de Dexie et lever `AlreadyValidatedError`. `deleteValidation` supprime d'abord la photo. `updateValidationDate` recalcule `schoolYearId`.

- [ ] **Étape 4 : Vérifier**

Run: `npm run test:run -- src/db`
Expected: PASS.

- [ ] **Étape 5 : Commit**

```bash
git add src/db src/domain/errors.ts
git commit -m "feat(validations): add validation and photo repositories"
```

---

### Task 11 : Identifiants, dates et compression photo

**Fichiers :**
- Créer : `src/lib/id.ts`, `src/lib/date.ts`, `src/lib/image.ts`, `src/lib/image.test.ts`, `src/lib/date.test.ts`.

**Interfaces :**
- Produit :
  - `newId(prefix: string): string`.
  - `formatShortDate(date: string): string` (`12 oct.`), `formatLongDate(date: string): string` (`12 octobre 2026`), `todayIso(): string`.
  - `fitDimensions(width: number, height: number, max: number): { width: number; height: number }`.
  - `compressImage(file: File): Promise<CompressedPhoto>` (type défini en tâche 1).

- [ ] **Étape 1 : Écrire les tests qui échouent**

`fitDimensions(2000, 1000, 1600)` → `{ width: 1600, height: 800 }` ; `fitDimensions(1000, 2000, 1600)` → `{ width: 800, height: 1600 }` ; `fitDimensions(800, 600, 1600)` inchangé. `formatShortDate('2026-10-12')` → `12 oct.` ; `formatLongDate('2026-10-12')` → `12 octobre 2026`. `newId('stu')` commence par `stu_`.

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- src/lib`
Expected: FAIL.

- [ ] **Étape 3 : Implémenter**

`compressImage` décode le fichier avec `createImageBitmap(file, { imageOrientation: 'from-image' })`, avec repli sur `<img>` + `decode()` si indisponible. Dessine sur un canvas à la taille `fitDimensions`, exporte en JPEG 0,82, puis recommence à 400 px pour la vignette. Le ré-encodage supprime les EXIF. Si le décodage échoue (HEIC), lever `ImageDecodeError` avec un message clair.

- [ ] **Étape 4 : Vérifier**

Run: `npm run test:run -- src/lib`
Expected: PASS. La compression réelle est couverte en e2e (tâche 23).

- [ ] **Étape 5 : Commit**

```bash
git add src/lib
git commit -m "feat(photos): add image compression and date helpers"
```

---

### Task 12 : Écran classe

**Fichiers :**
- Créer : `src/features/class/ClassScreen.tsx`, `src/features/class/ClassScreen.module.css`, `src/features/class/ClassScreen.test.tsx`.
- Modifier : `src/router.tsx` (route `/`).

**Interfaces :**
- Consomme : `useStudents`, `useSettings`, `useValidationsForYear`, `formatLongDate`.
- Produit : écran classe avec filtres PS/MS/GS, compteurs de l'année, lien « Gérer les élèves », bouton « Prendre une photo » désactivé si aucun élève.

- [ ] **Étape 1 : Écrire les tests qui échouent**

Avec deux élèves et des validations semées : afficher les prénoms, le nombre de réussites de l'année, filtrer par PS, afficher l'état vide quand la classe est vide, désactiver le bouton photo, et utiliser le prénom de l'enseignante dans « Bonjour, … » quand il est renseigné.

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- src/features/class`
Expected: FAIL.

- [ ] **Étape 3 : Implémenter**

Grille 2 colonnes sur téléphone, 3 à 4 sur iPad via `@media (min-width: 700px)` et `(min-width: 1000px)`. Cartes avec avatar, prénom, pastille de section, compteur. En-tête avec fleur, date longue, salutation. `useLiveQuery` pour les compteurs. Le CTA navigue vers `/capture` ; l'avatar de l'enseignante navigue vers `/settings`.

- [ ] **Étape 4 : Vérifier**

Run: `npm run test:run -- src/features/class`
Expected: PASS.

- [ ] **Étape 5 : Commit**

```bash
git add src/features/class src/router.tsx
git commit -m "feat(class): add class roster screen"
```

---

### Task 13 : Capture — élève et photo avec brouillon persistant

**Fichiers :**
- Créer : `src/db/drafts.ts`, `src/features/capture/StudentPickerScreen.tsx`, `src/features/capture/PhotoScreen.tsx`, `src/features/capture/capture.module.css`, `src/features/capture/capture.test.tsx`.
- Modifier : `src/router.tsx` (routes `/capture` et `/capture/:studentId/photo`).

**Interfaces :**
- Produit :
  - `getCaptureDraft(): Promise<CaptureDraft | undefined>`, `saveCaptureDraft(draft: CaptureDraft): Promise<void>`, `clearCaptureDraft(): Promise<void>`, `useCaptureDraft(): CaptureDraft | undefined`.
  - `CaptureDraft = { id: 'current'; studentId: string; full?: Blob; thumb?: Blob; width?: number; height?: number; createdAt: string }`.
  - Écran 1 : recherche + filtre de section + grille d'élèves ; au toucher, enregistre le brouillon et navigue vers la photo.
  - Écran 2 : rappel de l'élève, bouton d'ouverture de l'appareil photo natif, aperçu, « Reprendre », « Valider sans photo », CTA « Choisir l'objectif ».

- [ ] **Étape 1 : Écrire les tests qui échouent**

Sélectionner un élève écrit `drafts.current`. Choisir un fichier appelle `compressImage` et stocke `full`/`thumb`. « Valider sans photo » efface les blobs mais garde l'élève. Démontrer puis remonter l'écran photo : le brouillon est toujours là. Sans brouillon, l'écran redirige vers `/capture`.

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- src/features/capture/capture.test.tsx`
Expected: FAIL.

- [ ] **Étape 3 : Implémenter**

L'input fichier est `<input type="file" accept="image/*" capture="environment" hidden>`. L'aperçu utilise `URL.createObjectURL(draft.full)` et révoque l'URL au démontage. Le brouillon est en IndexedDB : il survit à un rechargement iOS. Ne jamais supprimer le brouillon avant la création de la validation.

- [ ] **Étape 4 : Vérifier**

Run: `npm run test:run -- src/features/capture/capture.test.tsx`
Expected: PASS.

- [ ] **Étape 5 : Commit**

```bash
git add src/db/drafts.ts src/features/capture src/router.tsx
git commit -m "feat(capture): add student picker and photo step"
```

---

### Task 14 : Capture — objectif et confirmation

**Fichiers :**
- Créer : `src/features/capture/ObjectiveScreen.tsx`, `src/features/capture/SuccessScreen.tsx`, `src/features/capture/ObjectiveScreen.test.tsx`.
- Modifier : `src/router.tsx` (routes `/capture/objective` et `/success/:validationId`).

**Interfaces :**
- Consomme : `referential`, `ageBandForSection`, `createValidation`, `useCaptureDraft`, `getOrCreateSchoolYear`.
- Produit : liste d'objectifs filtrée par section, domaine et recherche ; option « Tous les niveaux » ; objectifs déjà validés désactivés avec leur date ; CTA désactivé sans sélection ; validation avec instantané ; écran de succès.

- [ ] **Étape 1 : Écrire les tests qui échouent**

Filtrer par domaine et recherche ; un objectif déjà validé est désactivé et affiche sa date ; sélectionner active le CTA ; valider crée une validation avec `snapshot.objectiveLabel`, supprime le brouillon et navigue vers `/success/:id` ; l'écran de succès affiche l'intitulé et la mention « avec photo » ou « sans photo ».

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- src/features/capture/ObjectiveScreen.test.tsx`
Expected: FAIL.

- [ ] **Étape 3 : Implémenter**

L'âge sélectionné est `ageBandForSection(student.section)` si l'objectif le propose, sinon la première tranche de l'objectif. Les objectifs sont triés par domaine puis par intitulé ; les validés passent en dernier. Le bouton « Valider la réussite » est désactivé tant qu'aucun objectif n'est sélectionné.

- [ ] **Étape 4 : Vérifier**

Run: `npm run test:run -- src/features/capture`
Expected: PASS.

- [ ] **Étape 5 : Commit**

```bash
git add src/features/capture src/router.tsx
git commit -m "feat(capture): add objective selection and confirmation"
```

---

### Task 15 : Dossier élève

**Fichiers :**
- Créer : `src/features/dossier/DossierScreen.tsx`, `src/features/dossier/ValidationSheet.tsx`, `src/features/dossier/usePhoto.ts`, `src/features/dossier/dossier.module.css`, `src/features/dossier/DossierScreen.test.tsx`.
- Modifier : `src/router.tsx` (route `/students/:studentId`).

**Interfaces :**
- Consomme : `useValidationsForStudent`, `useSchoolYears`, `deleteValidation`, `updateValidationDate`, `addPhotoToValidation`, `compressImage`.
- Produit : sélecteur d'année (année courante par défaut, années précédentes, toutes), résumé, accordéons par domaine, vignettes, mention « Observation en classe », fiche de réussite avec photo, exemple, date éditable, retrait confirmé, ajout de photo.

- [ ] **Étape 1 : Écrire les tests qui échouent**

Afficher les réussites groupées par domaine pour l'année sélectionnée ; une validation sans photo affiche « Observation en classe » ; changer d'année filtre sans supprimer ; retirer une validation ouvre une confirmation puis supprime la ligne et la photo ; modifier la date reclasse l'année ; ajouter une photo à une validation sans photo met à jour la vignette ; une validation dont l'objectif n'existe plus affiche quand même `snapshot.objectiveLabel`.

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- src/features/dossier`
Expected: FAIL.

- [ ] **Étape 3 : Implémenter**

`usePhoto(photoId)` lit le blob et fabrique une URL d'objet révoquée au démontage. Les domaines viennent du référentiel, dans l'ordre ; un domaine sans réussite affiche un état vide discret. Le sélecteur d'année utilise les `schoolYears` triés décroissants et la valeur `all`. Le bouton Bilan navigue vers `/bilans/:studentId?period=1&year=<année sélectionnée ou année courante>`. Le bouton appareil photo et le lien « Ajouter une réussite sans photo » enregistrent le brouillon pour l'élève puis naviguent vers `/capture/:studentId/photo` ou `/capture/objective`. Afficher la tranche d'âge quand elle diffère de la section de l'élève.

- [ ] **Étape 4 : Vérifier**

Run: `npm run test:run -- src/features/dossier`
Expected: PASS.

- [ ] **Étape 5 : Commit**

```bash
git add src/features/dossier src/router.tsx
git commit -m "feat(dossier): add student dossier and validation details"
```

---

### Task 16 : Gérer les élèves

**Fichiers :**
- Créer : `src/features/students/ManageStudentsScreen.tsx`, `src/features/students/StudentFormSheet.tsx`, `src/features/students/students.module.css`, `src/features/students/ManageStudentsScreen.test.tsx`.
- Modifier : `src/router.tsx` (route `/students`).

**Interfaces :**
- Consomme : `useStudents`, `createStudent`, `updateStudent`, `deleteStudentCascade`, `useAllValidations`.
- Produit : liste avec total de réussites toutes années, ajout (prénom obligatoire, initiale facultative, section), édition, suppression avec confirmation et compte, état vide.

- [ ] **Étape 1 : Écrire les tests qui échouent**

Ajouter « Noah » en PS : la ligne apparaît avec 0 réussite. Modifier le prénom et la section. Supprimer : la confirmation affiche le nombre de réussites toutes années ; après confirmation, l'élève et ses validations/photos disparaissent. Si l'élève supprimé est celui de la route courante, revenir à `/students`. Annuler ne supprime rien.

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- src/features/students`
Expected: FAIL.

- [ ] **Étape 3 : Implémenter**

Le formulaire est une `Sheet` avec un champ prénom, un champ initiale (`maxLength={1}`), des chips PS/MS/GS et un bouton désactivé si le prénom est vide. La suppression utilise `ConfirmSheet` avec le ton danger.

- [ ] **Étape 4 : Vérifier**

Run: `npm run test:run -- src/features/students`
Expected: PASS.

- [ ] **Étape 5 : Commit**

```bash
git add src/features/students src/router.tsx
git commit -m "feat(students): add student management screens"
```

---

### Task 17 : Programme et validation rapide

**Fichiers :**
- Créer : `src/features/programme/ProgrammeScreen.tsx`, `src/features/programme/ObjectiveSheet.tsx`, `src/features/programme/programme.module.css`, `src/features/programme/ProgrammeScreen.test.tsx`.
- Modifier : `src/router.tsx` (route `/programme`).

**Interfaces :**
- Consomme : `referential`, `useValidationsForYear`, `useStudents`, `createValidation`, `ageBandForSection`.
- Produit : recherche, filtre de niveau, sélecteur d'année, accordéons par domaine, barre d'avancement, fiche objectif avec exemples et élèves ayant validé, « Valider pour un élève ».

- [ ] **Étape 1 : Écrire les tests qui échouent**

Filtrer par niveau et rechercher un intitulé ; ouvrir un objectif et voir les élèves qui l'ont validé ; « Valider pour un élève » ajoute une validation sans photo, met à jour le compteur et affiche un toast ; un élève déjà validé est désactivé. La barre d'avancement se rapporte à l'effectif du niveau quand un filtre est actif.

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- src/features/programme`
Expected: FAIL.

- [ ] **Étape 3 : Implémenter**

Les compteurs viennent de `useValidationsForYear`. La fiche affiche les exemples par tranche d'âge. La validation rapide choisit la tranche de l'élève si elle existe, sinon la première. Après ajout, fermer la fiche et afficher « Réussite ajoutée à … ».

- [ ] **Étape 4 : Vérifier**

Run: `npm run test:run -- src/features/programme`
Expected: PASS.

- [ ] **Étape 5 : Commit**

```bash
git add src/features/programme src/router.tsx
git commit -m "feat(programme): add programme browser and quick validation"
```

---

### Task 18 : Bilans, périodes et date de changement de semestre

**Fichiers :**
- Créer : `src/features/bilans/BilansScreen.tsx`, `src/features/bilans/PeriodEditor.tsx`, `src/features/bilans/bilans.module.css`, `src/features/bilans/BilansScreen.test.tsx`, `src/domain/bilan.ts`.
- Modifier : `src/router.tsx` (route `/bilans`).

**Interfaces :**
- Produit :
  - `buildBilanModel(input: { student: Student; year: SchoolYear; period: 1 | 2; validations: Validation[]; photos: Map<string, Photo>; referential: Referential }): BilanModel`.
  - `countValidationsInPeriod(validations: Validation[], year: SchoolYear, period: 1 | 2): number`.
  - `countValidationsMovedByCutover(validations: Validation[], oldDate: string, newDate: string): number`.
  - Écran avec sélecteur d'année, cartes Bilan 1 / Bilan 2, éditeur de date, liste des élèves avec compteurs ; chaque ligne navigue vers `/bilans/:studentId?period=1|2&year=<id>`.

```ts
interface BilanEntry {
  validationId: string;
  objectiveLabel: string;
  domainId: Domain['id'];
  domainLabel: string;
  date: string;
  photo?: Photo;
  ageBand: AgeBand;
  example?: string;
}

interface BilanModel {
  student: Student;
  year: SchoolYear;
  period: 1 | 2;
  start: string;
  end: string;
  total: number;
  domains: Array<{ domain: Domain; entries: BilanEntry[] }>;
}
```

- [ ] **Étape 1 : Écrire les tests qui échouent**

Avec une validation au 31 janvier et une au 1er février : Bilan 1 compte 1, Bilan 2 compte 1. Changer la date de changement au 15 janvier : l'avertissement indique « 1 réussite change de bilan », puis les compteurs s'inversent. Refaire dans l'autre sens (du 15 janvier au 5 février) et vérifier le déplacement inverse. Une date hors de `start < date < period2End` est refusée. Changer la date d'une année ne modifie pas les autres années. Une validation de juillet n'apparaît dans aucun bilan.

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- src/features/bilans`
Expected: FAIL.

- [ ] **Étape 3 : Implémenter**

`PeriodEditor` est une `Sheet` avec un `<input type="date">`, un récapitulatif du nombre de validations déplacées et un bouton « Enregistrer ». `updateSchoolYearPeriods` met à jour l'année sélectionnée. La période qui contient la date du jour est mise en avant. La liste des élèves affiche tous les élèves, y compris 0 réussite.

- [ ] **Étape 4 : Vérifier**

Run: `npm run test:run -- src/features/bilans`
Expected: PASS.

- [ ] **Étape 5 : Commit**

```bash
git add src/features/bilans src/domain/bilan.ts src/router.tsx
git commit -m "feat(bilans): add periods and cutover date editor"
```

---

### Task 19 : Aperçu A4, PDF et partage

**Fichiers :**
- Créer : `src/features/bilans/BilanPreviewScreen.tsx`, `src/features/bilans/BilanSheet.tsx`, `src/features/bilans/pdf.ts`, `src/lib/share.ts`, `src/features/bilans/pdf.test.ts`, `src/lib/share.test.ts`, `src/assets/fonts/Nunito-Regular.ttf`, `src/assets/fonts/Nunito-Bold.ttf`, `src/assets/fonts/Fraunces-Bold.ttf`, `src/assets/fonts/OFL.txt`.
- Modifier : `src/router.tsx` (route `/bilans/:studentId`).

**Interfaces :**
- Produit :
  - `buildBilanModel` (tâche 18) consommé par l'aperçu HTML et le PDF.
  - `PdfFonts = { regular: Uint8Array; bold: Uint8Array; display: Uint8Array }`.
  - `loadPdfFonts(): Promise<PdfFonts>` (charge les TTF via `fetch` des URLs Vite, avec cache).
  - `generateBilanPdf(model: BilanModel, meta: { schoolName: string; className: string; teacherName: string }, fonts: PdfFonts): Promise<Uint8Array>`.
  - `pdfFileName(student: Student, year: SchoolYear, period: 1 | 2): string` → `bilan-lea-1-2026-2027.pdf`.
  - `sharePdf(bytes: Uint8Array, filename: string): Promise<'shared' | 'downloaded'>`.
  - `downloadBlob(blob: Blob, filename: string): void`.

- [ ] **Étape 1 : Écrire les tests qui échouent**

`pdf.test.ts` : un modèle d'une page produit un PDF A4 (595 × 842 pt ± 1) contenant « Bilan des réussites », le prénom, l'intitulé et la date ; un modèle de 40 entrées produit plusieurs pages, chaque page contient « Page » et un en-tête ; une validation sans photo contient « Observation en classe ». `share.test.ts` : `navigator.canShare` vrai → `navigator.share` appelé ; faux → téléchargement déclenché.

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- src/features/bilans/pdf.test.ts src/lib/share.test.ts`
Expected: FAIL.

- [ ] **Étape 3 : Implémenter le PDF**

Télécharger les TTF OFL de Nunito (Regular, Bold) et Fraunces (Bold) depuis Google Fonts, les placer dans `src/assets/fonts/` avec `OFL.txt`. Utiliser `pdf-lib` + `@pdf-lib/fontkit` pour les embarquer. A4 595,28 × 841,89 pt, marges 48 pt, deux colonnes de 236 pt, gap 26 pt. Flux : en-tête, titre, bloc élève, règle, puis domaines et entrées ; une entrée = vignette 46 × 36 pt + intitulé 8,5 pt + date 7,5 pt. Remplir la colonne gauche, puis la droite, puis nouvelle page. Répéter l'en-tête et le pied sur chaque page. Ajouter la signature des parents sur la dernière page ; si elle ne tient pas, nouvelle page. Les JPEG sont embarqués via `embedJpg` ; en cas d'échec, dessiner un rectangle « Photo ». `buildBilanModel` filtre les validations de la période et utilise les instantanés. Les tests lisent les TTF avec `fs.readFile` et passent les octets à `generateBilanPdf`.

- [ ] **Étape 4 : Implémenter l'aperçu et le partage**

`BilanSheet` reprend la mise en page HTML du prototype, à l'échelle A4, avec les mêmes données. `BilanPreviewScreen` lit `studentId` dans l'URL et `period`/`year` dans les query params (défauts : période 1, année courante). « Imprimer / PDF » charge les polices avec `loadPdfFonts`, génère le PDF puis `sharePdf`. Le nom du fichier est normalisé (sans accents ni espaces).

- [ ] **Étape 5 : Vérifier**

Run: `npm run test:run -- src/features/bilans src/lib/share.test.ts`
Expected: PASS.

- [ ] **Étape 6 : Commit**

```bash
git add src/features/bilans src/lib/share.ts src/router.tsx
git commit -m "feat(bilans): add a4 preview and pdf generation"
```

---

### Task 20 : Réglages, stockage et passage à l'année suivante

**Fichiers :**
- Créer : `src/features/settings/SettingsScreen.tsx`, `src/features/settings/StoragePanel.tsx`, `src/features/settings/settings.module.css`, `src/features/settings/SettingsScreen.test.tsx`.
- Modifier : `src/router.tsx` (route `/settings`), `src/features/class/ClassScreen.tsx` (lien vers les réglages).

**Interfaces :**
- Consomme : `useSettings`, `updateSettings`, `startNextSchoolYear`, `updateSchoolYearPeriods`.
- Produit : formulaire école/classe/enseignante, année en cours, action « Passer à l'année suivante », dates de bilan, stockage, notice de confidentialité, version.

- [ ] **Étape 1 : Écrire les tests qui échouent**

Enregistrer l'école et l'enseignante met à jour les réglages. « Passer à l'année suivante » crée ou bascule vers `2027-2028` sans supprimer élèves, validations ni photos ; l'ancienne année reste dans le sélecteur. Les dates de bilan sont enregistrées par année. Le stockage affiche l'usage et le quota quand l'API est disponible. La notice de confidentialité s'affiche au premier lancement, disparaît après « J'ai compris » et ne revient pas. La version est visible.

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- src/features/settings`
Expected: FAIL.

- [ ] **Étape 3 : Implémenter**

`startNextSchoolYear` est appelé après une `ConfirmSheet` qui dit explicitement « Aucune réussite ne sera supprimée ». `StoragePanel` appelle `navigator.storage.estimate()` et `persist()` si disponibles, avec un message de repli. Les dates de bilan réutilisent `PeriodEditor`. `SettingsScreen` affiche la version via `__APP_VERSION__`. La notice de première utilisation s'affiche dans une `Sheet` si `localStorage.getItem('privacy-ack')` est absent ; « J'ai compris » écrit le flag.

- [ ] **Étape 4 : Vérifier**

Run: `npm run test:run -- src/features/settings`
Expected: PASS.

- [ ] **Étape 5 : Commit**

```bash
git add src/features/settings src/features/class/ClassScreen.tsx src/router.tsx
git commit -m "feat(settings): add settings, storage and year rollover"
```

---

### Task 21 : Sauvegarde ZIP et restauration

**Fichiers :**
- Créer : `src/features/settings/backup.ts`, `src/features/settings/BackupPanel.tsx`, `src/features/settings/backup.test.ts`, `src/features/settings/BackupPanel.test.tsx`.
- Modifier : `src/features/settings/SettingsScreen.tsx`, `src/features/class/ClassScreen.tsx` (rappel de sauvegarde).

**Interfaces :**
- Produit :
  - `exportBackup(onProgress: (ratio: number) => void): Promise<Blob>`.
  - `readBackup(file: File, onProgress: (ratio: number) => void): Promise<BackupPackage>`.
  - `restoreBackup(pkg: BackupPackage, onProgress: (ratio: number) => void): Promise<void>`.
  - `shouldRemindBackup(settings: Settings, totalValidations: number): boolean`.
  - `BackupSummary = { students: number; years: number; validations: number; photos: number; exportedAt: string; schemaVersion: number }`.

- [ ] **Étape 1 : Écrire les tests qui échouent**

Round-trip : créer 2 élèves, 2 validations, 1 photo, exporter, vider les tables, importer, retrouver élèves/validations/photos/années. Un ZIP sans `data.json` ou avec un `schemaVersion` supérieur est refusé et la base reste intacte. `shouldRemindBackup` est vrai après 30 jours ou 50 nouvelles validations depuis la dernière sauvegarde, faux sinon. Une exportation met à jour `lastBackupAt` et `lastBackupValidationCount`.

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- src/features/settings/backup.test.ts src/features/settings/BackupPanel.test.tsx`
Expected: FAIL.

- [ ] **Étape 3 : Implémenter l'export**

Structure ZIP : `data.json`, `referential.json`, `photos/<id>.jpg`, `thumbs/<id>.jpg`. Utiliser `fflate` en streaming (`Zip` + `ZipPassThrough` pour les JPEG, `ZipDeflate` pour les JSON). `data.json` contient `schemaVersion`, `exportedAt`, `settings`, `schoolYears`, `students`, `validations`, `photos` (métadonnées + chemins). Mettre à jour `lastBackupAt` et `lastBackupValidationCount` après succès. Avertir au-delà de 300 Mo. Le panneau déclenche le téléchargement avec `downloadBlob(blob, filename)`.

- [ ] **Étape 4 : Implémenter l'import**

`readBackup` lit le ZIP en streaming, valide `data.json` avec Zod, vérifie chaque photo référencée, et retourne un `BackupPackage` en mémoire. `restoreBackup` ouvre une transaction `rw` sur toutes les tables, vide puis réinsère. Toute erreur avant la transaction laisse la base intacte ; toute erreur pendant la transaction l'annule.

- [ ] **Étape 5 : Vérifier**

Run: `npm run test:run -- src/features/settings`
Expected: PASS.

- [ ] **Étape 6 : Commit**

```bash
git add src/features/settings src/features/class/ClassScreen.tsx
git commit -m "feat(backup): add zip export and restore"
```

---

### Task 22 : PWA installable et hors ligne

**Fichiers :**
- Créer : `public/favicon.svg`, `pwa-assets.config.ts`, `src/ui/InstallHint.tsx`, `src/ui/InstallHint.test.tsx`.
- Modifier : `vite.config.ts`, `src/main.tsx`, `src/features/settings/SettingsScreen.tsx`, `index.html`.

**Interfaces :**
- Produit : manifest (`Carnet de réussites`, `standalone`, thème crème, icônes 192/512 et Apple Touch), service worker précaché, `registerSW({ immediate: true })`, `useIsStandalone()` et une notice d'installation iOS dans les réglages.

- [ ] **Étape 1 : Écrire les tests qui échouent**

`useIsStandalone` retourne vrai si `display-mode: standalone` ou `navigator.standalone` ; faux sinon. `InstallHint` affiche le texte iOS seulement si l'appareil est iOS et que l'app n'est pas installée.

- [ ] **Étape 2 : Lancer les tests et vérifier l'échec**

Run: `npm run test:run -- src/ui/InstallHint.test.tsx`
Expected: FAIL.

- [ ] **Étape 3 : Configurer la PWA**

Dans `vite.config.ts`, `VitePWA({ registerType: 'autoUpdate', includeAssets: ['favicon.svg', 'icons/*.png'], manifest: { name: 'Carnet de réussites', short_name: 'Carnet', lang: 'fr', display: 'standalone', theme_color: '#FBF6EC', background_color: '#FBF6EC', icons: [...] }, workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], cleanupOutdatedCaches: true } })`. Ajouter `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon` dans `index.html`.

- [ ] **Étape 4 : Générer les icônes et vérifier le build**

Run: `npx pwa-assets-generator && npm run build`
Expected: `dist/manifest.webmanifest`, `dist/sw.js`, icônes présentes.

- [ ] **Étape 5 : Commit**

```bash
git add public pwa-assets.config.ts vite.config.ts src/main.tsx src/ui/InstallHint.tsx src/ui/InstallHint.test.tsx src/features/settings/SettingsScreen.tsx index.html
git commit -m "feat(pwa): add installable offline app"
```

---

### Task 23 : E2E des parcours principaux

**Fichiers :**
- Créer : `playwright.config.ts`, `e2e/fixtures/photo.jpg`, `e2e/helpers.ts`, `e2e/capture.spec.ts`, `e2e/students.spec.ts`, `e2e/programme.spec.ts`.
- Modifier : `package.json` (script `test:e2e` déjà prévu).

**Interfaces :**
- Produit : `addStudent(page, name, section)`, `captureWithPhoto(page, name, objectiveSearch)`, `openDossier(page, name)`.
- Fixture photo : JPEG 1200 × 900 avec des formes colorées, aucune photo d'enfant.

- [ ] **Étape 1 : Configurer Playwright**

`playwright.config.ts` : `testDir: './e2e'`, `testIgnore: /offline\.spec\.ts/`, `use: { baseURL: 'http://localhost:4173', viewport: { width: 390, height: 844 } }`, `webServer: { command: 'npm run dev -- --port 4173', url: 'http://localhost:4173', reuseExistingServer: true }`.

- [ ] **Étape 2 : Écrire `capture.spec.ts`**

Parcours photo complet : ajouter un élève, prendre une photo, choisir un objectif, valider, vérifier le dossier et le compteur. Recharger au milieu du parcours photo : le brouillon et la photo sont toujours là. Parcours sans photo : la mention « Observation en classe » apparaît. Revalider le même objectif : il est désactivé et aucune deuxième validation n'est créée.

- [ ] **Étape 3 : Écrire `students.spec.ts`**

Ajouter, modifier, supprimer un élève avec une validation et une photo ; vérifier la cascade et le retour à la liste. Annuler la suppression ne supprime rien.

- [ ] **Étape 4 : Écrire `programme.spec.ts`**

Filtrer par niveau, ouvrir un objectif, valider pour un élève, vérifier le compteur et le toast ; un élève déjà validé est désactivé.

- [ ] **Étape 5 : Lancer les tests**

Run: `npm run test:e2e -- capture.spec.ts students.spec.ts programme.spec.ts`
Expected: PASS.

- [ ] **Étape 6 : Commit**

```bash
git add playwright.config.ts e2e package.json
git commit -m "test(e2e): cover capture, students and programme flows"
```

---

### Task 24 : E2E des bilans, sauvegardes, années et responsive

**Fichiers :**
- Créer : `e2e/bilans.spec.ts`, `e2e/backup.spec.ts`, `e2e/year.spec.ts`, `e2e/responsive.spec.ts`, `e2e/offline.spec.ts`, `playwright.offline.config.ts`.
- Modifier : `src/db/db.ts` (exposer `window.__carnetDb` uniquement en développement), `e2e/helpers.ts`.

**Interfaces :**
- Produit : helpers `seedValidation(page, { studentId, objectiveId, date, withPhoto })` et `readDb(page, table)`.

- [ ] **Étape 1 : Exposer la base en développement**

Dans `src/db/db.ts` : `if (import.meta.env.DEV) (window as unknown as { __carnetDb: CarnetDB }).__carnetDb = db;`. Ne jamais l'exposer en production.

- [ ] **Étape 2 : Écrire `bilans.spec.ts`**

Semer une validation au 31 janvier et une au 1er février. Vérifier les compteurs. Changer la date de changement au 15 janvier, vérifier l'avertissement et le déplacement. Télécharger le PDF et vérifier le nom, la taille A4 et la pagination avec `pdfjs-dist`.

- [ ] **Étape 3 : Écrire `backup.spec.ts`**

Créer un élève, une validation avec photo, exporter le ZIP, vider la base via `window.__carnetDb`, importer, retrouver le dossier et la photo. Tenter un ZIP invalide : la base reste intacte.

- [ ] **Étape 4 : Écrire `year.spec.ts` et `responsive.spec.ts`**

Passer à l'année suivante, vérifier que l'ancien dossier et l'ancien bilan sont toujours là, qu'une nouvelle validation va dans la nouvelle année et qu'aucune donnée n'est supprimée. Sur iPad (1024 × 1366), la grille de classe a 3 ou 4 colonnes et aucun débordement horizontal ; sur iPhone, elle reste à 2 colonnes.

- [ ] **Étape 5 : Écrire `offline.spec.ts`**

Créer `playwright.offline.config.ts` : `testMatch: /offline\.spec\.ts/`, `webServer: { command: 'npm run build && npm run preview -- --port 4174', url: 'http://localhost:4174' }`, `use.baseURL: 'http://localhost:4174'`. Charger l'app, attendre le service worker, passer le contexte hors ligne, recharger : l'app se charge encore et la classe s'affiche. Ajouter le script `test:e2e:offline` (`playwright test -c playwright.offline.config.ts`).

- [ ] **Étape 6 : Lancer les tests**

Run: `npm run test:e2e -- bilans.spec.ts backup.spec.ts year.spec.ts responsive.spec.ts offline.spec.ts`
Expected: PASS.

- [ ] **Étape 7 : Commit**

```bash
git add src/db/db.ts e2e
git commit -m "test(e2e): cover bilans, backup, year rollover and offline"
```

---

### Task 25 : Accessibilité, performance et CI

**Fichiers :**
- Créer : `e2e/a11y.spec.ts`, `e2e/performance.spec.ts`, `.github/workflows/ci.yml`.
- Modifier : `package.json` (script `test:e2e` inchangé), `playwright.config.ts` si besoin.

**Interfaces :**
- Produit : tests axe sur les écrans principaux, test de cibles tactiles, test de performance avec 1 500 photos, workflow CI.

- [ ] **Étape 1 : Écrire `a11y.spec.ts`**

Avec `@axe-core/playwright`, analyser `/`, `/capture`, `/programme`, `/bilans` et `/students`. Semer un élève et un brouillon avant `/capture` pour éviter la redirection. Attendre zéro violation `serious` ou `critical`. Vérifier aussi que tous les `button`, `a` et `input` visibles sur la classe et la capture ont une boîte ≥ 44 × 44 px. Corriger les jetons ou les styles plutôt que désactiver une règle.

- [ ] **Étape 2 : Écrire `performance.spec.ts`**

Semer 1 500 validations avec des photos JPEG 1 × 1 px via `window.__carnetDb`, recharger, mesurer le temps jusqu'à l'affichage des cartes élèves. Budget CI : < 4 s (garde-fou machine de CI) ; noter dans le test que la cible téléphone est < 2 s et se mesure manuellement sur iPhone. Mesurer aussi l'ouverture d'un dossier.

- [ ] **Étape 3 : Écrire le workflow CI**

`.github/workflows/ci.yml` : sur `push` et `pull_request`, Node 24, `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, puis un job Playwright avec `npx playwright install --with-deps chromium`, `npm run test:e2e` et `npm run test:e2e:offline`.

- [ ] **Étape 4 : Lancer localement**

Run: `npm run lint && npm run typecheck && npm run test:run && npm run test:e2e && npm run test:e2e:offline`
Expected: PASS.

- [ ] **Étape 5 : Commit**

```bash
git add e2e .github/workflows/ci.yml
git commit -m "test: add accessibility, performance and ci checks"
```

---

### Task 26 : Configuration Vercel et mise en ligne

**Fichiers :**
- Créer : `vercel.ts`.
- Modifier : `package.json` (dépendance `@vercel/config`), `README.md` (URL de production).

**Interfaces :**
- Produit : build statique Vite déployé, hash routing compatible, PWA servie en HTTPS.

- [ ] **Étape 1 : Ajouter la configuration**

```bash
npm install -D @vercel/config
```

`vercel.ts` :

```ts
import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'vite',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
};
```

- [ ] **Étape 2 : Vérifier le build local**

Run: `npm run build && npm run preview`
Expected: l'app se charge, le PDF se télécharge, le service worker s'enregistre.

- [ ] **Étape 3 : Déployer**

Run: `vercel link` puis `vercel --prod` (ou connecter le dépôt GitHub au projet Vercel ; mettre à jour la CLI avec `npm i -g vercel@latest` si nécessaire). Noter l'URL de production dans le README. Vérifier sur l'URL : classe, capture, PDF, installation PWA et rechargement hors ligne.

- [ ] **Étape 4 : Commit**

```bash
git add vercel.ts package.json package-lock.json README.md
git commit -m "chore(deploy): add vercel configuration"
```

---

## Auto-relecture du plan

- **Couverture du spec** : les six domaines et le référentiel (tâches 5-6), les élèves (9, 16), les validations (10, 14, 17), les photos (11, 13, 15), le dossier (15), le programme (17), les bilans et la date de changement (18-19), les réglages et le stockage (20), la sauvegarde (21), la PWA (22), les critères d'acceptation (23-25), le déploiement (26).
- **Cohérence des types** : `CompressedPhoto` est défini en tâche 1, produit en 11 et consommé en 10, 13 et 15 ; `BilanModel` et `BilanEntry` en 18 et consommés en 19 ; `SchoolYear` (type en tâche 1, logique en tâche 7) ; `CaptureDraft` en 13.
- **Review Focus** : chaque ligne a un test dans la tâche propriétaire et un test e2e.
- **Proportion** : le plan décrit les décisions et les tests, pas le corps complet des composants.
