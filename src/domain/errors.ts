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

/** Le navigateur n'a pas pu décoder le fichier image (HEIC, fichier corrompu…). */
export class ImageDecodeError extends Error {
  constructor(
    message = "Cette image n'a pas pu être lue. Reformatez-la en JPEG ou reprenez la photo.",
  ) {
    super(message)
    this.name = 'ImageDecodeError'
  }
}
