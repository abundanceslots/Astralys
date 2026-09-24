/**
 * Garde le widget « Mon étoile » à jour : la première étoile acquise, l'énergie que produit SON système,
 * sa visibilité ce soir (position approximative si déjà autorisée, sinon Paris) et l'année de départ de sa lumière.
 * Écrit la fiche dans le stockage local (lue par le widget Android en arrière-plan) puis la pousse vers le widget.
 * Envoi seulement quand quelque chose de visible change, au plus toutes les 15 min sinon, et au passage en arrière-plan.
 */
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import { useAcquisitions } from '@/context/acquisitions-context';
import { useGuardianProgress } from '@/context/guardian-progress-context';
import { demoPlanets, stateEnergyPerHour } from '@/features/guardian-demo-model';
import { WIDGET_STORAGE_KEY, type StarWidgetInput } from '@/features/star-widget-data';
import { useSystemDefinition } from '@/lib/system-catalogue';
import { pushStarWidget } from '@/lib/star-widget-platform';
import { getCelestialDisplayName } from '@/utils/celestial-display-name';

const REFRESH_MS = 15 * 60_000;

const toHex = ([r, g, b]: readonly number[]) =>
  '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');

/** Position déjà connue, sans jamais afficher de demande d'autorisation depuis le widget. */
async function knownLocation(): Promise<StarWidgetInput['location']> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted') return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 24 * 60 * 60_000 });
    // Arrondi (~1 km) : suffisant pour le ciel, et la fiche ne garde pas de position précise.
    return last ? { latitude: Math.round(last.coords.latitude * 100) / 100, longitude: Math.round(last.coords.longitude * 100) / 100 } : null;
  } catch {
    return null;
  }
}

export function useStarWidgetSync() {
  const { stars, loading } = useAcquisitions();
  const { progressFor, ready } = useGuardianProgress();
  const star = stars[0] ?? null;
  const { system } = useSystemDefinition(star);
  const location = useRef<StarWidgetInput['location']>(null);
  const last = useRef<{ signature: string; at: number }>({ signature: '', at: 0 });
  const latest = useRef<StarWidgetInput | null>(null);

  const state = star ? progressFor(star.id) : null;
  const input: StarWidgetInput | null = star && state ? {
    starId: star.id,
    name: getCelestialDisplayName(star),
    colorHex: system && system.starId === star.id ? toHex(system.star.color) : '#FFD9A0',
    distanceLy: star.distance_ly ?? null,
    raDeg: star.ra_deg ?? null,
    decDeg: star.dec_deg ?? null,
    energy: state.energy,
    energyPerHour: stateEnergyPerHour(state),
    lastSyncedAt: state.lastSyncedAt,
    planetsReached: state.connected.length,
    planetsTotal: demoPlanets.length,
    location: location.current,
    savedAt: Date.now(),
  } : null;
  latest.current = input;

  const push = (force: boolean) => {
    if (Platform.OS === 'web' || loading || !ready) return;
    const current = latest.current;
    const signature = current
      ? [current.starId, current.name, current.colorHex, current.energyPerHour, current.planetsReached, current.location?.latitude, current.location?.longitude].join('|')
      : 'none';
    const now = Date.now();
    if (!force && signature === last.current.signature && now - last.current.at < REFRESH_MS) return;
    last.current = { signature, at: now };
    try {
      if (current) localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(current));
      else localStorage.removeItem(WIDGET_STORAGE_KEY);
    } catch { /* le widget gardera sa dernière fiche */ }
    pushStarWidget(current);
  };
  const pushRef = useRef(push);
  pushRef.current = push;

  // Position approximative déjà autorisée (une fois par ouverture de l'app).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    void knownLocation().then(found => { if (active && found) { location.current = found; pushRef.current(false); } });
    return () => { active = false; };
  }, []);

  // Changement visible (étoile, production, planète atteinte, couleur) → mise à jour.
  const signature = input ? [input.starId, input.colorHex, input.energyPerHour, input.planetsReached].join('|') : 'none';
  useEffect(() => { pushRef.current(false); }, [signature, loading, ready]);

  // Rafraîchissement régulier tant que l'app est ouverte, et dès qu'elle passe en arrière-plan.
  useEffect(() => {
    const interval = setInterval(() => pushRef.current(false), REFRESH_MS);
    const subscription = AppState.addEventListener('change', next => { if (next !== 'active') pushRef.current(true); });
    return () => { clearInterval(interval); subscription.remove(); };
  }, []);
}
