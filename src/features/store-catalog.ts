/**
 * Boutique Astralys : ce qui est payant et combien.
 *
 * Modèle : la première étoile est offerte, les suivantes s'achètent une fois.
 * Le prix dépend du nombre de VRAIES planètes du système (les autres sont inventées).
 * Rien d'autre n'accélère la progression contre de l'argent (pas de monnaie, pas de boosts).
 * Les cosmétiques arriveront plus tard.
 *
 * Les prix affichés ici sont des prix indicatifs : une fois Google Play Billing / App Store branchés,
 * l'app affichera le prix localisé renvoyé par le store pour chaque produit (PRODUCT_IDS).
 * Le palier devra aussi être recalculé côté serveur au moment de valider un achat.
 */

export type StarTier = 'imagined' | 'real1' | 'real2' | 'real4';

/** Ce dont la rareté a besoin : le nombre de planètes confirmées (vraies) autour de l'étoile. */
export type TierInput = { confirmed_planet_count?: number | null };

/**
 * Le prix dépend de ce qui est réel dans le système (7 planètes dans le jeu) :
 * · 0 vraie planète → système entièrement imaginé ;
 * · 1 vraie planète ;
 * · 2 ou 3 vraies planètes ;
 * · 4 vraies planètes ou plus.
 * Catalogue actuel (10 100 étoiles) : 9 665 / 289 / 130 / 16.
 */
export function starTier(star: TierInput): StarTier {
  const planets = star.confirmed_planet_count ?? 0;
  if (planets >= 4) return 'real4';
  if (planets >= 2) return 'real2';
  if (planets >= 1) return 'real1';
  return 'imagined';
}

export type TierInfo = {
  tier: StarTier;
  label: string;
  /** Prix indicatif (remplacé par le prix du store une fois la facturation branchée). */
  price: string;
  priceCents: number;
  productId: string;
  color: string;
  share: string;
  why: string;
};

export const TIERS: Record<StarTier, TierInfo> = {
  imagined: {
    tier: 'imagined', label: 'Imagined system', price: '€1.99', priceCents: 199, productId: 'star_imagined',
    color: '#A9C4FF', share: '≈ 9,700 stars', why: 'A real star with 7 imagined worlds. No planet has been discovered around it yet.',
  },
  real1: {
    tier: 'real1', label: '1 real planet', price: '€4.99', priceCents: 499, productId: 'star_real_1',
    color: '#9ED9BF', share: '289 stars', why: 'A real star with 1 confirmed planet and 6 imagined worlds.',
  },
  real2: {
    tier: 'real2', label: '2–3 real planets', price: '€7.99', priceCents: 799, productId: 'star_real_2',
    color: '#C8BAF5', share: '130 stars', why: 'A real star with 2 or 3 confirmed planets; the other worlds are imagined.',
  },
  real4: {
    tier: 'real4', label: '4+ real planets', price: '€9.99', priceCents: 999, productId: 'star_real_4',
    color: '#FFD66B', share: '16 stars', why: 'One of the richest known systems: 4 to 6 confirmed planets, the rest imagined.',
  },
};

export const TIER_ORDER: readonly StarTier[] = ['real4', 'real2', 'real1', 'imagined'];

/** Identifiants des produits à créer dans la Play Console et App Store Connect (achats consommables). */
export const PRODUCT_IDS = TIER_ORDER.map(tier => TIERS[tier].productId);

/** Nombre d'emplacements de planètes d'un système dans le jeu. */
export const SYSTEM_PLANET_SLOTS = 7;

/** Vraies planètes (confirmées) et planètes inventées d'un système, à annoncer avant l'achat. */
export function systemComposition(confirmedPlanets: number | null | undefined) {
  if (confirmedPlanets == null) return null;
  const real = Math.max(0, Math.min(SYSTEM_PLANET_SLOTS, confirmedPlanets));
  return { real, imagined: SYSTEM_PLANET_SLOTS - real };
}

/** La première étoile est offerte. */
export const isFreeClaim = (ownedStars: number) => ownedStars === 0;

export type Cosmetic = { id: string; label: string; detail: string };
/** Prévus, pas encore en vente. */
export const UPCOMING_COSMETICS: readonly Cosmetic[] = [
  { id: 'widget_themes', label: 'Widget themes', detail: 'Nebula, aurora and deep-field styles for your home-screen star.' },
  { id: 'satellite_trails', label: 'Satellite trails', detail: 'Coloured trails and liveries for your relays.' },
  { id: 'star_plaques', label: 'Star plaque', detail: 'A signed certificate card to share your star.' },
];
