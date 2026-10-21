/**
 * Erreurs métier partagées par les dépôts. Les messages sont destinés à
 * l'utilisateur : ils sont affichés tels quels dans les écrans.
 */

/** Une réussite ne peut être validée qu'une seule fois pour un élève donné. */
export class AlreadyValidatedError extends Error {
  constructor(message = 'Cette réussite est déjà validée pour cet élève.') {
    super(message)
    this.name = 'AlreadyValidatedError'
  }
}
