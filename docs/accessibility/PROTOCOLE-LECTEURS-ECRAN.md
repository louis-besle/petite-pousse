# Protocole de validation avec lecteurs d’écran — Carnet de réussites

**Version du protocole :** 1.0  
**Date de rédaction :** 7 novembre 2026  
**Portée :** VoiceOver sur iPhone/iPadOS et TalkBack sur Android  
**Statut :** **non exécuté** — aucun appareil physique n’est disponible dans l’environnement de développement.  
**Document lié :** [`AUDIT-WCAG-RGAA.md`](./AUDIT-WCAG-RGAA.md), critères RGAA 4.1.2 **7.1** et **13.3**

> **Exigence de preuve.** Les tests automatisés (axe sur Chromium et WebKit) ne
> remplacent pas une validation avec lecteur d’écran réel. **Aucune conformité
> RGAA 7.1 ne peut être déclarée avant l’exécution de ce protocole sur au moins
> un iPhone et un appareil Android réels**, avec les résultats consignés et
> datés. Tant que ce document n’est pas exécuté, l’audit reste **partiellement
> conforme**.

---

## 1. Objet

Ce protocole permet à un enseignant ou à un développeur d’exécuter, **sans
l’aide de l’auteur du code**, la vérification manuelle des parcours critiques de
l’application avec VoiceOver et TalkBack.

Il couvre les exigences suivantes, imposées par l’audit :

1. annonce du **titre de page** à chaque changement d’écran ;
2. **déplacement du focus** sur le contenu principal après un changement de route ;
3. **navigation par titres** dans chaque écran ;
4. **libellés des champs** et **annonce des erreurs** de formulaire ;
5. **piège de focus** des feuilles modales, fermeture et retour du focus ;
6. **annonces `aria-live`** des messages, toasts et progressions ;
7. **alternative HTML accessible** au PDF non balisé (aperçu A4).

Les résultats sont consignés dans le tableau du § 9, puis reportés dans
`AUDIT-WCAG-RGAA.md` et la matrice RGAA.

---

## 2. Prérequis

### 2.1 Matériel et logiciels

| Élément | Exigence |
| --- | --- |
| iPhone ou iPad | iOS/iPadOS 16 ou supérieur, VoiceOver activé |
| Appareil Android | Android 11 ou supérieur, TalkBack installé (version 13 ou supérieure recommandée) |
| Navigateur iOS | Safari (seul moteur autorisé sur iOS) |
| Navigateur Android | Chrome stable |
| Application | build de production déployé, **ou** serveur local accessible depuis l’appareil (`npm run dev -- --host`, même réseau Wi-Fi) |
| Réseau | première visite en ligne ; vérifier ensuite le fonctionnement hors ligne |
| Sauvegarde | un fichier `.zip` de sauvegarde exporté sur l’appareil, pour l’étape 12 |
| Preuve | capture d’écran, enregistrement d’écran ou panneau de sous-titres VoiceOver |

### 2.2 Données de test

Préparer une base avec :

- un élève de section **MS** nommé **Léa** ;
- une réussite avec photo sur un objectif du domaine « Langage » ;
- une seconde réussite sans photo (facultatif, pour la mention « Observation en
  classe ») ;
- l’année scolaire courante **2026-2027**.

Le script du § 6 crée ces données par l’interface : aucune donnée réelle
d’élève ne doit être utilisée.

### 2.3 Réglages à noter avant de commencer

- vitesse d’élocution (VoiceOver : Réglages > Accessibilité > VoiceOver >
  Débit ; TalkBack : Paramètres > Accessibilité > TalkBack > Débit de la
  synthèse vocale) ;
- voix utilisée ;
- mode d’affichage (clair/sombre) ;
- taille de texte et zoom navigateur ;
- connexion filaire ou Bluetooth pour l’audio.

Ces valeurs conditionnent la reproductibilité : les indiquer dans la fiche de
session (§ 9.1).

---

## 3. Activer VoiceOver (iPhone / iPad)

1. Ouvrir **Réglages > Accessibilité > VoiceOver**.
2. Activer **VoiceOver**. Un double-clic sur le bouton latéral peut être
   proposé comme raccourci (Réglages > Accessibilité > Raccourci
   d’accessibilité).
3. Vérifier que VoiceOver lit l’écran d’accueil : balayer vers la droite.
4. Pour les preuves, activer le **panneau de sous-titres** : Réglages >
   Accessibilité > VoiceOver > Commandes > Panneau de sous-titres, puis
   l’afficher par le rotor.
5. Ouvrir **Safari** et charger l’application.

> Le rotor s’utilise en posant deux doigts sur l’écran et en tournant. Il permet
> de choisir le mode de navigation : **Titres**, **Boutons**, **Champs de
> saisie**, **Liens**, **Zones de texte**.

---

## 4. Activer TalkBack (Android)

1. Ouvrir **Paramètres > Accessibilité > TalkBack**.
2. Activer **Utiliser TalkBack**, confirmer la boîte de dialogue.
3. Vérifier que TalkBack lit l’écran : balayer vers la droite.
4. Pour les preuves, lancer un **enregistrement d’écran** (voix comprise si
   l’appareil le permet) depuis le panneau de notifications.
5. Ouvrir **Chrome** et charger l’application.

> TalkBack 13 et supérieur propose le mode « Navigation par commandes » ; le
> mode « Navigation par balayage » reste la référence de ce protocole.

---

## 5. Gestes de référence

| Action | VoiceOver (iOS) | TalkBack (Android) |
| --- | --- | --- |
| Élément suivant / précédent | balayer à droite / à gauche | balayer à droite / à gauche |
| Activer l’élément | double-taper | double-taper |
| Choisir un mode de navigation | rotor (rotation à deux doigts) | balayage haut/bas puis choisir « Titres », « Boutons », « Champs de saisie » |
| Faire défiler | trois doigts | deux doigts |
| Revenir en arrière | balayage en Z à deux doigts, ou bouton « Retour » de l’écran | bouton « Retour » de l’écran ou geste système |
| Fermer une feuille modale | bouton « Fermer » de la feuille, ou balayage en Z | bouton « Fermer » de la feuille, ou geste système « Retour » |
| Lire l’écran depuis le début | deux doigts en haut de l’écran | balayage vers le bas puis « Lire depuis le début » |

> **Ne pas utiliser la souris, le clavier, ni le lecteur d’écran d’un navigateur
> de bureau** comme substitut. Le test doit être tactile et vocal.

---

## 6. Script en 12 étapes (à exécuter sur chaque plateforme)

Cocher chaque étape et noter l’annonce réellement entendue. Les libellés entre
guillemets sont les textes attendus dans l’interface.

### Étape 1 — Chargement et titre de page

- **Action :** ouvrir l’application à l’adresse de test.
- **Attendu :** VoiceOver/TalkBack annonce le titre **« La classe · Carnet de
  réussites »** (ou le titre de l’onglet), la langue est le français, puis le
  titre de niveau 1 « Bonjour… ».
- **Échec si :** le titre n’est pas annoncé, est en anglais, ou l’écran est muet
  au chargement.

### Étape 2 — Lien d’évitement et navigation par titres

- **Action :** parcourir depuis le début de la page ; activer « Aller au contenu
  principal ». Puis passer en navigation « Titres » et parcourir les titres.
- **Attendu :** le lien d’évitement est le premier élément ; son activation
  place le focus sur le contenu principal ; les titres sont annoncés avec leur
  niveau (« titre niveau 1 », « titre niveau 2 »).
- **Échec si :** le lien est absent, l’activation ne déplace pas le focus, ou
  les titres ne sont pas listés par le rotor / la navigation par titres.

### Étape 3 — Écran de la classe

- **Action :** parcourir les cartes élèves.
- **Attendu :** chaque carte est annoncée comme **lien** avec le prénom, la
  section et le nombre de réussites : « Léa, section MS, 1 réussite, lien ».
  Le bouton « Prendre une photo » est annoncé comme bouton.
- **Échec si :** le nom accessible est vide, tronqué, ou si la carte n’est pas
  activable au double-taper.

### Étape 4 — Choix de l’élève

- **Action :** activer « Prendre une photo », puis choisir « Léa, section MS ».
- **Attendu :** le titre « Nouvelle réussite » est annoncé ; le groupe
  récapitulatif est annoncé « Élève Léa, section MS, groupe ».
- **Échec si :** le focus reste sur l’écran précédent ou le groupe n’a pas de
  nom.

### Étape 5 — Capture photo

- **Action :** activer « Prendre la photo » (ou le champ d’import), choisir une
  image, revenir à l’application.
- **Attendu :** l’image est annoncée « Photo de réussite de Léa, image » ; le
  badge « Photo prise » est annoncé ; le bouton « Choisir l’objectif » est
  disponible.
- **Échec si :** l’image est muette, sans alternative, ou si le retour depuis
  l’appareil photo perd le focus.

### Étape 6 — Choix de l’objectif

- **Action :** activer « Choisir l’objectif », saisir « lettres capitales » dans
  le champ « Rechercher un objectif », parcourir les résultats, sélectionner
  « Tracer des lettres capitales ».
- **Attendu :** le titre « Choisir l’objectif » est annoncé ; le champ est
  annoncé avec son libellé ; la carte sélectionnée est annoncée
  « appuyé / sélectionné » (`aria-pressed="true"`).
- **Échec si :** le champ n’a pas de libellé, le filtre n’est pas annoncé, ou
  l’état de sélection n’est pas vocalisé.

> **Variante formulaire élève (contrôle T4).** Depuis « Élèves », ouvrir
> « Ajouter un élève » : vérifier que le champ « Prénom » est annoncé avec son
> libellé et que le groupe « Section » est annoncé comme un groupe de boutons.
> Vérifier que le bouton « Ajouter l’élève » est annoncé comme désactivé tant
> que le prénom est vide. Fermer avec « Annuler ».

### Étape 7 — Validation de la réussite

- **Action :** activer « Valider la réussite ».
- **Attendu :** l’écran de succès est annoncé : titre « C’est noté ! », message
  de confirmation, bouton « Voir le dossier de Léa ». Le message de confirmation
  est annoncé une seule fois, sans doublon.
- **Échec si :** le succès n’est pas annoncé, ou le focus reste sur le bouton
  précédent.

### Étape 8 — Dossier de l’élève

- **Action :** activer « Voir le dossier de Léa », parcourir les réussites.
- **Attendu :** titre « Léa » ; chaque réussite est un bouton nommé par
  l’objectif ; la photo est annoncée avec son alternative ; le compteur
  « 1 réussite » est lisible.
- **Échec si :** les réussites ne sont pas atteignables, ou l’image est
  annoncée comme « image sans description ».

### Étape 9 — Filtre et validation dans le programme

- **Action :** ouvrir « Programme » depuis la navigation basse, filtrer par
  niveau **PS** avec le groupe « Filtrer par niveau », rechercher
  « syllabes », ouvrir un objectif, activer « Valider pour un élève », choisir
  « Léa, section MS ».
- **Attendu :** le titre « Programme » est annoncé ; le filtre est annoncé comme
  groupe de boutons avec l’état actif ; le compteur et la barre de progression
  sont annoncés (« 1 élève sur 2 ») ; le message « Réussite ajoutée à Léa. »
  est annoncé par la région `aria-live="polite"` ; la valeur de la barre évolue.
- **Échec si :** le filtre n’a pas de nom, la progression n’est pas annoncée,
  ou le message de confirmation est silencieux.

### Étape 10 — Aperçu HTML du bilan

- **Action :** ouvrir « Bilans », choisir le bilan 1, ouvrir « Léa, section MS,
  1 réussite pour le bilan 1 ».
- **Attendu :** le titre « Bilan de Léa » est annoncé ; l’article « Aperçu de la
  feuille A4 de Léa » est parcourable titre par titre ; la note **« L’aperçu à
  l’écran est la version accessible ; le PDF, généré par le bouton ci-dessous,
  est destiné à l’impression. »** est annoncée ; le bouton « Imprimer / PDF »
  est présent.
- **Échec si :** l’aperçu n’est pas structuré par titres, ou la note annonçant
  l’alternative accessible est absente ou illisible.

> **Variante formulaire (contrôles T4 et T5).** Depuis « Bilans », ouvrir
> « Modifier la date de changement ». Vérifier le libellé « Date de changement
> de semestre », puis saisir une date hors bornes : l’erreur doit être annoncée
> et reliée au champ. Annuler sans enregistrer.

> **Alternative au PDF non balisé (RGAA 13.3).** L’aperçu HTML A4 est la
> version accessible de référence. Ne pas tenter de valider le PDF avec le
> lecteur d’écran comme s’il était balisé : le critère 13.3 reste **non
> conforme** pour le PDF, et la mesure compensatoire est cet aperçu HTML.

### Étape 11 — Export de sauvegarde

- **Action :** ouvrir « Réglages », activer « Exporter une sauvegarde ».
  Variante : cocher « Protéger par un mot de passe », saisir un mot de passe de
  8 caractères minimum et sa confirmation, puis exporter.
- **Attendu :** le bouton est annoncé avec son état (désactivé pendant
  l’export) ; le téléchargement est annoncé par le système ou par l’application ;
  le nom du fichier est cohérent ; en mode chiffré, l’avertissement sur
  l’irréversibilité est annoncé avant la validation.
- **Échec si :** l’état d’attente n’est pas annoncé, ou l’avertissement du mot
  de passe n’est pas lisible.

### Étape 12 — Import et restauration

- **Action :** activer « Importer une sauvegarde », choisir le fichier exporté,
  confirmer la feuille « Restaurer cette sauvegarde ? » (ou saisir le mot de
  passe dans la feuille « Sauvegarde chiffrée »).
- **Attendu :** la feuille est annoncée avec son nom ; le focus est piégé dans
  la feuille ; le résumé (« 1 élève », « 1 réussite », « 1 photo ») est lu ; le
  bouton « Restaurer la sauvegarde » est activable ; le message
  « Sauvegarde restaurée. » est annoncé ; la feuille se ferme et le focus
  revient au déclencheur.
- **Échec si :** le focus s’échappe de la feuille, le résumé n’est pas lu, ou la
  confirmation n’est pas annoncée.

---

## 7. Contrôles transverses obligatoires

Ces sept points doivent être explicitement cochés, en plus du script. Ils
peuvent être observés pendant les étapes indiquées.

| # | Contrôle | Comment le vérifier | Étape |
| --- | --- | --- | --- |
| T1 | **Titre de page annoncé** | changer de route et vérifier l’annonce du titre d’onglet / de page | 1, 4, 6, 8, 9, 10 |
| T2 | **Focus sur le contenu après changement de route** | après activation d’un lien de navigation, vérifier que le focus arrive sur le contenu principal et non sur l’ancien lien | 8, 9, 10 |
| T3 | **Navigation par titres** | rotor « Titres » (iOS) ou navigation « Titres » (Android) sur chaque écran | 2, 8, 9, 10 |
| T4 | **Libellés de formulaire** | ouvrir « Ajouter un élève » et vérifier que « Prénom » et le groupe « Section » sont annoncés avec leur rôle ; dans les bilans, vérifier « Date de changement de semestre » | 6 (variante formulaire élève), 10 (variante dates de bilan) |
| T5 | **Erreurs de formulaire annoncées** | dans « Modifier la date de changement », saisir une date hors bornes : l’erreur « La date doit être comprise entre … (bornes exclues) » doit être annoncée, associée au champ (`aria-invalid`, `aria-describedby`) | 10 (variante dates de bilan) |
| T6 | **Piège de focus des feuilles** | ouvrir une fiche objectif, parcourir jusqu’aux extrémités, fermer avec « Fermer » puis vérifier le retour du focus au déclencheur | 9, 12 |
| T7 | **Progressions et messages `aria-live`** | vérifier l’annonce de « Réussite ajoutée à Léa. » et de « Sauvegarde restaurée. » (toasts `aria-live="polite"`), de la progression « Bilan 3 sur 20 · Léa » (bilans en lot, `role="status"`) et de la progression d’export, ainsi que les erreurs de chargement (`role="alert"`) | 9, 10, 11, 12 |

> Pour T5, noter le texte exact de l’erreur entendu : il doit être en français,
> compréhensible hors contexte et associé au champ fautif. Le formulaire élève
> ne produit pas d’erreur en ligne : son bouton reste désactivé tant que le
> prénom est vide ; vérifier dans ce cas que l’état désactivé est bien annoncé.

---

## 8. Consignation des résultats

Pour chaque étape, utiliser l’un des statuts suivants :

| Statut | Signification |
| --- | --- |
| **OK** | l’annonce et le comportement sont conformes à l’attendu |
| **KO** | l’attendu n’est pas respecté (décrire précisément) |
| **BLOQUÉ** | l’étape n’a pas pu être exécutée (préciser pourquoi) |
| **N. A.** | l’étape ne s’applique pas à cette configuration |

Chaque **KO** doit comporter :

1. l’annonce réellement entendue (verbatim) ;
2. le comportement observé ;
3. une capture d’écran ou un horodatage dans l’enregistrement ;
4. la gravité : **bloquant** / **majeur** / **mineur**.

Conserver les preuves dans un dossier daté, par exemple
`docs/accessibility/preuves/2026-11-07-voiceover-iphone/`. Ne jamais y placer de
donnée d’élève réelle.

---

## 9. Modèles de résultats

### 9.1 Fiche de session

| Champ | Valeur |
| --- | --- |
| Date et heure | |
| Testeur | |
| Appareil et modèle | |
| Version de l’OS | |
| Navigateur et version | |
| Lecteur d’écran et version | |
| Débit de la voix | |
| Voix | |
| Réglages d’affichage (thème, taille de texte, zoom) | |
| Version de l’application / commit | |
| URL testée | |
| Preuves (chemins) | |

### 9.2 Tableau de résultats

Dupliquer ce tableau pour VoiceOver et pour TalkBack.

| # | Étape | Annonce attendue (résumé) | Statut | Annonce entendue / notes |
| --- | --- | --- | --- | --- |
| 1 | Chargement | « La classe · Carnet de réussites » | | |
| 2 | Évitement et titres | lien puis contenu principal ; titres hiérarchisés | | |
| 3 | Classe | « Léa, section MS, 1 réussite, lien » | | |
| 4 | Choix de l’élève | « Élève Léa, section MS, groupe » | | |
| 5 | Photo | « Photo de réussite de Léa, image » | | |
| 6 | Objectif | champ libellé, carte « sélectionnée » | | |
| 7 | Validation | « C’est noté ! » | | |
| 8 | Dossier | titre « Léa », réussites boutons | | |
| 9 | Programme | filtre nommé, progression annoncée | | |
| 10 | Bilan HTML | article A4, note « version accessible » | | |
| 11 | Export | bouton, état d’attente, avertissement | | |
| 12 | Import | feuille nommée, résumé, focus rendu | | |
| T1 | Titre de page | titre annoncé à chaque route | | |
| T2 | Focus route | focus sur le contenu principal | | |
| T3 | Navigation titres | tous les titres atteignables | | |
| T4 | Libellés | champs nommés | | |
| T5 | Erreurs | erreur française associée au champ | | |
| T6 | Piège de focus | focus piégé puis rendu | | |
| T7 | `aria-live` | messages et progression annoncés | | |

### 9.3 Synthèse

| Plateforme | Étapes OK | KO | Bloqués | Verdict 7.1 |
| --- | ---: | ---: | ---: | --- |
| VoiceOver / iPhone | | | | |
| TalkBack / Android | | | | |

---

## 10. Critères de conclusion

- **7.1 reste non conforme** tant que les deux plateformes n’ont pas été
  exécutées et que les KO bloquants ou majeurs ne sont pas corrigés.
- **7.1 peut être déclaré conforme** uniquement si :
  1. les 12 étapes et les 7 contrôles transverses sont **OK** sur VoiceOver
     **et** sur TalkBack ;
  2. aucun KO bloquant ou majeur ne subsiste ;
  3. les preuves sont archivées et la fiche de session est renseignée ;
  4. la matrice RGAA et `AUDIT-WCAG-RGAA.md` sont mis à jour avec la date et la
     version testées.
- **13.3 reste non conforme** pour le PDF non balisé, quelle que soit l’issue de
  ce protocole. L’aperçu HTML A4 est la mesure compensatoire documentée ; il
  doit être vérifié à l’étape 10.
- Les tests WebKit automatisés (`npx playwright test --project=webkit`)
  apportent une preuve **complémentaire** de non-régression du moteur Safari.
  Ils ne remplacent ni VoiceOver, ni TalkBack, ni une matrice de technologies
  d’assistance.

Après exécution, reporter dans l’audit :

- la date et les appareils testés ;
- le nombre d’étapes OK / KO ;
- les éventuels correctifs livrés ;
- le nouveau statut de 7.1, sans arrondir à la hausse.

---

## 11. Maintenance du protocole

Réexécuter au minimum :

- avant chaque déclaration d’accessibilité ;
- après toute modification de la navigation, des titres de page, des feuilles
  modales, des formulaires, des messages live ou de l’aperçu A4 ;
- après une montée de version majeure d’iOS, d’iPadOS, d’Android, de Safari ou
  de Chrome ;
- après l’ajout d’un nouveau parcours critique (bilan en lot, sauvegarde
  chiffrée, nouveau programme).

Mettre à jour la version du protocole et conserver les sessions précédentes :
une conformité sans preuve datée n’est pas une conformité.
