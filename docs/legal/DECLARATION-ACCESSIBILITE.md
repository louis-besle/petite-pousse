# Déclaration d’accessibilité — Petite pousse

> **Version de travail du 9 novembre 2026 — ne pas publier en l’état.**
>
> Compléter les champs entre crochets, faire valider le document par le DPO
> académique ou le service juridique compétent, puis publier cette déclaration
> à une URL stable, accessible depuis l’application et depuis le site de
> l’école.

## 1. Identification du service

- **Service numérique :** Petite pousse
- **Adresse :** <https://carnet-de-reussites.vercel.app>
- **Responsable du service :** [nom de l’école, de la circonscription ou de la commune]
- **Adresse postale :** [adresse complète]
- **Contact accessibilité :** [adresse e-mail dédiée]
- **Téléphone :** [numéro]
- **Date de publication :** [jj mois aaaa]
- **Dernière mise à jour :** [jj mois aaaa]

## 2. État de conformité

Petite pousse est **partiellement conforme** au référentiel général
d’amélioration de l’accessibilité (RGAA) 4.1.2.

L’audit technique du 7 novembre 2026 a examiné les 106 critères du RGAA 4.1.2 :

- **57 critères conformes** ;
- **47 critères non applicables** ;
- **1 critère partiel** : 7.1, compatibilité avec les technologies d’assistance ;
- **1 critère non conforme** : 13.3, PDF non balisé.

Le taux de conformité sur les critères applicables est de **57 / 59, soit
96,6 %**. En présence d’un critère partiel et d’un critère non conforme, le
service ne peut pas être déclaré « totalement conforme ».

## 3. Contenus non accessibles

### 3.1 Non-conformité

- **PDF généré non balisé (critère 13.3).** Les bilans peuvent être exportés en
  PDF, mais ce fichier ne possède pas de structure PDF/UA : l’ordre de lecture,
  les alternatives textuelles des images et la structure du document ne sont pas
  garantis pour les lecteurs d’écran.
  **Alternative accessible :** l’aperçu HTML A4 affiché dans l’application
  reprend le contenu du bilan et constitue la version accessible de référence.
  L’application l’annonce explicitement à l’écran.

### 3.2 Réserve de vérification

- **Compatibilité avec les technologies d’assistance (critère 7.1).** Les
  parcours sont couverts par des tests automatisés sur Chromium et WebKit, mais
  la matrice VoiceOver / TalkBack n’a pas encore été exécutée sur appareils
  physiques. Le protocole est prêt dans
  [`docs/accessibility/PROTOCOLE-LECTEURS-ECRAN.md`](../accessibility/PROTOCOLE-LECTEURS-ECRAN.md).
  Cette réserve ne permet pas de déclarer le critère 7.1 conforme à ce stade.

## 4. Retour d’information et contact

Si vous rencontrez un défaut d’accessibilité qui vous empêche d’accéder à un
contenu ou à une fonctionnalité, ou si vous avez besoin d’un contenu sous une
autre forme :

- **Courriel :** [adresse e-mail dédiée]
- **Téléphone :** [numéro]
- **Adresse postale :** [adresse complète]

Merci de préciser :

1. la page ou la fonctionnalité concernée ;
2. le matériel et le navigateur utilisés ;
3. la technologie d’assistance employée, le cas échéant ;
4. la difficulté rencontrée et le résultat attendu.

L’établissement s’engage à accuser réception de la demande et à y répondre dans
un délai maximal d’un mois.

## 5. Voie de recours

Si le retour d’information n’a pas permis de résoudre le problème, vous pouvez
saisir gratuitement le Défenseur des droits :

- **Formulaire en ligne :** <https://formulaire.defenseurdesdroits.fr/>
- **Adresse postale :** Défenseur des droits, Libre réponse 71120,
  75342 Paris CEDEX 07
- **Téléphone :** 09 69 39 00 00

## 6. Méthode d’évaluation

L’audit a été réalisé le **7 novembre 2026** selon les normes WCAG 2.1 AA,
WCAG 2.2 AA et le RGAA 4.1.2.

La méthode combine :

- des analyses automatisées axe-core sur **19 états** : 13 écrans et
  6 feuilles modales ;
- des vérifications manuelles du clavier, du focus, des contrastes, du reflow,
  des espacements de texte, de l’orientation et du mouvement réduit ;
- une couverture complémentaire du moteur WebKit, utilisé par Safari sur iPhone
  et iPad ;
- des parcours E2E sur Chromium et WebKit.

Le rapport complet et la matrice des 106 critères sont disponibles dans
[`docs/accessibility/AUDIT-WCAG-RGAA.md`](../accessibility/AUDIT-WCAG-RGAA.md).

## 7. Schéma pluriannuel et plan d’action

Le schéma pluriannuel de mise en accessibilité et le plan d’action de l’année
en cours sont disponibles à l’adresse suivante : [URL à publier].

À défaut, l’établissement doit publier ces documents et y inscrire au minimum :

1. l’exécution du protocole VoiceOver / TalkBack sur appareils physiques ;
2. la décision relative au PDF balisé ou à l’alternative HTML A4 ;
3. la mise à jour de l’audit après les évolutions de l’application ;
4. la formation et la sensibilisation des personnels concernés.

## 8. Historique des mises à jour

| Date | Version | Modification |
| --- | --- | --- |
| [jj mois aaaa] | 1.0 | Publication initiale de la déclaration |

## 9. À compléter avant publication

- [ ] Nom, adresse et contact de l’établissement responsable.
- [ ] Adresse e-mail et numéro de téléphone dédiés à l’accessibilité.
- [ ] Date de publication et historique.
- [ ] URL du schéma pluriannuel et du plan d’action.
- [ ] Validation par le DPO académique ou le service juridique.
- [ ] Publication de la déclaration à une URL stable et accessible depuis
      l’application.
