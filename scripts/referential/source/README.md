# Source officielle du référentiel 2026

`objectives.csv` est la transcription du programme officiel de l’école maternelle.
Il est la seule source du référentiel embarqué (`src/data/referential.json`) et ne
doit contenir que des intitulés et des exemples recopiés du texte officiel.

## Textes officiels

- **BO n°41 du 31 octobre 2024** : programme d’enseignement de l’école maternelle
  pour les domaines du langage et des mathématiques (texte consolidé en 2026).
- **BO n°19 du 7 mai 2026**, arrêté du 16 avril 2026 : programme révisé pour les
  quatre autres domaines.
  - Notice : <https://www.education.gouv.fr/bo/2026/Hebdo19/MENE2608627A>
  - Annexe (PDF) :
    <https://www.education.gouv.fr/sites/default/files/document/annexe-programme-d-enseignement-de-l-ecole-maternelle-cycle-1-516107.pdf>
- **Version consolidée Éduscol** utilisée pour la transcription (les deux BO
  réunis, avec les objectifs et exemples déclinés par âge) :
  <https://eduscol.education.gouv.fr/sites/default/files/document/programme-cycle-1-consolide-127565.pdf>
  (63 pages).

Le PDF consolidé n’est **pas commité** : il est volumineux et reste dans le
dossier de travail local `.superpowers/sdd/…/tools/` (dossier ignoré par git).
Seul ce dossier `source/` est versionné. Les colonnes `source_bo` et
`source_page` permettent de retrouver chaque ligne dans le PDF officiel.

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

Pour un objectif présent dans plusieurs tranches d’âge, `source_page` indique la
page du tableau où l’objectif apparaît pour la première fois (tranche la plus
jeune).

Provenance par domaine :

- `langage` et `maths` : BO n°41 du 31 octobre 2024 (version consolidée) ;
- `corps`, `arts`, `temps`, `vivant` : BO n°19 du 7 mai 2026.

État de la transcription : le domaine `langage` est complet dans ce fichier.
Les cinq autres domaines seront ajoutés par les étapes suivantes, sans
renuméroter les identifiants déjà publiés.

## Structure officielle retenue

Le programme est structuré en compétences (titres bleus de niveau 2), elles-mêmes
subdivisées en sous-thèmes (titres noirs gras de niveau 3). Le CSV ne modélise
qu’un seul niveau de regroupement : `competency_id` / `competency_label`
reprennent donc la **compétence officielle de niveau 2**, seul niveau que le
programme nomme « compétence » (« Le programme … est structuré en compétences
qui indiquent les enjeux et les finalités d’enseignement »).

Les sous-thèmes officiels de niveau 3 ne servent pas de clé de regroupement et
ne figurent pas dans le CSV (le schéma ne modélise qu’un niveau) : ils sont
seulement consignés ci-dessous pour la traçabilité de la transcription. Pour le
domaine `langage` :

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
  `maths`, `temps`, `vivant`).
- `competency_id` : `lang-<slug>` pour le domaine langage, où `<slug>` est un
  slug ASCII stable du titre de compétence (`vocabulaire`, `syntaxe`,
  `articulation`, `discours`, `phonologie`, `diversite`, `ecrits`, `geste`,
  `premiers-ecrits`). Les identifiants des autres domaines suivront le même
  schéma `<domaine>-<slug>`.
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
`langage` et `maths`, et `BO n°19 du 7 mai 2026` pour les quatre autres.
`source_page` est un entier (page PDF).

Le fichier est écrit avec Node ou Python en UTF-8 sans BOM ; ne pas utiliser
`Set-Content -Encoding utf8` sous PowerShell, qui ajoute un BOM.

## Construction et contrôle

```bash
npm run referential:build   # CSV -> src/data/referential.json
npm run referential:check   # schéma + comptes indicatifs par tranche
```

`referential:check` affiche des avertissements tant que tous les domaines ne sont
pas remplis : les cibles 114/140/162 sont des garde-fous, jamais des objectifs à
inventer.

## Défauts connus des outils d’extraction

Le texte extrait automatiquement (`tools/`) est une aide, pas une vérité :

- le script `split-domains.mjs` ne découpe pas les pages (le motif de split
  attend quatre `=` au lieu de cinq) ; il faut recouper `consolide-lines.txt`
  avec un motif corrigé avant de lire `lines-<domaine>.txt` ;
- les titres détectés peuvent être faux (`Points de vigilance`, `Introduction`) ;
- des mots peuvent manquer aux changements de page ou de colonne, et les
  césures doivent être recollées ;
- les objectifs et les exemples sont extraits en deux listes séparées.

Chaque ligne du CSV a donc été vérifiée sur le PDF (texte et rendu) : tableaux
extraits avec leurs cellules, puis relecture des pages du domaine.
