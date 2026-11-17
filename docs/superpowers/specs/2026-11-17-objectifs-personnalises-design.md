# Objectifs personnalisés — document de conception

**Date** : 17 novembre 2026
**Statut** : proposition à valider
**Périmètre** : application Petite pousse (PWA locale, React + Dexie)

---

## 1. Intention

Le programme officiel ne couvre pas tout ce que l'enseignante observe en classe. Elle veut pouvoir ajouter ses propres objectifs d'apprentissage, sans quitter l'application ni passer par un fichier.

Le geste attendu : depuis **Programme**, un bouton « Ajouter un objectif », une fiche courte (intitulé, domaine, niveaux, un exemple facultatif par niveau), et l'objectif apparaît dans son domaine comme les autres. Il peut ensuite être validé pour un élève exactement comme un objectif officiel.

Vocabulaire : l'application appelle « objectif » la ligne que l'on valide. Le bouton et les libellés emploient ce mot, pas « compétence ».

## 2. Objectifs

- Ajouter un objectif depuis Programme, en moins d'une minute.
- Le retrouver dans le bon domaine, à la fin de la liste officielle, avec une marque visible.
- Le proposer aussi à l'étape « Choisir l'objectif » de la capture, pour pouvoir le valider.
- Le modifier et le supprimer.
- L'inclure dans l'export de sauvegarde et le restaurer avec le reste.
- Conserver l'historique : une réussite déjà enregistrée ne disparaît jamais parce qu'un objectif a été modifié ou supprimé.

## 3. Non-objectifs

- Modifier, réordonner ou masquer les objectifs officiels : le référentiel reste la référence.
- Créer un domaine personnalisé : les sept domaines existants (six domaines 2026 + EVAR) sont les seuls choix.
- Synchroniser les objectifs entre appareils autrement que par la sauvegarde.
- Importer/exporter les objectifs personnalisés séparément.
- Gérer plusieurs classes ou plusieurs enseignants sur le même appareil.
- Ajouter des objectifs depuis l'écran de capture (la capture reste un parcours de validation).

## 4. Anti-objectifs

- Un objectif officiel qui deviendrait silencieusement modifiable.
- Une suppression qui efface des réussites du dossier d'un élève.
- Deux objectifs identiques dans le même domaine, qui permettraient de valider deux fois la même chose.
- Une fiche qui ajoute des champs ou des étapes au-delà des quatre champs décidés.

## 5. Contraintes

- Le référentiel officiel est un JSON embarqué (`src/data/referential.json`), validé au chargement. Il n'est pas modifiable à l'exécution.
- Les données vivent dans IndexedDB via Dexie (`src/db/db.ts`), une base par appareil.
- Les validations enregistrent un instantané (`snapshot`) : intitulé, domaine, niveau, exemple et version du référentiel au moment de la validation.
- La sauvegarde est un ZIP versionné (`data.json`, `referential.json`, photos). La version de schéma est contrôlée strictement à la restauration.
- Projet accessible (RGAA) : libellés de champs, groupes de boutons nommés, annonces et confirmation de suppression.
- Les objectifs officiels et personnalisés doivent produire exactement la même expérience une fois affichés.

## 6. Décisions

Décisions prises avec l'enseignante :

| Sujet | Décision |
|---|---|
| Champs de la fiche | Intitulé, domaine, niveaux (plusieurs possibles), un petit exemple facultatif par niveau coché. |
| Emplacement du bouton | En haut de Programme, à la fin de la barre de recherche, réduit à l'icône `plus`. Pas de « + » par domaine : le domaine se choisit dans la fiche. |
| Place dans la liste | En fin de domaine, après les objectifs officiels, dans l'ordre de création. |
| Distinction | Une marque discrète « Ajouté » sur la ligne et dans la fiche de l'objectif. |
| Modification / suppression | Les deux sont possibles, à tout moment. |
| Stockage | Sur l'appareil, dans IndexedDB, inclus dans la sauvegarde existante. |

Appels du concepteur (à vérifier à la lecture) :

| Sujet | Appel |
|---|---|
| Longueur | Intitulé 160 caractères maximum, exemple 200 maximum. |
| Exemples | Facultatifs pour chaque niveau coché ; les objectifs officiels, eux, en affichent toujours un par niveau. |
| Doublons | Refus d'un second objectif de même intitulé (comparaison insensible à la casse et aux accents) dans le même domaine. |
| Domaine verrouillé | Le domaine peut être changé même après des validations ; l'historique garde le domaine d'origine dans son instantané. |
| Suppression | Confirmée par une feuille de confirmation ; les réussites déjà enregistrées restent dans les dossiers et les bilans. |
| Édition | Modifier l'intitulé ne réécrit pas les instantanés : les bilans déjà produits restent fidèles à ce qui a été observé. |
| Portée du doublon | Il ne porte que sur les objectifs encore proposés : supprimer définitivement un objectif libère son intitulé, qui peut être recréé. |
| Niveaux retirés | Décocher un niveau cesse de le proposer ; les réussites déjà observées à ce niveau restent comptées et visibles dans les dossiers. |
| Format de la fiche | Aucun champ ni étape au-delà des quatre champs décidés. La feuille peut être plus haute qu'un formulaire d'élève sur téléphone ; les exemples restent compacts, sans section supplémentaire. |
| `settings.schemaVersion` | Reste à 1. C'est une valeur héritée, jamais lue ; la version qui fait foi est `data.json.schemaVersion`. |

## 7. Modèle de données

Nouvelle table Dexie `customObjectives`, version de base 2 :

```ts
customObjectives: 'id, domainId'
```

Une ligne est un `Objective` complet, pour que tout le code qui consomme un objectif fonctionne sans changement :

```ts
interface CustomObjective extends Objective {
  createdAt: string // ISO
  updatedAt: string // ISO
}
```

- `id` : `custom-<uuid>`. Le préfixe sert à reconnaître un objectif personnalisé partout, y compris après restauration.
- `competencyId` : `'custom'` (valeur technique, jamais affichée).
- `source` : `{ bo: 'Objectif ajouté par l’enseignant' }` (jamais affiché).
- `ageBands` : au moins une tranche, dans l'ordre officiel PS → MS → GS.
- `examples` : une entrée facultative par tranche déclarée.

Le référentiel officiel n'est jamais réécrit.

## 8. Fusion officiel + personnalisé

Nouveau module `src/domain/objectives.ts` :

- `isCustomObjective(objective)` : `id.startsWith('custom-')`.
- `useCustomObjectives()` : lecture vivante de la table, `undefined` pendant le chargement.
- `mergeObjectives(official, custom)` : renvoie les objectifs officiels dans l'ordre du JSON, puis les personnalisés triés par `createdAt`, groupés par domaine.
- `useObjectiveCatalog()` : les deux ensemble, `undefined` pendant le chargement.

Points de lecture à remplacer par le catalogue fusionné :

- `ProgrammeScreen` : construction des groupes, objectif sélectionné, ouverture des domaines à la recherche.
- `Capture/ObjectiveScreen` : liste visible et objectif sélectionné.

Aucun autre écran ne lit `referential.objectives` : le dossier et les bilans s'appuient sur les instantanés des validations. C'est ce qui garantit la conservation de l'historique.

## 9. Interface

### 9.1 Bouton

En tête de Programme, à la fin de la barre de recherche : bouton encre (`dark`) réduit à l'icône `plus`, carré de la taille d'une cible tactile, sur la même ligne que le champ. Son nom accessible, jamais affiché, reste « Ajouter un objectif ».

### 9.2 Fiche d'ajout / d'édition

Feuille (`Sheet`) sur le modèle de `StudentFormSheet`, montée à chaque ouverture. Chaque groupe de choix est introduit par un petit titre visible (« Domaine », « Niveaux », « Exemples »), qui sert aussi de nom accessible au groupe de puces.

- En-tête : « Ajouter un objectif » ou « Modifier l'objectif ».
- **Intitulé** : champ texte obligatoire, 160 caractères.
- **Domaine** : groupe de puces à choix unique, les sept domaines, obligatoire.
- **Niveaux** : groupe de puces à choix multiple PS / MS / GS, au moins un.
- **Exemples** : un champ par niveau coché, libellé « Exemple en PS » etc., facultatif. Décocher un niveau masque son exemple sans perdre le texte saisi si on le recoche.
- Erreur de doublon affichée sous l'intitulé, annoncée (`role="alert"`).
- Actions : « Ajouter l'objectif » / « Enregistrer », puis « Annuler ».
- En édition, un bouton « Supprimer » en ton danger, qui ouvre `ConfirmSheet`.

### 9.3 Ligne dans Programme

- Même ligne, même barre de progression, mêmes compteurs que les objectifs officiels.
- Étiquette « Ajouté » à côté de l'étiquette de niveau.
- Accessible : le texte lu par le lecteur d'écran précise « objectif ajouté ».

### 9.4 Fiche d'un objectif (`ObjectiveSheet`)

- Le domaine et les niveaux s'affichent comme aujourd'hui.
- Pour un objectif personnalisé, la ligne de métadonnées ajoute « Objectif ajouté ».
- Actions supplémentaires : « Modifier l'objectif » et « Supprimer » (danger), qui ferment la fiche puis ouvrent le formulaire ou la confirmation.

### 9.5 Capture

- L'objectif personnalisé apparaît dans la liste, filtré par niveau et par domaine comme les autres.
- La mention « Ajouté » y est discrète (métadonnée de la carte).
- Une fois validé, il se comporte exactement comme un objectif officiel.

## 10. Règles d'édition et de suppression

**Édition.** L'identifiant et `createdAt` sont conservés ; `updatedAt` est mis à jour. Les validations existantes ne sont pas touchées : leurs instantanés gardent l'intitulé, le domaine et l'exemple du moment de l'observation. Conséquence assumée : si le domaine change, la ligne se déplace dans Programme, mais les réussites déjà comptées restent rangées sous le domaine d'origine dans les dossiers et les bilans.

**Suppression.** La ligne est retirée de la table dans une transaction. Les validations ne sont jamais supprimées : les dossiers et les bilans continuent d'afficher ces réussites grâce aux instantanés. L'objectif disparaît de Programme et de la capture ; un élève ne peut plus le valider.

La suppression est définitive, sans corbeille : l'intitulé redevient libre et peut être recréé dans le même domaine. Le contrôle de doublon ne porte donc que sur les objectifs encore proposés. Recréer volontairement un objectif du même nom après suppression peut permettre une seconde validation pour un élève déjà validé ; c'est assumé pour garder une suppression simple, et le doublon reste refusé tant que les deux objectifs sont proposés en même temps.

**Niveaux retirés.** Décocher un niveau dans la fiche arrête de le proposer : l'objectif n'apparaît plus dans la capture pour les élèves de ce niveau. Les réussites déjà observées à ce niveau ne sont pas touchées ; elles restent dans les dossiers et comptent dans la barre de progression. La barre peut donc compter des élèves d'un niveau que la fiche ne propose plus : elle dit ce qui a été observé, pas ce qui est proposé.

**Conséquence sur les compteurs.** Le compteur de réussites d'un domaine compte les validations de l'année, y compris celles d'objectifs supprimés. Il peut donc dépasser la somme des lignes visibles. C'est le comportement actuel et il est conservé : le compteur dit ce qui a été observé, pas ce qui est encore proposé.

**Doublon.** À l'ajout ou à l'édition, un intitulé équivalent (casse et accents ignorés, espaces normalisés) à un objectif existant du même domaine — officiel ou personnalisé — est refusé.

## 11. Sauvegarde

- `data.json` gagne `customObjectives: CustomObjective[]`.
- `BACKUP_SCHEMA_VERSION` passe de 1 à 2.
- L'export écrit la version 2.
- La lecture accepte la version 2 **et** la version 1 ; une archive v1 est restaurée avec une liste d'objectifs personnalisés vide. Une version supérieure à 2 reste refusée avec le message « version plus récente ».
- La restauration vide puis réinsère `customObjectives` dans la même transaction que le reste.
- `referential.json` continue de ne contenir que le référentiel officiel.
- Le schéma Zod de `data.json` déclare `customObjectives` avec une valeur par défaut vide, pour que les archives v1 passent la validation.
- Contrôles d'intégrité à la lecture : identifiants uniques, domaine connu, au moins un niveau.
- `settings.schemaVersion` reste à 1 : cette valeur héritée n'est jamais lue, et la version qui fait foi pour les archives est celle de `data.json`. Aucune migration de réglages n'est donc nécessaire.

## 12. Cas limites

- **Objectif supprimé avec des validations** : invisible dans Programme et la capture, présent dans les dossiers et bilans.
- **Objectif recréé après suppression** : nouvel identifiant, aucun lien avec les validations de l'ancien ; les deux peuvent coexister dans un dossier.
- **Niveau retiré après validation** : l'objectif n'est plus proposé pour ce niveau, mais les réussites existantes y restent comptées.
- **Objectif modifié après validation** : compteurs et validations inchangés ; les instantanés ne bougent pas.
- **Aucun élève dans la classe** : l'objectif s'ajoute quand même ; sa barre de progression affiche 0 sur 0 sans division par zéro.
- **Recherche** : un objectif personnalisé trouvé par recherche ouvre son domaine, comme un objectif officiel.
- **Filtre de niveau** : un objectif personnalisé n'apparaît que dans les niveaux qu'il déclare.
- **Chargement** : Programme et capture attendent le chargement des objectifs personnalisés, comme elles attendent déjà les élèves et les validations.
- **Deux onglets** : les lectures vivantes Dexie mettent à jour les deux écrans.
- **Restauration d'une sauvegarde** : les objectifs personnalisés restaurés retrouvent leur place, y compris ceux liés à des validations restaurées.

## 13. Accessibilité

- Chaque champ a un libellé associé ; les groupes de puces sont nommés par leur titre visible (`role="group"`, `aria-labelledby`).
- L'état des puces de niveau est porté par `aria-pressed`.
- L'erreur de doublon est annoncée (`role="alert"`) et le focus va sur le champ fautif.
- L'étiquette « Ajouté » n'est pas seulement visuelle : elle est incluse dans le nom accessible de la ligne.
- La confirmation de suppression respecte le composant existant, qui gère le focus et l'échappement.

## 14. Tests attendus

Unitaires :

- `customObjectives` : création, édition, suppression, nettoyage des espaces, au moins un niveau, refus du doublon, identifiant préfixé.
- Doublon : refusé tant que les deux objectifs existent ; autorisé après suppression du premier.
- Niveaux : retirer un niveau met à jour la fiche sans toucher aux validations déjà enregistrées à ce niveau.
- `mergeObjectives` : officiels d'abord dans l'ordre du JSON, personnalisés ensuite par date de création, aucun officiel modifié.
- Savoir si un objectif est personnalisé.

Composants :

- Programme : le bouton ouvre la fiche ; l'objectif ajouté apparaît dans son domaine avec « Ajouté » ; l'édition met à jour la ligne ; la suppression demande confirmation puis retire la ligne ; les réussites existantes restent comptées.
- Fiche objectif : « Modifier » ouvre le formulaire prérempli ; « Supprimer » ouvre la confirmation.
- Capture : un objectif personnalisé du niveau de l'élève est proposé et validable.

Sauvegarde :

- Aller-retour export/restauration avec un objectif personnalisé et une validation associée.
- Archive v1 sans `customObjectives` : acceptée, liste vide.
- Archive v2 avec un objectif invalide : refusée.

Bout en bout (Playwright) : ajouter un objectif depuis Programme, le valider depuis la capture, le retrouver dans le dossier de l'élève, puis le supprimer et vérifier que la réussite reste visible.

## 15. Ce qui reste à l'implémenteur

- Découpage exact des composants et noms de fichiers dans `src/features/programme/`.
- Style fin de la marque « Ajouté » et des actions dans la fiche, dans le langage visuel existant.
- Structure des tests et réutilisation des fixtures existantes.
- Choix de faire ou non évoluer la version affichée du référentiel : les objectifs personnalisés ne font pas partie du référentiel officiel et n'ont pas à changer `REFERENTIAL_VERSION`.
