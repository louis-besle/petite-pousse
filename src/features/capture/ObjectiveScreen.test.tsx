/// <reference types="node" />
import { Blob as NodeBlob } from 'node:buffer'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dexie from 'dexie'
import { db } from '@/db/db'
import { getCaptureDraft, saveCaptureDraft } from '@/db/drafts'
import { createValidation } from '@/db/validations'
import { REFERENTIAL_VERSION, referential } from '@/domain/referential'
import type { CaptureDraft, Objective, Section, ValidationSnapshot } from '@/domain/types'
import { makeStudent } from '@/test/fixtures'
import { renderApp } from '@/test/render'

/**
 * Le `Blob` de jsdom est perdu par le clone structuré de fake-indexeddb ;
 * celui de Node survit et permet de vérifier les données relues.
 */
function nodeBlob(content: string): Blob {
  return new NodeBlob([content], { type: 'image/jpeg' }) as unknown as Blob
}

function objective(id: string): Objective {
  const found = referential.objectives.find((candidate) => candidate.id === id)
  if (found === undefined) {
    throw new Error(`Objectif de test introuvable : ${id}`)
  }
  return found
}

async function addStudent(firstName: string, section: Section) {
  const student = makeStudent({ firstName, section })
  await db.students.add(student)
  return student
}

function makeDraft(studentId: string, withPhoto: boolean): CaptureDraft {
  const draft: CaptureDraft = {
    id: 'current',
    studentId,
    createdAt: '2026-11-01T10:00:00.000Z',
  }

  if (withPhoto) {
    draft.full = nodeBlob('photo-pleine')
    draft.thumb = nodeBlob('vignette')
    draft.width = 1200
    draft.height = 900
  }

  return draft
}

async function seedDraft(studentId: string, withPhoto = true): Promise<CaptureDraft> {
  const draft = makeDraft(studentId, withPhoto)
  await saveCaptureDraft(draft)
  return draft
}

/** Un intitulé d'objectif du niveau MS, utilisé par plusieurs cas. */
const MATHS_LABEL = objective('maths-nombres-05').label
const LANGAGE_LABEL = objective('lang-vocabulaire-01').label
const FROM5_ONLY_LABEL = objective('lang-vocabulaire-03').label

describe('ObjectiveScreen', () => {
  it('filtre les objectifs par domaine et par recherche sans tenir compte des accents', async () => {
    const lea = await addStudent('Léa', 'MS')
    await seedDraft(lea.id)
    const user = userEvent.setup()

    renderApp({ route: '/capture/objective' })

    expect(
      await screen.findByRole('heading', { level: 1, name: "Choisir l'objectif" }),
    ).toBeInTheDocument()
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'Élève Léa, section MS' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Léa · MS')).toBeInTheDocument()

    // Par défaut, seuls les objectifs du niveau de l'élève sont listés.
    expect(
      await screen.findByRole('button', { name: new RegExp(LANGAGE_LABEL.slice(0, 24)) }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: new RegExp(MATHS_LABEL) }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Maths' }))

    expect(
      screen.getByRole('button', { name: new RegExp(MATHS_LABEL) }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Comprendre, mémoriser/ }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tous' }))
    await user.type(
      screen.getByRole('searchbox', { name: 'Rechercher un objectif' }),
      'coordonnee',
    )

    expect(
      await screen.findByRole('button', { name: /Lancer loin de manière coordonnée/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: new RegExp(MATHS_LABEL) }),
    ).not.toBeInTheDocument()
  })

  it('désactive un objectif déjà validé et affiche sa date', async () => {
    const lea = await addStudent('Léa', 'MS')
    await seedDraft(lea.id)
    await createValidation({
      studentId: lea.id,
      objective: objective('lang-vocabulaire-01'),
      ageBand: 'from4',
      date: '2026-10-12',
      referentialVersion: REFERENTIAL_VERSION,
    })

    renderApp({ route: '/capture/objective' })

    const card = await screen.findByRole('button', {
      name: /Comprendre, mémoriser/,
    })

    await waitFor(() => expect(card).toBeDisabled())
    expect(within(card).getByText('Déjà validé · 12 oct.')).toBeInTheDocument()
  })

  it('active le bouton de validation quand un objectif est sélectionné', async () => {
    const lea = await addStudent('Léa', 'MS')
    await seedDraft(lea.id)
    const user = userEvent.setup()

    renderApp({ route: '/capture/objective' })

    const cta = await screen.findByRole('button', { name: 'Valider la réussite' })
    expect(cta).toBeDisabled()

    await user.click(
      screen.getByRole('button', { name: new RegExp(MATHS_LABEL) }),
    )

    expect(screen.getByRole('button', { name: 'Valider la réussite' })).toBeEnabled()
    expect(
      screen.getByRole('button', { name: new RegExp(MATHS_LABEL) }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Prêt à valider')).toBeInTheDocument()
  })

  it('crée la validation avec son instantané, efface le brouillon et ouvre le succès', async () => {
    const lea = await addStudent('Léa', 'MS')
    await seedDraft(lea.id)
    const user = userEvent.setup()

    const { router } = renderApp({ route: '/capture/objective' })

    await user.click(
      await screen.findByRole('button', { name: new RegExp(MATHS_LABEL) }),
    )
    await user.click(screen.getByRole('button', { name: 'Valider la réussite' }))

    await waitFor(async () => expect(await db.validations.count()).toBe(1))
    const [validation] = await db.validations.toArray()

    expect(validation.studentId).toBe(lea.id)
    expect(validation.objectiveId).toBe('maths-nombres-05')
    expect(validation.snapshot.objectiveLabel).toBe(MATHS_LABEL)
    expect(validation.snapshot.ageBand).toBe('from4')
    expect(validation.photoId).toBeDefined()
    expect(await db.photos.count()).toBe(1)

    await waitFor(async () => expect(await getCaptureDraft()).toBeUndefined())
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/success/${validation.id}`),
    )

    expect(
      await screen.findByRole('heading', { level: 1, name: "C'est noté !" }),
    ).toBeInTheDocument()
    expect(screen.getByText(MATHS_LABEL)).toBeInTheDocument()
    expect(screen.getByText(/avec photo/)).toBeInTheDocument()
  })

  it('valide sans photo et le confirme sur l’écran de succès', async () => {
    const lea = await addStudent('Léa', 'MS')
    await seedDraft(lea.id, false)
    const user = userEvent.setup()

    const { router } = renderApp({ route: '/capture/objective' })

    expect(
      await screen.findByText('Tu peux valider sans photo.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Tu pourras en ajouter une plus tard depuis le dossier.'),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: new RegExp(MATHS_LABEL) }),
    )
    await user.click(screen.getByRole('button', { name: 'Valider la réussite' }))

    await waitFor(async () => expect(await db.validations.count()).toBe(1))
    const [validation] = await db.validations.toArray()

    expect(validation.photoId).toBeUndefined()
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/success/${validation.id}`),
    )
    expect(await screen.findByText(/sans photo/)).toBeInTheDocument()
  })

  it('garde le brouillon et affiche un toast quand la validation est déjà connue', async () => {
    const lea = await addStudent('Léa', 'MS')
    await seedDraft(lea.id)
    const user = userEvent.setup()
    const addSpy = vi
      .spyOn(db.validations, 'add')
      .mockRejectedValue(new Dexie.ConstraintError('objectif déjà validé'))

    try {
      renderApp({ route: '/capture/objective' })

      await user.click(
        await screen.findByRole('button', { name: new RegExp(MATHS_LABEL) }),
      )
      await user.click(screen.getByRole('button', { name: 'Valider la réussite' }))

      expect(
        await screen.findByText('Cet objectif est déjà validé pour cet élève.'),
      ).toBeInTheDocument()
      expect(await getCaptureDraft()).toBeDefined()
      expect(await db.validations.count()).toBe(0)
    } finally {
      addSpy.mockRestore()
    }
  })

  it('garde le brouillon et affiche un toast quand le stockage échoue', async () => {
    const lea = await addStudent('Léa', 'MS')
    await seedDraft(lea.id)
    const user = userEvent.setup()
    const addSpy = vi
      .spyOn(db.validations, 'add')
      .mockRejectedValue(new Error('QuotaExceededError'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const { router } = renderApp({ route: '/capture/objective' })

      await user.click(
        await screen.findByRole('button', { name: new RegExp(MATHS_LABEL) }),
      )
      await user.click(screen.getByRole('button', { name: 'Valider la réussite' }))

      expect(
        await screen.findByText('La réussite n’a pas pu être enregistrée. Réessaie.'),
      ).toBeInTheDocument()
      expect(await getCaptureDraft()).toBeDefined()
      expect(await db.validations.count()).toBe(0)
      expect(router.state.location.pathname).toBe('/capture/objective')
      expect(consoleSpy).toHaveBeenCalled()
    } finally {
      addSpy.mockRestore()
      consoleSpy.mockRestore()
    }
  })

  // Marge de 15 s pour le rendu complet des 407 cartes sous la charge parallèle
  // de la suite (accommodation de test, pas un benchmark produit).
  it('affiche tous les niveaux quand l’option est activée', async () => {
    const lea = await addStudent('Léa', 'MS')
    await seedDraft(lea.id)
    const user = userEvent.setup()

    renderApp({ route: '/capture/objective' })

    await screen.findByRole('heading', { level: 1, name: "Choisir l'objectif" })
    expect(screen.queryByText(FROM5_ONLY_LABEL)).not.toBeInTheDocument()

    const toggle = screen.getByRole('button', { name: 'Tous les niveaux' })
    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    const card = await screen.findByRole('button', {
      name: /corpus enseignés \(3 par période\)/,
    })
    expect(within(card).getByText('GS · Langage')).toBeInTheDocument()
  }, 15_000)

  it('redirige vers le choix de l’élève quand aucun brouillon n’existe', async () => {
    const { router } = renderApp({ route: '/capture/objective' })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pour qui ?' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/capture')
  })
})

describe('SuccessScreen', () => {
  it('affiche l’intitulé, la date et la mention « avec photo »', async () => {
    const lea = await addStudent('Léa', 'MS')
    const validation = await createValidation({
      studentId: lea.id,
      objective: objective('maths-nombres-05'),
      ageBand: 'from4',
      date: '2026-10-12',
      referentialVersion: REFERENTIAL_VERSION,
      photo: {
        full: nodeBlob('photo-pleine'),
        thumb: nodeBlob('vignette'),
        width: 1200,
        height: 900,
        mime: 'image/jpeg',
      },
    })

    renderApp({ route: `/success/${validation.id}` })

    expect(
      await screen.findByRole('heading', { level: 1, name: "C'est noté !" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/La réussite est ajoutée au dossier de/),
    ).toHaveTextContent('Léa')
    expect(screen.getByText(MATHS_LABEL)).toBeInTheDocument()
    expect(screen.getByText(/12 oct\. · avec photo/)).toBeInTheDocument()
    expect(
      screen.getByText(/L'ACQUISITION DES PREMIERS OUTILS MATHÉMATIQUES/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Voir le dossier de Léa' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Retour à la classe' }),
    ).toBeInTheDocument()
  })

  it('affiche le libellé de domaine figé quand le domaine a disparu du référentiel', async () => {
    const lea = await addStudent('Léa', 'MS')
    const validation = await createValidation({
      studentId: lea.id,
      objective: objective('maths-nombres-05'),
      ageBand: 'from4',
      date: '2026-10-12',
      referentialVersion: REFERENTIAL_VERSION,
    })

    await db.validations.put({
      ...validation,
      snapshot: {
        ...validation.snapshot,
        domainId: 'domaine-disparu' as ValidationSnapshot['domainId'],
        domainLabel: 'Mythologie',
      },
    })

    renderApp({ route: `/success/${validation.id}` })

    expect(
      await screen.findByRole('heading', { level: 1, name: "C'est noté !" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/mythologie/i)).toBeInTheDocument()
    expect(screen.getByText(MATHS_LABEL)).toBeInTheDocument()
  })

  it('affiche « sans photo » quand la validation n’a pas de photo', async () => {
    const lea = await addStudent('Léa', 'MS')
    const validation = await createValidation({
      studentId: lea.id,
      objective: objective('maths-nombres-05'),
      ageBand: 'from4',
      date: '2026-10-12',
      referentialVersion: REFERENTIAL_VERSION,
    })

    renderApp({ route: `/success/${validation.id}` })

    expect(await screen.findByText(/sans photo/)).toBeInTheDocument()
  })

  it('gère une validation introuvable sans planter', async () => {
    renderApp({ route: '/success/validation-disparue' })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Réussite introuvable' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour à la classe' })).toHaveAttribute(
      'href',
      '/',
    )
  })
})
