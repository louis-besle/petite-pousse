# Objectifs personnalisés — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'enseignante d'ajouter, modifier et supprimer ses propres objectifs d'apprentissage depuis Programme, puis de les valider en capture.

**Architecture:** Une seconde source d'objectifs, stockée dans IndexedDB, est fusionnée au référentiel officiel par un catalogue unique lu par Programme et la capture. Le dossier et les bilans restent inchangés : ils s'appuient sur les instantanés des validations, donc l'historique survit aux modifications et suppressions.

**Tech Stack:** React 19, TypeScript, Vite, Dexie 4 (IndexedDB), Zod 4, React Router 7, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-objectifs-personnalises-design.md`

## Global Constraints

- Toute l'interface et tous les messages sont en français ; les apostrophes typographiques (`’`) suivent le style existant.
- Aucun appel réseau, aucune synchronisation : les objectifs personnalisés vivent dans IndexedDB, sur l'appareil.
- Le référentiel officiel (`src/data/referential.json`) n'est jamais réécrit ni transformé.
- Schéma Dexie : version 2, table `customObjectives` avec l'index `id, domainId`.
- Schéma de sauvegarde : `BACKUP_SCHEMA_VERSION` passe de 1 à 2 ; les archives v1 restent lisibles avec une liste d'objectifs personnalisés vide.
- `Settings.schemaVersion` reste à 1 : valeur héritée, jamais lue.
- Identifiants personnalisés : `custom-<uuid>` ; `competencyId: 'custom'` ; `source: CUSTOM_OBJECTIVE_SOURCE`.
- Intitulé : 160 caractères maximum ; exemple : 200 caractères maximum ; au moins un niveau ; un exemple par niveau déclaré.
- Accessibilité : libellés associés, groupes nommés, `aria-pressed` sur les puces, erreur en `role="alert"`.
- Vérifications avant tout commit : `npm run typecheck`, `npm run lint`, `npm run test:run`.
- **Aucun commit sans autorisation explicite de l'utilisateur** (AGENTS.md). Une fois autorisé, backdater le commit selon AGENTS.md (date et heure aléatoires, jamais d'heure pile).

## Review Focus

- **Archive v1 restaurée** : une sauvegarde d'avant la fonctionnalité doit rester lisible et vider les objectifs personnalisés existants, sans laisser d'objectifs fantômes.
- **Suppression avec réussites** : supprimer un objectif déjà validé ne doit jamais effacer la réussite du dossier ni du bilan.
- **Édition d'un niveau** : décocher un niveau ne doit pas retirer les validations déjà enregistrées à ce niveau du dossier ni du compteur.
- **Doublon réel** : deux intitulés identiques à la casse, aux accents et aux espaces près, dans le même domaine, doivent être refusés.
- **Fiche ouverte pendant une suppression** : un objectif supprimé depuis un autre onglet ne doit pas laisser une fiche pointant vers une ligne inexistante.

---

### Task 1: Catalogue fusionné

**Files:**
- Create: `src/domain/objectives.ts`
- Create: `src/domain/objectives.test.ts`
- Modify: `src/domain/types.ts` (ajout du type `CustomObjective`)

**Interfaces:**
- Consumes: `Objective` et `AgeBand` depuis `@/domain/types`.
- Produces:
  - `CustomObjective extends Objective { createdAt: string; updatedAt: string }`
  - `CUSTOM_OBJECTIVE_SOURCE: { bo: string }`
  - `isCustomObjective(objective: Pick<Objective, 'id'>): boolean`
  - `mergeObjectives(official: Objective[], custom: CustomObjective[]): Objective[]`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/domain/objectives.test.ts
import { referential } from './referential'
import { CUSTOM_OBJECTIVE_SOURCE, isCustomObjective, mergeObjectives } from './objectives'
import type { CustomObjective, Objective } from './types'

function custom(overrides: Partial<CustomObjective> = {}): CustomObjective {
  return {
    id: 'custom-1',
    competencyId: 'custom',
    domainId: 'maths',
    label: 'Compter jusqu’à douze',
    ageBands: ['from4'],
    examples: { from4: 'Réciter la comptine jusqu’à douze.' },
    source: CUSTOM_OBJECTIVE_SOURCE,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  }
}

const official: Objective[] = referential.objectives.slice(0, 3)

describe('isCustomObjective', () => {
  it('reconnaît le préfixe des objectifs ajoutés', () => {
    expect(isCustomObjective(custom())).toBe(true)
    expect(isCustomObjective(official[0]!)).toBe(false)
  })
})

describe('mergeObjectives', () => {
  it('garde les officiels dans l’ordre puis ajoute les personnalisés par date', () => {
    const late = custom({ id: 'custom-b', createdAt: '2026-11-03T09:00:00.000Z' })
    const early = custom({ id: 'custom-a', createdAt: '2026-11-02T09:00:00.000Z' })

    const merged = mergeObjectives(official, [late, early])

    expect(merged.slice(0, official.length)).toEqual(official)
    expect(merged.slice(official.length).map((objective) => objective.id)).toEqual([
      'custom-a',
      'custom-b',
    ])
  })

  it('départage deux dates identiques par identifiant', () => {
    const sameDate = '2026-11-02T09:00:00.000Z'
    const b = custom({ id: 'custom-b', createdAt: sameDate })
    const a = custom({ id: 'custom-a', createdAt: sameDate })

    expect(
      mergeObjectives([], [b, a]).map((objective) => objective.id),
    ).toEqual(['custom-a', 'custom-b'])
  })

  it('ne modifie pas les tableaux reçus', () => {
    const incoming = [custom({ id: 'custom-b' }), custom({ id: 'custom-a' })]
    const before = incoming.map((objective) => objective.id)

    mergeObjectives(official, incoming)

    expect(incoming.map((objective) => objective.id)).toEqual(before)
    expect(official).toEqual(referential.objectives.slice(0, 3))
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm run test:run -- src/domain/objectives.test.ts`
Expected: FAIL, module `./objectives` introuvable.

- [ ] **Step 3: Ajouter le type**

Dans `src/domain/types.ts`, après `Objective` :

```ts
/** Objectif ajouté par l'enseignante, stocké hors du référentiel officiel. */
export interface CustomObjective extends Objective {
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 4: Implémenter le module**

Dans `src/domain/objectives.ts` :

```ts
import type { CustomObjective, Objective } from './types'

export const CUSTOM_OBJECTIVE_SOURCE = {
  bo: 'Objectif ajouté par l’enseignant',
} as const

export function isCustomObjective(objective: Pick<Objective, 'id'>): boolean {
  return objective.id.startsWith('custom-')
}

export function mergeObjectives(
  official: Objective[],
  custom: CustomObjective[],
): Objective[] {
  const sortedCustom = [...custom].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
    return a.id.localeCompare(b.id)
  })

  return [...official, ...sortedCustom]
}
```

- [ ] **Step 5: Relancer le test**

Run: `npm run test:run -- src/domain/objectives.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit (après autorisation)**

Demander l'autorisation, puis :

```bash
git add src/domain/objectives.ts src/domain/objectives.test.ts src/domain/types.ts
git commit -m "feat: add custom objective catalog merge"
```

---

### Task 2: Persistance et règles métier

**Files:**
- Modify: `src/db/db.ts` (version 2, table `customObjectives`)
- Create: `src/db/customObjectives.ts`
- Create: `src/db/customObjectives.test.ts`

**Interfaces:**
- Consumes: `CustomObjective`, `Objective`, `Domain`, `AgeBand` ; `referential`, `DOMAIN_IDS`, `AGE_BANDS`, `sectionForAgeBand` ; `normalizeSearch` ; `db`.
- Produces:
  - `class DuplicateObjectiveError extends Error`
  - `interface CustomObjectiveInput { label: string; domainId: Domain['id']; ageBands: AgeBand[]; examples: Partial<Record<AgeBand, string>> }`
  - `createCustomObjective(input: CustomObjectiveInput): Promise<CustomObjective>`
  - `updateCustomObjective(id: string, input: CustomObjectiveInput): Promise<void>`
  - `deleteCustomObjective(id: string): Promise<void>`
  - `useCustomObjectives(): CustomObjective[] | undefined`
  - `useObjectiveCatalog(): Objective[] | undefined`
  - `MAX_OBJECTIVE_LABEL_LENGTH = 160`, `MAX_OBJECTIVE_EXAMPLE_LENGTH = 200`

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// src/db/customObjectives.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { REFERENTIAL_VERSION, referential } from '@/domain/referential'
import { CUSTOM_OBJECTIVE_SOURCE } from '@/domain/objectives'
import { createValidation } from './validations'
import { db } from './db'
import {
  DuplicateObjectiveError,
  createCustomObjective,
  deleteCustomObjective,
  updateCustomObjective,
  useObjectiveCatalog,
} from './customObjectives'
import { makeStudent } from '@/test/fixtures'

function input(overrides: Partial<Parameters<typeof createCustomObjective>[0]> = {}) {
  return {
    label: '  Compter jusqu’à douze  ',
    domainId: 'maths' as const,
    ageBands: ['from4' as const, 'from5' as const],
    examples: {
      from4: 'Réciter la comptine jusqu’à douze.',
      from5: 'Compter douze objets en les pointant.',
    },
    ...overrides,
  }
}

describe('createCustomObjective', () => {
  it('nettoie l’intitulé et remplit les champs techniques', async () => {
    const created = await createCustomObjective(input())

    expect(created.id).toMatch(/^custom-/)
    expect(created.label).toBe('Compter jusqu’à douze')
    expect(created.competencyId).toBe('custom')
    expect(created.source).toEqual(CUSTOM_OBJECTIVE_SOURCE)
    expect(created.ageBands).toEqual(['from4', 'from5'])
    expect(created.createdAt).toEqual(expect.any(String))
    expect(created.updatedAt).toBe(created.createdAt)
    expect(await db.customObjectives.get(created.id)).toEqual(created)
  })

  it('refuse un intitulé vide ou trop long', async () => {
    await expect(createCustomObjective(input({ label: '   ' }))).rejects.toThrow(
      'L’intitulé est obligatoire.',
    )
    await expect(
      createCustomObjective(input({ label: 'a'.repeat(161) })),
    ).rejects.toThrow('L’intitulé ne peut pas dépasser 160 caractères.')
  })

  it('refuse un objectif sans niveau ou sans exemple', async () => {
    await expect(
      createCustomObjective(input({ ageBands: [] })),
    ).rejects.toThrow('Choisis au moins un niveau.')
    await expect(
      createCustomObjective(input({ ageBands: ['from4', 'from5'], examples: { from4: 'ok' } })),
    ).rejects.toThrow('L’exemple en GS est obligatoire.')
    await expect(
      createCustomObjective(input({ examples: { from4: 'ok', from5: 'x'.repeat(201) } })),
    ).rejects.toThrow('L’exemple en GS ne peut pas dépasser 200 caractères.')
  })

  it('refuse un doublon officiel ou personnalisé, casse et accents ignorés', async () => {
    const officialLabel = referential.objectives.find(
      (objective) => objective.domainId === 'langage',
    )!.label
    await expect(
      createCustomObjective(
        input({ domainId: 'langage', label: `  ${officialLabel.toUpperCase()}  ` }),
      ),
    ).rejects.toBeInstanceOf(DuplicateObjectiveError)

    await createCustomObjective(input({ label: 'Écrire son prénom' }))
    await expect(
      createCustomObjective(input({ label: '  ecrire   son prenom ', domainId: 'maths' })),
    ).rejects.toBeInstanceOf(DuplicateObjectiveError)
  })

  it('autorise le même intitulé dans un autre domaine', async () => {
    await createCustomObjective(input({ label: 'Écrire son prénom', domainId: 'langage' }))
    await expect(
      createCustomObjective(input({ label: 'Écrire son prénom', domainId: 'maths' })),
    ).resolves.toBeDefined()
  })
})

describe('updateCustomObjective', () => {
  it('conserve identifiant et date de création, met à jour la date de modification', async () => {
    const created = await createCustomObjective(input())

    await updateCustomObjective(created.id, input({ label: 'Compter jusqu’à vingt' }))

    const updated = await db.customObjectives.get(created.id)
    expect(updated?.id).toBe(created.id)
    expect(updated?.createdAt).toBe(created.createdAt)
    expect(updated?.updatedAt >= created.updatedAt).toBe(true)
    expect(updated?.label).toBe('Compter jusqu’à vingt')
  })

  it('ne se détecte pas lui-même comme doublon', async () => {
    const created = await createCustomObjective(input())
    await expect(
      updateCustomObjective(created.id, input({ label: created.label })),
    ).resolves.toBeUndefined()
  })

  it('retirer un niveau ne touche pas aux validations déjà enregistrées', async () => {
    const created = await createCustomObjective(
      input({ ageBands: ['from4', 'from5'] }),
    )
    const student = makeStudent({ section: 'GS' })
    await db.students.add(student)
    await createValidation({
      studentId: student.id,
      objective: created,
      ageBand: 'from5',
      date: '2026-11-10',
      referentialVersion: REFERENTIAL_VERSION,
    })

    await updateCustomObjective(
      created.id,
      input({
        ageBands: ['from4'],
        examples: { from4: 'Réciter la comptine jusqu’à douze.' },
      }),
    )

    const updated = await db.customObjectives.get(created.id)
    expect(updated?.ageBands).toEqual(['from4'])
    expect(await db.validations.count()).toBe(1)
    expect((await db.validations.toArray())[0]?.snapshot.ageBand).toBe('from5')
  })

  it('échoue sur un objectif inconnu', async () => {
    await expect(
      updateCustomObjective('custom-inconnu', input()),
    ).rejects.toThrow('Objectif introuvable.')
  })
})

describe('deleteCustomObjective', () => {
  it('retire l’objectif sans toucher aux validations', async () => {
    const created = await createCustomObjective(input())
    const student = makeStudent({ section: 'MS' })
    await db.students.add(student)
    await createValidation({
      studentId: student.id,
      objective: created,
      ageBand: 'from4',
      date: '2026-11-10',
      referentialVersion: REFERENTIAL_VERSION,
    })

    await deleteCustomObjective(created.id)

    expect(await db.customObjectives.get(created.id)).toBeUndefined()
    expect(await db.validations.count()).toBe(1)
  })
})

describe('useObjectiveCatalog', () => {
  it('rend les officiels puis les personnalisés, en direct', async () => {
    const { result } = renderHook(() => useObjectiveCatalog())

    await waitFor(() =>
      expect(result.current).toHaveLength(referential.objectives.length),
    )

    const created = await createCustomObjective(input())

    await waitFor(() =>
      expect(result.current?.at(-1)?.id).toBe(created.id),
    )
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm run test:run -- src/db/customObjectives.test.ts`
Expected: FAIL, module `./customObjectives` introuvable.

- [ ] **Step 3: Ajouter la table Dexie**

Dans `src/db/db.ts`, après `this.version(1).stores({...})` :

```ts
this.version(2).stores({
  customObjectives: 'id, domainId',
})
```

et dans la classe :

```ts
customObjectives!: EntityTable<CustomObjective, 'id'>
```

Importer `CustomObjective` dans le bloc de types.

- [ ] **Step 4: Implémenter le module**

Dans `src/db/customObjectives.ts` :

```ts
import { useLiveQuery } from 'dexie-react-hooks'
import { CUSTOM_OBJECTIVE_SOURCE, mergeObjectives } from '@/domain/objectives'
import {
  AGE_BANDS,
  referential,
  sectionForAgeBand,
} from '@/domain/referential'
import type { AgeBand, CustomObjective, Domain, Objective } from '@/domain/types'
import { normalizeSearch } from '@/lib/text'
import { db } from './db'

export const MAX_OBJECTIVE_LABEL_LENGTH = 160
export const MAX_OBJECTIVE_EXAMPLE_LENGTH = 200

export class DuplicateObjectiveError extends Error {
  constructor(message = 'Un objectif porte déjà cet intitulé dans ce domaine.') {
    super(message)
    this.name = 'DuplicateObjectiveError'
  }
}

export interface CustomObjectiveInput {
  label: string
  domainId: Domain['id']
  ageBands: AgeBand[]
  examples: Partial<Record<AgeBand, string>>
}
```

Règles de validation, dans cet ordre :

1. `label.trim()` vide → `L’intitulé est obligatoire.` ; longueur > 160 → `L’intitulé ne peut pas dépasser 160 caractères.`
2. `ageBands` dédupliquées et triées selon l'ordre de `AGE_BANDS` ; vide → `Choisis au moins un niveau.`
3. Pour chaque tranche déclarée : exemple `trim()` vide → `` `L’exemple en ${sectionForAgeBand(band)} est obligatoire.` `` ; longueur > 200 → `` `L’exemple en ${sectionForAgeBand(band)} ne peut pas dépasser 200 caractères.` ``
4. Ne conserver que les exemples des tranches déclarées.
5. Doublon : `duplicateKey(label) === duplicateKey(existant.label)` dans le même domaine, où

```ts
function duplicateKey(value: string): string {
  return normalizeSearch(value).replace(/\s+/g, ' ')
}
```

Les candidats sont `referential.objectives` du domaine plus `db.customObjectives.where('domainId').equals(domainId)`, en excluant l'identifiant en cours d'édition. Un doublon lève `DuplicateObjectiveError`.

`createCustomObjective` construit :

```ts
const now = new Date().toISOString()
const record: CustomObjective = {
  id: `custom-${crypto.randomUUID()}`,
  competencyId: 'custom',
  domainId: input.domainId,
  label,
  ageBands,
  examples,
  source: CUSTOM_OBJECTIVE_SOURCE,
  createdAt: now,
  updatedAt: now,
}
```

`updateCustomObjective` lit la ligne (sinon `Objectif introuvable.`), applique les mêmes règles, conserve `id` et `createdAt`, écrit `updatedAt: new Date().toISOString()`.

`deleteCustomObjective` fait un simple `db.customObjectives.delete(id)`.

Hooks :

```ts
export function useCustomObjectives(): CustomObjective[] | undefined {
  return useLiveQuery(
    async () => (await db.customObjectives.toArray()).sort((a, b) =>
      a.createdAt !== b.createdAt
        ? a.createdAt.localeCompare(b.createdAt)
        : a.id.localeCompare(b.id),
    ),
    [],
  )
}

export function useObjectiveCatalog(): Objective[] | undefined {
  const custom = useCustomObjectives()
  return custom === undefined
    ? undefined
    : mergeObjectives(referential.objectives, custom)
}
```

- [ ] **Step 5: Relancer les tests**

Run: `npm run test:run -- src/db/customObjectives.test.ts`
Expected: PASS.

- [ ] **Step 6: Vérifier la migration Dexie**

Run: `npm run test:run -- src/db`
Expected: PASS, aucune erreur d'ouverture de base.

- [ ] **Step 7: Commit (après autorisation)**

```bash
git add src/db/db.ts src/db/customObjectives.ts src/db/customObjectives.test.ts
git commit -m "feat: persist custom objectives in IndexedDB"
```

---

### Task 3: Fiche et écran Programme

**Files:**
- Create: `src/features/programme/CustomObjectiveSheet.tsx`
- Modify: `src/features/programme/ProgrammeScreen.tsx`
- Modify: `src/features/programme/ObjectiveSheet.tsx`
- Modify: `src/features/programme/programme.module.css`
- Modify: `src/features/programme/ProgrammeScreen.test.tsx`

**Interfaces:**
- Consumes: `CustomObjective`, `Objective`, `Domain`, `AgeBand` ; `createCustomObjective`, `updateCustomObjective`, `deleteCustomObjective`, `useCustomObjectives` ; `mergeObjectives`, `isCustomObjective`, `CUSTOM_OBJECTIVE_SOURCE` ; `DOMAINS` (via `referential.domains`), `AGE_BANDS`, `sectionForAgeBand`.
- Produces:
  - `CustomObjectiveSheet({ open, objective, onClose, onRequestDelete }: { open: boolean; objective: CustomObjective | null; onClose: () => void; onRequestDelete: (objective: CustomObjective) => void })`
  - `ObjectiveSheet` accepte `onEdit?: () => void` et `onDelete?: () => void`.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `src/features/programme/ProgrammeScreen.test.tsx` :

```tsx
describe('objectifs personnalisés', () => {
  async function addCustomObjectiveFromUi(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      screen.getByRole('button', { name: 'Ajouter un objectif' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Ajouter un objectif' })

    await user.type(within(dialog).getByLabelText('Intitulé'), 'Compter jusqu’à douze')
    await user.click(
      within(dialog).getByRole('group', { name: 'Domaine' }).getByRole('button', { name: 'Maths' }),
    )
    await user.click(
      within(dialog).getByRole('group', { name: 'Niveaux' }).getByRole('button', { name: 'MS' }),
    )
    await user.type(
      within(dialog).getByLabelText('Exemple en MS'),
      'Réciter la comptine jusqu’à douze.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Ajouter l’objectif' }))

    return dialog
  }

  it('ajoute un objectif, le range en fin de domaine et le marque « Ajouté »', async () => {
    const user = userEvent.setup()
    renderApp({ route: '/programme' })

    const dialog = await addCustomObjectiveFromUi(user)
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(await screen.findByText('Objectif ajouté.')).toBeInTheDocument()

    // La recherche ouvre le domaine Maths, fermé par défaut.
    await searchObjective('douze')
    const maths = await screen.findByRole('region', { name: 'Maths' })
    const row = within(maths).getByText('Compter jusqu’à douze').closest('li')!
    expect(within(row).getByText('Ajouté')).toBeInTheDocument()
    expect(within(row).getByText('MS')).toBeInTheDocument()

    const stored = await db.customObjectives.toArray()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      label: 'Compter jusqu’à douze',
      domainId: 'maths',
      ageBands: ['from4'],
    })
  })

  it('refuse un intitulé déjà pris et annonce l’erreur', async () => {
    const official = referential.objectives.find(
      (objective) => objective.domainId === 'maths',
    )!

    const user = userEvent.setup()
    renderApp({ route: '/programme' })
    await user.click(
      screen.getByRole('button', { name: 'Ajouter un objectif' }),
    )

    const dialog = await screen.findByRole('dialog', { name: 'Ajouter un objectif' })
    await user.type(within(dialog).getByLabelText('Intitulé'), official.label)
    await user.click(
      within(dialog).getByRole('group', { name: 'Domaine' }).getByRole('button', { name: 'Maths' }),
    )
    await user.click(
      within(dialog).getByRole('group', { name: 'Niveaux' }).getByRole('button', { name: 'MS' }),
    )
    await user.type(within(dialog).getByLabelText('Exemple en MS'), 'Un exemple.')
    await user.click(within(dialog).getByRole('button', { name: 'Ajouter l’objectif' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Un objectif porte déjà cet intitulé dans ce domaine.',
    )
    expect(await db.customObjectives.count()).toBe(0)
  })

  it('modifie un objectif ajouté depuis sa fiche', async () => {
    const created = await createCustomObjective({
      label: 'Compter jusqu’à douze',
      domainId: 'maths',
      ageBands: ['from4'],
      examples: { from4: 'Réciter la comptine.' },
    })
    await db.students.add(makeStudent({ firstName: 'Léa', section: 'MS' }))

    const user = userEvent.setup()
    renderApp({ route: '/programme' })
    await searchObjective('douze')
    await screen.findByText(created.label)
    await openObjective(user, created.label)

    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText('Objectif ajouté')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Modifier l’objectif' }))

    const form = await screen.findByRole('dialog', { name: 'Modifier l’objectif' })
    const label = within(form).getByLabelText('Intitulé')
    await user.clear(label)
    await user.type(label, 'Compter jusqu’à vingt')
    await user.click(within(form).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Modifier l’objectif' }))
        .not.toBeInTheDocument(),
    )
    expect(await screen.findByText('Compter jusqu’à vingt')).toBeInTheDocument()
    expect((await db.customObjectives.get(created.id))?.label).toBe(
      'Compter jusqu’à vingt',
    )
  })

  it('supprime après confirmation et laisse la réussite dans le dossier', async () => {
    const created = await createCustomObjective({
      label: 'Compter jusqu’à douze',
      domainId: 'maths',
      ageBands: ['from4'],
      examples: { from4: 'Réciter la comptine.' },
    })
    const student = await addStudent('Léa', 'MS')
    await createValidation({
      studentId: student.id,
      objective: created,
      ageBand: 'from4',
      date: '2026-11-10',
      referentialVersion: REFERENTIAL_VERSION,
    })

    const user = userEvent.setup()
    renderApp({ route: '/programme' })
    await searchObjective('douze')
    await screen.findByText(created.label)
    await openObjective(user, created.label)
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Supprimer l’objectif',
      }),
    )

    const confirm = await screen.findByRole('dialog', {
      name: /Supprimer « Compter jusqu’à douze »/,
    })
    await user.click(within(confirm).getByRole('button', { name: 'Supprimer définitivement' }))

    await waitFor(() => expect(screen.queryByText(created.label)).not.toBeInTheDocument())
    expect(await db.customObjectives.count()).toBe(0)
    expect(await db.validations.count()).toBe(1)
  })

  it('signale un objectif supprimé entre-temps au moment d’enregistrer', async () => {
    const created = await createCustomObjective({
      label: 'Compter jusqu’à douze',
      domainId: 'maths',
      ageBands: ['from4'],
      examples: { from4: 'Réciter la comptine.' },
    })

    const user = userEvent.setup()
    renderApp({ route: '/programme' })
    await searchObjective('douze')
    await screen.findByText(created.label)
    await openObjective(user, created.label)
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Modifier l’objectif',
      }),
    )

    const form = await screen.findByRole('dialog', { name: 'Modifier l’objectif' })
    await db.customObjectives.delete(created.id)
    await user.click(within(form).getByRole('button', { name: 'Enregistrer' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'Objectif introuvable.',
    )
  })

  it('ne propose ni modification ni suppression sur un objectif officiel', async () => {
    await db.students.add(makeStudent({ firstName: 'Léa', section: 'MS' }))
    const user = userEvent.setup()
    renderApp({ route: '/programme' })
    await searchObjective('memoriser')
    await screen.findByText(LANGAGE_1.label)
    await openObjective(user, LANGAGE_1.label)

    const sheet = await screen.findByRole('dialog')
    expect(
      within(sheet).queryByRole('button', { name: 'Modifier l’objectif' }),
    ).not.toBeInTheDocument()
    expect(
      within(sheet).queryByRole('button', { name: 'Supprimer l’objectif' }),
    ).not.toBeInTheDocument()
  })
})
```

Ajouter aux imports du fichier de test : `createCustomObjective` depuis `@/db/customObjectives`, `createValidation` et `REFERENTIAL_VERSION` sont déjà importés.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm run test:run -- src/features/programme/ProgrammeScreen.test.tsx`
Expected: FAIL, bouton « Ajouter un objectif » introuvable.

- [ ] **Step 3: Écrire la fiche**

`src/features/programme/CustomObjectiveSheet.tsx` :

- Feuille `Sheet` montée quand `open`, titre `objective === null ? 'Ajouter un objectif' : 'Modifier l’objectif'`.
- État local initialisé depuis `objective` (`null` pour un ajout) : `label`, `domainId` (défaut `'langage'`), `ageBands` (défaut `[]`), `examples`.
- `Field` pour l'intitulé, libellé `Intitulé`, `maxLength={160}`, `autoComplete="off"`.
- `role="group" aria-label="Domaine"` avec une `Chip` par domaine trié par `order`.
- `role="group" aria-label="Niveaux"` avec une `Chip` par section PS, MS, GS ; cocher/décocher conserve le texte d'exemple dans l'état.
- Pour chaque niveau coché, un `Field` avec `label={`Exemple en ${section}`}`, `maxLength={200}`, saisi dans `examples[band]`.
- `const [error, setError] = useState<string>()` ; rendu sous les champs : `<p role="alert">{error}</p>`.
- Soumission : `await createCustomObjective({ label, domainId, ageBands, examples })` ou `updateCustomObjective`, puis toast `Objectif ajouté.` / `Modifications enregistrées.`, puis `onClose`. Attraper l'erreur et afficher `error.message`.
- Actions : bouton `Ajouter l’objectif` / `Enregistrer`, `disabled` si `label.trim() === ''` ou `ageBands.length === 0` ou `saving`, puis `Annuler`. En édition, un bouton danger `Supprimer l’objectif` appelle `onRequestDelete(objective)`.

- [ ] **Step 4: Brancher Programme**

Dans `ProgrammeScreen.tsx`, avec les autres hooks en haut du composant :

```ts
const customObjectives = useCustomObjectives()
const [formObjective, setFormObjective] = useState<CustomObjective | null | undefined>(undefined)
const [deleteTarget, setDeleteTarget] = useState<CustomObjective | null>(null)
const [deleting, setDeleting] = useState(false)
```

- Ajouter `customObjectives === undefined` à la condition de chargement.
- `const catalog = mergeObjectives(referential.objectives, customObjectives)` et remplacer les trois lectures de `referential.objectives` (groupes, objectif sélectionné, recherche) par `catalog`.
- `selectedObjective` se cherche dans `catalog`.
- Bouton sous l'en-tête : `<Button variant="dark" fullWidth onClick={() => setFormObjective(null)}><Icon name="plus" size={18} />Ajouter un objectif</Button>`.
- Dans la ligne, après `levelTag` : `{isCustomObjective(objective) ? <span className={styles.addedTag}>Ajouté</span> : null}`.
- `ObjectiveSheet` reçoit `onEdit` et `onDelete` seulement pour un objectif personnalisé :
  `onEdit={() => { setSelectedObjectiveId(undefined); setFormObjective(objective as CustomObjective) }}`,
  `onDelete={() => { setSelectedObjectiveId(undefined); setDeleteTarget(objective as CustomObjective) }}`.
- Rendu de `CustomObjectiveSheet` quand `formObjective !== undefined`, avec `objective={formObjective}`, `onClose={() => setFormObjective(undefined)}`, `onRequestDelete={(objective) => setDeleteTarget(objective)}`.
- `ConfirmSheet` : titre `Supprimer « ${deleteTarget.label} » ?`, description `Les réussites déjà enregistrées restent dans les dossiers des élèves. Cette action est définitive.`, `confirmLabel="Supprimer définitivement"`, `tone="danger"`. `handleDelete` appelle `deleteCustomObjective`, ferme les deux feuilles, toast `Objectif supprimé.` ; en cas d'échec, toast `L’objectif n’a pas pu être supprimé. Réessaie.`

- [ ] **Step 5: Ajouter les actions à la fiche objectif**

Dans `ObjectiveSheet.tsx`, ajouter les props optionnelles `onEdit` et `onDelete`. Dans `sheetMeta`, pour un objectif personnalisé :

```tsx
<span className={styles.sheetDomain}>Objectif ajouté</span>
```

Dans `SheetActions`, avant « Fermer » :

```tsx
{onEdit === undefined ? null : (
  <Button variant="dark" fullWidth onClick={onEdit}>
    <Icon name="pencil" size={18} />
    Modifier l’objectif
  </Button>
)}
{onDelete === undefined ? null : (
  <Button variant="danger" fullWidth onClick={onDelete}>
    <Icon name="trash" size={18} />
    Supprimer l’objectif
  </Button>
)}
```

- [ ] **Step 6: Styles**

Dans `programme.module.css` : `.addedTag` (petite étiquette, bord `--line-strong`, couleur `--muted`, fond `--paper`) et les classes de formulaire (`.form`, `.formField`, `.formLabel`, `.formHint`, `.formError`, `.formActions`, `.chipRow`), dans le langage visuel existant. Réutiliser `--radius-pill`, `--muted`, `--line` ; l'erreur en `--blush-ink` ou équivalent lisible.

- [ ] **Step 7: Relancer les tests**

Run: `npm run test:run -- src/features/programme/ProgrammeScreen.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit (après autorisation)**

```bash
git add src/features/programme
git commit -m "feat: add custom objectives from the programme screen"
```

---

### Task 4: Capture

**Files:**
- Modify: `src/features/capture/ObjectiveScreen.tsx`
- Modify: `src/features/capture/capture.module.css`
- Modify: `src/features/capture/capture.test.tsx`

**Interfaces:**
- Consumes: `useObjectiveCatalog` ; `isCustomObjective` ; `Objective`, `CustomObjective`.
- Produces: aucune interface publique nouvelle.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter dans `capture.test.tsx`, après les tests de `ObjectiveScreen` existants :

```tsx
describe('objectifs personnalisés en capture', () => {
  it('propose un objectif ajouté au niveau de l’élève et le valide', async () => {
    await ensureSeed()
    const student = await addStudent('Léa', 'MS')
    const created = await createCustomObjective({
      label: 'Compter jusqu’à douze',
      domainId: 'maths',
      ageBands: ['from4'],
      examples: { from4: 'Réciter la comptine jusqu’à douze.' },
    })
    await seedDraft(student.id)

    const user = userEvent.setup()
    renderApp({ route: `/capture/${student.id}/objective` })

    const card = await screen.findByRole('button', {
      name: /Compter jusqu’à douze/,
    })
    expect(within(card).getByText('Ajouté')).toBeInTheDocument()

    await user.click(card)
    await user.click(screen.getByRole('button', { name: /Valider la réussite/ }))

    await waitFor(async () => {
      const stored = await db.validations.toArray()
      expect(stored).toHaveLength(1)
      expect(stored[0]).toMatchObject({
        studentId: student.id,
        objectiveId: created.id,
        snapshot: { objectiveLabel: 'Compter jusqu’à douze', ageBand: 'from4' },
      })
    })
  })

  it('ne propose pas un objectif ajouté pour un autre niveau', async () => {
    await ensureSeed()
    const student = await addStudent('Léa', 'PS')
    await createCustomObjective({
      label: 'Compter jusqu’à douze',
      domainId: 'maths',
      ageBands: ['from4'],
      examples: { from4: 'Réciter la comptine jusqu’à douze.' },
    })
    await seedDraft(student.id)

    renderApp({ route: `/capture/${student.id}/objective` })

    expect(
      await screen.findByRole('heading', { level: 1, name: /Choisir l.objectif/ }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Compter jusqu’à douze')).not.toBeInTheDocument()
  })
})
```

Importer `createCustomObjective` depuis `@/db/customObjectives`.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm run test:run -- src/features/capture/capture.test.tsx`
Expected: FAIL, l'objectif ajouté n'apparaît pas.

- [ ] **Step 3: Brancher le catalogue**

Dans `ObjectiveScreen.tsx`, appeler le hook **en haut du composant**, avec les autres hooks et avant tout retour anticipé (règle des hooks) :

```ts
const customObjectives = useCustomObjectives()
const catalog = customObjectives === undefined
  ? undefined
  : mergeObjectives(referential.objectives, customObjectives)
```

- Après les retours anticipés sur le brouillon, si `catalog === undefined`, rendre `<LoadingText>Chargement des objectifs…</LoadingText>`.
- Remplacer `referential.objectives` par `catalog` dans `visibleObjectives` et dans la recherche de `selectedObjective`.
- Dans la carte, après l'intitulé : `{isCustomObjective(objective) ? <span className={styles.addedTag}>Ajouté</span> : null}` dans `objectiveMeta`.

- [ ] **Step 4: Style**

Dans `capture.module.css`, `.addedTag` : petite étiquette alignée sur le texte, bord `--line`, fond `--paper`, couleur `--muted`, taille 9 px, `white-space: nowrap`.

- [ ] **Step 5: Relancer les tests**

Run: `npm run test:run -- src/features/capture/capture.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit (après autorisation)**

```bash
git add src/features/capture
git commit -m "feat: offer custom objectives during capture"
```

---

### Task 5: Sauvegarde v2

**Files:**
- Modify: `src/features/settings/backup.ts`
- Modify: `src/features/settings/backup.test.ts`

**Interfaces:**
- Consumes: `CustomObjective` ; `db.customObjectives`.
- Produces: `BACKUP_SCHEMA_VERSION = 2` ; `BackupData.customObjectives: CustomObjective[]`.

- [ ] **Step 1: Mettre à jour les tests existants**

- `expect(backup.data.schemaVersion).toBe(1)` → `.toBe(2)`.
- Le test « refuse une sauvegarde d’une version de schéma plus récente » écrit `data.schemaVersion = 2` → `3`.

- [ ] **Step 2: Écrire les tests qui échouent**

```ts
describe('objectifs personnalisés dans la sauvegarde', () => {
  it(
    'exporte et restaure les objectifs ajoutés',
    async () => {
      await seedBackupData()
      const created = await createCustomObjective({
        label: 'Compter jusqu’à douze',
        domainId: 'maths',
        ageBands: ['from4'],
        examples: { from4: 'Réciter la comptine jusqu’à douze.' },
      })

      const blob = await exportBackup(() => {})
      await db.customObjectives.clear()
      expect(await db.customObjectives.count()).toBe(0)

      const backup = await readBackup(await asZipFile(blob), () => {})
      expect(backup.data.customObjectives).toEqual([created])

      await restoreBackup(await withNodeBlobs(backup), () => {})
      expect(await db.customObjectives.get(created.id)).toEqual(created)
    },
    ZIP_TIMEOUT_MS,
  )

  it(
    'accepte une archive v1 sans objectifs personnalisés et vide la table',
    async () => {
      await seedBackupData()
      await createCustomObjective({
        label: 'Compter jusqu’à douze',
        domainId: 'maths',
        ageBands: ['from4'],
        examples: { from4: 'Réciter la comptine jusqu’à douze.' },
      })

      const blob = await exportBackup(() => {})
      const file = await mutateBackupData(blob, (data) => {
        data.schemaVersion = 1
        delete (data as { customObjectives?: unknown }).customObjectives
      })

      const backup = await readBackup(file, () => {})
      expect(backup.data.customObjectives).toEqual([])

      await restoreBackup(await withNodeBlobs(backup), () => {})
      expect(await db.customObjectives.count()).toBe(0)
    },
    ZIP_TIMEOUT_MS,
  )

  it(
    'refuse un objectif personnalisé sans exemple',
    async () => {
      await seedBackupData()
      await createCustomObjective({
        label: 'Compter jusqu’à douze',
        domainId: 'maths',
        ageBands: ['from4'],
        examples: { from4: 'Réciter la comptine jusqu’à douze.' },
      })

      const blob = await exportBackup(() => {})
      const file = await mutateBackupData(blob, (data) => {
        data.customObjectives[0]!.examples = {}
      })

      await expect(readBackup(file, () => {})).rejects.toThrow(/invalide/)
    },
    ZIP_TIMEOUT_MS,
  )
})
```

`EditableBackupData` gagne `customObjectives: { examples: Record<string, string>; [key: string]: unknown }[]`.
Importer `createCustomObjective` depuis `@/db/customObjectives`.

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm run test:run -- src/features/settings/backup.test.ts`
Expected: FAIL (`schemaVersion` à 1, `customObjectives` absent).

- [ ] **Step 4: Implémenter**

Dans `backup.ts` :

- `const BACKUP_SCHEMA_VERSION = 2`.
- `BackupData` gagne `customObjectives: CustomObjective[]`.
- Schéma Zod :

```ts
const customObjectiveSchema = z.object({
  id: z.string().startsWith('custom-'),
  competencyId: z.literal('custom'),
  domainId: domainIdSchema,
  label: z.string().min(1).max(160),
  ageBands: z.array(ageBandSchema).min(1),
  examples: z.partialRecord(ageBandSchema, z.string().min(1).max(200)),
  source: z.object({ bo: z.string().min(1) }),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})
```

et dans `backupDataSchema` : `customObjectives: z.array(customObjectiveSchema).default([])`.

- Lecture : `rawData.schemaVersion > BACKUP_SCHEMA_VERSION` → `SCHEMA_TOO_RECENT` ; `rawData.schemaVersion < 1` → `SCHEMA_TOO_OLD` ; 1 et 2 acceptés.
- Intégrité : identifiants uniques, et pour chaque objectif un exemple pour chaque tranche déclarée (message `La sauvegarde est invalide : l’objectif ajouté « <id> » n’a pas d’exemple pour « <band> ».`).
- Export : lire `db.customObjectives.toArray()` dans le `Promise.all` et écrire le tableau dans `data`.
- Restauration : ajouter `db.customObjectives` à la transaction, `clear()` puis `bulkPut` si non vide.

- [ ] **Step 5: Relancer les tests**

Run: `npm run test:run -- src/features/settings/backup.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit (après autorisation)**

```bash
git add src/features/settings/backup.ts src/features/settings/backup.test.ts
git commit -m "feat: include custom objectives in backups"
```

---

### Task 6: Bout en bout

**Files:**
- Modify: `e2e/helpers.ts`
- Modify: `e2e/programme.spec.ts`

**Interfaces:**
- Consumes: bouton et fiche de la Task 3, capture de la Task 4.
- Produces: `StoreName` et `DatabaseTable` acceptent `'customObjectives'` ; `clearDb` vide la table.

- [ ] **Step 1: Mettre à jour les helpers**

Dans `e2e/helpers.ts` :

- `export type StoreName = 'students' | 'validations' | 'photos' | 'schoolYears' | 'customObjectives'`.
- `DevDatabase` gagne `customObjectives: DevTable`.
- `clearDb` ajoute `database.customObjectives` à la transaction et `await database.customObjectives.clear()`.

- [ ] **Step 2: Écrire le scénario qui échoue**

Ajouter dans `e2e/programme.spec.ts` :

```ts
test('ajoute un objectif, le valide, le retrouve au dossier puis le supprime', async ({
  page,
}) => {
  await addStudent(page, 'Lina', 'MS')

  await page.getByRole('link', { name: 'Programme', exact: true }).click()
  await page.getByRole('button', { name: 'Ajouter un objectif', exact: true }).click()

  const form = page.getByRole('dialog', { name: 'Ajouter un objectif' })
  await expect(form).toBeVisible()
  await form.getByLabel('Intitulé', { exact: true }).fill('Compter jusqu’à douze')
  await form
    .getByRole('group', { name: 'Domaine', exact: true })
    .getByRole('button', { name: 'Maths', exact: true })
    .click()
  await form
    .getByRole('group', { name: 'Niveaux', exact: true })
    .getByRole('button', { name: 'MS', exact: true })
    .click()
  await form
    .getByLabel('Exemple en MS', { exact: true })
    .fill('Réciter la comptine jusqu’à douze.')
  await form.getByRole('button', { name: 'Ajouter l’objectif', exact: true }).click()

  await expect(page.getByText('Objectif ajouté.')).toBeVisible()
  const row = page.getByRole('button', {
    name: /^Ouvrir l.objectif : Compter jusqu.à douze/,
  })
  await expect(row).toBeVisible()
  await expect(page.getByText('Ajouté', { exact: true })).toBeVisible()

  // La réussite est validée depuis la capture.
  await captureWithPhoto(page, 'Lina', 'Compter jusqu’à douze')
  await openDossier(page, 'Lina')
  await expect(page.getByText('Compter jusqu’à douze')).toBeVisible()

  // Suppression : la ligne disparaît, la réussite reste au dossier.
  await page.getByRole('link', { name: 'Programme', exact: true }).click()
  await page.getByLabel('Rechercher un objectif', { exact: true }).fill('douze')
  await row.click()
  const sheet = page.getByRole('dialog', { name: /Compter jusqu.à douze/ })
  await sheet.getByRole('button', { name: 'Supprimer l’objectif', exact: true }).click()
  await page.getByRole('button', { name: 'Supprimer définitivement', exact: true }).click()

  await expect(row).toHaveCount(0)
  await expect(page.getByText('Aucun objectif ne correspond.')).toBeVisible()
  await openDossier(page, 'Lina')
  await expect(page.getByText('Compter jusqu’à douze')).toBeVisible()
})
```

Importer `captureWithPhoto` et `openDossier` depuis `./helpers`.

- [ ] **Step 3: Lancer le scénario**

Run: `npm run test:e2e -- e2e/programme.spec.ts`
Expected: PASS.

- [ ] **Step 4: Vérifier l'accessibilité**

Run: `npm run test:e2e -- e2e/a11y.spec.ts`
Expected: PASS, aucun nouveau contraste ou nom accessible en défaut.

- [ ] **Step 5: Commit (après autorisation)**

```bash
git add e2e/helpers.ts e2e/programme.spec.ts
git commit -m "test: cover custom objectives end to end"
```

---

## Vérification finale

- [ ] `npm run typecheck` — aucune erreur.
- [ ] `npm run lint` — aucun avertissement nouveau.
- [ ] `npm run test:run` — toute la suite passe.
- [ ] `npm run test:e2e -- e2e/programme.spec.ts e2e/a11y.spec.ts` — passe.

## Couverture de la spécification

| Exigence | Tâche |
|---|---|
| Bouton en tête de Programme | 3 |
| Intitulé, domaine, niveaux, exemple par niveau | 3 |
| Fin de domaine et marque « Ajouté » | 3 |
| Fiche objectif : modifier, supprimer | 3 |
| Capture : objectifs ajoutés proposés et validables | 4 |
| Édition sans réécrire les instantanés | 2 (CRUD), 3 (UI) |
| Suppression sans effacer les réussites | 2 (test), 3 (UI) |
| Doublon casse/accents/espaces, même domaine | 2 |
| Session Dexie v2 | 2 |
| Sauvegarde v2, archive v1 lisible | 5 |
| Accessibilité (libellés, groupes, alerte) | 3, 6 |
| Tests unitaires, composants, sauvegarde, E2E | 1–6 |
