# Source officielle du référentiel 2026 et du programme EVAR

`objectives.csv` est la transcription du programme officiel de l’école maternelle
et du programme EVAR. Il est la seule source du référentiel embarqué
(`src/data/referential.json`) et ne doit contenir que des intitulés et des
exemples recopiés du texte officiel.

## Textes officiels

- **BO n°41 du 31 octobre 2024** : programme d’enseignement de l’école maternelle
  pour les domaines du langage et des mathématiques (texte consolidé en 2026).
  - Notice : <https://www.education.gouv.fr/bo/2024/Hebdo41/MENE2415135A>
- **BO n°19 du 7 mai 2026**, arrêté du 16 avril 2026 : programme révisé pour les
  quatre autres domaines.
  - Notice : <https://www.education.gouv.fr/bo/2026/Hebdo19/MENE2608627A>
  - Annexe (PDF) :
    <https://www.education.gouv.fr/sites/default/files/document/annexe-programme-d-enseignement-de-l-ecole-maternelle-cycle-1-516107.pdf>
- **BO n°6 du 6 février 2025**, arrêté du 3 février 2025 : programme
  d’éducation à la vie affective et relationnelle (EVAR) à l’école maternelle.
  - Notice : <https://www.education.gouv.fr/bo/2025/Hebdo6/MENE2503064A>
  - Annexe (PDF) :
    <https://www.education.gouv.fr/sites/default/files/document/Annexe%20%E2%80%93%20Un%20programme%20ambitieux%20%3A%20%C3%A9duquer%20%C3%A0%20la%20vie%20affective%20et%20relationnelle%2C%20et%20%C3%A0%20la%20sexualit%C3%A9-405357.pdf>
  - Synthèse maternelle (4 pages) :
    <https://eduscol.education.gouv.fr/sites/default/files/document/2025evar4pagesa5maternellepdf-113340.pdf>
- **Version consolidée Éduscol** utilisée pour la transcription des six
  domaines (les deux BO réunis, avec les objectifs et exemples déclinés par
  âge) :
  <https://eduscol.education.gouv.fr/sites/default/files/document/programme-cycle-1-consolide-127565.pdf>
  (63 pages).

Le PDF consolidé n’est **pas commité** (fichier volumineux). Il peut être
téléchargé à l’URL Éduscol ci-dessus ; les colonnes `source_bo` et `source_page`
permettent de retrouver chaque ligne dans ce PDF officiel.

## Pages du PDF consolidé

Les numéros de page du PDF ne coïncident pas avec les numéros imprimés : la page
PDF 6 porte le folio « 5 ». Toutes les valeurs `source_page` du CSV sont des
**numéros de page du PDF** (et non les folios imprimés).

| Domaine | Pages PDF | Folios imprimés |
|---|---|---|
| Langage oral et écrit | 6-21 | 5-20 |
| Activités physiques | 22-26 | 21-25 |
| Activités artistiques | 27-35 | 26-34 |
| Premiers outils mathématiques | 36-51 | 35-50 |
| Temps et espace | 53-58 | 52-57 |
| Vivant, matière et objets | 59-63 | 58-62 |

La page PDF 52 est une page blanche de séparation (folio « 51 » seul) : elle ne
contient aucun contenu de programme.

Les objectifs EVAR ne viennent pas de ce PDF consolidé : ils sont dans l’annexe
du BO n°6, aux pages PDF 11 à 16.

| Tranche EVAR | Pages PDF de l’annexe |
|---|---|
| À aborder avant 4 ans | 11-12 |
| À partir de 4 ans | 13-14 |
| À partir de 5 ans | 15-16 |

Pour un objectif présent dans plusieurs tranches d’âge, `source_page` indique la
page du tableau où l’objectif apparaît pour la première fois (tranche la plus
jeune).

Provenance par domaine :

- `langage` et `maths` : BO n°41 du 31 octobre 2024 (version consolidée) ;
- `corps`, `arts`, `temps`, `vivant` : BO n°19 du 7 mai 2026 ;
- `evar` : BO n°6 du 6 février 2025, programme EVAR de l’école maternelle.

État de la transcription : les six domaines de 2026 et l’EVAR sont complets
(407 objectifs, 40 compétences, version `2026.2.0`). Les identifiants déjà
publiés n’ont pas été renumérotés. Le test
`scripts/referential/build.test.ts` vérifie que le CSV reproduit exactement
`src/data/referential.json`.

## Structure officielle retenue

Le programme est structuré en compétences, elles-mêmes subdivisées en
sous-thèmes (titres noirs gras de niveau 3). Le CSV ne modélise qu’un seul
niveau de regroupement. Pour le domaine `langage`, les compétences sont les
titres bleus de niveau 2 (12 pt), seul niveau que le programme nomme
« compétence » (« Le programme … est structuré en compétences qui indiquent les
enjeux et les finalités d’enseignement »). Les autres domaines retiennent le
titre qui groupe réellement les tableaux ; le niveau utilisé est précisé
ci-dessous.

Les sous-thèmes officiels de niveau 3 ne servent pas de clé de regroupement et
ne figurent pas dans le CSV (le schéma ne modélise qu’un niveau) : ils sont
seulement consignés ci-dessous pour la traçabilité de la transcription.

Niveau de titre utilisé comme compétence, par domaine (vérifié sur le PDF
consolidé) :

| Domaine | Niveau utilisé | Compétences |
|---|---|---:|
| `langage` | titres bleus de niveau 2 (12 pt) | 9 |
| `maths` | titres de section 16 pt | 5 |
| `corps` | titres bleus de niveau 2 (12 pt) | 4 |
| `arts` | titres bleus de niveau 2 (12 pt) | 9 |
| `temps` | 5 titres de niveau 2 (12 pt) + 1 titre de section 16 pt (`temps-reperes`) | 6 |
| `vivant` | titres bleus de niveau 2 (12 pt) | 4 |

Pour les mathématiques, les titres de niveau 2 (12 pt) sont des subdivisions
internes (« Exprimer une quantité par un nombre », « Exprimer un rang ou une
position par un nombre ») : les compétences retenues sont les titres de section
16 pt. Pour `temps`, le premier bloc de tableaux (repères temporels, moments de
la journée, marqueurs, saisons) n’a pas de titre de niveau 2 : la compétence
`temps-reperes` reprend le titre de section « Se repérer dans le temps ».

Pour le domaine `langage` :

| `competency_id` | Intitulé officiel (niveau 2) | Sous-thèmes (niveau 3) |
|---|---|---|
| `lang-vocabulaire` | Enrichir son vocabulaire | — |
| `lang-syntaxe` | Développer sa syntaxe | — |
| `lang-articulation` | Articuler distinctement | — |
| `lang-discours` | Produire des discours variés | — |
| `lang-phonologie` | Acquérir les habiletés phonologiques et le principe alphabétique | Écouter, identifier, discriminer et reproduire des sons ; Manipuler des syllabes orales puis des phonèmes ; Connaitre le nom des lettres ; Connaitre le son des lettres |
| `lang-diversite` | S’éveiller à la diversité linguistique | Écouter, identifier, discriminer et reproduire des sons |
| `lang-ecrits` | Écouter et comprendre différentes formes d’écrits | Découvrir les supports de l’écrit ; Comprendre des textes lus par le professeur ; Initier un parcours de lecteur et une première culture littéraire |
| `lang-geste` | Apprendre le geste d’écriture | — |
| `lang-premiers-ecrits` | Produire de premiers écrits | Passer de l’oral à l’écrit ; Produire des écrits |

## Règles de transcription

1. **Aucune reformulation.** Les intitulés d’objectifs et les exemples sont
   recopiés mot pour mot, y compris la ponctuation, les majuscules, les
   apostrophes typographiques (’) et les chiffres. Seuls les artefacts de mise
   en page sont nettoyés : coupures de mots en fin de ligne, espaces multiples,
   puces « - » de début de ligne.
2. **Aucun objectif inventé, fusionné ou scindé.** Chaque ligne du CSV correspond
   à un objectif de la colonne « Objectifs d’apprentissage » du PDF. Un objectif
   dont l’intitulé est identique dans plusieurs tranches d’âge est regroupé en
   une seule ligne (`age_bands` = `before4|from4|from5`) ; si l’intitulé diffère,
   il donne des lignes distinctes.
3. **Tranches d’âge** : `before4` = « À aborder avant 4 ans », `from4` =
   « À partir de 4 ans ou dès que les apprentissages précédents ont pu être
   observés », `from5` = « À partir de 5 ans ou dès que les apprentissages
   précédents ont pu être observés ».
4. **Exemples** : une seule cellule d’exemple par tranche déclarée, remplie avec
   un exemple **verbatim** du même domaine, de la même compétence et de la même
   tranche d’âge. Les cellules des tranches non déclarées restent vides (le
   builder refuse un exemple pour une tranche absente de `age_bands`).

### Règle d’association objectif ↔ exemple

Le PDF présente les objectifs et les exemples dans **deux colonnes
indépendantes** : il n’existe pas d’appariement officiel un à un. L’association
est donc éditoriale, mais l’exemple n’est jamais réécrit :

- l’exemple est choisi dans le tableau de la **même compétence** et de la
  **même tranche d’âge** ;
- à l’intérieur de ce tableau, on retient l’exemple dont le sens est le plus
  proche de l’objectif (même notion, même type d’activité) ;
- si la tranche ne propose pas d’exemple spécifique, ou propose moins d’exemples
  que d’objectifs, l’exemple le plus proche peut être réutilisé pour plusieurs
  objectifs ; le doublon reste alors visible et assumé, il n’est jamais remplacé
  par un texte inventé ;
- un exemple est recopié en entier, y compris ses puces internes (« • … ; • … »)
  et la liste de mots qu’il contient.

## Conventions d’identifiants

- `domain_id` : identifiant officiel du domaine (`langage`, `corps`, `arts`,
  `maths`, `temps`, `vivant`) ou `evar` pour le programme d’éducation à la vie
  affective et relationnelle.
- `competency_id` : `<préfixe domaine>-<slug>`, où `<slug>` est un slug ASCII
  stable du titre de compétence. Les préfixes utilisés sont `lang`, `corps`,
  `arts`, `maths`, `temps`, `vivant` et `evar` (par exemple `lang-vocabulaire`,
  `corps-manipuler`, `arts-graphisme`, `maths-nombres`, `temps-reperes`,
  `vivant-animaux-vegetaux`, `evar-corps`). Pour l’EVAR, les trois compétences
  sont les trois axes officiels du programme.
- `objective_id` : `<préfixe domaine>-<slug compétence>-<numéro sur deux
  chiffres>`, par exemple `lang-vocabulaire-01` ou `lang-phonologie-14`. Les
  numéros suivent l’ordre d’apparition dans le programme, commencent à `01` et
  ne sont **jamais réutilisés ni renumérotés** : un objectif supprimé laisse un
  trou, un nouvel objectif prend le numéro suivant.
- Tous les identifiants sont en ASCII minuscule, sans accent ni espace.

## Format du fichier

CSV UTF-8 **sans BOM**, séparateur virgule, en-tête exact :

```
objective_id,domain_id,competency_id,competency_label,objective_label,age_bands,example_before4,example_from4,example_from5,source_bo,source_page
```

Les champs contenant une virgule sont entre guillemets ; les guillemets internes
sont doublés. `source_bo` vaut `BO n°41 du 31 octobre 2024` pour les domaines
`langage` et `maths`, `BO n°19 du 7 mai 2026` pour les quatre autres, et
`BO n° 6 du 6 février 2025` pour `evar`. `source_page` est un entier (page PDF
du document correspondant).

Le fichier est écrit avec Node ou Python en UTF-8 sans BOM ; ne pas utiliser
`Set-Content -Encoding utf8` sous PowerShell, qui ajoute un BOM.

## Construction et contrôle

```bash
npm run referential:build   # CSV -> src/data/referential.json
npm run referential:check   # schéma + comptes indicatifs par tranche
```

`referential:check` n’affiche un avertissement que si le total d’une tranche
s’écarte de plus de 10 % des cibles 114/140/162. Ces cibles sont des garde-fous,
jamais des objectifs à atteindre ni à inventer.

## Méthode de transcription

La transcription est faite page par page : le texte de chaque page est extrait
avec ses coordonnées de colonnes, puis chaque ligne du CSV est relue sur le PDF
(texte et rendu). Les objectifs et les exemples forment deux colonnes
indépendantes : leur association est donc éditoriale (voir la règle ci-dessus),
jamais une correspondance officielle un à un. Les scripts d’extraction locaux ne
sont que des aides de travail ; les URL officielles ci-dessus suffisent pour
reproduire la vérification.
