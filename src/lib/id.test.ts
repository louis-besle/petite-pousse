import { newId } from './id'

describe('newId', () => {
  it('préfixe l’identifiant avec le domaine demandé', () => {
    expect(newId('stu')).toMatch(/^stu_/)
  })

  it('génère un identifiant différent à chaque appel', () => {
    expect(newId('stu')).not.toBe(newId('stu'))
  })
})
