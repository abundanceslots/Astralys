# Export public Supabase — 21 septembre 2026

Cette sauvegarde contient les données du schéma `public` accessibles à
l'application Astralys avec sa clé publique. Les règles Row Level Security
(RLS) de Supabase restent appliquées pendant l'export.

## Contenu principal

- `celestial_objects.json` : 10 753 objets célestes, dont 10 100 étoiles et
  653 planètes confirmées.
- `planetary_systems.json` : 10 100 systèmes planétaires.
- `planetary_system_planets.json` : 653 associations planète-système.
- `stellar_neighbors.json` : 8 800 relations de voisinage stellaire.
- `system_visual_profiles.json` : 10 020 profils visuels terminés.
- Les autres fichiers JSON contiennent les règles publiques de progression.
- `manifest.json` indique le résultat et le nombre de lignes de chaque table.

Les profils, possessions, ressources, colonies, alliances et autres données
liées aux comptes ne sont pas inclus. Supabase refuse leur lecture anonyme,
conformément aux politiques RLS du projet.

## Actualiser l'export

Depuis la racine du projet :

```powershell
node --use-system-ca --env-file=.env.local scripts/export-supabase-public-data.mjs
```

Le script remplace les fichiers JSON de ce dossier avec l'état public actuel de
Supabase. La clé publique reste dans `.env.local`, qui est exclu de Git.
