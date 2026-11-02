# Guide d’utilisation — Petite pousse

**Application :** Petite pousse, suivi des apprentissages en maternelle (PS, MS, GS)  
**Version décrite :** 1.1.1 + évolutions de `main` au 16 novembre 2026 — **Date de rédaction :** 16 novembre 2026  
**Adresse :** <https://carnet-de-reussites.vercel.app>

> **Note de maintenance.** Guide à relire après chaque évolution de l’interface :
> un libellé déplacé ou un écran renommé peut rendre une étape inexacte.

## 1. À qui s’adresse ce guide et ce que fait l’application

Ce guide s’adresse d’abord à l’enseignante qui tient la classe, puis aux familles qui reçoivent un bilan imprimé. Il décrit les gestes de tous les jours, sans supposer de compétence technique particulière.

Petite pousse remplace les photos « perdues dans le téléphone » par un classeur numérique : élèves filtrables par section, réussites avec photo facultative, programme officiel 2026 et programme EVAR, dossier par élève, bilans A4 et sauvegarde complète. L’application ne crée aucun compte, n’envoie rien sur Internet et ne propose ni synchronisation, ni notes chiffrées, ni statistiques de classe, ni objectifs personnalisés, ni import CSV. Ces absences sont volontaires : l’outil reste un carnet d’observation, pas un logiciel administratif.

## 2. Installer l’application sur iPhone, iPad, Android ou ordinateur

Petite pousse est une **PWA** : un site web installable qui s’ouvre comme une application et fonctionne hors ligne après le premier chargement.

### Sur iPhone et iPad

1. Ouvrez l’adresse dans **Safari**, touchez **Partager** (le carré avec une flèche vers le haut), puis **« Sur l’écran d’accueil »** et confirmez.
2. Ouvrez ensuite l’application depuis l’icône ajoutée. La notice est rappelée dans **Profil → Installer l’application** tant que l’application n’est pas installée.

### Sur Android et sur ordinateur

1. Ouvrez l’adresse dans **Chrome** (ou Edge sur ordinateur).
2. Ouvrez le menu du navigateur, ou utilisez l’icône d’installation de la barre d’adresse, puis choisissez **« Installer l’application »** (ou **« Ajouter à l’écran d’accueil »**).

### Fonctionnement hors ligne et données locales

Après un premier chargement complet, l’application se rouvre sans réseau : la classe, les dossiers, la capture et la génération des PDF restent disponibles, les polices nécessaires aux PDF étant mises en cache avec l’application.

Les élèves, les photos et les réussites sont enregistrés **uniquement sur l’appareil**, dans le stockage local du navigateur. Aucune copie n’existe sur un serveur, et installer l’application sur un second appareil ne copie pas les données : le transfert se fait par une sauvegarde ZIP (section 9).

## 3. Premier lancement : école, classe, année et notice

Au premier lancement, la classe est vide et l’année scolaire qui contient la date du jour est créée automatiquement. Les champs d’identité sont vides.

1. Ouvrez l’application : l’écran **Classe** affiche « Bonjour, Maîtresse ». Touchez l’avatar de l’enseignante, en haut à droite, pour ouvrir le **Profil** (libellé accessible : « Ouvrir le profil »).
2. Dans la carte **École et classe**, renseignez le **Nom de l’école**, la **Classe** et le **Prénom de l’enseignante**, puis touchez **Enregistrer**. Ces informations apparaissent sur l’en-tête des bilans PDF.
3. Vérifiez la carte **Année scolaire** : elle affiche l’année en cours, par exemple 2026-2027.
4. Dans la carte **Dates des bilans**, contrôlez les deux périodes. Par défaut, le **Bilan 1** va du 1er septembre au 31 janvier et le **Bilan 2** du 1er février au 30 juin. Pour ajuster la limite, touchez **Modifier la date de changement**, choisissez une date comprise entre la rentrée et la fin du bilan 2, puis **Enregistrer**. Le même formulaire, ouvert depuis le profil, permet aussi de régler la **Fin du bilan 2**.
5. Au premier passage dans le profil, la notice **« Tes données restent sur ton appareil »** s’affiche : lisez-la puis touchez **J’ai compris**. Elle reste consultable par **Relire la notice**.

Ajoutez ensuite les élèves (section 4). La notice rappelle que la sauvegarde ZIP est indispensable, qu’un mot de passe de sauvegarde n’est jamais récupérable et que la suppression d’un élève efface définitivement son dossier.

## 4. Écran Classe : filtrer, ajouter, modifier, ouvrir un dossier

L’écran **Classe** est l’accueil. La navigation basse propose **Classe**, **Programme** et **Bilans**.

1. Lisez l’en-tête : date du jour, nombre d’élèves et année scolaire.
2. Filtrez avec les pastilles **Toute la classe**, **PS**, **MS** ou **GS**.
3. Touchez la carte d’un élève pour ouvrir son **dossier**. La carte indique son prénom, sa section et son nombre de réussites de l’année en cours.
4. Touchez **Prendre une photo** pour lancer une nouvelle réussite. Ce bouton est désactivé tant que la classe est vide.
5. Le rappel **« Sauvegarde conseillée »** renvoie au profil. Il se déclenche dès qu’une réussite existe sans sauvegarde, après 30 jours sans sauvegarde ou après 50 nouvelles réussites.

### Ajouter, modifier ou supprimer un élève

1. Ouvrez le **Profil** par l’avatar, puis **Gérer les élèves**, et touchez **Ajouter un élève**.
2. Renseignez le **Prénom** (obligatoire), l’**Initiale du nom** (facultative, une seule lettre, reprise sur les bilans) et la **Section** (PS, MS ou GS), puis touchez **Ajouter l’élève**. Son dossier démarre vide.
3. Pour corriger un prénom, une initiale ou une section, touchez la ligne de l’élève, modifiez les champs puis touchez **Enregistrer**.
4. Pour supprimer un élève, touchez l’icône de corbeille de sa ligne. La confirmation **« Supprimer Léa ? »** rappelle le nombre de réussites et de photos concernées. Touchez **Supprimer définitivement** ou **Annuler**.

La suppression est irréversible : elle efface le dossier, toutes ses réussites (y compris celles des années précédentes) et toutes ses photos.

## 5. Enregistrer une nouvelle réussite

Le parcours se fait en trois étapes, avec un repère **1 / 3**, **2 / 3**, **3 / 3**.

### Étape 1 — Pour qui ?

1. Touchez **Prendre une photo** depuis la classe ou depuis un dossier.
2. Cherchez l’élève dans **Rechercher un élève** : la recherche ignore les majuscules et les accents. Filtrez au besoin avec **Toute**, **PS**, **MS** ou **GS**, puis touchez la carte de l’élève.

### Étape 2 — Photo facultative

1. Touchez **Prendre la photo** : choisissez **Caméra** pour ouvrir l’appareil photo natif du téléphone ou de la tablette, ou **Photothèque** pour reprendre une photo déjà enregistrée sur l’appareil. Cadrez ou choisissez l’image, puis vérifiez l’aperçu : le badge **Photo prise** confirme l’ajout.
2. Touchez **Reprendre** pour remplacer la photo — le choix **Caméra** / **Photothèque** réapparaît — puis **Choisir l'objectif**. Pour renoncer à la photo, touchez **Valider sans photo** : vous passez directement au choix de l’objectif.

Une réussite peut toujours être enregistrée **sans photo**. Elle apparaît dans le dossier et dans le bilan avec les mentions « Observation en classe » et « sans photo » ; une photo pourra être ajoutée plus tard. La photo est compressée, ses métadonnées sont retirées et elle ne quitte pas l’appareil, sauf si vous partagez vous-même un PDF ou une sauvegarde.

### Étape 3 — Objectif, date et validation

1. Cherchez l’objectif dans **Rechercher un objectif**, ou filtrez par domaine avec les pastilles **Tous**, **Langage**, **Maths**, **Corps**, **Arts**, **Temps**, **Vivant**, **EVAR**.
2. Par défaut, la liste est limitée au niveau de l’élève. Touchez **Tous les niveaux** pour afficher aussi les autres tranches d’âge.
3. Touchez l’objectif choisi : la mention **Prêt à valider** apparaît. Un objectif déjà validé est grisé et affiche **Déjà validé · date**.
4. Touchez **Valider la réussite**. L’écran **« C'est noté ! »** s’affiche avec l’objectif, la date et la présence ou l’absence de photo. Terminez par **Voir le dossier de Léa** ou **Retour à la classe**.

La date enregistrée est celle du jour. Pour la corriger, ouvrez ensuite la fiche de la réussite depuis le dossier (section 7) et modifiez **Date de la réussite** ; si la nouvelle date change d’année scolaire, la réussite est reclassée.

Un même objectif ne peut être validé qu’une seule fois pour un même élève, toutes années confondues : l’application empêche la seconde validation et affiche la date de la première.

## 6. Programme : six domaines 2026 et programme EVAR

L’onglet **Programme** donne accès au référentiel embarqué : **407 objectifs**, répartis dans les six domaines du programme 2026 et le programme EVAR (éducation à la vie affective et relationnelle).

1. Ouvrez l’onglet **Programme**, cherchez un intitulé avec **Rechercher un objectif**, puis filtrez par niveau avec **Tous**, **PS**, **MS** ou **GS**.
2. Choisissez l’**Année scolaire** pour les compteurs, ou **Toutes les années**.
3. Dépliez un domaine : **Langage**, **Maths**, **Corps**, **Arts**, **Temps**, **Vivant** ou **EVAR**. Chaque en-tête indique le nombre d’objectifs et le nombre de validations de la classe.
4. Chaque objectif affiche ses niveaux (par exemple « PS · MS ») et une barre d’avancement avec le nombre d’élèves qui l’ont validé. La barre se rapporte à l’effectif de la classe, ou à celui de la section filtrée.

### Fiche objectif et validation rapide

1. Touchez un objectif pour ouvrir sa fiche : domaine complet, niveaux et **exemples de réussite** par tranche d’âge (« Avant 4 ans », « À partir de 4 ans », « À partir de 5 ans »).
2. La fiche indique les élèves qui ont déjà validé l’objectif, ou « Aucun élève n’a encore validé cet objectif. ».
3. La fiche liste directement les élèves : filtrez éventuellement par section, puis touchez **Valider** sur la ligne de l’élève. La fiche reste ouverte après chaque validation : la ligne passe à **déjà validé**, les compteurs se mettent à jour et vous pouvez enchaîner sur les élèves suivants.
4. La validation rapide enregistre la réussite **sans photo**, à la date du jour, et affiche « Réussite ajoutée à Léa. » ; la photo pourra être ajoutée depuis le dossier. Touchez **Terminer** pour revenir au programme.

Les compteurs suivent l’année sélectionnée. Les objectifs déjà validés le restent indépendamment de l’année affichée.

## 7. Dossier élève : réussites par domaine et par année

1. Depuis la classe, touchez la carte d’un élève. L’en-tête affiche son prénom, sa section et un lien **Bilan**.
2. Choisissez l’**Année scolaire** dans le sélecteur, ou **Toutes les années**. Le dossier s’ouvre sur l’année en cours ; changer d’année ne change que l’affichage.
3. Lisez la carte résumé : nombre de réussites et répartition par domaine.
4. Dépliez un domaine pour voir ses réussites : vignette de la photo, intitulé, date et section. Une réussite sans photo porte les mentions « Observation en classe » et « sans photo ».
5. Touchez une réussite pour ouvrir sa fiche : photo en grand ou mention d’observation, **Exemple de réussite**, **Date de la réussite**, bouton **Ajouter une photo** ou **Remplacer la photo**, et bouton **Retirer cette réussite**.
6. Pour retirer une réussite, confirmez avec **Retirer définitivement** : la photo associée est supprimée avec elle.
7. Pour ajouter une réussite sans photo, touchez **Ajouter une réussite sans photo**. Pour reprendre une photo, touchez le bouton flottant **Prendre une photo** : l’élève est déjà sélectionné.

Les réussites des années précédentes restent consultables, mais elles ne comptent ni dans les compteurs de l’année en cours ni dans ses bilans.

## 8. Bilans : deux feuilles A4 par année

L’écran **Bilans** prépare les deux rendez-vous annuels : **Bilan 1**, de la rentrée à la date de changement, et **Bilan 2**, de cette date à la fin de l’année. Chaque année garde ses propres dates.

1. Ouvrez l’onglet **Bilans**, puis choisissez l’**Année scolaire**.
2. Touchez la carte **Bilan 1** ou **Bilan 2**. Chaque carte affiche ses bornes, son nombre de réussites et son statut : **En cours**, **À venir**, **Terminé** ou **Passé**.
3. Au besoin, touchez **Modifier la date de changement**. L’application prévient si des réussites changent de bilan, par exemple « 1 réussite change de bilan ».
4. Touchez la ligne d’un élève pour ouvrir l’**aperçu A4**. La liste indique, pour chaque élève, sa section et son nombre de réussites sur la période.
5. Vérifiez la feuille : école, classe, enseignante, **Bilan 1 · 2026-2027**, prénom (et initiale du nom si elle est renseignée), section, domaines, photos, dates et **Signature des parents**.
6. Touchez **Imprimer / PDF**. L’application génère un vrai fichier PDF puis ouvre le partage natif sur mobile ; sur ordinateur, le fichier est téléchargé. Le nom suit le modèle `bilan-lea-1-2026-2027.pdf`. L’aperçu à l’écran est la version accessible ; le PDF est destiné à l’impression.
7. Touchez **Changer de période** pour passer d’un aperçu à l’autre sans revenir à la liste.

La feuille ne contient que les réussites dont la date tombe dans la période choisie. Une réussite de juillet ou août reste dans le dossier mais n’entre dans aucun des deux bilans. Si le volume dépasse une page, le PDF pagine sans supprimer de réussite.

### Générer les bilans de toute la classe

1. Choisissez l’année et la période, puis touchez **Générer le bilan (ZIP)** quand la classe ne compte qu’un élève, ou **Générer les N bilans (ZIP)** pour la classe entière. Le ZIP regroupe les bilans de **tous** les élèves de la classe ; pour un seul élève, utilisez **Imprimer / PDF** depuis son aperçu.
2. Suivez la progression : « Bilan 1 sur 20 · Léa ».
3. Le fichier `bilans-1-2026-2027.zip` contient un PDF par élève, y compris pour les élèves sans réussite sur la période.

La génération se fait élève après élève, sans annulation possible. Une classe chargée en photos peut demander plusieurs minutes : gardez l’écran allumé.

## 9. Sauvegarde et restauration

La sauvegarde est la seule copie de secours : elle est **indispensable** avant un changement d’appareil, une désinstallation, un changement d’adresse ou un nettoyage du navigateur.

1. Ouvrez le **Profil**, puis la carte **Sauvegarde**. Lisez la date de la **Dernière sauvegarde** et le nombre de **Réussites enregistrées**.
2. Touchez **Exporter une sauvegarde**. Le fichier `petite-pousse-backup-2026-11-16.zip` contient toutes les années, les réussites et les photos ; une barre de progression s’affiche.
3. Pour protéger le fichier, cochez **Protéger par un mot de passe**, saisissez deux fois un mot de passe d’au moins 8 caractères, puis exportez. Le fichier prend le suffixe `-chiffre`.
4. Conservez le ZIP dans un endroit protégé. Sans mot de passe, il n’est pas chiffré et contient les données personnelles et les photos des enfants : supprimez-le après le transfert.

> **Avertissement.** Sans le mot de passe, la sauvegarde est **définitivement illisible**. Il n’existe aucun moyen de le récupérer, ni dans l’application, ni auprès de l’éditeur. Notez-le dans un gestionnaire de mots de passe avant de fermer l’export.

### Restaurer une sauvegarde

1. Touchez **Importer une sauvegarde** et choisissez le fichier ZIP.
2. Si le fichier est chiffré, la feuille **Sauvegarde chiffrée** demande le mot de passe. Touchez **Lire la sauvegarde** ; un mot de passe incorrect laisse la feuille ouverte et affiche une erreur.
3. Lisez la confirmation **« Restaurer cette sauvegarde ? »** : elle résume le nombre d’élèves, d’années, de réussites et de photos, et indique si la sauvegarde est chiffrée.
4. Touchez **Restaurer la sauvegarde**. **Toutes les données actuelles sont remplacées**, réglages compris. Il n’existe ni fusion de sauvegardes ni restauration partielle d’une année.
5. Attendez le message « Sauvegarde restaurée. ». En cas d’échec, les données présentes avant l’import ne sont pas modifiées.

Une sauvegarde de plus de 300 Mo ouvre une confirmation supplémentaire : gardez l’écran allumé et branchez l’appareil pendant l’opération.

### Stockage et quota

La carte **Stockage** affiche l’espace utilisé (« 120 Mo utilisés sur 2 Go ») et un pourcentage. Le bouton **Demander un stockage persistant** demande au navigateur de ne pas effacer les données ; la réponse peut être accordée ou refusée. Sur iPhone et iPad, un refus est fréquent : installez l’application sur l’écran d’accueil et sauvegardez régulièrement.

## 10. Réglages : école, classe, période et passage d’année

Le **Profil** regroupe les réglages et les actions sur les données :

- **Les élèves** : accès à **Gérer les élèves** ;
- **École et classe** : nom de l’école, classe, prénom de l’enseignante ;
- **Année scolaire** : année en cours et bouton **Passer à l’année suivante** ;
- **Dates des bilans** : bornes des deux bilans et date de changement ;
- **Stockage**, **Sauvegarde**, **Installer l’application** et **Confidentialité** (bouton **Relire la notice**) ;
- **Version** de l’application, en bas de l’écran.

### Passer à l’année suivante

1. Ouvrez **Profil → Année scolaire**, touchez **Passer à l’année suivante**.
2. Lisez la confirmation **« Passer à l’année suivante ? »** : elle annonce la nouvelle année et rappelle qu’**aucune réussite ne sera supprimée**. Touchez **Ouvrir 2027-2028**.

Le libellé de l’année change et de nouvelles dates de bilan sont ouvertes. La classe, les dossiers et les photos restent en place. Supprimez ensuite les élèves partis et ajoutez les nouveaux : l’application ne le fait pas automatiquement.

Si l’année des réglages ne correspond plus à la date du jour, un avertissement signale que les nouvelles réussites sont classées dans l’année de leur date. Il suffit alors d’ouvrir l’année suivante pour aligner les réglages. Modifier une date de bilan reclasse les réussites concernées et met à jour les aperçus ; les PDF déjà imprimés restent la trace de ce qui a été remis aux familles.

## 11. Accessibilité : clavier, lecteur d’écran, mouvement réduit

L’application est conçue pour être utilisable sans souris et avec un lecteur d’écran :

- **Clavier** : le premier appui sur Tab atteint le lien **« Aller au contenu principal »**. Le focus reste visible, l’ordre de tabulation suit l’écran, et les feuilles modales piègent le focus, se ferment avec **Échap** et le rendent au bouton d’origine.
- **Lecteur d’écran** : chaque écran a un titre de page distinct, le focus suit le contenu après un changement de route, les chargements sont annoncés, les erreurs utilisent une alerte et les confirmations sont annoncées dans une région dédiée. Les boutons icônes ont un libellé explicite.
- **Mouvement réduit** : si l’appareil demande moins d’animations, les transitions sont neutralisées.
- **Petit écran** : l’aperçu A4 se réduit pour tenir sur un téléphone ; à 320 px, le texte de la feuille devient petit et le zoom du navigateur reste nécessaire. La feuille garde son propre défilement horizontal.

### La limite du PDF

Le PDF n’est **pas balisé** : il n’a pas d’ordre de lecture structuré, pas d’alternative textuelle intégrée aux photos et pas de structure de tableau. Un lecteur d’écran peut lire son texte, mais l’expérience n’est pas équivalente à un PDF accessible. **Le PDF est un format d’impression, pas la version accessible du bilan.**

La version accessible de référence est l’**aperçu HTML A4** affiché à l’écran avant le bouton **Imprimer / PDF**. Il contient les mêmes informations, dans un document structuré et lisible par les technologies d’assistance.

L’audit WCAG 2.1/2.2 AA et RGAA 4.1.2 conclut à une conformité **partielle** : aucune violation automatisée n’est relevée sur Chromium et WebKit, mais la validation avec VoiceOver et TalkBack sur appareil réel reste à exécuter. Le rapport complet se trouve dans `docs/accessibility/`.

## 12. Précautions et limites à connaître

- **Stockage local uniquement.** Les données vivent dans le navigateur de l’appareil. Aucun compte, aucun serveur applicatif, aucune synchronisation.
- **Une base par appareil et par navigateur.** Un autre téléphone, un autre navigateur ou un autre profil de navigateur ne voit pas les mêmes données.
- **Effacement du navigateur.** Vider les données du site, changer d’adresse (domaine) ou réinitialiser le navigateur rend les données existantes invisibles. Une sauvegarde ZIP est indispensable avant toute migration.
- **Désinstallation sur iOS.** Supprimer l’application de l’écran d’accueil peut aussi supprimer ses données. Exportez une sauvegarde avant.
- **Quota.** Les photos occupent l’espace alloué au site. Le navigateur peut refuser ou révoquer le stockage persistant, surtout sur iPhone et iPad.
- **Pas de fusion.** Une restauration remplace tout ; il n’existe pas d’export limité à une année ni de fusion de deux sauvegardes.
- **Bilans en lot.** Les PDF sont générés l’un après l’autre, sans annulation. Une classe très illustrée peut être longue à traiter.
- **PDF non accessible.** Voir la limite détaillée en section 11.
- **Fonctionnalités absentes.** Objectifs personnalisés, import CSV, statistiques de classe et PDF combiné du lot ne sont pas proposés.
- **Photos d’enfants.** L’application affiche une notice et ne transmet rien. Le consentement, l’information des familles et la conservation des fichiers relèvent des règles de l’école : référez-vous aux documents de votre école et aux personnes compétentes (direction, DPO académique) pour toute question juridique. Ce guide ne constitue pas un avis juridique.

## 13. Questions fréquentes

**Une réussite sans photo est-elle vraiment enregistrée ?**  
Oui. Elle compte comme les autres, apparaît dans le dossier et dans le bilan avec la mention « Observation en classe », et une photo peut être ajoutée plus tard.

**Peut-on valider deux fois le même objectif pour un élève ?**  
Non. Une seule validation existe par élève et par objectif, toutes années confondues. L’objectif apparaît alors avec la mention « Déjà validé » et sa date.

**Les données partent-elles sur Internet ?**  
Non. Aucun compte, aucune mesure d’audience, aucun envoi automatique. Seuls le PDF et la sauvegarde que vous partagez vous-même quittent l’appareil.

**Comment transférer les données sur un nouvel appareil ?**  
Exportez une sauvegarde ZIP depuis le profil de l’ancien appareil, puis importez-la sur le nouveau. La restauration remplace les données présentes.

**Peut-on fusionner deux sauvegardes ou restaurer une seule année ?**  
Non. Le ZIP contient toutes les années et la restauration remplace l’ensemble.

**Le PDF du bilan est-il accessible aux lecteurs d’écran ?**  
Non, il n’est pas balisé. L’aperçu HTML A4 à l’écran est la version accessible de référence ; le PDF sert à l’impression.

**Que se passe-t-il au 1er septembre ?**  
Rien n’est effacé. Utilisez **Passer à l’année suivante** dans le profil pour ouvrir la nouvelle année et ses dates de bilan.

**Où voir la version de l’application ?**  
En bas du profil, par exemple « Version 1.1.1 ».
