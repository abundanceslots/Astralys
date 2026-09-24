import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/context/auth-context';
import { useAcquisitions } from '@/context/acquisitions-context';
import {
  createGuardianDemo,
  guardianDemoReducer,
  restoreGuardianDemo,
  syncGuardianProgress,
  type GuardianDemoAction,
  type GuardianDemoState,
} from '@/features/guardian-demo-model';
import { LEGACY_SYSTEM, loadCloudProgress, mergeSystems, saveCloudProgress, unpackProgress, type SystemsProgress } from '@/lib/guardian-cloud';

/**
 * Progression PAR SYSTÈME : chaque étoile acquise a sa propre énergie, son relais, ses planètes,
 * ses sondes, ses signaux et ses épreuves. Acquérir une nouvelle étoile ouvre donc une nouvelle
 * partie qui produit en parallèle des autres.
 *
 * Le « système actif » est celui que le joueur regarde (écran du système, Orbital Run, signaux).
 * Les autres ne sont pas recalculés en continu : leur production est rattrapée à la prochaine visite
 * (avec la même limite de 8 h que d'habitude).
 */

/** 'local' : invité ou table absente · 'syncing' / 'saved' / 'offline' : compte connecté. */
export type CloudStatus = 'local' | 'syncing' | 'saved' | 'offline';

type GuardianProgressValue = {
  /** Progression du système actif. */
  state: GuardianDemoState;
  ready: boolean;
  cloud: CloudStatus;
  /** Agit sur le système actif. */
  dispatch: (action: GuardianDemoAction) => void;
  activeSystemId: string | null;
  /** Choisit le système que les écrans de jeu affichent (identifiant de l'étoile). */
  setActiveSystem: (starId: string | null) => void;
  /** Progression d'un système donné (lecture seule), à jour de sa production. */
  progressFor: (starId: string | null | undefined) => GuardianDemoState;
};

const GuardianProgressContext = createContext<GuardianProgressValue | null>(null);

const STORAGE_VERSION = 'v4';
const LEGACY_GUEST_KEY = 'astralys:guardian:v3:guest';
/** Au plus une sauvegarde cloud toutes les 30 s pendant le jeu (la production change l'état en continu). */
const SAVE_INTERVAL_MS = 30_000;
/** Après une vraie action (sonde, relais, mission…), on sauvegarde vite. */
const ACTION_SAVE_DELAY_MS = 1_500;

const readLocal = (key: string): unknown => {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
};
const restoreAll = (raw: Record<string, unknown>, now: number): SystemsProgress =>
  Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, restoreGuardianDemo(value, now)]));

/** Lit la sauvegarde locale v4, ou migre l'ancienne sauvegarde v3 (progression unique). */
function readLocalSystems(userId: string | null, now: number): SystemsProgress {
  const v4 = readLocal(`astralys:guardian:${STORAGE_VERSION}:${userId ?? 'guest'}`) as { systems?: Record<string, unknown> } | null;
  if (v4?.systems) return restoreAll(v4.systems, now);
  const v3 = readLocal(`astralys:guardian:v3:${userId ?? 'guest'}`) ?? (userId ? readLocal(LEGACY_GUEST_KEY) : null);
  return v3 ? { [LEGACY_SYSTEM]: restoreGuardianDemo(v3, now) } : {};
}

type Saved = { key: string; systems: SystemsProgress };

export function GuardianProgressProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth();
  const { stars: acquired } = useAcquisitions();
  const userId = user?.id ?? null;
  const storageKey = `astralys:guardian:${STORAGE_VERSION}:${userId ?? 'guest'}`;
  const [saved, setSaved] = useState<Saved>({ key: '', systems: {} });
  const [activeSystemId, setActiveSystemId] = useState<string | null>(null);
  const [cloud, setCloud] = useState<CloudStatus>('local');

  const latest = useRef(saved.systems);
  latest.current = saved.systems;
  const active = useRef(activeSystemId);
  active.current = activeSystemId;
  const revision = useRef(0);
  const dirty = useRef(false);
  const saving = useRef(false);
  const cloudEnabled = useRef(false);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback((key: string, systems: SystemsProgress) => {
    try { localStorage.setItem(key, JSON.stringify({ version: 4, systems })); } catch { /* Progress remains available for this session. */ }
  }, []);

  /* ---- chargement : local d'abord (instantané), puis cloud pour un compte connecté ---- */
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const now = Date.now();
    revision.current = 0;
    dirty.current = false;
    cloudEnabled.current = false;

    const local = readLocalSystems(userId, now);
    setSaved({ key: storageKey, systems: local });
    persist(storageKey, local);

    if (!userId) { setCloud('local'); return; }
    setCloud('syncing');
    void loadCloudProgress(userId).then(result => {
      if (cancelled) return;
      if (result === 'error') {
        // Table pas encore créée ou réseau coupé : on joue en local et on réessaiera à la prochaine sauvegarde.
        setCloud('offline');
        cloudEnabled.current = true;
        dirty.current = true;
        return;
      }
      cloudEnabled.current = true;
      if (result) {
        revision.current = result.revision;
        const remote = restoreAll(unpackProgress(result.state), Date.now());
        setSaved(current => {
          if (current.key !== storageKey) return current;
          const merged = mergeSystems(current.systems, remote);
          persist(storageKey, merged);
          if (JSON.stringify(Object.keys(merged).sort()) !== JSON.stringify(Object.keys(remote).sort()) || Object.keys(merged).some(k => merged[k] !== remote[k])) dirty.current = true;
          return { key: current.key, systems: merged };
        });
      } else {
        dirty.current = true; // premier envoi de ce compte
      }
      setCloud('saved');
    });
    return () => { cancelled = true; };
  }, [authLoading, persist, storageKey, userId]);

  /* ---- l'ancienne progression unique revient à la première étoile acquise ---- */
  useEffect(() => {
    const first = acquired[0]?.id;
    if (!first) return;
    setSaved(current => {
      const legacy = current.systems[LEGACY_SYSTEM];
      if (!legacy || current.key !== storageKey) return current;
      const { [LEGACY_SYSTEM]: _legacy, ...rest } = current.systems;
      const systems = rest[first] ? rest : { ...rest, [first]: legacy };
      persist(current.key, systems);
      dirty.current = true;
      return { key: current.key, systems };
    });
  }, [acquired, persist, storageKey]);

  /* ---- système actif par défaut : la première étoile acquise ---- */
  useEffect(() => {
    if (activeSystemId && acquired.some(star => star.id === activeSystemId)) return;
    setActiveSystemId(acquired[0]?.id ?? null);
  }, [acquired, activeSystemId]);

  /* ---- sauvegarde cloud ---- */
  const flush = useCallback(async () => {
    if (!userId || !cloudEnabled.current || saving.current || !dirty.current) return;
    const systems = Object.fromEntries(Object.entries(latest.current).filter(([key]) => key !== LEGACY_SYSTEM));
    if (!Object.keys(systems).length) return;
    saving.current = true;
    dirty.current = false;
    setCloud('syncing');
    const result = await saveCloudProgress(systems, revision.current);
    saving.current = false;
    if (result.status === 'saved') {
      revision.current = result.revision;
      setCloud('saved');
    } else if (result.status === 'conflict') {
      // Un autre appareil a sauvegardé : on garde, système par système, la progression la plus avancée.
      revision.current = result.revision;
      const remote = restoreAll(unpackProgress(result.state), Date.now());
      setSaved(current => {
        const merged = mergeSystems(current.systems, remote);
        persist(current.key, merged);
        return { key: current.key, systems: merged };
      });
      dirty.current = true;
      setCloud('syncing');
      setTimeout(() => { void flush(); }, 0);
    } else {
      dirty.current = true;
      setCloud('offline');
    }
  }, [persist, userId]);

  const dispatch = useCallback((action: GuardianDemoAction) => {
    const target = active.current;
    if (!target) return; // aucun système possédé : rien à faire progresser
    setSaved(current => {
      if (current.key !== storageKey) return current;
      const before = current.systems[target] ?? createGuardianDemo(action.type === 'sync' ? action.now : undefined);
      const state = guardianDemoReducer(before, action);
      // Rien n'a changé (cas le plus fréquent du « sync » toutes les secondes) : pas d'écriture ni de nouveau rendu.
      if (state === before && current.systems[target]) return current;
      const systems = { ...current.systems, [target]: state };
      persist(storageKey, systems);
      dirty.current = true;
      return { key: current.key, systems };
    });
    if (action.type !== 'sync') {
      if (actionTimer.current) clearTimeout(actionTimer.current);
      actionTimer.current = setTimeout(() => { void flush(); }, ACTION_SAVE_DELAY_MS);
    }
  }, [flush, persist, storageKey]);

  useEffect(() => {
    const sync = () => dispatch({ type: 'sync', now: Date.now() });
    sync(); // rattrape la production du système dès qu'il devient actif
    const interval = setInterval(sync, 1_000);
    const cloudInterval = setInterval(() => { void flush(); }, SAVE_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') sync();
      else void flush(); // l'app passe en arrière-plan : on sauvegarde tout de suite
    });
    return () => {
      clearInterval(interval);
      clearInterval(cloudInterval);
      subscription.remove();
      if (actionTimer.current) clearTimeout(actionTimer.current);
    };
  }, [dispatch, flush, activeSystemId]);

  const fresh = useMemo(() => createGuardianDemo(), [activeSystemId]);
  const progressFor = useCallback((starId: string | null | undefined) => {
    const state = starId ? saved.systems[starId] : undefined;
    // Rattrape la production accumulée depuis la dernière visite (lecture seule, rien n'est enregistré).
    return state ? syncGuardianProgress(state, Date.now()) : createGuardianDemo();
  }, [saved.systems]);

  const ready = saved.key === storageKey;
  const state = (activeSystemId ? saved.systems[activeSystemId] : undefined) ?? fresh;
  const value = useMemo<GuardianProgressValue>(() => ({
    state, ready, cloud, dispatch, activeSystemId, setActiveSystem: setActiveSystemId, progressFor,
  }), [state, ready, cloud, dispatch, activeSystemId, progressFor]);
  return <GuardianProgressContext.Provider value={value}>{children}</GuardianProgressContext.Provider>;
}

export function useGuardianProgress() {
  const value = useContext(GuardianProgressContext);
  if (!value) throw new Error('useGuardianProgress requires GuardianProgressProvider');
  return value;
}
