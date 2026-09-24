# Supabase — Astralys

## Migrations (à appliquer dans cet ordre)

| Fichier | Contenu |
|---|---|
| `20260914_create_profiles.sql` | Profils joueurs, création automatique à l'inscription |
| `20260915_create_guardian_economy.sql` | Systèmes planétaires, règles, ancienne économie serveur (*) |
| `20260916_create_social_observatory.sql` | Voisinage stellaire, alliances (*) |
| `20260919_create_jev_system_visual_profiles.sql` | Profils visuels des 10 000 systèmes |
| `20260921_enable_preview_star_acquisitions.sql` | Étoiles acquises + **liste des testeurs autorisés à acheter** |
| `20260922_guardian_progress_cloud_save.sql` | Sauvegarde cloud de la progression |
| `20260923_guardian_progress_per_system.sql` | Sauvegarde par système |
| `20260924_delete_my_account.sql` | Suppression de compte depuis l'app (obligatoire stores) |
| `20260925_catalogue_indexes.sql` | Index pour Explore, Store, planètes |

(*) Tables plus utilisées par l'app (l'économie tourne dans l'app et se sauvegarde dans `guardian_progress`). À garder tant que rien n'est décidé ; ne pas les supprimer sans vérifier.

Appliquer : Supabase → SQL Editor → coller le fichier → Run, ou `npx supabase db push` (projet lié).

### ⚠️ Table du catalogue sans migration

`celestial_objects` (étoiles et planètes) a été créée directement dans Supabase. Pour que le dépôt permette de recréer la base, exporter le schéma réel une fois :

```powershell
npx supabase login
npx supabase link --project-ref <ton-project-ref>
npx supabase db dump --linked --schema public -f supabase/schema.sql
```

Puis ajouter `supabase/schema.sql` au dépôt. Clé d'unicité connue : `(source_catalog, source_id)`.

## Données du catalogue

- `imports/gaia-9000-20260918/` : 9 000 étoiles Gaia DR3 (SQL + CSV + vérification)
- `imports/nasa-planets-20260918/` : 653 planètes confirmées
- `exports/public-20260921/` : export public complet (utilisé par `npm run check:systems`)

## Tables utilisées par l'app

| Table | Accès app | Rôle |
|---|---|---|
| `celestial_objects` | lecture | étoiles et planètes |
| `planetary_systems`, `planetary_system_planets` | lecture | système de chaque étoile, ordre des planètes |
| `system_visual_profiles` | lecture | apparence de chaque système |
| `profiles` | lecture/écriture (soi) | profil du joueur |
| `star_acquisitions` | lecture (soi) | étoiles possédées |
| `guardian_progress` | lecture (soi), écriture via `save_guardian_progress` | progression de tous les systèmes du joueur |
| `purchase_preview_accounts` | aucune (serveur) | e-mails autorisés à acquérir des étoiles en test |

## Fonctions appelées par l'app

- `complete_preview_star_acquisition(star_id)` — acquisition (réservée aux testeurs)
- `save_guardian_progress(state, base_revision)` — sauvegarde de la progression
- `delete_my_account()` — suppression du compte et de toutes ses données

## Testeurs autorisés à acheter

Voir `checks/testeurs-achat.sql` (lister, ajouter, retirer).

## Vérifications

- `checks/new-player-readiness.sql` — un nouveau joueur peut-il acquérir un système ?
- `checks/audit-base-de-donnees.sql` — RLS, index, migrations appliquées, qualité des données
- `checks/sauvegarde-cloud-complete.sql` — installe la sauvegarde cloud si elle manque

## Fonctions Edge

- `classify-system-visuals` : classement visuel des systèmes (protégée par `JEV_BATCH_SECRET`).
- `astralys-daily-guidance` : **plus utilisée par l'app et non protégée** → à supprimer ou désactiver (`npx supabase functions delete astralys-daily-guidance`).

Secrets (Supabase → Edge Functions → Secrets, jamais dans Git) : voir `functions/.env.example`.
