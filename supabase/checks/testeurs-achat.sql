-- Astralys — testeurs autorisés à acquérir des étoiles (mode test, sans paiement).
-- Supabase → SQL Editor. Adresse e-mail en minuscules, identique à celle du compte Astralys.

-- 1. Voir la liste
select email, note, created_at from public.purchase_preview_accounts order by created_at;

-- 2. Ajouter un testeur (remplacer l'adresse et la note)
-- insert into public.purchase_preview_accounts (email, note)
-- values (lower(trim('prenom.nom@example.com')), 'Testeur')
-- on conflict (email) do update set note = excluded.note;

-- 3. Retirer un testeur
-- delete from public.purchase_preview_accounts where email = lower(trim('prenom.nom@example.com'));
