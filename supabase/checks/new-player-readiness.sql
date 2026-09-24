-- Astralys — vérification (lecture seule) : un nouveau joueur invité peut-il acquérir un système ?
-- À coller dans Supabase → SQL Editor → Run. Chaque ligne doit afficher ok = true.

with checks as (
  select 'Profil créé automatiquement à l''inscription (trigger on_auth_user_created)' as check_name,
         exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') as ok
  union all
  select 'Chaque compte a son profil',
         not exists (select 1 from auth.users u left join public.profiles p on p.id = u.id where p.id is null)
  union all
  select 'Fonction d''acquisition présente (complete_preview_star_acquisition)',
         exists (select 1 from pg_proc where proname = 'complete_preview_star_acquisition')
  union all
  select 'Les joueurs connectés peuvent l''appeler',
         has_function_privilege('authenticated', 'public.complete_preview_star_acquisition(uuid)', 'execute')
  union all
  select 'Source « purchase » acceptée dans guardian_systems',
         pg_get_constraintdef((select oid from pg_constraint where conname = 'guardian_systems_acquisition_source_check')) like '%purchase%'
  union all
  select 'Toutes les étoiles sont acquérables',
         not exists (select 1 from public.celestial_objects where object_type = 'star' and is_purchasable is distinct from true)
  union all
  select 'Chaque étoile a son système planétaire',
         not exists (select 1 from public.celestial_objects s left join public.planetary_systems p on p.star_id = s.id where s.object_type = 'star' and p.id is null)
  union all
  select 'Sauvegarde cloud de la progression installée (table guardian_progress)',
         to_regclass('public.guardian_progress') is not null
  union all
  select 'Sauvegarde cloud : fonction save_guardian_progress',
         exists (select 1 from pg_proc where proname = 'save_guardian_progress')
  union all
  select 'Profils visuels des systèmes lisibles par l''app',
         exists (select 1 from public.system_visual_profiles where status = 'complete')
  union all
  select 'Au moins un compte invité dans la liste des testeurs',
         exists (select 1 from public.purchase_preview_accounts)
)
select check_name, ok from checks;

-- Comptes invités actuels :
select email, note, created_at from public.purchase_preview_accounts order by created_at;

-- Pour inviter un testeur (adresse en minuscules, sans espaces) :
-- insert into public.purchase_preview_accounts (email, note) values ('prenom.nom@example.com', 'Testeur') on conflict (email) do nothing;
