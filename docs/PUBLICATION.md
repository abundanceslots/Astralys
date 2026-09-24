# Astralys — checklist de publication

État au 24/09/2026. Cocher au fur et à mesure.

## 1. Bloquant avant toute soumission

- [ ] **Variables d'environnement EAS**. `.env.local` n'est pas envoyé au build. Créer pour `preview` et `production` :
  ```
  npx eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://xxxx.supabase.co --environment production --visibility plaintext
  npx eas env:create --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value sb_publishable_xxx --environment production --visibility plaintext
  ```
  Refaire la même chose avec `--environment preview`.
- [ ] **Pages légales en ligne**. Héberger `docs/legal/privacy.html`, `terms.html` et `delete-account.html` sous `https://abundanceslots.com/astralys/…` (voir `src/constants/legal.ts`).
- [ ] **Migrations Supabase appliquées**, dans l'ordre de `supabase/README.md`. Les deux dernières sont `20260924_delete_my_account.sql` et `20260925_catalogue_indexes.sql`.
- [ ] **Schéma du catalogue versionné** : `npx supabase db dump --linked --schema public -f supabase/schema.sql`, puis commit.
- [ ] **Accès aux étoiles pour les nouveaux joueurs**. Aujourd'hui `PREVIEW_MODE = true`, donc seuls les comptes de `purchase_preview_accounts` peuvent obtenir une étoile. Pour ouvrir au public, il faut :
  - la première étoile gratuite (RPC côté serveur) ;
  - le paiement réel (Google Play Billing et StoreKit, via RevenueCat ou `expo-iap`) ;
  - la vérification des reçus côté serveur avant d'attribuer l'étoile.

## 2. Boutique

| Palier | Prix | ID produit | Étoiles |
|---|---|---|---|
| 4 vraies planètes | 9,99 € | `star_real_4` | 16 |
| 2–3 vraies planètes | 7,99 € | `star_real_2` | 130 |
| 1 vraie planète | 4,99 € | `star_real_1` | 289 |
| Planètes imaginées | 1,99 € | `star_imagined` | 9 665 |

- Créer ces 4 produits (consommables) dans la Play Console et dans App Store Connect.
- La fiche d'achat précise déjà quelles planètes sont réelles et lesquelles sont imaginées. La description des stores doit le dire aussi.

## 3. Google Play

- [ ] Compte développeur (25 $), avec vérification d'identité. Pour un compte personnel, c'est l'adresse publiée si l'app vend du contenu (statut de professionnel au sens du DSA).
- [ ] Profil de paiement marchand, avec IBAN et numéro de micro-entreprise.
- [ ] Compte personnel créé après nov. 2023 : **test fermé avec 12 testeurs pendant 14 jours** avant de pouvoir passer en production.
- [ ] Formulaires : sécurité des données (e-mail, identifiant, achats), classification du contenu, public cible (pas moins de 13 ans), publicités (aucune), URL de suppression de compte.
- [ ] Fiche : icône 512×512, bannière 1024×500, au moins 2 captures, description courte et longue.
- [ ] Build : `npx eas build -p android --profile production`, qui produit un AAB.

## 4. App Store

- [ ] Apple Developer Program (99 €/an). Pour une entreprise, il faut un D-U-N-S.
- [ ] Accord « Paid Apps », renseignements bancaires et fiscaux.
- [ ] Étiquettes de confidentialité, classification d'âge, suppression de compte dans l'app (déjà en place dans Profil).
- [ ] Captures 6,7" et 6,5", bouton « Restaurer les achats » (déjà présent).
- [ ] Build : `npx eas build -p ios --profile production`, puis `npx eas submit -p ios`.

## 5. Recommandé avant la sortie

- Supprimer ou protéger la fonction edge `astralys-daily-guidance`. Elle n'est pas utilisée et n'est pas protégée.
- Retirer les animations `entering` Reanimated des Modals restantes (Orbital Run, sky locator, explore). Sur Android, elles peuvent rester invisibles et bloquer le tactile.
- Harmoniser le scheme (`astrelys` dans app.json) avec le nom Astralys.
- Passer la sauvegarde de progression côté serveur (RPC) pour limiter la triche.
- Traduire l'interface en français (elle est aujourd'hui en anglais).
- Passer Supabase en plan payant, ou prévoir un ping : le plan gratuit met le projet en pause après 7 jours sans activité.

## 6. Ne jamais committer

`.env.local`, la clé `service_role`, les JSON de compte de service Google, `client_secret*.json`, `google-services.json`, `GoogleService-Info.plist`. Ils sont déjà dans `.gitignore`.
