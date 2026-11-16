import {
  normalizeSearch,
  objectiveCountLabel,
  plural,
  studentCountLabel,
  studentFullName,
  studentInitials,
  successLabel,
  validationCountLabel,
} from './text'

describe('plural', () => {
  it('garde le singulier pour zéro et un', () => {
    expect(plural(0, 'élève', 'élèves')).toBe('0 élève')
    expect(plural(1, 'élève', 'élèves')).toBe('1 élève')
  })

  it('passe au pluriel à partir de deux', () => {
    expect(plural(2, 'élève', 'élèves')).toBe('2 élèves')
    expect(plural(12, 'élève', 'élèves')).toBe('12 élèves')
  })
})

describe('libellés de comptage', () => {
  it('accorde les réussites', () => {
    expect(successLabel(0)).toBe('0 réussite')
    expect(successLabel(1)).toBe('1 réussite')
    expect(successLabel(2)).toBe('2 réussites')
  })

  it('accorde les élèves', () => {
    expect(studentCountLabel(0)).toBe('0 élève')
    expect(studentCountLabel(1)).toBe('1 élève')
    expect(studentCountLabel(2)).toBe('2 élèves')
  })

  it('accorde les objectifs', () => {
    expect(objectiveCountLabel(0)).toBe('0 objectif')
    expect(objectiveCountLabel(1)).toBe('1 objectif')
    expect(objectiveCountLabel(2)).toBe('2 objectifs')
  })

  it('accorde les validations', () => {
    expect(validationCountLabel(0)).toBe('0 validation')
    expect(validationCountLabel(1)).toBe('1 validation')
    expect(validationCountLabel(2)).toBe('2 validations')
  })
})

describe('studentFullName', () => {
  it('rend le prénom seul sans initiale de nom', () => {
    expect(studentFullName({ firstName: 'Léa' })).toBe('Léa')
  })

  it('ajoute l’initiale du nom quand elle est renseignée', () => {
    expect(studentFullName({ firstName: 'Léa', lastNameInitial: 'M' })).toBe('Léa M.')
    expect(studentFullName({ firstName: 'Léa', lastNameInitial: '  M  ' })).toBe('Léa M.')
  })

  it('ignore une initiale vide ou faite d’espaces', () => {
    expect(studentFullName({ firstName: 'Léa', lastNameInitial: '' })).toBe('Léa')
    expect(studentFullName({ firstName: 'Léa', lastNameInitial: '   ' })).toBe('Léa')
  })
})

describe('studentInitials', () => {
  it('rend les initiales du prénom et du nom', () => {
    expect(studentInitials({ firstName: 'Léa', lastNameInitial: 'M' })).toBe('LM')
  })

  it('rend seulement l’initiale du prénom sans nom', () => {
    expect(studentInitials({ firstName: 'léa' })).toBe('L')
  })

  it('ignore une initiale vide', () => {
    expect(studentInitials({ firstName: 'Léa', lastNameInitial: '  ' })).toBe('L')
  })
})

describe('normalizeSearch', () => {
  it('retire la casse et les accents', () => {
    expect(normalizeSearch('Léa')).toBe('lea')
    expect(normalizeSearch('ÉCOLE')).toBe('ecole')
  })

  it('retire les espaces autour de la valeur', () => {
    expect(normalizeSearch('  mémoriser  ')).toBe('memoriser')
  })

  it('laisse une valeur déjà normalisée inchangée', () => {
    expect(normalizeSearch('maths')).toBe('maths')
  })
})
