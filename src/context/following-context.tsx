import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { StarDetail } from '@/components/star-detail-modal';
import { useAuth } from '@/context/auth-context';

type FollowingValue = { stars: StarDetail[]; toggle: (star: StarDetail) => string | null; error: string | null };
const FollowingContext = createContext<FollowingValue | null>(null);

// This is a device-local watchlist, never an acquisition or a claim of ownership.
export function FollowingProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const key = `astralys:following:v1:${user?.id ?? 'guest'}`;
  const [saved, setSaved] = useState<{ key: string; stars: StarDetail[] }>({ key: '', stars: [] });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      if (!Array.isArray(parsed) || parsed.some(s => !s || typeof s.id !== 'string' || typeof s.source_id !== 'string' || typeof s.scientific_name !== 'string')) throw new Error('Invalid watchlist');
      setSaved({ key, stars: parsed as StarDetail[] });
      setError(null);
    } catch {
      setSaved({ key, stars: [] });
      setError('The saved watchlist could not be read on this device.');
    }
  }, [key]);
  const stars = saved.key === key ? saved.stars : [];
  const toggle = (star: StarDetail) => {
    if (saved.key !== key) return 'Your watchlist is still loading. Try again.';
    const next = stars.some(s => s.id === star.id) ? stars.filter(s => s.id !== star.id) : [...stars, star];
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setSaved({ key, stars: next });
      setError(null);
      return null;
    } catch {
      const message = 'The watchlist could not be saved. Check the storage available on this device.';
      setError(message);
      return message;
    }
  };
  return <FollowingContext.Provider value={{ stars, toggle, error }}>{children}</FollowingContext.Provider>;
}

export function useFollowing() {
  const value = useContext(FollowingContext);
  if (!value) throw new Error('useFollowing requires FollowingProvider');
  return value;
}
