import { AppState } from 'react-native';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { StarDetail } from '@/components/star-detail-modal';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';

type AcquisitionValue = {
  error: string | null;
  loading: boolean;
  markAcquired: (star: StarDetail) => void;
  refresh: () => Promise<void>;
  stars: StarDetail[];
};

const AcquisitionsContext = createContext<AcquisitionValue | null>(null);

export function AcquisitionsProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth();
  const requestVersion = useRef(0);
  const [stars, setStars] = useState<StarDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    if (authLoading) {
      setLoading(true);
      return;
    }
    if (!user) {
      setStars([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const { data, error: requestError } = await supabase
      .from('star_acquisitions')
      .select('id, acquired_at, celestial_objects(*)')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('acquired_at', { ascending: true });
    if (version !== requestVersion.current) return;
    if (requestError) {
      setError('Your acquired stars could not be loaded.');
    } else {
      const rows = (data ?? []) as unknown as { celestial_objects: StarDetail | null }[];
      setStars(rows.flatMap(row => row.celestial_objects ? [row.celestial_objects] : []));
      setError(null);
    }
    setLoading(false);
  }, [authLoading, user]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => listener.remove();
  }, [refresh]);

  const value = useMemo<AcquisitionValue>(() => ({
    error,
    loading,
    markAcquired: star => setStars(current => current.some(item => item.id === star.id) ? current : [...current, star]),
    refresh,
    stars,
  }), [error, loading, refresh, stars]);

  return <AcquisitionsContext.Provider value={value}>{children}</AcquisitionsContext.Provider>;
}

export function useAcquisitions() {
  const value = useContext(AcquisitionsContext);
  if (!value) throw new Error('useAcquisitions requires AcquisitionsProvider');
  return value;
}
