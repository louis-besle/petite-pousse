# Carnet de réussites — document de conception

**Date** : 6 novembre 2026  
**Statut** : proposition à valider  
**Nom de travail** : Carnet de réussites  
**Maquette de référence** : `maquettes/prototype.html` (prototype cliquable, données fictives)  
**Images** : `maquettes/proto-*.png`, planche Figma « Livret suivi apprentissage »

---

## 1. Intention

Une professeure des écoles maternelle suit les compétences de ses 20 élèves (PS, MS et GS) avec des photos prises en classe. Aujourd'hui, les photos restent « perdues dans le téléphone » : aucune ne peut être retrouvée au moment du dossier ou du rendez-vous avec les parents.

L'application remplace ce désordre par un classeur vivant, sur son téléphone ou sa tablette :

1. je cherche l'élève ;
2. je prends la photo (ou je valide sans photo) ;
3. je choisis l'objectif du programme officiel ;
4. la réussite est datée et rangée dans le dossier de l'élève.

Deux fois par an, l'application produit une feuille A4 par élève (ou plusieurs si le volume l'exige), avec les photos et les compétences en face, à imprimer pour les rendez-vous parents. Les données restent sur l'appareil ; seul le PDF est envoyé à l'ordinateur pour l'impression. L'application sert plusieurs années de suite : rien n'est remis à zéro au changement d'année.

## 2. Décisions déjà prises

| Sujet | Décision |
|---|---|
| Public | Une enseignante, une classe de 20 élèves PS/MS/GS. Pas de comptes parents, pas de collègues. |
| Référentiel | Programme officiel de l'école maternelle 2026 (BO n°19 du 7 mai 2026, consolidé avec le BO n°41 du 31 octobre 2024 pour le langage et les maths). |
| Granularité | L'objectif d'apprentissage précis du programme, pas la compétence large. |
| Preuve | Une photo suffit à valider. Une validation sans photo est possible si l'objectif a été observé à l'oral ; une photo pourra être ajoutée plus tard. |
| Validation | Une seule validation par objectif et par élève. Pas d'échelle « en cours / acquis ». |
| Dossier | Un dossier par élève, rangé par domaine, avec photo, intitulé et date. |
| Bilan | Deux bilans par an. Le bilan ne contient que les validations de la période, depuis le bilan précédent. La date de changement de semestre (passage du bilan 1 au bilan 2) est choisie par l'enseignante. Une ou plusieurs feuilles A4 selon le volume. |
| Sortie | Feuille A4 imprimable par élève, PDF. |
| Appareils | iPhone, Android et iPad. Même PWA responsive : capture au téléphone, consultation et impression possibles sur tablette. |
| Stockage | 100 % local sur l'appareil. Aucun stockage en ligne, aucun compte. Une base par appareil ; le transfert se fait par export/import de sauvegarde. |
| Années | Aucune remise à zéro au 1er septembre. Les réussites restent rattachées à leur année scolaire ; la classe continue, les élèves partis sont supprimés. |
| Élèves | Ajout (prénom, initiale du nom facultative, section) et suppression définitive avec confirmation. |
| Ambiance | École maternelle : papier, bois, couleurs douces, formes arrondies, ton chaleureux et lisible. |
| Langue | Français. |

## 3. Objectifs, non-objectifs, anti-objectifs

### Objectifs

- Capturer une réussite en moins de 20 secondes, téléphone en main.
- Retrouver le dossier d'un élève en deux gestes et voir ses réussites par domaine.
- Savoir, pour chaque objectif, quels élèves l'ont validé (vue Programme).
- Produire un bilan A4 lisible, daté, avec les photos, en moins d'une minute par élève.
- Ne jamais perdre une année de données : continuité d'une année sur l'autre, sauvegarde exportable et restaurable.
- Donner une impression de cahier de classe, pas de logiciel de gestion.

### Non-objectifs (v1)

- Synchronisation automatique entre appareils, compte en ligne, cloud. Le passage d'un appareil à l'autre se fait par sauvegarde.
- Accès parents, portail famille, notifications.
- Gestion de plusieurs classes ou d'une école entière.
- Notes chiffrées, moyennes, bulletin scolaire.
- Analyse d'image, reconnaissance faciale, suggestion automatique d'objectif.
- Programme EVAR (éducation à la vie affective et relationnelle) : hors périmètre v1.
- Application native iOS/iPadOS/Android : l'application est une PWA installable.

### Anti-objectifs

- Un outil qui demande plus de temps qu'un cahier papier.
- Des photos d'enfants qui partent sur un serveur ou dans un CDN.
- Une interface « dashboard » froide, dense ou administrative.
- Des objectifs inventés ou reformulés à la place du programme officiel.
- Une validation en masse qui déshumanise l'observation.

## 4. Utilisatrice et moments d'usage

**Le matin, en classe.** L'enseignante a le téléphone en poche. Un élève vient de réussir quelque chose. Elle ouvre l'app, cherche l'élève, prend la photo, choisit l'objectif. Le geste doit être possible debout, avec une main.

**Le soir, à la maison.** Elle complète les validations observées à l'oral, sans photo, et parcourt le programme pour préparer la période.

**Deux fois par an, avant les rendez-vous.** Elle ouvre Bilans, choisit l'année et la période, vérifie l'aperçu d'un élève, génère le PDF, l'envoie sur son ordinateur et imprime une feuille par enfant.

**Sur la tablette.** Même application, plus large : consulter un dossier à deux, préparer un bilan, montrer une photo. Les données restent propres à l'appareil ; la sauvegarde permet de les transférer.

**À la rentrée.** Elle passe à la nouvelle année dans les réglages : la classe reste, les élèves partis sont supprimés, les nouveaux ajoutés. Les réussites de l'année précédente restent consultables.

**En début d'année et à l'arrivée d'un élève.** Elle ajoute des élèves ; en cas de départ, elle supprime le dossier avec une confirmation explicite.

## 5. Le référentiel

### 5.1 Source

- Programme d'enseignement de l'école maternelle (cycle 1), arrêté du 16 avril 2026, BO n°19 du 7 mai 2026, applicable à la rentrée 2026-2027.
- Domaines « langage oral et écrit » et « premiers outils mathématiques » : programme du BO n°41 du 31 octobre 2024, entré en vigueur en 2025-2026, repris dans la version consolidée.
- Le référentiel est embarqué dans l'application sous forme de fichier de données versionné. Il n'est pas saisi par l'enseignante.

### 5.2 Structure

Le programme est organisé en **six domaines**, eux-mêmes découpés en compétences, puis en **objectifs d'apprentissage** déclinés par âge, avec des **exemples de réussite**.

Domaines :

1. Le développement et la structuration du langage oral et écrit
2. Agir, s'exprimer, comprendre à travers les activités physiques
3. Agir, s'exprimer, comprendre à travers les activités artistiques
4. L'acquisition des premiers outils mathématiques
5. Se repérer dans le temps et l'espace
6. Découvrir le monde du vivant, de la matière et des objets

Chaque objectif porte :

- un identifiant stable ;
- son domaine et sa compétence parente ;
- son intitulé exact ;
- les tranches d'âge où il apparaît : « avant 4 ans », « à partir de 4 ans », « à partir de 5 ans » ;
- l'exemple de réussite associé, par tranche d'âge ;
- une référence de source (page / tableau) pour vérification.

Les tranches d'âge ne sont pas des sections rigides. Le texte dit « à partir de 4 ans **ou dès que les apprentissages précédents ont pu être observés** ». L'application utilise donc la section de l'élève comme filtre par défaut, avec une option « Voir tous les niveaux » pour valider un objectif d'une autre tranche.

### 5.3 Qualité des données

- Le référentiel est construit à partir du texte officiel, pas reformulé de mémoire.
- Un script de vérification contrôle : identifiants uniques, domaines valides, intitulés non vides, exemples présents, aucune tranche vide, nombre d'objectifs par domaine et par tranche cohérent avec le texte.
- Les comptes indicatifs du programme (114 objectifs « avant 4 ans », 140 « à partir de 4 ans », 162 « à partir de 5 ans ») servent de garde-fou, pas de source de vérité.
- Toute correction du référentiel est versionnée (`referentialVersion`).
- Les identifiants d'objectifs sont stables et ne sont jamais réutilisés. Si une version du référentiel retire ou renomme un objectif, l'ancien libellé reste résolvable ; chaque validation conserve une copie de l'intitulé, du domaine, de la tranche d'âge et de l'exemple au moment de la validation. Une correction du référentiel ne peut donc ni vider ni réétiqueter un dossier existant.

## 6. Parcours et écrans

### 6.1 Ma classe

- En-tête : marque florale, date, « Bonjour, Maîtresse », nombre d'élèves, année scolaire discrète.
- Filtres : Toute la classe / PS / MS / GS.
- Cartes élèves : deux colonnes sur téléphone, trois ou quatre sur iPad ; initiale colorée, prénom, pastille de section, nombre de réussites de l'année.
- Couleur de section : PS rose, MS moutarde, GS sauge. La pastille porte toujours la lettre, pas seulement la couleur.
- Lien « Gérer les élèves » sous la liste.
- Bouton flottant « Prendre une photo ».
- Navigation basse : Élèves / Programme / Bilans.

### 6.2 Nouvelle réussite (3 étapes)

1. **Pour qui ?** Recherche par prénom, filtre PS/MS/GS, grille de 20 élèves.
2. **Photo.** Élève rappelé en haut. Bouton d'ouverture de l'appareil photo natif. Actions : prendre la photo, reprendre, ou « Valider sans photo ». La photo reste sur l'appareil.
3. **Objectif.** Recherche, filtres par domaine, liste des objectifs du niveau de l'élève (avec option « tous les niveaux »). Les objectifs déjà validés apparaissent grisés avec leur date. Un objectif sélectionné affiche « Prêt à valider ». Le bouton « Valider la réussite » enregistre.

Après validation : écran de confirmation « C'est noté ! », avec l'objectif, la date et deux sorties : voir le dossier de l'élève, retour à la classe.

Depuis le dossier, deux entrées permettent de court-circuiter la photo :

- bouton appareil photo : photo avec l'élève déjà sélectionné ;
- lien « Ajouter une réussite sans photo » : arrive directement à l'étape 3.

### 6.3 Dossier de l'élève

- En-tête : retour, prénom, section, bouton Bilan.
- Sélecteur d'année discret (2026-2027, 2025-2026, toutes les années). Le dossier s'ouvre sur l'année en cours ; changer d'année ne change que l'affichage.
- Carte résumé : initiale, nombre de réussites de l'année sélectionnée, répartition par domaine.
- Domaines en accordéon : Langage, Maths, Corps, Arts, Temps, Vivant.
- Chaque domaine affiche son nombre de réussites et, déplié, les objectifs validés avec vignette photo, intitulé et date.
- Un objectif validé sans photo affiche une vignette « observation » et la mention « sans photo ».
- Toucher une réussite ouvre une fiche : photo en grand (si présente), intitulé, exemple de réussite, date, et action « Retirer cette réussite » avec confirmation.
- Bouton flottant appareil photo + lien « Ajouter une réussite sans photo ».
- Si un objectif a été validé dans une autre tranche d'âge, il apparaît avec une petite étiquette du niveau.
- Les réussites des années précédentes restent consultables ; elles ne comptent pas dans les compteurs ni dans les bilans de l'année en cours.

### 6.4 Programme

- En-tête « Programme », sous-titre « Les six domaines du programme 2026, objectif par objectif ».
- Recherche plein texte sur l'intitulé et le domaine.
- Filtres de niveau : Tous / PS / MS / GS.
- Domaines en accordéon. Chaque domaine affiche le nombre d'objectifs et le nombre de validations de la classe.
- Chaque objectif affiche son niveau, une barre d'avancement et le nombre d'élèves qui l'ont validé.
- Toucher un objectif ouvre une fiche : domaine, niveau, intitulé, exemple de réussite, élèves ayant validé (initiales), bouton « Valider pour un élève ».
- « Valider pour un élève » ouvre la liste des élèves ; un toucher ajoute la validation et met à jour les compteurs.
- La barre d'avancement se rapporte à l'effectif de la classe, ou à l'effectif du niveau quand un filtre de niveau est actif.
- Les compteurs portent sur l'année sélectionnée, avec le même sélecteur d'année que le dossier.

### 6.5 Bilans

- En-tête « Bilans », sous-titre « Deux fois par an, une feuille A4 par élève ».
- Sélecteur d'année scolaire, puis deux cartes de période : Bilan 1 (de la rentrée à la date de changement) et Bilan 2 (de la date de changement à la fin de l'année). La période en cours est mise en avant. Chaque année garde ses propres dates.
- La date de changement de semestre est réglable directement dans l'écran Bilans (et dans les réglages), pour l'année sélectionnée. La modifier met à jour l'aperçu et prévient si des validations changent de bilan.
- Bouton « Aperçu de la feuille » pour l'élève sélectionné (par défaut le premier de la liste, ou le dernier dossier ouvert).
- Liste des 20 élèves avec section, nombre de réussites de la période et accès à l'aperçu.
- Aperçu A4 : école, classe, enseignante, année, période, prénom (+ initiale du nom si renseignée), section, nombre de réussites, domaines en deux colonnes, entrées photo + intitulé + date, ligne « Signature des parents ».
- Pagination : une page si tout tient ; sinon plusieurs pages A4, avec en-tête, pied et « Page n / N » répétés. Aucune réussite n'est supprimée pour faire tenir la feuille.
- Les validations sans photo apparaissent avec une mention « Observation en classe » à la place de la vignette.
- Action « Imprimer / PDF » : génère un vrai fichier PDF et ouvre le partage natif (ou le téléchargement sur ordinateur). Pas d'impression directe depuis le navigateur.
- Le PDF ne contient que les validations dont la date tombe dans la période.

### 6.6 Gérer les élèves

- En-tête « Gérer les élèves » avec le nombre d'élèves.
- Bouton « Ajouter un élève ».
- Liste des élèves : initiale, prénom, section, nombre de réussites, icône corbeille.
- Ajout : feuille modale avec prénom (obligatoire), initiale du nom (facultative), section PS/MS/GS, bouton « Ajouter l'élève ». Le dossier démarre vide.
- Suppression : feuille modale « Supprimer Léa ? » avec le rappel du nombre de réussites et des photos, puis « Supprimer définitivement » (bouton rouge) et « Annuler ». Suppression en cascade : validations et photos.
- La suppression est définitive, sans archive, conformément à la décision de l'enseignante ; elle inclut les réussites de toutes les années.
- Éditer un élève (prénom, initiale, section) est inclus pour corriger une faute ou un changement de section.

### 6.7 Réglages

Accessibles par l'avatar de l'enseignante (rond « M ») ou depuis « Gérer les élèves ».

- École, classe, prénom de l'enseignante (pour l'en-tête du PDF).
- Année scolaire en cours, avec l'action « Passer à l'année suivante » : elle change le libellé et ouvre de nouvelles dates de bilan, sans supprimer aucune donnée.
- Date de changement de semestre (fin du bilan 1, début du bilan 2) et fin du bilan 2, enregistrées par année scolaire. La date de changement est aussi réglable depuis l'écran Bilans.
- Sauvegarde complète (toutes les années) : exporter un fichier ZIP, importer une sauvegarde (remplacement complet après confirmation), date de la dernière sauvegarde.
- Stockage : espace utilisé, quota, bouton « Demander un stockage persistant » ; sur iPhone et iPad, rappel d'installer l'app sur l'écran d'accueil.
- Notice de confidentialité et version de l'application.

## 7. Règles métier

### 7.1 Validation

- Une validation lie un élève, un objectif, une date et zéro ou une photo.
- Une seule validation par couple élève × objectif, toutes années confondues. Une nouvelle tentative est empêchée ; l'interface affiche « Déjà validé le … ».
- Chaque validation conserve une copie de l'intitulé, du domaine, de la tranche d'âge et de l'exemple de réussite tels qu'ils étaient au moment de la validation.
- La date par défaut est le jour de la validation. Elle peut être corrigée dans la fiche de la réussite (utile pour une observation notée le lendemain). Si la correction change l'année scolaire, la validation est reclassée dans la bonne année.
- Une validation sans photo est une validation normale ; elle apparaît dans le dossier et dans le PDF avec la mention « Observation en classe ».
- Une photo peut être ajoutée après coup à une validation sans photo.
- Retirer une validation la supprime, ainsi que sa photo, après confirmation.

### 7.2 Année scolaire, dates et bilans

- Une année scolaire est identifiée « 2026-2027 » et couvre du 1er septembre 2026 au 31 août 2027. Une validation de juillet ou août est rattachée à l'année qui vient de s'écouler.
- Chaque validation porte l'année scolaire déduite de sa date.
- Bilan 1 : du 1er septembre à la date de changement de semestre (31 janvier par défaut).
- Bilan 2 : du lendemain de la date de changement à la fin du bilan 2 (30 juin par défaut).
- La date de changement de semestre est choisie par l'enseignante, année par année, depuis l'écran Bilans ou les réglages. La modifier reclasse les validations concernées dans l'autre bilan ; l'aperçu et les PDF suivants en tiennent compte, les PDF déjà imprimés restent la trace de ce qui a été remis.
- Une validation de juillet ou août reste dans le dossier mais n'entre dans aucun des deux bilans.
- Les dates de bilan sont enregistrées par année scolaire : modifier l'année en cours ne change pas les bilans des années précédentes.
- Le 1er septembre, rien n'est effacé. « Passer à l'année suivante » change le libellé et ouvre de nouvelles dates ; la classe et les dossiers restent. Les élèves partis sont supprimés, les nouveaux ajoutés.
- Les compteurs de la classe, du dossier, du programme et des bilans portent sur l'année sélectionnée. Un sélecteur permet de consulter les années précédentes.
- Le PDF est recalculé à la demande. Il n'est pas figé en base : si une validation est antidatée après coup, l'aperçu du bilan passé change ; le PDF déjà imprimé reste la trace de ce qui a été remis aux parents.
- La date de changement de semestre et la fin du bilan 2 sont modifiables, avec un avertissement si des validations changent de bilan.

### 7.3 Suppression d'un élève

- Suppression définitive, avec confirmation explicite.
- La confirmation indique le nombre de réussites, toutes années confondues, et rappelle que les photos partent avec le dossier.
- Suppression en cascade dans une transaction : validations de toutes les années, photos, entrées de progression.
- Si l'élève supprimé était le dossier ouvert ou l'élève du bilan, l'application revient à la classe ou au premier élève disponible.
- Si la classe devient vide, l'écran affiche un état vide et le bouton d'ajout ; le bouton photo est désactivé.

### 7.4 Photos

- Prise de photo : appareil natif via `<input type="file" accept="image/*" capture="environment">`, fiable sur iPhone, iPad et Android. Pas de vue caméra intégrée en v1 : elle ajoute des permissions et des cas d'échec pour peu de gain.
- Recadrage non obligatoire ; l'image est affichée en vignette carrée ou 4:3.
- Compression : côté long max 1600 px, JPEG qualité 0,82, cible < 300 Ko. Une vignette max 400 px est stockée en plus pour les listes.
- Les photos HEIC d'iOS sont ré-encodées en JPEG par le canvas. Si le navigateur ne sait pas décoder le fichier, l'app demande de reprendre la photo ou d'utiliser un JPEG.
- Les métadonnées EXIF (dont la géolocalisation) sont supprimées par le ré-encodage canvas.
- Une photo ne quitte jamais l'appareil, sauf via le PDF ou la sauvegarde que l'enseignante partage elle-même.

### 7.5 Stockage et sauvegarde

- IndexedDB pour les données et les Blobs photo.
- `navigator.storage.persist()` demandé au premier lancement pour limiter l'éviction ; sur iPhone et iPad, l'installation sur l'écran d'accueil est fortement recommandée.
- Export ZIP complet (toutes les années) : `data.json`, le référentiel utilisé et les photos, écrit en streaming avec barre de progression.
- Import : validation du schéma et de la version, résumé (élèves, années, photos), confirmation de remplacement complet. C'est aussi le mécanisme de transfert entre appareils.
- Au-delà de 300 Mo, l'app prévient et recommande de garder l'écran allumé. Un export par année et une fusion de sauvegardes arrivent en v1.1.
- Rappel de sauvegarde si la dernière date de sauvegarde a plus de 30 jours ou après 50 nouvelles validations (compteur enregistré lors de la dernière sauvegarde).
- Aucune synchronisation automatique : chaque appareil a sa propre base.
- Aucun envoi réseau au fonctionnement. Les polices sont auto-hébergées.

## 8. Modèle de données

```ts
type Section = 'PS' | 'MS' | 'GS';
type AgeBand = 'before4' | 'from4' | 'from5';

interface Student {
  id: string;
  firstName: string;
  lastNameInitial?: string; // optionnel, pour le PDF
  section: Section;
  createdAt: string;        // ISO
}

interface SchoolYear {
  id: string;          // "2026-2027"
  start: string;       // YYYY-MM-DD, 1er septembre
  period1End: string;  // YYYY-MM-DD, date de changement de semestre
  period2End: string;  // YYYY-MM-DD, fin du bilan 2
}

interface Domain {
  id: 'langage' | 'maths' | 'corps' | 'arts' | 'temps' | 'vivant';
  label: string;
  longLabel: string;
  order: number;
}

interface Competency {
  id: string;
  domainId: Domain['id'];
  label: string;
}

interface Objective {
  id: string;
  competencyId: string;
  domainId: Domain['id'];
  label: string;
  ageBands: AgeBand[];
  examples: Partial<Record<AgeBand, string>>;
  source: { bo: string; page?: number; table?: string };
}

interface ValidationSnapshot {
  objectiveLabel: string;
  domainId: Domain['id'];
  domainLabel: string;
  ageBand: AgeBand;
  example?: string;
  referentialVersion: string;
}

interface Validation {
  id: string;
  studentId: string;
  objectiveId: string;
  schoolYearId: string;
  date: string;        // YYYY-MM-DD
  photoId?: string;
  snapshot: ValidationSnapshot;
  createdAt: string;
}

interface Photo {
  id: string;
  validationId: string;
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  mime: 'image/jpeg';
  createdAt: string;
}

interface Settings {
  schoolName: string;
  className: string;
  teacherName: string;
  currentSchoolYearId: string;
  lastBackupAt?: string;
  lastBackupValidationCount: number;
  referentialVersion: string;
  schemaVersion: number;
}
```

Contraintes :

- index unique `(studentId, objectiveId)` sur `Validation`, toutes années confondues ;
- index `studentId`, `objectiveId`, `date`, `schoolYearId` ;
- `SchoolYear` n'est jamais supprimée ; une année existe dès qu'une validation l'utilise ou que l'enseignante la démarre ;
- suppression en cascade `Student -> Validation -> Photo` ;
- `Photo` n'existe jamais sans validation.

## 9. Direction visuelle

La maquette de référence est le prototype HTML et la planche Figma.

- **Papier** : fond crème `#FBF6EC`, cartes `#FFFCF6`, bordures chaudes `#EADCC6`, encre `#2F2A24`.
- **Accents** : terre cuite `#D9765B`, sauge `#6F8F6A`, moutarde `#E7B65C`, ciel `#8FB3C7`, rose `#E9A6A0`.
- **Typographie** : Fraunces pour les titres (chaleureuse, un peu affiche), Nunito pour le texte (très lisible sur téléphone). Polices auto-hébergées.
- **Formes** : coins 20–28 px, boutons pilules, ombres douces, petits aplats de couleur par domaine.
- **Micro-détails** : fleur de marque, pastilles de section, vignettes illustrées, feuille A4 réaliste.
- **Ton** : chaleureux, artisanal, jamais puéril ni surchargé. Pas de clipart, pas d'emoji, pas de dégradé violet.
- **Accessibilité** : cibles ≥ 44 px, contraste texte ≥ 4,5:1, focus visible, libellés sur les boutons icônes, information jamais portée par la couleur seule, respect de `prefers-reduced-motion`.
- **Responsive** : téléphone à une main, deux colonnes ; iPad trois ou quatre colonnes et feuilles modales plus larges ; ordinateur centré (max 720 px) avec téléchargement du PDF. Pas de version desktop séparée en v1.
- **Safari iOS/iPadOS** : respecter les zones sûres, la barre d'outils dynamique (`100dvh`) et le clavier qui masque les champs.

## 10. Architecture technique

Choix techniques retenus :

- **Vite + React + TypeScript strict**. Pas de Next.js : l'app est 100 % statique et locale, sans SSR ni SEO.
- **IndexedDB via Dexie** + `dexie-react-hooks` pour les requêtes réactives.
- **PWA** : `vite-plugin-pwa`, manifest, service worker, installable, fonctionne hors ligne après le premier chargement.
- **Cibles** : iOS/iPadOS 16+, Android 10+ avec Chrome à jour. Safari et Chrome sont les navigateurs de référence ; Firefox mobile n'est pas testé.
- **Polices** : `@fontsource/fraunces` et `@fontsource/nunito` (pas de CDN au runtime).
- **PDF** : `pdf-lib` pour composer l'A4 et embarquer les JPEG, avec pagination et en-tête/pied répétés. Génération dans un Web Worker si nécessaire pour ne pas bloquer l'interface.
- **Partage** : `navigator.share({ files })` quand il est disponible (iOS 15+, Chrome Android) ; repli sur le téléchargement du PDF.
- **ZIP** : `fflate` pour la sauvegarde/restauration, en streaming.
- **Dates** : `date-fns` avec locale `fr`.
- **Routage** : hash router (`createHashRouter`) ou petite machine à états, pour rester compatible avec un hébergement statique.
- **Styles** : CSS Modules + variables CSS globales. Pas de Tailwind, pour préserver le dessin sur mesure.
- **Tests** : Vitest + Testing Library + `fake-indexeddb` ; Playwright pour les parcours (viewports iPhone et iPad), la persistance, la pagination PDF et le téléchargement.
- **CI** : lint, typecheck, tests, build, déploiement Vercel statique.

### 10.1 Découpage proposé

- `src/data/referential.json` : référentiel versionné.
- `src/db/` : schéma Dexie, migrations, requêtes.
- `src/features/students/` : classe, gestion, ajout/suppression.
- `src/features/capture/` : parcours élève → photo → objectif.
- `src/features/dossier/` : dossier, accordéons, fiche de réussite.
- `src/features/programme/` : domaines, objectifs, fiche, validation pour un élève.
- `src/features/bilans/` : périodes, aperçu A4, génération PDF.
- `src/features/settings/` : réglages, sauvegarde, stockage.
- `src/ui/` : boutons, champs, chips, feuilles modales, toast, navigation.
- `scripts/` : construction et vérification du référentiel.

### 10.2 Référentiel

Un script de build lit une source vérifiée et produit `referential.json` avec un rapport de contrôle. Le contenu est revu contre le BO avant d'être considéré comme livré. Aucun objectif n'est écrit de mémoire.

## 11. Confidentialité et sécurité

- Photos d'enfants : données sensibles. L'application ne les envoie nulle part.
- Aucun compte, aucun analytics, aucun crash reporting, aucune police ou ressource chargée depuis un tiers au runtime.
- L'enseignante reste responsable du consentement parental pour les photos, selon les règles de son école. L'app affiche une notice de première utilisation et un rappel dans les réglages.
- La sauvegarde ZIP n'est pas chiffrée en v1. Elle contient les photos et circule entre appareils : l'app le dit clairement, recommande un stockage protégé et de supprimer le fichier après transfert. Le chiffrement de la sauvegarde est un candidat v1.1.
- Le PDF contient des données personnelles ; l'enseignante choisit le canal de partage.
- Une base par appareil : aucune synchronisation automatique, donc aucune copie implicite ailleurs.
- Pas de verrouillage par code en v1 : le verrouillage de l'appareil protège l'app.

## 12. Performance et limites

- Cible : 20 élèves, 1 500 photos, 400 objectifs, plusieurs années.
- Écran classe < 2 s sur un téléphone milieu de gamme et sur iPad, photos en lazy loading.
- Génération d'un PDF < 10 s pour 30 entrées avec photos ; indicateur de progression ; pagination au-delà d'une page.
- Stockage : ~250 Ko par photo compressée ; 1 500 photos ≈ 375 Mo. Afficher l'usage et alerter à 80 % du quota.
- Sauvegarde : un ZIP complet de 1 500 photos peut peser plusieurs centaines de Mo ; export en streaming, avertissement au-delà de 300 Mo, restauration testée sur un jeu de 400 photos. L'export par année arrive en v1.1.
- Limite iOS/iPadOS : l'éviction du stockage est possible si l'app n'est pas installée ; recommander l'installation sur l'écran d'accueil et une sauvegarde régulière.
- HEIC : le ré-encodage canvas peut échouer sur certains fichiers ; prévoir un message clair plutôt qu'une photo cassée.

## 13. Critères d'acceptation

1. Ajouter « Noah » en PS : il apparaît dans la classe et dans « Gérer les élèves », avec 0 réussite.
2. Supprimer un élève : la confirmation indique son nombre de réussites ; après confirmation, il disparaît de la classe, du programme et des bilans, et ses validations/photos sont supprimées.
3. Parcours photo : classe → élève → photo → objectif → valider. La date est automatique, le compteur de l'élève augmente, le dossier affiche la photo et l'objectif.
4. Parcours sans photo : dossier → ajouter sans photo → objectif → valider. La ligne « observation » apparaît dans le dossier et dans le PDF.
5. Un objectif déjà validé ne peut pas être validé une deuxième fois et affiche sa date.
6. Le dossier montre les réussites par domaine, avec compteurs et dates ; une réussite peut être retirée avec confirmation.
7. Le programme se filtre par niveau et par domaine, se recherche, et permet de valider un objectif pour un élève.
8. Le bilan 1 ne contient que les validations de la période ; le bilan 2 ne contient que celles depuis le bilan 1. Le PDF A4 contient l'école, la classe, l'enseignante, l'année, la période, l'élève, les photos, les intitulés, les dates et la signature des parents. Il tient sur une page quand le volume le permet et pagine sinon, avec en-tête, pied et numérotation répétés.
9. Le PDF se télécharge ou s'ouvre dans le partage natif ; il est lisible en noir et blanc.
10. La sauvegarde ZIP s'exporte et se restaure sur un autre appareil (iPhone, Android ou iPad) ; les élèves, les années, les validations et les photos sont retrouvés.
11. L'app fonctionne hors ligne après le premier chargement ; aucune requête réseau liée aux données n'est observable.
12. Les 20 élèves et 1 500 photos restent utilisables ; l'écran classe et la génération PDF tiennent les cibles de performance.
13. L'interface est en français, avec accents et dates au format français.
14. Les cibles tactiles font au moins 44 px et les contrastes texte sont conformes.
15. Le passage à l'année suivante ne supprime rien : les réussites de l'année précédente restent consultables dans le dossier et dans les bilans de leur année.
16. Sur iPad, l'interface utilise la largeur disponible (grille de trois ou quatre colonnes) sans déformation ; sur iPhone et Android, elle reste utilisable à une main.
17. Un élève sans initiale de nom s'affiche et s'imprime avec son prénom seul.
18. Un bilan qui dépasse une page est paginé sans omettre aucune réussite.
19. La date de changement de semestre se modifie depuis l'écran Bilans ; après modification, les validations basculent dans le bon bilan et l'aperçu se met à jour.

## 14. Décisions laissées au constructeur (tranchées)

Ces points ne demandent plus d'arbitrage : ils sont fixés pour que le plan soit exécutable.

- **Extraction du référentiel** : script de build à partir du texte officiel, contrôle automatique des comptes et relecture humaine contre le BO. C'est le risque principal du projet.
- **Référentiel mouvant** : identifiants stables, objectifs retirés conservés, snapshot de l'intitulé, du domaine, de la tranche et de l'exemple sur chaque validation.
- **Visibilité inter-niveaux** : simple filtre « tous les niveaux » dans l'étape objectif, désactivé par défaut.
- **Date de validation** : éditable, date du jour par défaut ; un changement d'année reclassifie la validation.
- **Pagination du bilan** : une page si ça tient, sinon plusieurs pages avec en-tête, pied et numérotation.
- **Date de changement de semestre** : réglable dans Bilans et dans les réglages, par année scolaire ; le changement reclasse les validations et met à jour l'aperçu.
- **Initiale du nom** : champ facultatif, affiché sur le PDF seulement s'il est renseigné.
- **Capture photo** : appareil natif via `input file`, pas de vue caméra intégrée en v1.
- **Sauvegarde** : ZIP unique complet, streaming, avertissement au-delà de 300 Mo ; restauration = remplacement complet.
- **Transfert entre appareils** : par sauvegarde, sans synchronisation automatique.
- **Année scolaire** : aucune remise à zéro ; table `SchoolYear`, sélecteur d'année, action « Passer à l'année suivante ».
- **Navigateurs** : iOS/iPadOS 16+, Android 10+ avec Chrome à jour.
- **Lot de PDF** : reporté en v1.1.
- **Sauvegarde chiffrée** : reportée en v1.1.
- **Nom de l'application** : « Carnet de réussites » reste un nom de travail.

## 15. Plus tard (v1.1 et au-delà)

- Génération des 20 bilans en lot (ZIP ou PDF combiné).
- Export d'une année seule et fusion de sauvegardes.
- Sauvegarde chiffrée par mot de passe.
- Verrouillage de l'app par code.
- Objectifs « maison » en plus du programme officiel.
- Import CSV de la liste des élèves.
- Programme EVAR.
- Statistiques de classe par domaine (sans note chiffrée).

## 16. Références de conception

- Prototype cliquable : `maquettes/prototype.html` (données fictives, à ne pas réutiliser comme code de production).
- Captures : `maquettes/proto-01-classe.png` à `proto-12-supprimer.png`.
- Bilan imprimé de démonstration : `maquettes/bilan-demo.pdf`.
- Planche Figma : page « Livret suivi apprentissage ».
- Programme officiel : BO n°19 du 7 mai 2026 ; version consolidée BO n°41 du 31 octobre 2024.
