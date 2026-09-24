import { supabase } from '@/lib/supabase';
import type { GuardianDemoState } from '@/features/guardian-demo-model';

/**
 * Sauvegarde cloud de la progression (table `guardian_progress`).
 * Lecture directe (RLS : ses propres lignes), écriture uniquement via
 * la fonction `save_guardian_progress`, qui gère les conflits entre appareils.
 */

export type CloudProgress = { state: unknown; revision: number };

export type CloudSaveResult =
  | { status: 'saved'; revision: number }
  | { status: 'conflict'; revision: number; state: unknown }
  | { status: 'error' };

export async function loadCloudProgress(userId: string): Promise<CloudProgress | null | 'error'> {
  const { data, error } = await supabase
    .from('guardian_progress')
    .select('state, revision')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return 'error';
  if (!data) return null;
  return { state: data.state, revision: Number(data.revision) || 0 };
}

/** Progression de chaque système possédé, indexée par l'identifiant de l'étoile. */
export type SystemsProgress = Record<string, GuardianDemoState>;
/** Clé de l'ancienne progression unique (avant la progression par système). */
export const LEGACY_SYSTEM = '__legacy';

const strip = (state: GuardianDemoState) => {
  // `message` et `lastCollected` ne servent qu'à l'affichage local : inutile de les envoyer.
  const { message: _message, lastCollected: _lastCollected, ...payload } = state;
  return payload;
};

/**
 * Format envoyé au serveur : les champs du premier système restent au premier niveau
 * (la fonction save_guardian_progress les valide), et `systems` contient chaque système.
 */
export function packProgress(systems: SystemsProgress) {
  const keys = Object.keys(systems).sort();
  const first = systems[keys.find(k => k !== LEGACY_SYSTEM) ?? keys[0]];
  return { ...(first ? strip(first) : {}), format: 2, systems: Object.fromEntries(keys.map(k => [k, strip(systems[k])])) };
}

/** Lit l'ancien format (une seule progression) comme le nouveau (une par système). */
export function unpackProgress(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const value = raw as { systems?: unknown };
  if (value.systems && typeof value.systems === 'object') return value.systems as Record<string, unknown>;
  return { [LEGACY_SYSTEM]: raw };
}

/** Fusion entre deux appareils, système par système. */
export function mergeSystems(a: SystemsProgress, b: SystemsProgress): SystemsProgress {
  const out: SystemsProgress = { ...a };
  for (const [key, state] of Object.entries(b)) out[key] = out[key] ? furthestProgress(out[key], state) : state;
  return out;
}

export async function saveCloudProgress(systems: SystemsProgress, baseRevision: number): Promise<CloudSaveResult> {
  const { data, error } = await supabase.rpc('save_guardian_progress', { p_state: packProgress(systems), p_base_revision: baseRevision });
  if (error) return { status: 'error' };
  const row = (Array.isArray(data) ? data[0] : data) as { saved_revision: number; saved_state: unknown; is_conflict: boolean } | null;
  if (!row) return { status: 'error' };
  return row.is_conflict
    ? { status: 'conflict', revision: Number(row.saved_revision), state: row.saved_state }
    : { status: 'saved', revision: Number(row.saved_revision) };
}

/**
 * Choisit la progression la plus avancée entre deux appareils :
 * planètes, puis relais, puis sonde en route (et sa route), puis épreuves du jour, puis signaux, puis énergie.
 */
export function furthestProgress(a: GuardianDemoState, b: GuardianDemoState): GuardianDemoState {
  const score = (s: GuardianDemoState) => [
    s.connected.length,
    s.relayLevel,
    s.probeTarget ? 1 : 0,
    s.probeTarget ? s.orbitalNextMission : 0,
    s.dailyDay * 10 + s.dailyStage,
    s.signalsAnalyzed,
    s.energy,
  ];
  const sa = score(a), sb = score(b);
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return sa[i] > sb[i] ? a : b;
  }
  return a.lastSyncedAt >= b.lastSyncedAt ? a : b;
}
