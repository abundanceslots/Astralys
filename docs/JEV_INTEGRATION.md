# Astralys — intégration de Jev

Jev est relié à Astralys par une Edge Function Supabase. La clé TypeSafe reste côté serveur et n'est jamais incluse dans l'application Expo.

## Architecture

1. l'application rassemble un état limité : astre suivi, visibilité, progression planétaire, relais et gardiens proches ;
2. elle appelle la fonction `astralys-daily-guidance` avec la session Supabase de l'utilisateur ;
3. la fonction valide les données puis interroge `POST https://api.typesafe.ai/v1/systemone` avec le modèle `jev-latest` ;
4. Jev choisit une action parmi cinq possibilités fermées ;
5. l'application transforme cette décision en texte anglais déjà contrôlé dans le code ;
6. si Jev échoue ou répond avec une confiance inférieure à `0,35`, une règle locale fournit immédiatement une recommandation de secours.

Jev ne calcule ni la visibilité, ni les orbites, ni les distances astronomiques. Ces données restent produites par le code et les catalogues scientifiques.

La consigne exacte utilisée par la fonction est documentée dans `docs/JEV_ASTRALYS_POLICY.md`. Elle privilégie l'observation réelle et interdit les recommandations basées sur des données inventées ou une urgence artificielle.

## Activation dans PowerShell

Depuis le dossier `C:\Users\zeeny\Desktop\etoiles\mon-univers` :

```powershell
npx.cmd supabase@latest login
if (!(Test-Path supabase\functions\.env)) { Copy-Item supabase\functions\.env.example supabase\functions\.env }
notepad supabase\functions\.env
npx.cmd supabase@latest secrets set --env-file supabase\functions\.env --project-ref unfvmwmhrdlywxwrjaxm
npx.cmd supabase@latest functions deploy astralys-daily-guidance --project-ref unfvmwmhrdlywxwrjaxm
```

Après avoir ouvert le fichier, remplacer `replace_with_your_typesafe_key` par la clé fournie dans le tableau de bord TypeSafe, puis enregistrer. Le fichier réel `.env` est ignoré par Git. Il ne faut pas placer cette clé dans `.env.local`, dans `app.json`, ni dans une variable commençant par `EXPO_PUBLIC_`.

## Appel depuis l'application

Importer `getJevDailyGuidance` depuis `src/lib/jev-daily-guidance.ts`, construire un `DailyGuidanceState`, puis appeler la fonction. Le résultat contient le titre, le message, l'action retenue, la confiance et la source (`jev` ou `fallback`).

La fonction déployée conserve la vérification JWT Supabase par défaut : l'utilisateur doit être connecté pour l'appeler.
