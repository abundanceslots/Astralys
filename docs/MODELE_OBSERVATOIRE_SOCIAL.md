# Astrélys — modèle d’observatoire social

## Positionnement

Astrélys reste une application astronomique centrée sur un astre réel confié à un gardien. La progression légère sert à renforcer la relation avec cet astre ; elle ne doit jamais prendre le dessus sur son suivi scientifique.

Les constructions autour d’une planète sont des simulations clairement signalées. Elles ne modifient pas les données scientifiques et ne représentent ni une propriété réelle ni un projet de colonisation véritable.

## Expérience principale

1. Le joueur reçoit un astre réel et devient son gardien dans Astrélys.
2. Il consulte sa visibilité, sa position, ses caractéristiques et ses planètes confirmées.
3. Ses observations font progresser trois indicateurs simples : connaissance, exploration et connexion.
4. Il déploie des instruments symboliques autour de son système.
5. Il explore les planètes confirmées puis développe une station et une colonie simulée.
6. Astrélys lui propose les gardiens des systèmes physiquement les plus proches.
7. Jusqu’à huit gardiens peuvent former un réseau stellaire et accomplir des missions communes.

## Progression légère

- **Connaissance** : augmente en consultant les données et en réalisant des observations.
- **Exploration** : augmente avec les sondes et les missions planétaires.
- **Connexion** : augmente avec les relais et les actions menées avec des voisins.

Il n’existe pas de collecte obligatoire toutes les heures. La progression dépend d’actions astronomiques, de missions limitées dans le temps et de collaborations facultatives.

## Instruments

| Instrument | Rôle | Durée initiale |
|---|---|---:|
| Satellite d’observation | Suivi de l’astre et premières données | 5 min |
| Sonde planétaire | Exploration d’une planète confirmée | 6 h |
| Relais de communication | Connexion avec les systèmes voisins | 12 h |
| Station scientifique | Présence orbitale et missions approfondies | 24 h |
| Télescope spatial | Données avancées et alertes scientifiques | 24 h |

## Colonisation simulée

Une planète suit quatre étapes : étude, relais orbital, station scientifique, colonie simulée. Les contraintes scientifiques connues restent visibles pendant toute la simulation. Une planète inconnue ou non confirmée ne doit pas être présentée comme réelle.

## Alliances de proximité

Chaque système actif reçoit une liste de huit voisins calculée à la demande en trois dimensions à partir de l’ascension droite, de la déclinaison et de la distance à la Terre. Le calcul est déclenché lorsqu’un gardien obtient le système, afin d’éviter de matérialiser près de 100 millions de comparaisons pour les 10 000 étoiles. Une alliance comporte entre deux et huit gardiens.

Les activités collectives sont volontairement simples : campagne d’observation, calibration d’un relais et étude planétaire. Les astres, bases et achats d’un joueur ne peuvent jamais être détruits ou confisqués.

## Tables Supabase

- `stellar_neighbors` : huit voisins physiques par système.
- `guardian_observatory_progress` : connaissance, exploration et connexion.
- `observatory_instrument_rules` : règles des cinq instruments.
- `observatory_satellites` : instruments déployés par un gardien.
- `planet_colonies` : progression d’une colonie explicitement simulée.
- `stellar_alliances` et `stellar_alliance_members` : réseaux de gardiens.
- `stellar_alliance_invitations` : invitations valables sept jours.
- `stellar_network_links` : liens partagés entre systèmes.
- `stellar_alliance_missions` et `stellar_alliance_contributions` : missions communes.

Les données privées d’un observatoire sont protégées par RLS. Les écritures de progression, d’alliance et de mission devront passer par des fonctions Supabase ou une Edge Function afin que le téléphone ne puisse pas attribuer lui-même des points.

## Limites de la première version

- Pas de guerre, de marché ou de monnaie échangeable.
- Pas de discussion libre au lancement, afin d’éviter une infrastructure de modération prématurée.
- Pas de destruction d’un achat ou d’un astre attitré.
- Les anciennes tables d’économie restent disponibles mais ne sont pas utilisées par ce modèle.
