# Audit d’accessibilité — Carnet de réussites

**Date de l’audit :** 7 novembre 2026  
**Version auditée :** `main` après les correctifs de cet audit (référentiel 2026.1.0)  
**Normes de référence :** WCAG 2.1 AA, WCAG 2.2 AA, RGAA 4.1.2

## 1. Synthèse

**Verdict : partiellement conforme.**

- **WCAG 2.1 / 2.2 A et AA :** aucune violation détectée par axe sur les **19 états audités** (13 écrans et 6 feuilles modales). Les vérifications clavier, focus, contraste, reflow, espacement du texte, orientation et mouvement réduit passent. Un contrôle complémentaire est rejoué sur **WebKit**, le moteur de Safari sur iPhone et iPad.
- **RGAA 4.1.2 :** les 106 critères ont été examinés. **57 sont conformes**, **47 sont non applicables** (aucune vidéo, aucun tableau, aucun cadre, etc.), **1 est partiel** et **1 est non conforme** :
  - **7.1** — compatibilité avec les technologies d’assistance : testée sur Chromium et WebKit, mais **aucune matrice VoiceOver / TalkBack n’a encore été exécutée sur appareil réel**. Le protocole est prêt : [`PROTOCOLE-LECTEURS-ECRAN.md`](./PROTOCOLE-LECTEURS-ECRAN.md) ;
  - **13.3** — le PDF généré n’est **pas un PDF balisé** : le critère reste **non conforme**. L’aperçu HTML A4 équivalent, annoncé à l’écran, est la version accessible et la mesure compensatoire.
- **Taux de conformité sur les critères applicables : 57 / 59 = 96,6 %.** Un taux de 100 % et l’absence de critère partiel ou non conforme sont nécessaires pour déclarer une conformité RGAA. Le résultat est donc **partiellement conforme**, et non « conforme ».

> Cet audit est un audit technique du produit. Il ne remplace ni une déclaration d’accessibilité légale, ni un audit RGAA contradictoire avec un échantillon représentatif et une matrice de technologies d’assistance.

## 2. Périmètre audité

### Écrans

| Écran | Route |
| --- | --- |
| La classe | `/` |
| Choix de l’élève | `/capture` |
| Capture — photo | `/capture/:studentId/photo` |
| Capture — objectif | `/capture/objective` |
| Dossier de l’élève | `/students/:studentId` |
| Gestion des élèves | `/students` |
| Programme | `/programme` |
| Bilans | `/bilans` |
| Aperçu du bilan A4 | `/bilans/:studentId?period=1&year=2026-2027` |
| Réglages | `/settings` |
| Succès | `/success/:validationId` |
| Page introuvable | `/inconnu` |

### Feuilles modales

| Feuille | Déclencheur |
| --- | --- |
| Fiche objectif | Ligne du programme |
| Fiche réussite | Ligne du dossier |
| Formulaire élève | « Ajouter un élève » |
| Confirmation de suppression | « Supprimer Léa » |
| Dates de bilan | « Modifier la date de changement » |
| Notice de confidentialité | « Relire la notice » |

### Environnement

- Application servie localement par Vite (`localhost:4173`) sur la révision auditée ; la production sera à re-vérifier après déploiement.
- Chromium via Playwright 1.65, viewport téléphone 390 × 844, plus 320 × 640 et 640 × 320.
- WebKit via Playwright 1.65 (`npx playwright test --project=webkit`), viewport iPhone 390 × 844, tactile : contrôle de non-régression complémentaire sur le moteur de Safari iOS.
- `@axe-core/playwright` 4.14.0, règles `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.
- Validateur HTML du W3C (validator.nu).
- Calculs de contraste WCAG 2.x (luminance relative).
- Pas de test avec lecteur d’écran réel : VoiceOver, NVDA, JAWS et TalkBack restent à exécuter. Le protocole complet est fourni dans [`PROTOCOLE-LECTEURS-ECRAN.md`](./PROTOCOLE-LECTEURS-ECRAN.md).

## 3. Méthode

1. **Analyse automatisée** de chaque écran et de chaque feuille avec axe, sans filtrer les violations par gravité : l’objectif est zéro violation A/AA.
2. **Vérification manuelle et calculée** des points qu’axe ne sait pas trancher : contrastes sur fonds translucides, composants non textuels, ordre de tabulation, focus visible, piège de focus, annonce des changements de contexte.
3. **Tests de mise en page** : reflow à 320 px, espacement du texte, orientation paysage, `prefers-reduced-motion`, contenu sans CSS.
4. **Validation du DOM rendu** avec le validateur W3C sur cinq routes représentatives.
5. **Revue des 106 critères RGAA 4.1.2**, avec statut et preuve dans la matrice annexe.

## 4. Résultats automatisés

### axe

- **19 états audités**, **0 violation** WCAG A/AA.
- Les 28 tests E2E d’accessibilité passent : `e2e/a11y.spec.ts`.
- Un seul résultat **incomplet** subsiste, sur la notice de confidentialité : axe ne peut pas calculer le contraste lorsqu’une feuille modale recouvre la page. Vérification manuelle : texte atténué `#6b6154` sur papier `#fbf6ec` = **5,63:1**, conforme.

### WebKit — preuve complémentaire

`e2e/webkit.spec.ts` rejoue dans WebKit, au format iPhone 13 (390 × 844, tactile), les parcours critiques : chargement et titre, classe, filtre du programme, validation d’une capture, aperçu HTML du bilan et analyse axe des écrans principaux. Aucune violation WCAG A/AA n’y est détectée.

Cette preuve **complète** Chromium : elle vérifie que le moteur de Safari iOS ne casse ni la sémantique, ni le focus, ni les styles. Elle **ne remplace pas** les tests VoiceOver et TalkBack, qui restent à exécuter sur appareil réel — voir le § 7.2.

**Limite de l’environnement.** Le WebKit fourni par Playwright sous Windows refuse l’écriture d’un `Blob` de photo dans IndexedDB (`UnknownError: Error preparing Blob/File data to be stored in object store`). Le test WebKit couvre donc une validation de capture **sans photo** ; le parcours photo complet reste vérifié par le protocole manuel sur appareil réel. Cette limitation doit être reconfirmée sur Safari iOS physique, où le stockage de photos est un usage courant.

### Validateur HTML du W3C

DOM rendu contrôlé sur `/`, `/programme`, `/bilans`, `/settings` et `/students` : **0 erreur**. Les snapshots HTML ont été envoyés après exécution du JavaScript. Les états dynamiques non échantillonnés (feuilles ouvertes, erreurs) ne sont pas couverts par ce contrôle, mais les cinq écrans principaux confirment la validité du document et des composants rendus.

### Contrastes calculés

| Paire | Ratio |
| --- | ---: |
| Encre sur papier | 13,19:1 |
| Encre sur carte | 13,88:1 |
| Texte atténué sur papier | 5,63:1 |
| Texte atténué sur carte | 5,92:1 |
| Moutarde sur fond moutarde | 5,12:1 |
| Langage sur fond doux | 4,83:1 |
| Maths sur fond doux | 5,46:1 |
| Corps sur fond doux | 5,59:1 |
| Arts sur fond doux | 5,12:1 |
| Temps sur fond doux | 5,67:1 |
| Vivant sur fond doux | 4,72:1 |
| Crème sur encre | 13,48:1 |
| Crème sur sauge profonde | 5,75:1 |
| Crème sur terre profonde | 5,04:1 |
| Encre sur terre (bouton principal) | 4,53:1 |
| Bordure interactive sur carte | 3,59:1 |
| Focus encre sur papier | 13,19:1 |
| Rose profond sur rose doux | 4,67:1 |
| Ciel profond sur ciel doux | 5,10:1 |

Tous les textes atteignent **4,5:1** ; les composants d’interface et éléments graphiques atteignent **3:1**.

## 5. Vérifications manuelles

### Clavier et focus

- Le **lien d’évitement** est le premier élément atteint au clavier et place le focus sur `main#main`.
- Les **feuilles modales** déplacent le focus dans le panneau, piègent la tabulation, se ferment avec **Échap** et rendent le focus au déclencheur.
- Le **focus visible** est conservé : contour encre de 2 px, contraste 13,19:1.
- L’ordre de tabulation suit l’ordre du DOM et l’ordre visuel.
- Aucun piège clavier hors feuille modale.

### Changement de contexte

- Chaque route possède un **titre de page** distinct : « La classe », « Programme », « Aperçu du bilan », etc.
- Un changement de route déplace le focus sur `main#main`, ce qui permet aux lecteurs d’écran d’annoncer le nouvel écran.
- Les chargements utilisent `role="status"`, les erreurs `role="alert"` et les toasts une région `aria-live="polite"` persistante.

### Reflow et adaptation

- Aucun débordement horizontal de page à **320 px** sur les 11 routes testées.
- Contenu et navigation restent visibles **sans CSS**.
- Espacements du texte augmentés (interligne 1,5, lettrage 0,12 em, espacement des mots 0,16 em) : aucun débordement.
- Orientation paysage 640 × 320 : aucun débordement.
- `prefers-reduced-motion: reduce` neutralise animations et transitions.
- L’aperçu A4 possède son propre défilement horizontal : c’est un contenu bidimensionnel assumé, il ne provoque pas de double défilement de la page.

### Couleurs et composants

- L’information n’est jamais portée par la couleur seule : les domaines, statuts et sections associent toujours un libellé ou une icône.
- Les bordures des composants interactifs utilisent `--line-strong` (`#a08054`) pour dépasser 3:1 sur la carte.
- Les icônes de validation, les pastilles et les boutons atteignent au moins 3:1.
- Les états désactivés restent compréhensibles : le texte est atténué mais le contrôle est identifiable.

## 6. Corrections apportées pendant l’audit

- Moutarde : `#9a7420` → `#7f5d10` (5,12:1 sur fond moutarde au lieu de 3,64:1).
- Inks de domaines assombris : maths `#3f6277`, corps `#8f3f38`, arts `#7f5d10`, temps `#74503a`.
- Rose et ciel profonds ajustés : `#9e4a43` et `#41647a`.
- Ajout de `--line-strong` pour les bordures des champs, boutons, filtres, cartes cliquables et sélecteurs.
- Navigation basse rendue **opaque** : suppression du fond translucide et du `backdrop-filter`, qui empêchaient de garantir le contraste.
- Ligne d’objectif du programme transformée en **un seul bouton** : le libellé, le niveau et le compteur font partie du nom accessible, sans bouton transparent superposé.
- Puces du viseur photo rendues **opaques** (encre) au lieu d’un fond translucide sur un dégradé.
- Badge « Photo prise » passé sur `--sage-ink` (5,75:1).
- Bouton flottant du dossier passé sur `--terra-deep` (5,04:1).
- Lien enseignant : initiale visible intégrée au nom accessible, sans `aria-hidden` contradictoire.
- Focus global passé de la terre cuite (2,91:1 sur papier) à l’encre (13,19:1).
- Titres de page et focus sur le contenu ajoutés à chaque changement de route.
- PDF : ajout des métadonnées auteur et langue ; la note de l’aperçu précise que **l’aperçu HTML est la version accessible** et que le PDF est destiné à l’impression.

## 7. Points de vigilance et limites

### 7.1 PDF non balisé — RGAA 13.3 non conforme

Le PDF est produit par `pdf-lib`. Il contient du texte réel, des métadonnées (titre, auteur, sujet, langue `fr-FR`) et des images, mais il n’est **pas balisé** : pas d’ordre de lecture structuré, pas d’alternatives textuelles intégrées aux images, pas de tableau de structure. Un lecteur d’écran peut lire le texte, mais l’expérience n’est pas équivalente à un PDF/UA. **Le critère 13.3 reste donc non conforme pour ce fichier.**

**Mesure compensatoire :** l’aperçu HTML A4 à l’écran est complet, sémantique et annoncé comme la version accessible (note « L’aperçu à l’écran est la version accessible ; le PDF… est destiné à l’impression »). Le PDF reste un format d’impression. Pour une conformité stricte 13.3, il faudrait produire un PDF/UA (par exemple avec un moteur de mise en page balisé) ou retirer le téléchargement PDF au profit de l’impression navigateur. L’étape 10 du protocole manuel vérifie cet aperçu avec lecteur d’écran.

### 7.2 Technologies d’assistance — RGAA 7.1 partiel, matrice sur appareil en attente

Les tests sont exécutés sur Chromium **et sur WebKit** avec l’arbre d’accessibilité du navigateur. Aucun test réel n’a été mené avec :

- NVDA + Firefox ou Chrome sur Windows ;
- JAWS + Chrome ;
- VoiceOver + Safari sur macOS, iPhone et iPad ;
- TalkBack + Chrome sur Android.

Les sémantiques DOM, les noms accessibles et les annonces live sont conformes aux attentes, et le contrôle automatique WebKit ne révèle aucune régression du moteur Safari. **Ces preuves restent indirectes : une validation avec lecteur d’écran est nécessaire avant de déclarer 7.1 conforme.**

Le protocole exécutable est prêt : [`PROTOCOLE-LECTEURS-ECRAN.md`](./PROTOCOLE-LECTEURS-ECRAN.md). Il couvre VoiceOver (iPhone/iPadOS) et TalkBack (Android), avec 12 étapes, les sept contrôles transverses (titre de page, focus après changement de route, navigation par titres, libellés et erreurs de formulaire, piège de focus des feuilles, annonces `aria-live`, alternative HTML au PDF) et un modèle de résultats. **Tant qu’il n’a pas été exécuté sur les deux plateformes, 7.1 reste partiel.**

### 7.3 Aperçu A4 sur petit écran

L’aperçu A4 utilise un `zoom` CSS pour tenir sur un téléphone. À 320 px, le texte de la feuille devient très petit. Le contenu reste dans le DOM, lisible par lecteur d’écran et zoomable par le navigateur, et le défilement horizontal de la feuille est disponible. Ce n’est pas une non-conformité WCAG automatique, mais c’est une limite d’usage à surveiller. Une piste serait de supprimer les réductions extrêmes et d’assumer le défilement horizontal de la feuille.

### 7.4 Déclaration d’accessibilité

Aucune déclaration d’accessibilité légale n’est publiée. Elle n’est pas nécessaire pour une application personnelle non diffusée, mais si l’application devient un service public ou scolaire diffusé, il faudra publier une déclaration, un schéma pluriannuel et organiser les tests utilisateurs.

## 8. Matrice RGAA 4.1.2

| Thème | Critères | Conformes | Non applicables | Partiels | Non conformes |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1. Images | 9 | 4 | 5 | 0 | 0 |
| 2. Cadres | 2 | 0 | 2 | 0 | 0 |
| 3. Couleurs | 3 | 3 | 0 | 0 | 0 |
| 4. Multimédia | 13 | 0 | 13 | 0 | 0 |
| 5. Tableaux | 8 | 0 | 8 | 0 | 0 |
| 6. Liens | 2 | 2 | 0 | 0 | 0 |
| 7. Scripts | 5 | 3 | 1 | 1 | 0 |
| 8. Éléments obligatoires | 10 | 7 | 3 | 0 | 0 |
| 9. Structuration | 4 | 3 | 1 | 0 | 0 |
| 10. Présentation | 14 | 14 | 0 | 0 | 0 |
| 11. Formulaires | 13 | 10 | 3 | 0 | 0 |
| 12. Navigation | 11 | 6 | 5 | 0 | 0 |
| 13. Consultation | 12 | 5 | 6 | 0 | 1 |
| **Total** | **106** | **57** | **47** | **1** | **1** |

La matrice détaillée, avec le statut et la justification de chaque critère, est fournie dans [`RGAA-4.1-matrice.csv`](./RGAA-4.1-matrice.csv).

### Légende

- **C** : conforme sur le périmètre audité, avec preuve automatisée ou vérification manuelle.
- **NA** : non applicable (aucun média, aucun tableau, aucun cadre, aucun CAPTCHA, etc.).
- **P** : partiel, réserve documentée ci-dessus.
- **NC** : non conforme, réserve documentée ci-dessus (PDF non balisé, critère 13.3).

## 9. Reproduction

```bash
# Audit WCAG complet (écrans, feuilles, clavier, reflow, mouvement) — Chromium
npm run test:e2e -- a11y.spec.ts --project=chromium

# Contrôle complémentaire WebKit (Safari iPhone/iPad)
npx playwright install webkit
npx playwright test --project=webkit

# Suite unitaire, lint, types et build
npm run test:run
npm run lint
npm run typecheck
npm run build
```

Le protocole manuel VoiceOver / TalkBack, avec les 12 étapes et le modèle de
résultats, se trouve dans [`PROTOCOLE-LECTEURS-ECRAN.md`](./PROTOCOLE-LECTEURS-ECRAN.md).
Il doit être exécuté sur appareil réel avant toute déclaration de conformité
RGAA 7.1.

### Sources

- WCAG 2.1 : <https://www.w3.org/TR/WCAG21/>
- WCAG 2.2 : <https://www.w3.org/TR/WCAG22/>
- RGAA 4.1.2, critères et tests : <https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/>
- Fichier officiel des 106 critères : <https://github.com/DISIC/RGAA/blob/master/v4.1/JSON/criteres.json>
