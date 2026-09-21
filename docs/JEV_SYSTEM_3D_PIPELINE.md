# Astralys — classification Jev des 10 000 systèmes

## Ce qui est stocké

`system_visual_profiles` contient une seule ligne par `planetary_systems`. La migration remplit automatiquement la file pour les systèmes déjà présents et un trigger ajoute chaque futur système.

Jev choisit quatre valeurs fermées : architecture du système, famille de matériau planétaire, priorité de caméra et ambiance visuelle. La table conserve aussi la confiance, les probabilités, le modèle, une empreinte des données source et une graine 3D stable.

Jev ne crée aucun fait astronomique. Les planètes confirmées, distances, températures et tailles restent dans les tables scientifiques. Pour un système sans planète confirmée, son choix sert uniquement de direction artistique et doit être présenté comme une simulation.

## Traitement des 10 000 systèmes

La fonction `classify-system-visuals` réserve jusqu'à 25 systèmes à la fois avec `FOR UPDATE SKIP LOCKED`. Plusieurs traitements peuvent donc fonctionner sans prendre deux fois le même système. Une erreur est retentée après 15 minutes, avec cinq essais maximum. Un traitement interrompu est récupéré après dix minutes.

Avec une taille de lot de 20, les 10 000 systèmes nécessitent environ 500 appels à la fonction Supabase et 10 000 décisions Jev. Il faut vérifier les quotas TypeSafe avant le lancement complet. Commencer par `--maximum 20` permet de contrôler le résultat et le coût.

## Activation

Dans PowerShell, depuis le dossier du projet :

```powershell
npx.cmd supabase@latest link --project-ref unfvmwmhrdlywxwrjaxm
npx.cmd supabase@latest db push --include-all
npx.cmd supabase@latest secrets set --env-file supabase\functions\.env --project-ref unfvmwmhrdlywxwrjaxm
npx.cmd supabase@latest functions deploy classify-system-visuals --project-ref unfvmwmhrdlywxwrjaxm --no-verify-jwt
```

Le secret `JEV_BATCH_SECRET` doit être long et aléatoire. Il protège la fonction contre le lancement de milliers de décisions par un utilisateur de l'application.

## Test puis traitement complet

```powershell
$env:SUPABASE_PROJECT_REF="unfvmwmhrdlywxwrjaxm"
$env:JEV_BATCH_SECRET="le_meme_secret_que_dans_supabase"
node scripts\classify-system-visuals.mjs --maximum 20
node scripts\classify-system-visuals.mjs --maximum 10000
```

Contrôle dans l'éditeur SQL Supabase :

```sql
select status, count(*)
from public.system_visual_profiles
group by status
order by status;
```

## Passage à la 3D

`src/features/system-visual-profile.ts` transforme le profil Jev et les planètes fournies par le catalogue en paramètres procéduraux légers : distance visuelle, angle, taille, matière, atmosphère et palette. La même graine redonne toujours la même scène. Le menu 3D de démonstration utilise déjà ce générateur ; la prochaine connexion consiste à charger le profil du système sélectionné depuis Supabase et à lui fournir ses vraies planètes.
