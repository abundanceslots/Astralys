# Astralys

Application mobile (iOS / Android) d'exploration spatiale : le joueur choisit une vraie étoile du catalogue Gaia DR3, développe son système (énergie, relais, sondes, planètes réelles et imaginées) et joue à **Orbital Run**, un jeu d'adresse gravitationnel.

- **App :** Expo SDK 57 · React Native 0.86 · expo-router · Reanimated 4 · Skia · expo-gl
- **Backend :** Supabase (Postgres + RLS, Auth Google/Apple/email, fonctions Edge)
- **Catalogue :** 10 100 étoiles Gaia DR3 + 653 planètes confirmées (NASA Exoplanet Archive)

## Démarrer

```powershell
npm install
copy .env.example .env.local   # puis remplir les deux valeurs Supabase
npx expo start --go --lan --clear
```

`npm run start:go` fait la même chose. Les widgets d'écran d'accueil ne fonctionnent pas dans Expo Go : il faut une version de développement (`eas build --profile development`).

## Variables d'environnement

| Variable | Où la trouver | Où la déclarer |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | `.env.local` (local) **et** EAS → Environment variables (builds) |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | idem (clé publique « publishable ») | idem |

`.env.local` n'est jamais envoyé sur GitHub (voir `.gitignore`). Sans ces variables dans EAS, un build cloud s'arrête au démarrage. Aucune clé secrète (service role, Typesafe, Google client secret) ne doit être dans l'app : elles vont uniquement dans les secrets Supabase.

## Structure

```
src/app/            écrans (expo-router) : accueil, explore, collection, store, profile
src/components/     composants (système 3D, Orbital Run, fiches, boutique…)
src/features/       logique pure : économie du jeu, rendu 3D, niveaux, catalogue, boutique
src/context/        état global : compte, étoiles acquises, progression par système
src/lib/            Supabase, sauvegarde cloud, widgets, liens légaux
src/widgets/        widgets iOS (expo-widgets) et Android
supabase/           migrations SQL, vérifications, fonctions Edge, imports du catalogue
docs/               documentation, pages légales (docs/legal), check-list de publication
scripts/            vérifications automatiques (npm run check:systems…)
```

## Base de données

Tout est décrit dans [`supabase/README.md`](supabase/README.md) : ordre des migrations, tables, fonctions, gestion des testeurs autorisés à acheter.

## Vérifications

```powershell
npm run check:systems     # les 10 100 systèmes sont valides et variés, économie simulée
npx tsc --noEmit          # types
```

## Publication

Voir [`docs/PUBLICATION.md`](docs/PUBLICATION.md).

## Licence et données

Code : voir `LICENSE`. Données astronomiques : ESA Gaia DR3 et NASA Exoplanet Archive (données publiques, citées dans l'app).
