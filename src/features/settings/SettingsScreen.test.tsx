import { Blob as NodeBlob } from 'node:buffer'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SETTINGS_ID, db } from '@/db/db'
import { ensureSeed } from '@/db/seed'
import { getSettings, updateSettings } from '@/db/settings'
import { createValidation } from '@/db/validations'
import { REFERENTIAL_VERSION } from '@/domain/referential'
import type { Objective, SchoolYear } from '@/domain/types'
import { makeSchoolYear, makeStudent } from '@/test/fixtures'
import { renderApp } from '@/test/render'

const PRIVACY_KEY = 'privacy-ack'

const objective: Objective = {
  id: 'obj-rollover',
  competencyId: 'comp-langage-1',
  domainId: 'langage',
  label: 'Dire de mémoire un texte court',
  ageBands: ['from4'],
  examples: { from4: 'Réciter une comptine' },
  source: { bo: 'BO 2026' },
}

/**
 * Le `Blob` de jsdom ne survit pas au clone structuré de fake-indexeddb ;
 * celui de Node est conservé (même procédé que les tests du dossier photo).
 */
function jpegBlob(content: string): Blob {
  return new NodeBlob([content], { type: 'image/jpeg' }) as unknown as Blob
}

function acknowledgePrivacy(): void {
  localStorage.setItem(PRIVACY_KEY, '1')
}

/** Année 2026-2027 posée explicitement, indépendamment de la date du jour. */
async function setUpCurrentYear(year: SchoolYear = makeSchoolYear()): Promise<void> {
  await db.schoolYears.put(year)
  await updateSettings({ currentSchoolYearId: year.id })
}

/**
 * Remplace `navigator.storage` pour la durée d'un test. Le descripteur
 * d'origine est restauré après coup : jsdom peut le porter lui-même ou non.
 */
let originalStorage: PropertyDescriptor | undefined
let storageStubbed = false

function stubStorage(value: unknown): void {
  if (!storageStubbed) {
    originalStorage = Object.getOwnPropertyDescriptor(navigator, 'storage')
    storageStubbed = true
  }

  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value,
  })
}

/**
 * Fait échouer la lecture des années scolaires. La méthode est posée sur
 * l'instance de table puis retirée : le prototype Dexie reste intact.
 */
let originalSchoolYearsToArray: PropertyDescriptor | undefined
let schoolYearsReadStubbed = false

function stubSchoolYearsReadFailure(): void {
  originalSchoolYearsToArray = Object.getOwnPropertyDescriptor(
    db.schoolYears,
    'toArray',
  )
  schoolYearsReadStubbed = true

  Object.defineProperty(db.schoolYears, 'toArray', {
    configurable: true,
    value: async () => {
      throw new Error('IndexedDB indisponible')
    },
  })
}

beforeEach(async () => {
  localStorage.clear()
  await ensureSeed()
})

afterEach(() => {
  if (storageStubbed) {
    if (originalStorage === undefined) {
      Reflect.deleteProperty(navigator, 'storage')
    } else {
      Object.defineProperty(navigator, 'storage', originalStorage)
    }

    originalStorage = undefined
    storageStubbed = false
  }

  if (schoolYearsReadStubbed) {
    if (originalSchoolYearsToArray === undefined) {
      Reflect.deleteProperty(db.schoolYears, 'toArray')
    } else {
      Object.defineProperty(db.schoolYears, 'toArray', originalSchoolYearsToArray)
    }

    originalSchoolYearsToArray = undefined
    schoolYearsReadStubbed = false
  }
})

describe('SettingsScreen', () => {
  it('enregistre l’école, la classe et l’enseignante en supprimant les espaces superflus', async () => {
    acknowledgePrivacy()
    const user = userEvent.setup()

    renderApp({ route: '/settings' })

    const school = await screen.findByLabelText('Nom de l’école')
    const className = screen.getByLabelText('Classe')
    const teacher = screen.getByLabelText('Prénom de l’enseignante')

    await user.clear(school)
    await user.type(school, '  École des Tilleuls  ')
    await user.clear(className)
    await user.type(className, 'GS B')
    await user.clear(teacher)
    await user.type(teacher, 'Mme Perrin')

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Réglages enregistrés.')).toBeInTheDocument()
    await waitFor(async () => {
      const stored = await getSettings()
      expect(stored.schoolName).toBe('École des Tilleuls')
      expect(stored.className).toBe('GS B')
      expect(stored.teacherName).toBe('Mme Perrin')
    })
  })

  it('passe à l’année suivante sans supprimer élèves, réussites ni photos', async () => {
    acknowledgePrivacy()
    await setUpCurrentYear()
    const lea = makeStudent({ firstName: 'Léa' })
    await db.students.add(lea)
    const validation = await createValidation({
      studentId: lea.id,
      objective,
      ageBand: 'from4',
      date: '2026-10-12',
      referentialVersion: REFERENTIAL_VERSION,
      photo: {
        full: jpegBlob('photo'),
        thumb: jpegBlob('vignette'),
        width: 800,
        height: 600,
        mime: 'image/jpeg',
      },
    })
    const yearBefore = await db.schoolYears.get('2026-2027')

    const user = userEvent.setup()
    const { router } = renderApp({ route: '/settings' })
    await screen.findByLabelText('Nom de l’école')

    await user.click(screen.getByRole('button', { name: 'Passer à l’année suivante' }))

    const dialog = await screen.findByRole('dialog', {
      name: 'Passer à l’année suivante ?',
    })
    expect(dialog).toHaveTextContent('Aucune réussite ne sera supprimée.')
    expect(dialog).toHaveTextContent('2027-2028')

    await user.click(within(dialog).getByRole('button', { name: 'Ouvrir 2027-2028' }))

    await waitFor(async () => {
      expect((await getSettings()).currentSchoolYearId).toBe('2027-2028')
    })

    // La nouvelle année apparaît, l'ancienne ligne reste intacte.
    expect(await screen.findByText('2027-2028', { exact: true })).toBeInTheDocument()
    expect(await db.schoolYears.get('2026-2027')).toEqual(yearBefore)
    expect(await db.schoolYears.get('2027-2028')).toBeDefined()

    // Rien n'a été supprimé : élève, réussite et photo sont toujours là.
    expect(await db.students.get(lea.id)).toEqual(lea)
    expect(await db.validations.get(validation.id)).toBeDefined()
    expect(await db.photos.count()).toBe(1)

    // L'ancienne année reste sélectionnable dans les bilans.
    await act(async () => {
      await router.navigate('/bilans')
    })
    const yearSelect = await screen.findByRole('combobox', { name: 'Année scolaire' })
    expect(
      within(yearSelect).getByRole('option', { name: '2026-2027' }),
    ).toBeInTheDocument()
    expect(
      within(yearSelect).getByRole('option', { name: '2027-2028' }),
    ).toBeInTheDocument()
  })

  it('enregistre la date de changement pour l’année en cours sans toucher aux autres', async () => {
    acknowledgePrivacy()
    const previousYear = makeSchoolYear({
      id: '2025-2026',
      start: '2025-09-01',
      period1End: '2026-01-31',
      period2End: '2026-06-30',
    })
    await db.schoolYears.put(previousYear)
    await setUpCurrentYear()
    const previousBefore = await db.schoolYears.get('2025-2026')

    const user = userEvent.setup()
    renderApp({ route: '/settings' })
    await screen.findByLabelText('Nom de l’école')

    await user.click(
      screen.getByRole('button', { name: 'Modifier la date de changement' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Modifier la date de changement',
    })
    const input = within(dialog).getByLabelText('Date de changement de semestre')
    expect(input).toHaveValue('2027-01-31')

    fireEvent.change(input, { target: { value: '2027-01-15' } })
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(async () => {
      expect((await db.schoolYears.get('2026-2027'))?.period1End).toBe('2027-01-15')
    })
    expect(await db.schoolYears.get('2025-2026')).toEqual(previousBefore)
    expect(await screen.findByText('Date de changement enregistrée.')).toBeInTheDocument()
    expect(await screen.findByText(/15 janvier 2027/)).toBeInTheDocument()
  })

  it('enregistre la fin du bilan 2 pour l’année en cours seulement', async () => {
    acknowledgePrivacy()
    const previousYear = makeSchoolYear({
      id: '2025-2026',
      start: '2025-09-01',
      period1End: '2026-01-31',
      period2End: '2026-06-30',
    })
    await db.schoolYears.put(previousYear)
    await setUpCurrentYear()
    const previousBefore = await db.schoolYears.get('2025-2026')
    const currentBefore = await db.schoolYears.get('2026-2027')

    const user = userEvent.setup()
    renderApp({ route: '/settings' })
    await screen.findByLabelText('Nom de l’école')

    await user.click(
      screen.getByRole('button', { name: 'Modifier la date de changement' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Modifier la date de changement',
    })
    const endInput = within(dialog).getByLabelText('Fin du bilan 2')
    expect(endInput).toHaveValue('2027-06-30')

    fireEvent.change(endInput, { target: { value: '2027-06-15' } })
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(async () => {
      expect((await db.schoolYears.get('2026-2027'))?.period2End).toBe('2027-06-15')
    })

    const currentAfter = await db.schoolYears.get('2026-2027')
    expect(currentAfter?.start).toBe(currentBefore?.start)
    expect(currentAfter?.period1End).toBe(currentBefore?.period1End)
    expect(await db.schoolYears.get('2025-2026')).toEqual(previousBefore)
    expect(await screen.findByText(/15 juin 2027/)).toBeInTheDocument()
  })

  it('affiche l’espace utilisé et le quota quand l’API de stockage est disponible', async () => {
    acknowledgePrivacy()
    const estimate = vi.fn(async () => ({
      usage: 1572864,
      quota: 2147483648,
    }))
    stubStorage({ estimate })

    renderApp({ route: '/settings' })

    expect(await screen.findByText('1,5 Mo utilisés sur 2 Go')).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: 'Espace de stockage utilisé' }),
    ).toBeInTheDocument()
    expect(estimate).toHaveBeenCalledTimes(1)
  })

  it('demande un stockage persistant et affiche l’accord du navigateur', async () => {
    acknowledgePrivacy()
    let persistent = false
    const persist = vi.fn(async () => {
      persistent = true
      return true
    })
    const persisted = vi.fn(async () => persistent)
    stubStorage({
      estimate: vi.fn(async () => ({ usage: 1024, quota: 4096 })),
      persist,
      persisted,
    })

    const user = userEvent.setup()
    renderApp({ route: '/settings' })

    await user.click(
      await screen.findByRole('button', { name: 'Demander un stockage persistant' }),
    )

    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1))
    expect(persisted).toHaveBeenCalled()
    expect(await screen.findByText(/Stockage persistant accordé/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Demander un stockage persistant' }),
    ).not.toBeInTheDocument()
  })

  it('ne propose pas la demande quand le stockage est déjà persistant', async () => {
    acknowledgePrivacy()
    stubStorage({
      persist: vi.fn(async () => true),
      persisted: vi.fn(async () => true),
    })

    renderApp({ route: '/settings' })

    expect(await screen.findByText(/Stockage persistant accordé/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Demander un stockage persistant' }),
    ).not.toBeInTheDocument()
  })

  it('affiche un message de repli quand l’API de stockage n’est pas disponible', async () => {
    acknowledgePrivacy()
    stubStorage(undefined)

    renderApp({ route: '/settings' })

    expect(
      await screen.findByText(/Ce navigateur ne permet pas de demander un stockage persistant/),
    ).toBeInTheDocument()
    expect(screen.getByText(/ne fournit pas d.estimation/)).toBeInTheDocument()
  })

  it('affiche la notice de confidentialité au premier lancement, puis ne la montre plus', async () => {
    const user = userEvent.setup()
    const first = renderApp({ route: '/settings' })

    const dialog = await screen.findByRole('dialog', {
      name: 'Tes données restent sur ton appareil',
    })
    expect(dialog).toHaveTextContent(/aucun compte/i)
    expect(dialog).toHaveTextContent(/photos/i)

    await user.click(within(dialog).getByRole('button', { name: /J.ai compris/ }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(localStorage.getItem(PRIVACY_KEY)).toBe('1')

    first.unmount()
    renderApp({ route: '/settings' })
    await screen.findByRole('heading', { level: 1, name: 'Réglages' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ne mémorise pas la notice fermée sans « J’ai compris »', async () => {
    const user = userEvent.setup()
    const first = renderApp({ route: '/settings' })

    const dialog = await screen.findByRole('dialog', {
      name: 'Tes données restent sur ton appareil',
    })
    expect(dialog).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(localStorage.getItem(PRIVACY_KEY)).toBeNull()

    first.unmount()
    renderApp({ route: '/settings' })

    expect(
      await screen.findByRole('dialog', {
        name: 'Tes données restent sur ton appareil',
      }),
    ).toBeInTheDocument()
  })

  it('affiche la version de l’application', async () => {
    acknowledgePrivacy()
    renderApp({ route: '/settings' })

    expect(await screen.findByText(`Version ${__APP_VERSION__}`)).toBeInTheDocument()
  })

  it('signale une base illisible sans masquer le stockage ni la version', async () => {
    acknowledgePrivacy()
    renderApp({ route: '/settings' })
    await screen.findByLabelText('Nom de l’école')

    // La ligne des réglages disparaît : la lecture en direct doit remonter une
    // panne claire au lieu de laisser l'écran en chargement perpétuel.
    await db.settings.delete(SETTINGS_ID)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /n.ont pas pu être chargés/,
    )
    expect(screen.getByRole('heading', { name: 'Stockage' })).toBeInTheDocument()
    expect(screen.getByText(`Version ${__APP_VERSION__}`)).toBeInTheDocument()
  })

  it('affiche une alerte si les années ne peuvent pas être lues, sans casser le formulaire', async () => {
    acknowledgePrivacy()
    stubSchoolYearsReadFailure()

    renderApp({ route: '/settings' })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Les données de l.année n.ont pas pu être lues/,
    )
    expect(screen.getByLabelText('Nom de l’école')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Stockage' })).toBeInTheDocument()
    expect(screen.getByText(`Version ${__APP_VERSION__}`)).toBeInTheDocument()
  })
})
