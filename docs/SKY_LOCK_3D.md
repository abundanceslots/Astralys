# Astralys — verrouillage 3D du ciel

## Problème corrigé

L'ancien localisateur comparait le cap 2D du compas à l'azimut de l'astre, puis utilisait uniquement l'angle `beta` pour la hauteur. Cette approximation ne décrivait pas l'axe optique de la caméra arrière, ignorait le roulis et mélangeait deux capteurs mis à jour séparément. Un marqueur pouvait donc accompagner le mouvement du téléphone au lieu de rester fixé sur le ciel.

## Technique retenue

Le localisateur construit maintenant un repère orthonormal complet dans les coordonnées du téléphone :

1. la composante de mouvement est retirée de l'accélération totale afin d'isoler la gravité, qui donne le zénith local ;
2. le champ magnétique calibré est projeté sur le plan horizontal pour obtenir le nord magnétique ;
3. `trueHeading − magHeading` corrige ce nord vers le nord vrai ;
4. le produit vectoriel donne l'est ;
5. chaque azimut/altitude astronomique est transformé dans ce repère ;
6. le vecteur obtenu est projeté par une caméra rectilinéaire de champ 62° × 44°.

La caméra arrière vise l'axe `−Z` du téléphone. La projection tient donc compte simultanément du lacet, de l'inclinaison et du roulis. Le filtre devient très amorti sous `0,8°/s` et conserve la dernière pose dans une zone morte de `0,35°`. Dès qu'un mouvement volontaire est détecté, sa réactivité augmente progressivement pour éviter une visée lente ou collante. La correction manuelle de l'horizon reste disponible et agit comme un biais vertical explicite.

Le localisateur fonctionne désormais en mode cible unique. Il ne charge et ne projette plus les 350 étoiles de contexte : seule l'étoile sélectionnée — ou le système hôte d'une exoplanète sélectionnée — peut apparaître sur la caméra. Cela réduit le bruit visuel et supprime les calculs de projection sans rapport avec la cible.

Cette architecture reprend les principes utilisés par les planétariums mobiles : Sky Map décrit une combinaison compas–accéléromètre–gyroscope, une correction magnétique et un réglage d'amortissement ; Stellarium Mobile utilise un mode capteurs où la carte suit la direction réelle du téléphone. Aucune source tierce n'a été copiée.

## Sources techniques

- [Expo SDK 57 — DeviceMotion](https://docs.expo.dev/versions/v57.0.0/sdk/devicemotion/) : axes du téléphone, orientation, fréquence de mise à jour et disponibilité dans Expo Go.
- [Expo SDK 57 — Magnetometer](https://docs.expo.dev/versions/v57.0.0/sdk/magnetometer/) : valeurs calibrées du champ magnétique sur les trois axes.
- [Expo SDK 57 — Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/) : `magHeading`, `trueHeading` et niveaux de précision du compas.
- [Sky Map — aide officielle](https://github.com/sky-map-team/stardroid/blob/master/help.md) : fusion de capteurs, amortissement, correction magnétique, diagnostic et calibration en huit.
- [Stellarium Mobile — guide](https://github.com/ultrapre/Stellarium-mobile/blob/master/mobile-guide/guide.md) : position GPS et mode capteurs pour aligner la vue sur la direction du téléphone.

## Limites honnêtes

Le résultat est une aide au pointage, pas de l'astrométrie. Un aimant dans une coque, une structure métallique, un véhicule ou un capteur de mauvaise qualité peut déplacer le nord de plusieurs degrés. L'application affiche donc la qualité du compas et demande une calibration en huit lorsque cette qualité est faible. Le champ de vue 62° × 44° est une approximation commune : Expo Camera n'expose pas actuellement l'étalonnage optique précis de chaque caméra dans ce parcours.

Pour une précision supérieure à quelques degrés, une future version native devrait utiliser ARKit/ARCore, leurs poses de caméra horodatées et les paramètres intrinsèques réels de l'objectif. Cette évolution nécessiterait un development build et ne resterait pas limitée aux API disponibles dans Expo Go.

## Vérification

`node scripts/check-sky-orientation.cjs` vérifie les visées nord, est et à 30° d'altitude, l'inversion correcte du mouvement à l'écran, l'exclusion des objets derrière la caméra, la correction du nord vrai, l'amortissement adaptatif et la zone morte. Les capteurs, le champ magnétique local et la caméra exigent encore un test sur téléphone réel.
