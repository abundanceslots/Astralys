import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

/**
 * Retours haptiques d'Orbital Hook.
 *
 * On passe par le module natif `ExpoHaptics` en mode optionnel (exactement
 * comme le fait le paquet expo-haptics) : il est déjà présent dans Expo Go,
 * et s'il manque dans un build personnalisé, les appels deviennent de
 * simples no-op au lieu de faire planter l'app.
 * Pour un build de production, ajoutez le paquet : `npx expo install expo-haptics`.
 */
type HapticsModule = {
  impactAsync?: (style: string) => Promise<void>;
  notificationAsync?: (type: string) => Promise<void>;
  selectionAsync?: () => Promise<void>;
  performHapticsAsync?: (type: string) => Promise<void>;
};

const native = requireOptionalNativeModule<HapticsModule>('ExpoHaptics');

export type HapticKind = 'tick' | 'launch' | 'success' | 'warning' | 'error';

/** Sur Android, les haptiques système ne demandent aucune permission et sont plus fines que le vibreur. */
const ANDROID: Record<HapticKind, string> = {
  tick: 'segment-frequent-tick',
  launch: 'gesture-end',
  success: 'confirm',
  warning: 'reject',
  error: 'reject',
};

let lastTick = 0;

export function haptic(kind: HapticKind): void {
  if (!native) return;
  // Les crans de visée peuvent arriver très vite : on en limite la cadence.
  if (kind === 'tick') {
    const now = Date.now();
    if (now - lastTick < 35) return;
    lastTick = now;
  }
  try {
    if (Platform.OS === 'android' && native.performHapticsAsync) {
      void native.performHapticsAsync(ANDROID[kind]).catch(() => {});
      return;
    }
    if (kind === 'tick') void native.selectionAsync?.().catch(() => {});
    else if (kind === 'launch') void native.impactAsync?.('medium').catch(() => {});
    else void native.notificationAsync?.(kind).catch(() => {});
  } catch {
    // Haptique indisponible : sans importance pour le jeu.
  }
}
