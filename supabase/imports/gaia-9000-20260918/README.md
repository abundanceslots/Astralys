# Astralys — 9 000 étoiles supplémentaires

Import exécuté le 18 septembre 2026 dans `public.celestial_objects`, projet Supabase `unfvmwmhrdlywxwrjaxm`.

- Avant : 1 100 étoiles ; ajout : 9 000 ; après : 10 100.
- Origine : Gaia DR3 via le service TAP ARI Heidelberg, requête exacte dans `manifest.json`.
- Structure principale identique au précédent import : identifiants, nom de catalogue, coordonnées, distance estimée, magnitude, catégorie visuelle et graine stable. Les paramètres source restent dans `raw_data`.
- Sélection : parallaxe ≥ 10 mas, rapport parallaxe/erreur ≥ 10, RUWE < 1,4, source non dupliquée et couleur BP−RP disponible. Requête G entre 1 et 12 ; les 9 000 retenues ont G entre 5,1951 et 8,694964. Certaines ne sont pas visibles à l'œil nu.
- Distance approximative obtenue par inversion de la parallaxe, entre 5,96 et 326,13 années-lumière. Aucun nom propre, planète, température ou date de découverte n'a été inventé.
- Publication du catalogue : 13 juin 2022, pas une date de découverte individuelle.
- Les anciens objets et leurs noms ne sont pas modifiés. Les doublons sont ignorés grâce à la contrainte `(source_catalog, source_id)`.

## Fichiers

- `astralys_gaia_9000_etoiles_supplementaires.sql` : sauvegarde SQL complète, transaction et contrôle des 9 000 lignes ; réexécutable sans ajout de doublons.
- `astralys_gaia_9000_etoiles_supplementaires.csv` : format documentaire identique au CSV précédent ; `parallax_mas` et `bp_rp` sont des paramètres source, pas des colonnes directes de la table. Utiliser le SQL pour réimporter.
- `application/` : neuf transactions de 1 000 étoiles utilisées dans l'éditeur SQL Supabase.
- `lots/` : 36 transactions alternatives de 250 étoiles.
- `gaia-source.csv` : réponse scientifique brute.
- `existing-catalogue-ids.json` : identifiants exclus lors de la sélection.
- `manifest.json` : provenance, nombre de lignes, catégories et empreinte du SQL.
- `verification.json` : contrôle après import via la clé publique de l'application, sans désactivation de RLS.

Vérification depuis la racine du projet :

```powershell
node --use-system-ca --env-file=.env.local scripts/verify-gaia-9000.mjs
```

`--use-system-ca` utilise les autorités de certification Windows et maintient la vérification HTTPS. Les clés ne sont jamais écrites dans ces fichiers. Ne pas régénérer ce même lot après son import : réutiliser ses sauvegardes SQL.
