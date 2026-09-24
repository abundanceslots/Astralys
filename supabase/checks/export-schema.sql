-- Export du schéma public sans Docker.
-- À coller dans Supabase > SQL Editor > Run.
-- Le résultat est une seule cellule « schema » : la copier entièrement
-- dans supabase/schema.sql (lecture seule, ne modifie rien).

with cols as (
  select c.table_name,
         string_agg(
           format('  %I %s%s%s',
             c.column_name,
             case when c.data_type = 'USER-DEFINED' then c.udt_name
                  when c.data_type = 'ARRAY' then ltrim(c.udt_name, '_') || '[]'
                  when c.character_maximum_length is not null then format('%s(%s)', c.data_type, c.character_maximum_length)
                  else c.data_type end,
             case when c.is_identity = 'YES' then ' generated ' || c.identity_generation || ' as identity'
                  when c.is_generated = 'ALWAYS' then ' generated always as (' || c.generation_expression || ') stored'
                  when c.column_default is not null then ' default ' || c.column_default else '' end,
             case when c.is_nullable = 'NO' then ' not null' else '' end),
           E',\n' order by c.ordinal_position) as body
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
  where c.table_schema = 'public'
  group by c.table_name
),
cons as (
  select rel.relname as table_name,
         string_agg(format('  constraint %I %s', con.conname, pg_get_constraintdef(con.oid)), E',\n' order by con.contype, con.conname) as body
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public' and con.contype in ('p','u','c')
  group by rel.relname
),
tables as (
  select format(E'create table if not exists public.%I (\n%s%s\n);', cols.table_name, cols.body,
                coalesce(E',\n' || cons.body, '')) as ddl, 1 as ord, cols.table_name as k
  from cols left join cons using (table_name)
),
fks as (
  select format('alter table public.%I add constraint %I %s;', rel.relname, con.conname, pg_get_constraintdef(con.oid)) as ddl,
         2 as ord, rel.relname || con.conname as k
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public' and con.contype = 'f'
),
rls as (
  select format('alter table public.%I enable row level security;', c.relname) as ddl, 2 as ord, c.relname::text as k
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
),
idx as (
  select indexdef || ';' as ddl, 3 as ord, indexname::text as k
  from pg_indexes
  where schemaname = 'public'
    and indexname not in (select conname from pg_constraint)
),
pol as (
  select format('create policy %I on public.%I as %s for %s to %s%s%s;',
           policyname, tablename, permissive, cmd, array_to_string(roles, ', '),
           case when qual is not null then ' using (' || qual || ')' else '' end,
           case when with_check is not null then ' with check (' || with_check || ')' else '' end) as ddl,
         6 as ord, tablename || policyname as k
  from pg_policies where schemaname = 'public'
),
fns as (
  select pg_get_functiondef(p.oid) || ';' as ddl, 5 as ord, p.proname::text as k
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
)
select '-- Schéma public Astralys, exporté le ' || now()::date || E'\n\n' ||
       string_agg(ddl, E'\n\n' order by ord, k) as schema
from (select * from tables union all select * from fks union all select * from rls union all select * from idx
      union all select * from pol union all select * from fns) s;
