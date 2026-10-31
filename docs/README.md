# Documentation — Petite pousse

Ce dossier rassemble la documentation de conception, d’accessibilité,
d’utilisation, d’exploitation et les modèles légaux. Le `README.md` à la racine
reste le point d’entrée pour l’état du projet, les fonctionnalités et les
commandes.

## Par où commencer

| Besoin | Document |
| --- | --- |
| Comprendre le produit et les décisions de conception | [`superpowers/specs/2026-11-06-livret-suivi-apprentissage-design.md`](superpowers/specs/2026-11-06-livret-suivi-apprentissage-design.md) |
| Utiliser l’application au quotidien | [`GUIDE-UTILISATION.md`](GUIDE-UTILISATION.md) |
| Connaître le niveau d’accessibilité | [`accessibility/AUDIT-WCAG-RGAA.md`](accessibility/AUDIT-WCAG-RGAA.md) |
| Tester avec VoiceOver ou TalkBack | [`accessibility/PROTOCOLE-LECTEURS-ECRAN.md`](accessibility/PROTOCOLE-LECTEURS-ECRAN.md) |
| Préparer une release | [`operations/RELEASE.md`](operations/RELEASE.md) |
| Contribuer au code | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) |
| Suivre les versions | [`../CHANGELOG.md`](../CHANGELOG.md) |
| Vérifier le référentiel officiel | [`../scripts/referential/source/VERIFICATION.md`](../scripts/referential/source/VERIFICATION.md) |

## État des documents

| Document | Rôle | État | Dernière mise à jour |
| --- | --- | --- | --- |
| [`GUIDE-UTILISATION.md`](GUIDE-UTILISATION.md) | Mode d’emploi enseignante et familles | À relire après chaque évolution d’interface | 16 novembre 2026 |
| [`accessibility/AUDIT-WCAG-RGAA.md`](accessibility/AUDIT-WCAG-RGAA.md) | Audit WCAG 2.1/2.2 AA et RGAA 4.1.2 | Partiellement conforme ; révision automatisée du 16 novembre 2026 | 16 novembre 2026 |
| [`accessibility/PROTOCOLE-LECTEURS-ECRAN.md`](accessibility/PROTOCOLE-LECTEURS-ECRAN.md) | Protocole VoiceOver / TalkBack | Prêt, **non exécuté** sur appareil physique | 7 novembre 2026 |
| [`accessibility/RGAA-4.1-matrice.csv`](accessibility/RGAA-4.1-matrice.csv) | Matrice des 106 critères RGAA | À jour pour le périmètre audité | 7 novembre 2026 |
| [`legal/README.md`](legal/README.md) | Statut et procédure de validation des documents légaux | Courant | 16 novembre 2026 |
| [`legal/DECLARATION-ACCESSIBILITE.md`](legal/DECLARATION-ACCESSIBILITE.md) | Modèle de déclaration légale | **Brouillon, non publiable en l’état** | 9 novembre 2026 |
| [`legal/INFORMATION-RGPD-FAMILLES.md`](legal/INFORMATION-RGPD-FAMILLES.md) | Modèle d’information RGPD | **Brouillon, non diffusable en l’état** | 9 novembre 2026 |
| [`operations/RELEASE.md`](operations/RELEASE.md) | Runbook de release | Prêt ; **aucune release 1.1.2 planifiée** | 16 novembre 2026 |
| [`superpowers/specs/2026-11-06-livret-suivi-apprentissage-design.md`](superpowers/specs/2026-11-06-livret-suivi-apprentissage-design.md) | Document de conception | Référence courante ; certains passages racontent l’historique v1 | 16 novembre 2026 |
| [`superpowers/plans/2026-11-06-livret-suivi-apprentissage.md`](superpowers/plans/2026-11-06-livret-suivi-apprentissage.md) | Plan d’implémentation initial | Historique | 6 novembre 2026 |
| [`superpowers/plans/2026-11-07-roadmap-v1.1.md`](superpowers/plans/2026-11-07-roadmap-v1.1.md) | Roadmap v1.1 | Historique + actualisation du 16 novembre 2026 | 16 novembre 2026 |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Journal des versions | `Unreleased` + 1.1.1, 1.1.0, 1.0.0 | 16 novembre 2026 |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Guide de contribution | Courant | 16 novembre 2026 |

## Règles de maintenance

1. **Toute évolution d’interface** doit mettre à jour le guide utilisateur et,
   si le parcours ou l’accessibilité change, l’audit WCAG/RGAA.
2. **Toute release** doit mettre à jour `CHANGELOG.md` et suivre
   [`operations/RELEASE.md`](operations/RELEASE.md).
3. **Les documents légaux** ne sont publiés qu’après complétion des champs,
   validation par le DPO ou le service juridique compétent, et publication à une
   URL stable.
4. **Le référentiel** se modifie via `scripts/referential/source/objectives.csv`
   puis `npm run referential:build` ; toute modification doit être consignée
   dans `VERIFICATION.md`.
5. **Les plans et roadmaps** sont datés : ne pas réécrire l’historique, ajouter
   une section « Actualisation » avec la nouvelle date.

## Sources de vérité

En cas de contradiction, l’ordre de confiance est :

1. le code et les tests de `src/` et `e2e/` ;
2. le `README.md` pour l’état et les commandes ;
3. l’audit d’accessibilité pour le périmètre WCAG/RGAA ;
4. le guide utilisateur pour les libellés et les parcours ;
5. les plans et roadmaps pour l’historique des décisions.
