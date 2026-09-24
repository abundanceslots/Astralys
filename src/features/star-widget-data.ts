/**
 * Données du widget « Mon étoile » (écran d'accueil iOS et Android).
 * Module pur : l'app l'utilise pour préparer les entrées du widget, et le widget Android
 * s'en sert aussi en arrière-plan pour se mettre à jour toutes les 30 min, sans ouvrir l'app.
 */
import { calculateVisibility } from '@/utils/astronomy';

/** Ce que l'app enregistre pour le widget (lu aussi par le widget Android en arrière-plan). */
export type StarWidgetInput = {
  starId: string;
  name: string;
  /** Couleur de l'étoile (#rrggbb), issue de sa couleur Gaia. */
  colorHex: string;
  distanceLy: number | null;
  raDeg: number | null;
  decDeg: number | null;
  /** Progression de CE système. */
  energy: number;
  energyPerHour: number;
  lastSyncedAt: number;
  planetsReached: number;
  planetsTotal: number;
  /** Position de l'utilisateur (si la localisation est autorisée), pour la visibilité de ce soir. */
  location: { latitude: number; longitude: number } | null;
  savedAt: number;
};

/** Textes prêts à afficher : le widget iOS ne peut rien calculer lui-même. */
export type StarWidgetProps = {
  name: string;
  colorHex: string;
  energyPerHour: string;
  energy: string;
  visibility: string;
  visibilityDetail: string;
  visibleNow: boolean;
  lightYear: string;
  lightDetail: string;
  planets: string;
};

const OFFLINE_CAP_H = 8;
const PARIS = { latitude: 48.8566, longitude: 2.3522 };
const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const compact = (n: number) => n >= 100_000 ? `${Math.round(n / 1000)}k` : n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toLocaleString('en-US');

/** Année où est partie la lumière que l'on voit aujourd'hui. */
export function lightDeparture(distanceLy: number | null, at: Date): { year: string; detail: string } {
  if (distanceLy == null || !Number.isFinite(distanceLy) || distanceLy <= 0) return { year: '—', detail: 'Distance unknown' };
  const year = at.getFullYear() + at.getMonth() / 12 - distanceLy;
  const label = year >= 1 ? String(Math.floor(year)) : `${Math.round(1 - year).toLocaleString('en-US')} BC`;
  return { year: label, detail: `${Math.round(distanceLy).toLocaleString('en-US')} light-years away` };
}

/** Énergie du système à l'instant `at`, production hors ligne comprise (limitée à 8 h comme dans le jeu). */
export function projectedEnergy(input: Pick<StarWidgetInput, 'energy' | 'energyPerHour' | 'lastSyncedAt'>, at: Date) {
  const hours = Math.min(OFFLINE_CAP_H, Math.max(0, (at.getTime() - input.lastSyncedAt) / 3_600_000));
  return input.energy + Math.floor(hours * input.energyPerHour);
}

export function buildWidgetProps(input: StarWidgetInput, at: Date = new Date()): StarWidgetProps {
  const light = lightDeparture(input.distanceLy, at);
  let visibility = 'Tonight';
  let visibilityDetail = 'Open Astralys to locate it';
  let visibleNow = false;
  if (input.raDeg != null && input.decDeg != null) {
    // Sans localisation autorisée, comme dans l'app : calcul depuis Paris (précisé dans le détail).
    const observer = input.location ?? PARIS;
    const where = input.location ? '' : ' · Paris';
    const forecast = calculateVisibility(input.raDeg, input.decDeg, { ...observer, label: '' }, at);
    if (forecast?.visibleNow) {
      visibleNow = true;
      visibility = 'Visible now';
      visibilityDetail = `${forecast.direction} · ${Math.round(forecast.currentAltitude)}° high${where}`;
    } else if (forecast?.observableTonight && forecast.firstVisibleTime) {
      visibility = `Visible from ${hhmm(forecast.firstVisibleTime)}`;
      visibilityDetail = (forecast.bestTime ? `Best ${hhmm(forecast.bestTime)} · ${forecast.direction}` : forecast.direction) + where;
    } else if (forecast) {
      visibility = 'Not visible tonight';
      visibilityDetail = (forecast.currentAltitude < 0 ? 'Below the horizon' : 'Too low or daylight') + where;
    }
  }
  return {
    name: input.name,
    colorHex: input.colorHex,
    energyPerHour: `+${compact(input.energyPerHour)} ⚡/h`,
    energy: `${compact(projectedEnergy(input, at))} ⚡`,
    visibility,
    visibilityDetail,
    visibleNow,
    lightYear: light.year,
    lightDetail: light.detail,
    planets: `${input.planetsReached}/${input.planetsTotal} planets`,
  };
}

/** Entrées d'une frise : le widget iOS passe de l'une à l'autre tout seul (toutes les 30 min, 12 h d'avance). */
export function buildWidgetTimeline(input: StarWidgetInput, from: Date = new Date(), hours = 12, stepMinutes = 30) {
  const start = new Date(from); start.setSeconds(0, 0);
  return Array.from({ length: Math.floor(hours * 60 / stepMinutes) + 1 }, (_, i) => {
    const date = new Date(start.getTime() + i * stepMinutes * 60_000);
    return { date, props: buildWidgetProps(input, date) };
  });
}

export const WIDGET_STORAGE_KEY = 'astralys:widget:v1';
export const WIDGET_NAME = 'AstralysStar';
