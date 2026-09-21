# Astralys — lancement et transitions

## Comportement

- Le splash natif affiche la marque orbitale lavande sur fond `#070911`.
- Il disparaît après le chargement des polices et la première mise en page, même si une police échoue.
- Une introduction dans l'app affiche la marque et le nom Astralys pendant deux secondes : fondu d'entrée de 500 ms, maintien d'une seconde et fondu vers l'application de 500 ms. Le bouton **Skip** permet de la passer.
- L'apparition du contenu démarre pendant le fondu de sortie, pour éviter une seconde apparition après la disparition du lancement.
- L'introduction ne dépend pas de Supabase et ne se rejoue pas lors des changements d'onglet ou des retours depuis l'arrière-plan.
- Accueil : apparition de l'astre, puis du titre et des actions.
- Explore : titre, recherche, filtres, puis les six premières cartes au maximum.
- Collection : titre, premières cartes et bouton d'exploration.
- Profile : formulaire ou identité, sans réinitialiser les champs pour animer.
- Fiches : ouverture douce, puis visuel et identité. Les informations scientifiques apparaissent à leur ouverture.
- Les transitions de section durent 240 ms avec un déplacement maximal de 6 points ; les décalages sont plafonnés à 180 ms.
- Le menu du bas est en dehors de l'animation du contenu. Les transitions n'ajoutent aucun écran bloquant.
- L'introduction est passée et les mouvements sont désactivés si « réduire les animations » est activé. Les animations de section sont annulées quand l'écran perd le focus ou l'app passe en arrière-plan.

## Vérifications sur téléphone

1. Fermer complètement l'app, la relancer : intro courte puis contenu ; tester **Skip**.
2. Basculer rapidement entre les quatre onglets : menu fixe, aucun écran bloqué.
3. Saisir une recherche, ouvrir une fiche puis revenir : recherche conservée et boutons utilisables.
4. Dans Collection, ouvrir une étoile, comparer puis revenir : navigation conservée.
5. Saisir des données dans Profile, changer d'onglet et revenir : pas de réinitialisation provoquée par l'animation.
6. Mettre l'app en arrière-plan pendant l'intro, puis revenir : pas de nouvelle introduction ni d'overlay persistant.
7. Activer « réduire les animations » avant le lancement, puis pendant l'utilisation : contenu immédiatement disponible.
8. Relancer sans réseau : le lancement doit disparaître ; les écrans affichent ensuite leurs états habituels de chargement ou d'erreur.

Expo Go permet de voir l'introduction et les transitions dans l'app. Le splash natif personnalisé doit être contrôlé sur une nouvelle compilation installée, idéalement une version release.

## Étoiles des menus — rendu natif

Le composant partagé `CelestialVisual` utilise maintenant un shader Skia pour les étoiles d'Explore, Collection, Profile, des fiches et des comparaisons. La surface sphérique présente une granulation, des taches discrètes et un assombrissement naturel au bord, avec un halo transparent sans rayons en croix. La palette existante reste liée à la catégorie ou à la température disponible ; la texture illustrative dépend de l'identifiant et ne change pas au rechargement. Ce rendu n'est pas une photographie ni une carte mesurée de la surface.

Les vignettes de moins de 60 points sont fixes et omettent l'octave fine de granulation. Les grands visuels déjà marqués `animated` tournent en 42 secondes : seule la surface change, le halo reste en place. La convection et la faible variation de luminosité bouclent sans coupure. L'animation s'arrête hors de l'onglet actif, en arrière-plan et avec « réduire les animations ». Une apparence statique de secours reste disponible si le shader ne compile pas. Les planètes des menus et l'astre lavande de l'accueil restent inchangés.

Contrôle sans navigateur : `node scripts/check-menu-stars.cjs` vérifie la compilation Skia via CanvasKit, six tailles mobiles, la transparence du halo, l'identité stable, les palettes et la boucle. `--preview` produit des échantillons de matériaux, pas des captures du téléphone. Contrôler la fluidité et le rendu final dans Expo Go.

## Fichiers

- `src/components/launch-intro.tsx` : séquence de lancement et sortie de secours.
- `src/components/astralys-mark.tsx` : marque vectorielle partagée.
- `scripts/generate-launch-mark.cjs` : génération du PNG natif à partir des mêmes tracés.
- `assets/brand/astralys-logo.svg` : logo vectoriel conservé, sans perte à l'agrandissement.
- `assets/brand/astralys-logo-2048.png` : export PNG transparent de 2048 × 2048 pixels (`node scripts/generate-launch-mark.cjs --hd`).
- `src/context/motion-context.tsx` : préférences, état de premier lancement.
- `src/hooks/use-reveal-motion.ts` et `src/components/motion-section.tsx` : transitions réutilisables.
