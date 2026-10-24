import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { ensureSeed } from '@/db/seed'
import { updateSettings } from '@/db/settings'
import { createValidation } from '@/db/validations'
import { REFERENTIAL_VERSION, referential } from '@/domain/referential'
import type { AgeBand, Objective, Section } from '@/domain/types'
import { schoolYearIdForDate } from '@/domain/schoolYear'
import { todayIso } from '@/lib/date'
import { makeSchoolYear, makeStudent } from '@/test/fixtures'
import { renderApp } from '@/test/render'

const LANGAGE_1 = objective('lang-vocabulaire-01')
const LANGAGE_2 = objective('lang-vocabulaire-02')
const LANGAGE_3 = objective('lang-vocabulaire-03')
const MATHS_5 = objective('maths-nombres-05')

function objective(id: string): Objective {
  const found = referential.objectives.find((candidate) => candidate.id === id)
  if (found === undefined) {
    throw new Error(`Objectif de test introuvable : ${id}`)
  }
  return found
}

async function addStudent(
  firstName: string,
  section: Section,
  lastNameInitial?: string,
) {
  const student = makeStudent({
    firstName,
    section,
    ...(lastNameInitial === undefined ? {} : { lastNameInitial }),
  })
  await db.students.add(student)
  return student
}

async function addValidation(
  studentId: string,
  objectiveId: string,
  date: string,
  ageBand?: AgeBand,
) {
  const found = objective(objectiveId)

  return createValidation({
    studentId,
    objective: found,
    ageBand: ageBand ?? found.ageBands[0],
    date,
    referentialVersion: REFERENTIAL_VERSION,
  })
}

/** Ligne d'objectif : le `li` qui porte le bouton d'ouverture et la barre. */
function objectiveItem(label: string): HTMLElement {
  const node = screen.getByText(label)
  const item = node.closest('li')
  if (!(item instanceof HTMLElement)) {
    throw new Error(`Ligne d’objectif introuvable : ${label}`)
  }
  return item
}

/** Toute la ligne est cliquable via le bouton qui la recouvre. */
async function openObjective(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
): Promise<void> {
  await user.click(within(objectiveItem(label)).getByRole('button'))
}

function levelFilters(): HTMLElement {
  return screen.getByRole('group', { name: 'Filtrer par niveau' })
}

/** Réduit le nombre de lignes rendues avant d'ouvrir une fiche précise. */
async function searchObjective(term: string): Promise<void> {
  const search = await screen.findByRole('searchbox', {
    name: 'Rechercher un objectif',
  })
  fireEvent.change(search, { target: { value: term } })
}

beforeEach(async () => {
  await ensureSeed()
})

describe('ProgrammeScreen', () => {
  it('filtre les objectifs par niveau et par recherche plein texte', async () => {
    await addStudent('Léa', 'MS')
    await addStudent('Adam', 'PS')
    await addStudent('Zoé', 'GS')

    const user = userEvent.setup()
    renderApp({ route: '/programme' })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Programme' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Les six domaines du programme 2026 et le programme EVAR, objectif par objectif',
      ),
    ).toBeInTheDocument()

    // Le premier domaine officiel est déplié par défaut.
    const langage = await screen.findByRole('region', { name: 'Langage' })
    expect(within(langage).getByText(LANGAGE_1.label)).toBeInTheDocument()
    expect(within(langage).getByText(LANGAGE_3.label)).toBeInTheDocument()

    // PS/MS : l'objectif « à partir de 5 ans » disparaît.
    await user.click(within(levelFilters()).getByRole('button', { name: 'MS' }))
    expect(within(langage).queryByText(LANGAGE_3.label)).not.toBeInTheDocument()
    expect(within(langage).getByText(LANGAGE_1.label)).toBeInTheDocument()

    // GS : inversement.
    await user.click(within(levelFilters()).getByRole('button', { name: 'GS' }))
    await waitFor(() =>
      expect(within(langage).getByText(LANGAGE_3.label)).toBeInTheDocument(),
    )
    expect(within(langage).queryByText(LANGAGE_1.label)).not.toBeInTheDocument()

    // Recherche insensible aux accents, sur l'intitulé.
    const search = screen.getByRole('searchbox', { name: 'Rechercher un objectif' })
    fireEvent.change(search, { target: { value: 'memoriser' } })
    expect(await screen.findByText(LANGAGE_3.label)).toBeInTheDocument()

    // Recherche sur le nom du domaine : le domaine correspondant s'ouvre.
    await user.click(within(levelFilters()).getByRole('button', { name: 'Tous' }))
    fireEvent.change(search, { target: { value: 'maths' } })
    expect(await screen.findByText(MATHS_5.label)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Maths' })).toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'zzzz' } })
    expect(await screen.findByText('Aucun objectif ne correspond.')).toBeInTheDocument()
  })

  it('ouvre un objectif et montre les élèves qui l’ont validé, toutes années confondues', async () => {
    const lea = await addStudent('Léa', 'MS', 'M')
    const adam = await addStudent('Adam', 'PS')
    await addValidation(lea.id, 'lang-vocabulaire-01', '2026-10-12')
    await addValidation(adam.id, 'lang-vocabulaire-01', '2025-10-12')

    const user = userEvent.setup()
    renderApp({ route: '/programme' })

    await searchObjective('memoriser')
    await screen.findByText(LANGAGE_1.label)
    await openObjective(user, LANGAGE_1.label)

    const sheet = await screen.findByRole('dialog')
    expect(
      within(sheet).getByRole('heading', { name: LANGAGE_1.label }),
    ).toBeInTheDocument()
    expect(
      within(sheet).getByText(
        'Le développement et la structuration du langage oral et écrit',
      ),
    ).toBeInTheDocument()
    expect(within(sheet).getByText('PS · MS')).toBeInTheDocument()
    // Tous les exemples déclarés, avec leur tranche d'âge.
    expect(within(sheet).getByText('Avant 4 ans')).toBeInTheDocument()
    expect(within(sheet).getByText('À partir de 4 ans')).toBeInTheDocument()
    expect(
      within(sheet).getByText(LANGAGE_1.examples.before4 ?? ''),
    ).toBeInTheDocument()
    // La liste est globale : une validation de l'année précédente compte aussi.
    expect(within(sheet).getByText('Déjà validé par 2 élèves')).toBeInTheDocument()

    const validated = within(sheet).getByRole('list', {
      name: 'Élèves ayant validé cet objectif',
    })
    expect(within(validated).getByText('LM')).toBeInTheDocument()
    expect(within(validated).getByText('A')).toBeInTheDocument()
    // Noms complets accessibles.
    expect(within(validated).getByText('Léa M.')).toBeInTheDocument()
    expect(within(validated).getByText('Adam')).toBeInTheDocument()
  })

  it('valide une réussite sans photo, ferme la fiche et met à jour le compteur', async () => {
    const lea = await addStudent('Léa', 'MS')
    await addStudent('Adam', 'PS')

    const user = userEvent.setup()
    renderApp({ route: '/programme' })

    await searchObjective('memoriser')
    await screen.findByText(LANGAGE_1.label)
    await openObjective(user, LANGAGE_1.label)

    const sheet = await screen.findByRole('dialog')
    expect(
      within(sheet).queryByRole('list', { name: 'Élèves ayant validé cet objectif' }),
    ).not.toBeInTheDocument()

    await user.click(
      within(sheet).getByRole('button', { name: 'Valider pour un élève' }),
    )
    await user.click(within(sheet).getByRole('button', { name: /^Léa/ }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(await screen.findByText('Réussite ajoutée à Léa.')).toBeInTheDocument()

    const stored = await db.validations.toArray()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      studentId: lea.id,
      objectiveId: 'lang-vocabulaire-01',
      date: todayIso(),
      schoolYearId: schoolYearIdForDate(todayIso()),
    })
    expect(stored[0]?.snapshot.ageBand).toBe('from4')
    expect(stored[0]?.photoId).toBeUndefined()
    expect(await db.photos.count()).toBe(0)

    const updatedLangage = screen.getByRole('region', { name: 'Langage' })
    await waitFor(() =>
      expect(within(updatedLangage).getByText('1 élève')).toBeInTheDocument(),
    )
  })

  it('désactive un élève qui a déjà validé l’objectif, même une autre année', async () => {
    const lea = await addStudent('Léa', 'MS')
    await addStudent('Adam', 'PS')
    await addValidation(lea.id, 'lang-vocabulaire-02', '2025-10-12')

    const user = userEvent.setup()
    renderApp({ route: '/programme' })

    await searchObjective('organiser')
    await screen.findByText(LANGAGE_2.label)
    await openObjective(user, LANGAGE_2.label)

    const sheet = await screen.findByRole('dialog')
    await user.click(
      within(sheet).getByRole('button', { name: 'Valider pour un élève' }),
    )

    const leaButton = within(sheet).getByRole('button', { name: /^Léa/ })
    expect(leaButton).toBeDisabled()
    expect(within(leaButton).getByText(/déjà validé/i)).toBeInTheDocument()

    expect(within(sheet).getByRole('button', { name: /^Adam/ })).toBeEnabled()
  })

  it('rapporte la barre d’avancement à l’effectif du niveau filtré', async () => {
    const ps1 = await addStudent('Ana', 'PS')
    await addStudent('Basile', 'PS')
    const ms1 = await addStudent('Cléo', 'MS')
    await addStudent('Dina', 'MS')
    await addStudent('Eli', 'MS')
    const gs1 = await addStudent('Félix', 'GS')

    await addValidation(ps1.id, 'maths-nombres-05', '2026-10-12')
    await addValidation(ms1.id, 'maths-nombres-05', '2026-10-12')
    await addValidation(gs1.id, 'maths-nombres-05', '2026-10-12')

    const user = userEvent.setup()
    renderApp({ route: '/programme' })

    await searchObjective('comparer des quantités')
    await screen.findByText(MATHS_5.label)
    expect(screen.getByRole('region', { name: 'Maths' })).toBeInTheDocument()

    const bar = within(objectiveItem(MATHS_5.label)).getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '6')
    expect(bar).toHaveAttribute('aria-valuenow', '3')

    await user.click(within(levelFilters()).getByRole('button', { name: 'MS' }))

    await waitFor(() =>
      expect(
        within(objectiveItem(MATHS_5.label)).getByRole('progressbar'),
      ).toHaveAttribute('aria-valuemax', '3'),
    )
    const filteredBar = within(objectiveItem(MATHS_5.label)).getByRole('progressbar')
    expect(filteredBar).toHaveAttribute('aria-valuenow', '1')
    expect(filteredBar).toHaveAccessibleName(/1 élève sur 3/)
  })

  it('bascule sur l’année de la validation après une validation rapide hors année courante', async () => {
    await db.schoolYears.add(
      makeSchoolYear({
        id: '2025-2026',
        start: '2025-09-01',
        period1End: '2026-01-31',
        period2End: '2026-06-30',
      }),
    )
    await addStudent('Léa', 'MS')
    const adam = await addStudent('Adam', 'PS')
    await addValidation(adam.id, 'lang-vocabulaire-02', '2025-10-12')

    const user = userEvent.setup()
    renderApp({ route: '/programme' })

    const yearSelect = await screen.findByRole('combobox', { name: 'Année scolaire' })
    await user.selectOptions(yearSelect, '2025-2026')
    await waitFor(() => expect(yearSelect).toHaveValue('2025-2026'))

    await searchObjective('2 par période')
    await screen.findByText(LANGAGE_1.label)
    await openObjective(user, LANGAGE_1.label)
    const sheet = await screen.findByRole('dialog')
    await user.click(
      within(sheet).getByRole('button', { name: 'Valider pour un élève' }),
    )
    await user.click(within(sheet).getByRole('button', { name: /^Léa/ }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    // La validation est datée d'aujourd'hui : le sélecteur bascule sur l'année
    // de la validation pour que le compteur mis à jour soit visible.
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Année scolaire' })).toHaveValue(
        schoolYearIdForDate(todayIso()),
      ),
    )
  })

  it('conserve « Toutes les années » et compte les validations de deux années', async () => {
    await addStudent('Léa', 'MS')
    const adam = await addStudent('Adam', 'PS')
    const zoe = await addStudent('Zoé', 'GS')
    await addValidation(adam.id, 'lang-vocabulaire-02', '2025-10-12', 'before4')
    await addValidation(zoe.id, 'lang-vocabulaire-02', '2026-10-12', 'from5')

    const user = userEvent.setup()
    renderApp({ route: '/programme' })

    const yearSelect = await screen.findByRole('combobox', { name: 'Année scolaire' })
    await user.selectOptions(yearSelect, 'all')
    await waitFor(() => expect(yearSelect).toHaveValue('all'))

    await searchObjective('organiser')
    await screen.findByText(LANGAGE_2.label)
    expect(within(objectiveItem(LANGAGE_2.label)).getByText('2 élèves')).toBeInTheDocument()

    await openObjective(user, LANGAGE_2.label)
    const sheet = await screen.findByRole('dialog')
    await user.click(
      within(sheet).getByRole('button', { name: 'Valider pour un élève' }),
    )
    await user.click(within(sheet).getByRole('button', { name: /^Léa/ }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(await screen.findByText('Réussite ajoutée à Léa.')).toBeInTheDocument()

    // « Toutes les années » reste le filtre choisi : la nouvelle ligne y est déjà.
    expect(screen.getByRole('combobox', { name: 'Année scolaire' })).toHaveValue('all')
    await waitFor(() =>
      expect(within(objectiveItem(LANGAGE_2.label)).getByText('3 élèves')).toBeInTheDocument(),
    )
  })

  it('bascule sur l’année de la validation quand les réglages sont restés sur une année antérieure', async () => {
    // Simule un septembre avant la bascule explicite : `ensureSeed` ne fait
    // jamais avancer les réglages tout seul.
    await updateSettings({ currentSchoolYearId: '2025-2026' })
    await addStudent('Léa', 'MS')

    const user = userEvent.setup()
    renderApp({ route: '/programme' })

    const yearSelect = await screen.findByRole('combobox', { name: 'Année scolaire' })
    await waitFor(() => expect(yearSelect).toHaveValue('2025-2026'))

    await searchObjective('2 par période')
    await screen.findByText(LANGAGE_1.label)
    await openObjective(user, LANGAGE_1.label)
    const sheet = await screen.findByRole('dialog')
    await user.click(
      within(sheet).getByRole('button', { name: 'Valider pour un élève' }),
    )
    await user.click(within(sheet).getByRole('button', { name: /^Léa/ }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )

    // La validation appartient à l'année de sa date, pas à l'année des réglages.
    const validationYear = schoolYearIdForDate(todayIso())
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Année scolaire' })).toHaveValue(
        validationYear,
      ),
    )
    await waitFor(() =>
      expect(within(objectiveItem(LANGAGE_1.label)).getByText('1 élève')).toBeInTheDocument(),
    )
  })

  it('affiche le programme EVAR après les six domaines, objectif par objectif', async () => {
    await addStudent('Léa', 'MS')

    const user = userEvent.setup()
    renderApp({ route: '/programme' })

    // Le groupe EVAR est le dernier des sept domaines.
    const domainToggles = await screen.findAllByRole('button', { name: /objectifs ·/ })
    expect(domainToggles.at(-1)).toHaveAccessibleName(/^EVAR/)

    await user.click(within(levelFilters()).getByRole('button', { name: 'MS' }))
    await user.click(screen.getByRole('button', { name: /^EVAR/ }))

    const evar = await screen.findByRole('region', { name: 'EVAR' })
    expect(within(evar).getAllByRole('listitem')).toHaveLength(3)

    const evarLabels = referential.objectives
      .filter(
        (objective) =>
          objective.domainId === 'evar' && objective.ageBands.includes('from4'),
      )
      .map((objective) => objective.label)
    for (const label of evarLabels) {
      expect(within(evar).getByText(label)).toBeInTheDocument()
    }

    // Les objectifs des autres tranches d'âge ne s'affichent pas.
    const before4Label = objective('evar-corps-avant4').label
    expect(within(evar).queryByText(before4Label)).not.toBeInTheDocument()
  })

  it('affiche le nombre d’objectifs filtrés et de validations par domaine', async () => {
    const lea = await addStudent('Léa', 'MS')
    const adam = await addStudent('Adam', 'PS')
    await addValidation(lea.id, 'lang-vocabulaire-01', '2026-10-12')
    await addValidation(adam.id, 'lang-vocabulaire-02', '2026-10-12')

    const user = userEvent.setup()
    renderApp({ route: '/programme' })

    const langageToggle = await screen.findByRole('button', { name: /^Langage/ })
    const langageObjectives = referential.objectives.filter(
      (objective) => objective.domainId === 'langage',
    )
    expect(langageToggle).toHaveTextContent(
      `${langageObjectives.length} objectifs · 2 validations`,
    )

    await user.click(within(levelFilters()).getByRole('button', { name: 'PS' }))
    const psObjectives = langageObjectives.filter((objective) =>
      objective.ageBands.includes('before4'),
    )
    await waitFor(() =>
      expect(langageToggle).toHaveTextContent(
        `${psObjectives.length} objectifs · 2 validations`,
      ),
    )
  })
})
