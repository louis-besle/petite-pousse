/**
 * Télécharge un blob sous un nom de fichier. Le lien temporaire est retiré du
 * document et l'URL d'objet révoquée dès le clic : rien ne reste en mémoire.
 *
 * `revokeObjectURL` est absent de certains navigateurs anciens ou de certains
 * environnements de test : son absence ne doit jamais empêcher le téléchargement.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.hidden = true
  document.body.append(anchor)

  try {
    anchor.click()
  } finally {
    anchor.remove()
    // iOS Safari peut annuler le téléchargement si l'URL d'objet est révoquée
    // dans la même tâche que le clic. On laisse la boucle d'événements finir.
    setTimeout(() => {
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(url)
      }
    }, 0)
  }
}

/**
 * Partage un PDF via la feuille de partage native quand elle accepte les
 * fichiers ; sinon, le télécharge.
 *
 * Une annulation de l'utilisateur (`AbortError`) remonte telle quelle : elle ne
 * doit jamais déclencher un téléchargement de repli surprise.
 */
export async function sharePdf(
  bytes: Uint8Array,
  filename: string,
): Promise<'shared' | 'downloaded'> {
  // Copie dans un ArrayBuffer neutre : `Uint8Array` peut porter un buffer
  // partagé, que le constructeur `File` n'accepte pas.
  const buffer = new Uint8Array(bytes).buffer
  const file = new File([buffer], filename, { type: 'application/pdf' })
  const files = [file]

  if (navigator.canShare?.({ files }) === true) {
    await navigator.share({ files, title: filename })
    return 'shared'
  }

  downloadBlob(file, filename)
  return 'downloaded'
}
