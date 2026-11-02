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

  it('ignore les apostrophes typographiques dans la comparaison', async () => {
    await createCustomObjective(input({ label: 'L’objectif du jour' }))
    await expect(
      createCustomObjective(input({ label: "L'objectif du jour" })),
    ).rejects.toBeInstanceOf(DuplicateObjectiveError)
  })
})

describe('updateCustomObjective', () => {
  it('conserve identifiant et date de création, met à jour la date de modification', async () => {
    const created = await createCustomObjective(input())

    await updateCustomObjective(created.id, input({ label: 'Compter jusqu’à vingt' }))

    const updated = await db.customObjectives.get(created.id)
    expect(updated?.id).toBe(created.id)
    expect(updated?.createdAt).toBe(created.createdAt)
    expect(updated!.updatedAt >= created.updatedAt).toBe(true)
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

  it('libère l’intitulé, qui peut être recréé dans le même domaine', async () => {
    const created = await createCustomObjective(
      input({ label: 'Compter jusqu’à douze' }),
    )

    await deleteCustomObjective(created.id)

    const recreated = await createCustomObjective(
      input({ label: 'Compter jusqu’à douze' }),
    )

    expect(recreated.id).not.toBe(created.id)
    expect(await db.customObjectives.count()).toBe(1)
    expect((await db.customObjectives.get(recreated.id))?.label).toBe(
      'Compter jusqu’à douze',
    )
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
