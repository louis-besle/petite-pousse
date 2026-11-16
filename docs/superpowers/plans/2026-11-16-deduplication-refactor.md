# Refactor : suppression de la duplication

Date : 2026-11-16
Contexte : audit de duplication (≈8,5 % des lignes hors tests, 111 blocs ≥ 8 lignes, 29 règles CSS identiques entre `dossier` et `programme`).

## Règles d'exécution

- Aucun commit sans autorisation explicite.
- Les agents travaillent en parallèle **uniquement** sur des dossiers de fichiers disjoints.
- Le socle partagé (wave A) est créé avant, jamais modifié par deux agents à la fois.
- Vérification finale : `typecheck`, `lint`, `test:run`, `build`.

## Wave A — socle partagé (1 agent, séquentiel)

Créer, sans toucher aux écrans :

1. `src/lib/text.ts` (+ test) : `plural`, `successLabel`, `studentCountLabel`,
   `objectiveCountLabel`, `validationCountLabel`, `studentFullName`, `studentInitials`,
   `normalizeSearch`.
2. `src/lib/date.ts` (+ test) : `formatPeriodRange`, `formatPeriodRangeLong`,
   `formatLongDateOrdinal`.
3. `src/lib/schoolYearSelection.ts` : `sortedSchoolYearIds`.
4. `src/ui/domainIcon.ts` : `DOMAIN_ICONS`, `domainIcon`.
5. `src/ui/YearSelect.tsx` (+ CSS) : sélecteur d'année partagé.
6. `src/ui/DomainAccordion.tsx` (+ CSS) : accordéon de domaine + `.rows` / `.domainEmpty`.
7. `src/ui/LoadingText.tsx` (+ CSS) : `.loading` partagé.
8. `src/ui/EmptyState.tsx` (+ CSS) : `.empty`, `.emptyTitle`, `.emptyText`, `.emptyLink`.
9. `src/db/photos.ts` : `loadPhotosForValidations`.

## Wave B — un agent par dossier de feature (parallèle)

| Agent | Périmètre | Cible |
|---|---|---|
| B1 | `src/features/bilans/**` | `successLabel`, `studentLabel`, libellés de période, `loadPhotos`, `parsePeriod`, CSS `.year*`, `.loading` |
| B2 | `src/features/programme/**` | `DOMAIN_ICONS`, `normalizeSearch`, libellés, `DomainAccordion`, `YearSelect`, `ExampleBlock`, `.srOnly` |
| B3 | `src/features/dossier/**` | idem B2 + `ValidationSheet` (pipeline photo) |
| B4 | `src/features/class/**`, `capture/**`, `students/**` | libellés, `normalizeSearch`, `EmptyState`, `LoadingText`, `ExampleBlock`, `DomainAccordion` (dossier), `.srOnly` |
| B5 | `src/features/settings/**` | `plural`, `dayLabel`, dédup interne `BackupPanel`, énumérations Zod |

Chaque agent : aucun édit hors de son périmètre, tests de sa feature verts, pas de
changement de texte visible, pas de changement de structure DOM observable.

## Wave C — validation de date (1 agent, séquentiel)

Unifier `lib/date.ts`, `domain/schoolYear.ts`, `db/schoolYears.ts`,
`features/settings/backup.ts` autour d'un seul validateur de date calendaire.

## Wave D — vérification (orchestrateur)

`npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`,
puis re-mesure de la duplication.

## Résultats (2026-11-16)

### Premier passage

- Blocs ≥ 8 lignes répétés : **111 → 44** ; lignes dupliquées estimées : **1 312 → 432**
  (**8,5 % → 2,9 %** des lignes hors tests).
- Blocs de déclarations CSS identiques d'un module à l'autre : **77 → 61**.
- Règles CSS strictement identiques entre `dossier.module.css` et
  `programme.module.css` : **29 → 1** (`.sheetActions`).
- `git diff --stat` : **43 fichiers, +892 / −1 674** (dont 12 nouveaux fichiers
  de socle et 4 fichiers de tests).

### Second passage

- Ajout de `ui/ScreenHeader`, `ui/TopBar`, `ui/EmptyStateLink`, `ui/SearchField`,
  `ui/SheetActions`, `ui/CardList`, `lib/usePhotoFileInput` (+ test),
  `db/useGuardedLiveQuery` (refactor de `useSchoolYearsState` et
  `useValidationsForYearState`).
- Blocs ≥ 8 lignes répétés : **44 → 16** ; lignes dupliquées : **432 → 128**
  (**2,9 % → 0,8 %**).
- Blocs CSS identiques entre modules : **61 → 56** ; règles identiques
  dossier ↔ programme : **1 → 0**.

### Vérification finale

- `npm run typecheck` : OK. `npm run lint` : OK.
- `npm run test:run` : **37 fichiers, 381/381 tests**.
- `npm run build` : OK (avertissement de taille de chunk préexistant).
- Restes : composition d'états vides très courts (classe / choix d'élève),
  quelques règles internes à `capture.module.css` (cartes et titres tronqués),
  fragments d'avatar + nom (bilans / choix d'élève).
- Les fichiers modifiés hors périmètre (`README.md`, `docs/**`, `CHANGELOG.md`,
  `CONTRIBUTING.md`, `scripts/referential/source/*`, `src/data/referential.json`,
  `tsconfig.e2e.json`) n'ont pas été touchés par ce refactor : travail
  parallèle laissé intact.


