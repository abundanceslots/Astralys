import type { StyleProp, ViewStyle } from 'react-native';

import type { Level, Palette } from './levels';

/**
 * Contrat public du jeu Orbital Hook, partagé par les trois implémentations :
 * - `orbital-hook.native.tsx` (iOS / Android, rendu Skia natif)
 * - `orbital-hook.web.tsx` (web, iframe)
 * - `orbital-hook.tsx` (repli WebView)
 */

/** 1 à 3 étoiles selon le nombre de tentatives. */
export type MissionStars = 1 | 2 | 3;

export type OrbitalEvent =
  | { type: 'ready'; missions: number }
  | { type: 'launch'; mission: number; attempt: number; dv: number; angle: number }
  | {
      type: 'fail';
      mission: number;
      attempt: number;
      reason: string;
      /** Distance minimale atteinte par rapport au bord de la cible (unités virtuelles). Natif uniquement. */
      closest?: number;
      /** Vrai si la sonde est passée tout près de la cible. Natif uniquement. */
      nearMiss?: boolean;
    }
  | {
      type: 'mission';
      mission: number;
      name: string;
      attempts: number;
      supply: number;
      /** Note de la mission. Natif uniquement. */
      stars?: MissionStars;
    }
  | { type: 'complete'; supply: number; totalAttempts: number; elapsedMs: number }
  | { type: 'state'; mission: number; attempts: number; supply: number; done: boolean };

export type OrbitalHookHandle = {
  /** Repart de la mission 1, remet la jauge de colonie à zéro. */
  reset(): void;
  /** Saute directement à une mission (index 0-based). */
  goTo(index: number): void;
  /** Gèle la simulation — à appeler quand l'écran perd le focus. */
  pause(): void;
  resume(): void;
  /** Demande un événement `state` avec la progression courante. */
  requestState(): void;
};

export type OrbitalHookProps = {
  /** Missions personnalisées. Par défaut : les cinq de `levels.ts`. */
  levels?: Level[];
  /** Surcharge partielle de la palette — pour coller à votre charte. */
  palette?: Partial<Palette>;
  /** Masque les barres d'interface : utile pour capturer une créa publicitaire. */
  showHud?: boolean;
  /** Retours haptiques (natif uniquement). Activés par défaut. */
  haptics?: boolean;
  /** Tous les événements, dans l'ordre. */
  onEvent?: (event: OrbitalEvent) => void;
  /** Raccourci : appelé une fois toutes les missions réussies. */
  onComplete?: (supply: number) => void;
  /** Raccourci : appelé à chaque mission réussie. */
  onMission?: (mission: number, supply: number) => void;
  style?: StyleProp<ViewStyle>;
};

/** Note d'une mission selon les tentatives : 1re = 3★, 2e–3e = 2★, au-delà = 1★. */
export function starsForAttempts(attempts: number): MissionStars {
  'worklet';
  return attempts <= 1 ? 3 : attempts <= 3 ? 2 : 1;
}
