import { localStarNames } from '@/data/star-names';

type NamedCelestialObject = {
  source_id: string;
  scientific_name: string;
  common_name: string | null;
};

// Canonical constellation genitives: https://iauarchive.eso.org/public/themes/constellations/
// Only presentation changes; source identifiers and verified proper names are retained.
const constellationGenitives: Record<string, string> = {
  'Cassiopée': 'Cassiopeiae', 'Serpentaire': 'Ophiuchi', 'Phénix': 'Phoenicis',
  'Sagittaire': 'Sagittarii', 'Bouvier': 'Boötis', 'Couronne boréale': 'Coronae Borealis',
  'Éridan': 'Eridani', 'Grande Ourse': 'Ursae Majoris', 'Balance': 'Librae',
  'Serpent': 'Serpentis', 'Lyre': 'Lyrae', 'Toucan': 'Tucanae', 'Vierge': 'Virginis',
  'Corbeau': 'Corvi', 'Hydre mâle': 'Hydri', 'Lynx': 'Lyncis', 'Dragon': 'Draconis',
  'Voiles': 'Velorum', 'Hercule': 'Herculis', 'Poupe': 'Puppis', 'Lièvre': 'Leporis',
  'Persée': 'Persei', 'Colombe': 'Columbae', 'Pégase': 'Pegasi', 'Hydre': 'Hydrae',
  'Lion': 'Leonis', 'Triangle austral': 'Trianguli Australis', 'Capricorne': 'Capricorni',
  'Indien': 'Indi', 'Flèche': 'Sagittae', 'Andromède': 'Andromedae',
  'Chiens de chasse': 'Canum Venaticorum', 'Cygne': 'Cygni', 'Céphée': 'Cephei',
  'Loup': 'Lupi', 'Cancer': 'Cancri', 'Aigle': 'Aquilae', 'Grue': 'Gruis',
  'Orion': 'Orionis', 'Croix du Sud': 'Crucis', 'Autel': 'Arae', 'Réticule': 'Reticuli',
  'Baleine': 'Ceti', 'Scorpion': 'Scorpii', 'Compas': 'Circini', 'Cocher': 'Aurigae',
  'Coupe': 'Crateris', 'Gémeaux': 'Geminorum', 'Mouche': 'Muscae',
};

// These syllables create stable Astralys catalogue names for Gaia sources that
// have no verified proper name. They are interface aliases, not IAU names.
const astralysSyllables = [
  'ael', 'aer', 'al', 'an', 'ar', 'astra', 'aur', 'bel',
  'cael', 'cer', 'cy', 'dae', 'del', 'dra', 'el', 'en',
  'era', 'fae', 'gal', 'hel', 'ia', 'il', 'io', 'ir',
  'kae', 'lae', 'len', 'li', 'lor', 'lyr', 'mae', 'mer',
  'na', 'nel', 'ner', 'no', 'nor', 'ny', 'ora', 'or',
  'phae', 'rae', 'ren', 'ria', 'sae', 'sel', 'ser', 'sol',
  'sy', 'tae', 'thal', 'tor', 'ul', 'vael', 'vel', 'vera',
  'vi', 'xa', 'ya', 'zen', 'zia', 'zor', 'un', 'eth',
] as const;

function isNumberedCatalogueName(name: string) {
  return /^(?:Gaia(?:\s+DR3)?|Star)\s+\d+$/i.test(name.trim());
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getAstralysCatalogueName(sourceId: string) {
  let hash = 2166136261;
  for (let index = 0; index < sourceId.length; index += 1) {
    hash ^= sourceId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  // Mix the 32-bit value before splitting it into five six-bit syllables.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  hash >>>= 0;

  const syllable = (shift: number) => astralysSyllables[(hash >>> shift) & 63];
  const givenName = capitalize(`${syllable(0)}${syllable(6)}${syllable(12)}`);
  const familyName = capitalize(`${syllable(18)}${syllable(24)}`);
  return `${givenName} ${familyName}`;
}

export function canonicalDesignation(name: string) {
  let translated = name.replace(/^Bêta\b/, 'Beta').replace(/^Êta\b/, 'Eta')
    .replace(/^Zêta\b/, 'Zeta').replace(/^Thêta\b/, 'Theta').replace(/^Rhô(?=\s|$)/, 'Rho');
  for (const [french, genitive] of Object.entries(constellationGenitives)) {
    if (translated.endsWith(' ' + french)) return translated.slice(0, -french.length) + genitive;
  }
  return translated;
}

function removeGaiaPrefix(name: string, sourceId: string) {
  if (isNumberedCatalogueName(name)) {
    return `Star ${sourceId}`;
  }

  return name;
}

export function getCelestialScientificName(object: NamedCelestialObject) {
  const localName = localStarNames[object.source_id];
  if (localName) return canonicalDesignation(localName.scientificName);

  return canonicalDesignation(removeGaiaPrefix(object.scientific_name, object.source_id));
}

export function hasAstralysCatalogueName(object: NamedCelestialObject) {
  return (!object.common_name || isNumberedCatalogueName(object.common_name))
    && !localStarNames[object.source_id]
    && isNumberedCatalogueName(object.scientific_name);
}

export function getCelestialDisplayName(object: NamedCelestialObject) {
  const localName = localStarNames[object.source_id];
  if (object.common_name && !isNumberedCatalogueName(object.common_name)) {
    return canonicalDesignation(object.common_name);
  }
  if (localName?.commonName) return canonicalDesignation(localName.commonName);
  if (localName?.scientificName) return canonicalDesignation(localName.scientificName);
  if (hasAstralysCatalogueName(object)) {
    return getAstralysCatalogueName(object.source_id);
  }

  return canonicalDesignation(object.scientific_name);
}

export function findLocalStarSourceIds(search: string) {
  const normalizedSearch = search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!normalizedSearch) return [];

  return Object.entries(localStarNames)
    .filter(([sourceId, names]) => {
      const searchable = [sourceId, names.scientificName, canonicalDesignation(names.scientificName), names.commonName]
        .filter(Boolean)
        .join(' ')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return searchable.includes(normalizedSearch);
    })
    .map(([sourceId]) => sourceId);
}
