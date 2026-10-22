/**
 * Fabrique un identifiant opaque préfixé par son domaine (`stu_`, `val_`,
 * `photo_`…). Le préfixe rend les identifiants lisibles dans la base et les
 * exports, sans dépendre d'un ordre de création.
 */
export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}
