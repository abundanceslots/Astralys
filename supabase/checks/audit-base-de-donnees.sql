-- Astralys — audit de la base (lecture seule). Supabase → SQL Editor → coller → Run.
-- Chaque bloc renvoie un tableau. Exécute-les un par un (sélectionne le bloc puis Run)
-- si l'éditeur n'affiche que le dernier résultat.

-- 1. Tables publiques SANS sécurité par ligne (RLS) : doit être vide.
select c.relname as table_sans_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
order by 1;

-- 2. Règles d'accès du catalogue (celestial_objects n'a pas de migration dans le projet).
select tablename, policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public' and tablename in ('celestial_objects', 'planetary_systems')
order by 1, 2;

-- 3. Index existants sur les tables interrogées par l'app.
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename in ('celestial_objects', 'planetary_systems', 'planetary_system_planets', 'star_acquisitions', 'guardian_progress')
order by 1, 2;

-- 4. Migrations récentes bien appliquées ? (toutes les lignes doivent être « true »)
select 'Sauvegarde cloud (table guardian_progress)' as element, to_regclass('public.guardian_progress') is not null as ok
union all select 'Sauvegarde par système (save_guardian_progress v2)', exists (select 1 from pg_proc where proname = 'save_guardian_progress' and prosrc like '%systems%')
union all select 'Suppression de compte (delete_my_account)', exists (select 1 from pg_proc where proname = 'delete_my_account')
union all select 'Recherche rapide (extension pg_trgm)', exists (select 1 from pg_extension where extname = 'pg_trgm');

-- 5. Qualité des données du catalogue.
select
  count(*) filter (where object_type = 'star') as etoiles,
  count(*) filter (where object_type = 'planet') as planetes,
  count(*) filter (where object_type = 'star' and is_purchasable is distinct from true) as etoiles_non_achetables,
  count(*) filter (where object_type = 'star' and (ra_deg is null or dec_deg is null)) as etoiles_sans_position,
  count(*) filter (where object_type = 'planet' and host_object_id is null) as planetes_sans_etoile
from public.celestial_objects;

-- 6. Étoiles sans système planétaire (l'app ne peut pas les afficher) : doit être 0.
select count(*) as etoiles_sans_systeme
from public.celestial_objects s
left join public.planetary_systems p on p.star_id = s.id
where s.object_type = 'star' and p.id is null;

-- 7. Tables de l'ancienne économie serveur, plus utilisées par l'app (volume actuel).
select 'guardian_systems' as table_name, count(*) from public.guardian_systems
union all select 'guardian_planets', count(*) from public.guardian_planets
union all select 'guardian_resource_ledger', count(*) from public.guardian_resource_ledger
union all select 'stellar_alliances', count(*) from public.stellar_alliances;
