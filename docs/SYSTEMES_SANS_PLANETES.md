# Astralys — planètes réelles et systèmes sans planète répertoriée

## Ce qui est en place au 18 septembre 2026

653 planètes confirmées du NASA Exoplanet Archive ont été importées dans Supabase et reliées à 435 des 10 100 étoiles du catalogue. Les 9 665 autres systèmes conservent le statut `unknown` : aucune planète confirmée n'a été associée par cet import, ce qui ne signifie pas qu'ils n'ont aucune planète.

Le rapprochement utilise exclusivement l'identifiant Gaia DR3 exact. Des systèmes connus peuvent échapper à cette méthode lorsque cet identifiant manque ou diffère dans les sources. Ces chiffres décrivent le catalogue importé, pas un inventaire exhaustif de tous les systèmes.

Dans la fiche d'une étoile, **Confirmed planets** ouvre la liste de ses planètes. Toucher une planète ouvre sa fiche ; Back revient à l'étoile. Sans correspondance, le message indique **No confirmed planets listed**. Une erreur réseau n'est pas transformée en compteur zéro.

Les caractéristiques disponibles, l'année et la méthode de découverte sont conservées. Les valeurs manquantes restent inconnues. Les visuels sont interprétatifs ; les coordonnées et le guidage caméra d'une exoplanète désignent la direction de son système hôte, pas une planète que le téléphone pourrait distinguer.

## Proposition : développer un observatoire, même sans planète connue

Cette progression est une proposition à implémenter, pas une nouvelle économie déjà activée. Elle complète le modèle d'observatoire social sans introduire des planètes fictives dans le catalogue scientifique.

1. **Satellite d'observation** : première installation simulée autour de l'étoile. Elle ouvre des missions de suivi, un journal et des améliorations visuelles.
2. **Relais** : développe le réseau et permet des campagnes communes avec les gardiens voisins. Les alliances restent facultatives.
3. **Station scientifique** : ajoute une base orbitale simulée et des missions plus longues, sans avoir besoin d'une surface planétaire.
4. **Observatoire spatial** : personnalisation avancée, objectifs de connaissance et suivi des nouvelles publications. La simulation n'invente pas de résultats scientifiques.

Une mission de sonde à destination d'une planète confirmée constitue un contenu supplémentaire lorsque le système en possède. Elle n'est pas obligatoire pour débloquer le relais, la station ou le niveau maximal de l'observatoire.

### Rythme indicatif

Conserver les durées du modèle existant : satellite 5 minutes, relais 12 heures, station 24 heures, observatoire 24 heures. Une mission de sonde peut durer 6 heures. Ces durées sont des choix de conception, pas des délais de voyage réels. Le premier satellite sert à comprendre la boucle dès la première session ; les améliorations suivantes donnent une raison de revenir sans imposer une récolte horaire.

La même progression de base et les mêmes plafonds sont disponibles dans tous les systèmes, indépendamment du nombre de planètes confirmées. Les planètes ajoutent des découvertes et des objectifs, pas un avantage obligatoire de production. Acheter un astre ne garantit ni des planètes inconnues ni une découverte future.

## Présentation dans le menu 3D

L'étoile reste au centre. Satellites, relais et station forment des points navigables sur des trajectoires illustratives portant la mention **Simulation**. Les planètes confirmées ajoutent leurs propres points avec leur vrai nom et leurs données connues ; la vue n'est pas à l'échelle.

Sans planète connue, le système n'est donc pas vide : le joueur navigue entre ses installations et leurs améliorations. Ne pas ajouter arbitrairement une planète, une ceinture d'astéroïdes ou des ressources présentées comme réellement observées.

Le panneau flottant reste court : instrument sélectionné, état de mission, amélioration disponible. **Satellite relay** conserve son interface dédiée. Le statut scientifique « aucune planète confirmée répertoriée » reste séparé de l'avancement simulé.

## Séparation des données

- `celestial_objects` : uniquement les astres réels importés avec leur provenance.
- `planetary_systems` et `planetary_system_planets` : associations et nombre de planètes confirmées répertoriées, sans nombre total supposé.
- `observatory_satellites` : installations simulées du gardien ; une station dépend du système, pas obligatoirement d'une planète.
- `guardian_observatory_progress` : progression légère de connaissance, exploration et connexion.
- `planet_colonies` : contenu simulé facultatif pour les planètes confirmées.

Les déblocages et fins de mission devront être validés côté serveur, avec RLS et une fonction contrôlée ; le téléphone ne doit pas pouvoir attribuer lui-même des points ou modifier les compteurs scientifiques.

## Suivi du catalogue

Prévoir une actualisation périodique, par exemple mensuelle, avec revue du résultat et déduplication par source. Une nouvelle correspondance confirmée peut ensuite apparaître comme nouvelle planète dans le système existant. Aucun rafraîchissement automatique n'a été programmé par cet import, et aucune actualité scientifique n'est fabriquée pour remplir le menu.

## Limites de cette livraison

L'import et la consultation des fiches sont réalisés. La progression orbitale décrite ci-dessus n'est pas encore implémentée. La démonstration 3D existante conserve ses données de démonstration et n'est pas automatiquement remplacée par les 653 planètes.

Sources et audit : `supabase/imports/nasa-planets-20260918/manifest.json` et `verification.json`. Documentation NASA : https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html
