# Import des 653 planètes confirmées

Import exécuté et vérifié le 18 septembre 2026 : 653 planètes, 435 étoiles hôtes, 653 associations de système. Les 10 100 étoiles existantes sont conservées. Aucune planète simulée n'a été ajoutée au catalogue scientifique.

## Fichiers

- `astralys_653_planetes_confirmees.sql` : transaction d'import, déduplication par catalogue/identifiant, associations et vérification finale.
- `astralys_653_planetes_confirmees.csv` : données normalisées, incluant les données source JSON.
- `payload.json` : objets attendus par la vérification.
- `nasa-source.json` : réponse NASA utilisée, conservée pour audit.
- `hosts.json` : correspondances avec les étoiles présentes dans Supabase.
- `manifest.json` : date, requête, méthode de rapprochement, compteurs et empreinte SHA-256 du SQL.
- `verification.json` : résultat de la vérification après import.

## Provenance et précautions

Source : NASA Exoplanet Archive, table `pscomppars` des planètes confirmées. Rapprochement par identifiant Gaia DR3 exact, traité comme une chaîne pour éviter une perte de précision. Pas de rapprochement approximatif par nom ou proximité angulaire.

Cette table composite peut réunir des paramètres issus de références différentes et des estimations ; les valeurs ne sont pas présentées comme un jeu de mesures provenant d'un même article. La référence de découverte disponible est `disc_refname`. Les indicateurs de limite restent dans les données brutes et les valeurs correspondantes ne sont pas exposées comme des mesures normalisées.

`mass_earth` n'est renseigné que pour une masse de provenance `Mass` ; une masse minimale de type M sin i n'est pas convertie en masse réelle. La magnitude de l'étoile n'est pas affectée à sa planète. L'année connue n'est pas transformée en date exacte. Les coordonnées désignent la direction du système hôte. Catégories et textures visuelles sont des interprétations, pas des photographies ou des classifications scientifiques garanties.

`orbit_order` est un classement par période orbitale disponible ; cinq objets restent sans ordre connu. `source_updated_at` indique la date de récupération de l'archive, pas la date d'une publication scientifique.

Les 9 665 étoiles sans correspondance conservent `data_status = 'unknown'`. Cela ne prouve pas l'absence de planètes, ni l'exhaustivité de cet import.

## Vérifier à nouveau

Depuis la racine du projet, avec les variables publiques Supabase de `.env.local` :

```powershell
node --use-system-ca --env-file=.env.local scripts/verify-confirmed-planets.mjs
```

La vérification ne fait aucune écriture dans Supabase ; elle actualise uniquement le rapport local `verification.json`. Elle compare les objets importés, leurs données source, les 653 liens, les compteurs des 435 systèmes et le statut des autres étoiles. Elle teste également la requête publique de l'application sur HD 219134 et ses six planètes.

## Préparer un autre lot

```powershell
node --use-system-ca --env-file=.env.local scripts/generate-confirmed-planets.mjs
```

Le générateur écrit uniquement les fichiers d'import locaux ; il ne dispose d'aucune clé d'administration et n'écrit pas dans Supabase. Il refuse de fonctionner si le dossier d'audit existe déjà. Le lot est volontairement contrôlé sur 653 objets : pour une actualisation, revoir la date, les assertions et la différence de catalogue, puis choisir un nouveau dossier et un nouvel identifiant de lot avant d'exécuter cette commande.

Le SQL a été exécuté dans la session authentifiée de l'éditeur Supabase. Les clés publiques ne permettent pas les écritures du catalogue. L'import ne modifie ni les noms des étoiles existantes ni leur attribution à un gardien.

Documentation : https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html
