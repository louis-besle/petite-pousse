# Vérification indépendante — référentiel officiel 2026

Date de vérification : **2026-11-07**.
Périmètre : les six domaines de `scripts/referential/source/objectives.csv` et le
référentiel généré `src/data/referential.json` (version `2026.1.0`).

## Sources

- **BO n°41 du 31 octobre 2024** (langage et mathématiques) :
  <https://www.education.gouv.fr/bo/2024/Hebdo41/MENE2415135A>
- **BO n°19 du 7 mai 2026**, arrêté du 16 avril 2026 (corps, arts, temps,
  vivant) : <https://www.education.gouv.fr/bo/2026/Hebdo19/MENE2608627A>
  - Annexe :
    <https://www.education.gouv.fr/sites/default/files/document/annexe-programme-d-enseignement-de-l-ecole-maternelle-cycle-1-516107.pdf>
- **Programme consolidé Éduscol** (63 pages, texte de référence de la
  transcription) :
  <https://eduscol.education.gouv.fr/sites/default/files/document/programme-cycle-1-consolide-127565.pdf>
  - Copie locale non commitée :
    `.superpowers/sdd/2026-11-06-livret-suivi-apprentissage/tools/programme-cycle-1-consolide.pdf`
    (dossier ignoré par git, vérifié avec `git check-ignore`).

Les `source_page` sont des **numéros de page du PDF** (page PDF 6 = folio « 5 »).
La page PDF 52 est blanche (folio « 51 » seul), ce qui a été confirmé sur le PDF.

## Échantillon stratifié de 20 objectifs

Il s’agit d’un **échantillon stratifié** — et non d’un tirage aléatoire —
couvrant les six domaines, les trois tranches d’âge et 20 compétences
distinctes. Chaque objectif a été localisé à sa `source_page`, puis comparé au
texte du PDF après normalisation des seuls artefacts de mise en page : espaces et
sauts de ligne, césures (`au - delà` → `au-delà`), apostrophes typographiques,
glyphes de puce en zone privée Unicode et tirets de puces de liste. La
comparaison porte sur le texte intégral ; les exemples sont tronqués à 150
caractères dans le tableau pour la lisibilité.

| `objective_id` | Domaine | Page | Objectif | Exemple(s) par tranche (extrait) | Tranches | Verdict |
|---|---|---:|---|---|---|---|
| `lang-vocabulaire-01` | langage | 8 | Comprendre, mémoriser, réemployer les mots des corpus enseignés (2 par période). | before4 : Comprendre et utiliser les réseaux lexicaux : • de la vie familiale ; • des activités récurrentes dans la vie de la classe (ex. :verbes de mouvement… ; from4 : Comprendre et utiliser : • les mots qui vont permettre de décrire l’environnement immédiat de l’élève ; • les mots spécifiques des projets et des dif… | `before4|from4` | conforme |
| `lang-discours-09` | langage | 12 | Décrire une action ou une activité qui a été menée par un autre élève. | from5 : Dire : « Peut-être que Corentin a mis la peinture avant de dessiner avec les feutres. » | `from5` | conforme |
| `lang-geste-03` | langage | 18 | Prendre des repères spatiaux sur le support utilisé pour tracer. | before4 : Tracer quelques formes de base : traits verticaux, traits horizontaux, points, boucles et cercles. | `before4` | conforme |
| `lang-premiers-ecrits-14` | langage | 21 | Mémoriser la graphie d’un mot transparent, en s’appuyant sur la connaissance des lettres et la conscience phonologique et le retranscrire sur un support. | from5 : Utiliser ses propres ressources mémorisées et celles de la classe pour écrire des mots. | `from5` | conforme |
| `maths-nombres-11` | maths | 39 | Poursuivre la compréhension des faits suivants : • si on ajoute un objet à une collection, le nombre qui désigne sa quantité est le suivant dans la suite orale des noms des nombres ; • dans la suite orale des nombres, chaque nombre s’obtient en ajoutant un au nombre précédent. | from4 : Nommer les nombres correspondant au cardinal d’une collection avant et après l’ajout d’un élément. ; from5 : Nommer les nombres correspondant au cardinal d’une collection avant et après l’ajout ou le retrait d’un élément. | `from4|from5` | conforme |
| `maths-problemes-08` | maths | 46 | Déterminer la position finale (respectivement initiale) à partir de la position initiale (respectivement finale) et d’un déplacement sur une piste du type du jeu de l’oie ou sur la bande numérique. | from5 : Utiliser des procédures de calcul (comptage, décomptage, surcomptage) pour résoudre un problème parties-tout. Ainsi, pour calculer la quantité d’obje… | `from5` | conforme |
| `maths-solides-formes-02` | maths | 48 | Percevoir l’invariance de la forme d’un objet par rapport aux déplacements qu’il peut subir. | before4 : Reconnaitre visuellement et tactilement des objets de même forme qu’un objet donné. | `before4` | conforme |
| `maths-motifs-05` | maths | 51 | Décrire oralement des motifs répétitifs simples de différentes natures, sans nécessairement recourir au vocabulaire spécialisé. | from4 : Verbaliser les éléments d’un motif répétitif simple visuel, sonore ou gestuel. | `from4` | conforme |
| `corps-manipuler-03` | corps | 23 | Sauter sans élan un obstacle. | before4 : Sauter sans élan un obstacle horizontal matérialisé par une latte (une rivière). | `before4` | conforme |
| `corps-equilibres-06` | corps | 24 | Explorer le milieu aquatique et développer une nouvelle locomotion dans l’eau. | from5 : Entrer et sortir seul de l’eau, se déplacer avec les épaules immergées, immerger complètement la tête pendant plusieurs secondes. | `from5` | conforme |
| `corps-cooperation-05` | corps | 26 | Jouer en exerçant des rôles différents : attaquant, attaquante et défenseur, défenseuse. | from4 : Jouer à plusieurs en identifiant la zone à atteindre et les rôles des joueurs et des joueuses (attaquants, attaquantes ou défenseurs, défenseuses). | `from4` | conforme |
| `arts-graphisme-08` | arts | 29 | Créer de nouveaux motifs. | from5 : Choisir les outils adaptés pour faire varier la largeur et le relief du tracé (dans une plaque d’argile, sur une feuille humidifiée, sur du papier de… | `from5` | conforme |
| `arts-voix-03` | arts | 32 | Dire ou chanter au moins cinq comptines. | before4 : Dire ou chanter une comptine, en même temps que les professeurs et en reproduisant la gestuelle (Toc, toc, toc Monsieur Pouce ; Petit escargot). | `before4` | conforme |
| `arts-ecoute-04` | arts | 33 | Exprimer ses émotions après l’écoute d’un extrait musical. | from4 : Partager son ressenti en groupe, après avoir écouté des extraits d’Émilie jolie de Philippe Chatel et de La Flute enchantée de Mozart. | `from4` | conforme |
| `temps-reperes-01` | temps | 53 | Acquérir les premiers repères temporels. | before4 : Comprendre les temps principaux du déroulé (global) des actions de la journée. | `before4` | conforme |
| `temps-chronologie-08` | temps | 54 | Repérer les différentes étapes d’un processus ou d’un évènement vécu et les ordonner. | from5 : Établir la liste des différentes étapes d’une construction ou d’une fabrication en utilisant les mots : d’abord, ensuite, puis, après, enfin, à la fi… | `from5` | conforme |
| `temps-espace-representation-05` | temps | 57 | Représenter un déplacement. | from4 : Décrire le parcours réalisé lors d’une séance d’activité physique en utilisant des repères et des marqueurs spatiaux et le dessiner. ; from5 : Coder à l’aide de flèches le déplacement effectué par un objet mobile sur un tableau à cases. | `from4|from5` | conforme |
| `vivant-animaux-vegetaux-04` | vivant | 60 | Reconnaitre une ou plusieurs étapes d’un cycle de vie à partir de l’observation d’animaux et de plantes. | from4 : Constater et décrire des changements liés à la croissance d’une plante à partir d’un suivi d’observation (photographies régulières). | `from4` | conforme |
| `vivant-matiere-melanges-04` | vivant | 63 | Découvrir et observer la fusion et la solidification de l’eau. | before4 : Observer, manipuler et fabriquer de la glace (dehors ou en utilisant un mélange réfrigérant), la faire fondre. | `before4` | conforme |
| `vivant-objets-materiaux-11` | vivant | 62 | Explorer la notion de flottabilité avec des objets pleins constitués d’une seule et même matière : observer que, plongés dans l’eau, ils flottent tous ou coulent tous. | from5 : Plonger des objets pleins (sans creux, sans trous) d'une même matière (bois, fer, cire de bougie, polystyrène, verre) et observer leur comportement :… | `from5` | conforme |

**Bilan de l’échantillon : 20/20 objectifs exacts, 23/23 cellules d’exemple
exactes dans la même compétence et la même tranche, 20/20 `age_bands` exacts.**

Contrôle complémentaire exhaustif (même méthode) : les **398 objectifs** sont
retrouvés dans exactement les tranches déclarées, et les **417 cellules
d’exemple** (une par tranche déclarée) sont retrouvées verbatim dans la même
compétence et la même tranche. Aucun texte inventé, reformulé ou attribué à une
autre tranche.

## Comptes

| Indicateur | Valeur |
|---|---:|
| Objectifs uniques (`objective_id`) | 398 |
| Compétences (`competency_id`) | 37 |
| Domaines | 6 |
| Occurrences avant 4 ans | 116 |
| Occurrences à partir de 4 ans | 139 |
| Occurrences à partir de 5 ans | 162 |

- Le CSV et le JSON concordent : 398 objectifs, 37 compétences, 6 domaines,
  version `2026.1.0`.
- Aucun `objective_id` en double ; aucun couple
  `(competency_id, objective_label)` en double.
- Les cibles **114/140/162 sont des garde-fous, pas un objectif à atteindre** :
  les écarts constatés sont +2 / −1 / 0. Aucun objectif n’a été ajouté pour les
  rejoindre.

## Pages

Plages contrôlées et pages réellement utilisées :

| Domaine | Plage exigée | Pages utilisées |
|---|---|---:|
| langage | 6-21 | 8-21 |
| corps | 22-26 | 23-26 |
| arts | 27-35 | 28-35 |
| maths | 36-51 | 38-51 |
| temps | 53-58 | 53-58 |
| vivant | 59-63 | 60-63 |

Toutes les valeurs `source_page` sont dans leur plage. Les pages d’ouverture sans
tableau (6-7, 22, 27, 36-37, 52 blanche, 59) sont conformes au PDF.

## Commandes exécutées

| Commande | Résultat |
|---|---|
| `npm run referential:build` | PASS — « Wrote 398 objectives (37 competencies) » ; `git status --short` vide après régénération (JSON reproductible à l’octet) |
| `npm run referential:check` | PASS — 398 objectifs, 116/139/162, aucun avertissement de volume |
| `npm run test:run` | PASS — 8 fichiers, 61 tests |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS — 44 modules, bundle 317,80 kB (gzip 100,71 kB), build en 308 ms |
| `git status --short` | vide (hors fichiers de cette vérification) |

## Ambiguïtés résiduelles et choix assumés

1. **Appariement objectif ↔ exemple.** Le PDF sépare objectifs et exemples en
   deux colonnes indépendantes : l’appariement est éditorial, jamais recopié
   d’une correspondance officielle. Règle appliquée : exemple verbatim de la même
   compétence et de la même tranche, réutilisé si la tranche contient moins
   d’exemples que d’objectifs. Cas documentés : plusieurs objectifs de
   `lang-geste`, `lang-ecrits` et `lang-phonologie`, `maths-problemes-08`
   (`from5`), `temps-espace-representation-04`/`-05` (`from4`),
   `vivant-objets-materiaux-14` (`from5`). Les doublons sont visibles et assumés ;
   aucun exemple inventé.
2. **Libellés fusionnés entre tranches.** 13 lignes portent plusieurs tranches
   (19 occurrences supplémentaires au total) : 7 en langage, 5 en maths
   (`maths-nombres-05`, `-07`, `-08`, `-11`, `-28`), 1 en temps
   (`temps-espace-representation-05`). La fusion n’a lieu que si l’intitulé est
   strictement identique ; aucune fusion sémantique. En particulier,
   « Comprendre, mémoriser, réemployer les mots des corpus enseignés (2 par
   période). » et la variante « (3 par période). » restent deux lignes.
3. **Choix du niveau de compétence.** Langage, corps, arts et vivant utilisent
   les titres de niveau 2 (12 pt) ; maths utilise les titres de section 16 pt
   (les titres 12 pt y sont des subdivisions internes) ; temps utilise cinq
   titres de niveau 2 plus le titre de section « Se repérer dans le temps » pour
   le premier bloc sans sous-thème. Ces choix sont désormais documentés dans
   `source/README.md` et correspondent au CSV.
4. **`source_page` pour les tableaux à cheval.** La convention est la page de
   première apparition du tableau. Deux objectifs `before4` de
   `vivant-corps-sante` (`-02`, `-03`) portent la page 60, où commence le
   tableau, alors que leur texte coule page 61. Les objectifs à cheval sur deux
   pages (`lang-ecrits-11`, `vivant-objets-materiaux-11`) retiennent la première
   page (17 et 62).
5. **Artefacts d’extraction.** Le PDF utilise un glyphe de puce en zone privée
   Unicode (`U+F09F`) et perd parfois les tirets de liste ou insère le folio dans
   le flux. La comparaison neutralise uniquement ces artefacts de mise en page.
   Les particularités typographiques officielles sont conservées telles quelles
   (`X-chen de Paul Klee`, `Gabriele Munter`, `gout`, `boite`,
   `scénario: imparfait`, `La Flute enchantée`, apostrophes ASCII locales).

## Conclusion

Toutes les vérifications de contenu, de comptage, de pages, de source et de
reproductibilité passent. Le référentiel est conforme au texte officiel
consolidé.

**Vérification indépendante : 20 objectifs échantillonnés, conformes au texte officiel.**
