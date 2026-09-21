# Astralys — corrections du diagnostic UI/UX

## Corrections appliquées

- Les fiches et comparaisons sont maintenant des écrans de contenu, et non des fenêtres plein écran masquant les cinq onglets. Les retours Results et Home restent accessibles. Back to star restaure la fiche de référence après une comparaison.
- Follow this star ajoute réellement l'astre à la liste de suivi de Collection. Cette liste persiste dans le stockage local du navigateur ou du téléphone, dans un espace distinct pour le visiteur et pour chaque compte. Ce n'est pas une acquisition payante et aucune garde n'est attribuée par cette action.
- Collection présente les astres suivis et permet de rouvrir leur fiche. Son aperçu vide porte explicitement la mention Example. Les systèmes déjà attribués au compte sont lus dans Supabase via guardian_systems et planetary_systems, avec un état de chargement et une erreur distincte de l'état vide.
- Collection → Sign in ouvre explicitement le mode connexion, même après une visite du formulaire de création de compte.
- La création de compte ne demande initialement que le nom d'affichage, l'email et le mot de passe. Les autres informations restent éditables après connexion. Les champs portent des libellés accessibles et le mot de passe peut être affiché ou masqué.
- Forgot password permet de demander un email Supabase. Après validation du lien de récupération, un formulaire permet de définir le nouveau mot de passe. Les liens natifs et l'événement web PASSWORD_RECOVERY sont pris en charge.
- Les actions, filtres et onglets ont des rôles explicites et des états accessibles. Les filtres forment des groupes de boutons radio. Le dialogue reçoit le focus, gère Tab, les flèches et Échap, puis restaure le focus. Les fiches gèrent aussi Échap sur le web et Retour sur Android, sans bloquer l'accès aux onglets.
- Les libellés du menu passent de 9 à 12 px. Les petits textes utiles sont agrandis ; les boutons concernés et le focus clavier sont plus visibles. Les rotations décoratives respectent la préférence de réduction des animations.
- Les fiches donnent priorité aux actions Follow, Locate et Compare. Les détails scientifiques sont repliables ; le visuel est plus compact.
- Le catalogue affiche correctement 1 star. Les filtres actifs sont nommés et supprimables. Une recherche vide de résultats propose de réinitialiser recherche et filtres. La feuille de filtres a une largeur maximale sur ordinateur et une fermeture explicite.
- Les désignations françaises sont présentées avec les génitifs astronomiques internationaux, sans inventer de noms propres ni modifier les identifiants scientifiques. Recherche française, anglaise et sans accents conservée. Référence : [table des constellations de l'IAU](https://iauarchive.eso.org/public/themes/constellations/).
- Gaia DR3 est harmonisé comme libellé de catalogue, sans modifier la clé technique GAIA_DR3.
- La comparaison propose les objets les plus brillants en premier, fournit un résumé distance/magnitude et omet température, rayon ou masse lorsque la valeur manque pour les deux objets. Les unités et les limites des illustrations sont expliquées.
- Gift est annoncé comme Coming soon, conformément à l'alternative recommandée dans le rapport. Aucun bouton ne promet un parcours de dédicace, d'envoi ou de paiement inexistant.
- Les erreurs de stockage du journal et les erreurs de chargement des actualités sont maintenant visibles, au lieu de simuler un journal enregistré ou l'absence de publication.

## Vérifications

- TypeScript : npx.cmd tsc --noEmit.
- Régression des noms : node scripts/check-display-names.cjs — 14 assertions.
- Exports Expo web et Android.
- Navigateur intégré : accueil à 1280 × 720, puis largeur mobile 390 × 844 ; cinq onglets visibles, recherche Schedar avec 1 star, fiche → Follow → Collection, persistance après rechargement, comparaison avec Ankaa puis retour à Schedar, entrée Sign in après Create account, accès à Forgot password et validation locale d'un formulaire vide.
- Filtres : North, navigation par flèches vers Equator, fermeture avec Échap et retour du focus. La feuille mobile garde le tri Name A–Z et l'action finale accessibles.
- Dernier export : les trois groupes de filtres exposent bien leur choix coché. Shift+Tab et Tab bouclent entre la première et la dernière action du dialogue. Une recherche sans correspondance revient aux 1 100 étoiles via Clear search and filters.
- Aucun message error/warn capturé pendant les parcours vérifiés.

## Limites et prochaines vérifications

- La liste Following est locale, pas synchronisée entre appareils. Les gardes existantes viennent de Supabase ; aucun paiement, réservation ni transfert de garde n'a été créé.
- Aucun schéma Supabase ni réglage OAuth n'a été modifié. La récupération utilise le redirectTo généré par Expo : cette URL doit être autorisée dans Authentication → URL Configuration. Voir [documentation Supabase](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).
- Aucun compte créé, email réel envoyé, mot de passe modifié, connexion Google/Apple effectuée ou permission caméra/localisation accordée pendant les tests.
- Lecture des gardes avec un compte autorisé, réception des emails, OAuth, caméra, safe areas et clavier natif restent à vérifier sur un téléphone réel. L'export Android ne remplace pas ce test.
- L'anomalie de peinture des onglets Collection n'a pas été reproduite dans le navigateur vérifié ; il reste à la confirmer ou l'infirmer sur téléphone.
- Ce contrôle ciblé n'est pas une certification complète d'accessibilité, de contraste ou d'observation astronomique.

## Mise à jour du catalogue — 19 septembre 2026

- Explore charge maintenant les étoiles les plus proches en premier. Le tri **Nearest first** est l'état initial et la destination de **Reset** ; il n'est donc pas compté comme un filtre actif.
- **Brightest first**, **Farthest first** et **Name A–Z** restent disponibles dans la feuille de filtres.
- La localisation céleste passe de trois zones approximatives à sept bandes de déclinaison continues : North pole, High north, Low north, Equatorial, Low south, High south et South pole.
- Les limites affichées vont de −90° à +90°. Chaque déclinaison appartient à une seule bande, sans trou ni chevauchement ; **All sky** conserve la vue complète.
- Ce filtre décrit une position fixe sur la sphère céleste. Il ne prétend pas indiquer où regarder depuis un lieu et une heure donnés, fonction qui reste réservée au localisateur utilisant le téléphone.
- Vérification : `node scripts/check-catalogue-filters.cjs` et `npx.cmd tsc --noEmit`.
