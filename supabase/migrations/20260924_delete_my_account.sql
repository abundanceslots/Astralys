-- Astralys : suppression du compte depuis l'app (exigée par Google Play et l'App Store).
-- Supprime l'utilisateur connecté. Toutes ses données suivent automatiquement
-- (profiles → on delete cascade → systèmes, progression, étoiles acquises, alliances…).
-- Les reçus d'achat restent chez Google / Apple, qui en ont l'obligation légale.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  delete from auth.users where id = current_user_id;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
