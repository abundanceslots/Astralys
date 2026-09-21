import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { createSessionFromCallback } from '@/lib/social-auth';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type UserProfile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  country: string | null;
  created_at: string;
  updated_at: string;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  passwordRecovery: boolean;
  finishPasswordRecovery: () => void;
  callbackError: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const profileVersion = useRef(0);
  const activeUserId = useRef<string | undefined>(undefined);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const refreshProfile = async () => {
    const userId = session?.user.id;
    if (!userId) {
      setProfile(null);
      return;
    }

    const version = ++profileVersion.current;
    setProfileLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, display_name, country, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (version !== profileVersion.current || activeUserId.current !== userId) return;
    if (!error && data) setProfile(data as UserProfile);
    setProfileLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      activeUserId.current = data.session?.user.id;
      setSession(data.session);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (activeUserId.current !== nextSession?.user.id) { ++profileVersion.current; setProfile(null); }
      activeUserId.current = nextSession?.user.id;
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setPasswordRecovery(false);
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    const receive = async (url: string) => {
      let parsed: URL;
      try { parsed = new URL(url); } catch { return; }
      if (parsed.hostname !== 'profile' && !/profile\/?$/.test(parsed.pathname)) return;
      const params = new URLSearchParams(parsed.hash.replace(/^#/, ''));
      if (!params.has('access_token') && !parsed.searchParams.has('code') && !params.has('error_description')) return;
      try {
        await createSessionFromCallback(url);
        if (active && (params.get('type') === 'recovery' || parsed.searchParams.get('recovery') === '1')) setPasswordRecovery(true);
      } catch {
        if (active) setCallbackError('This sign-in or recovery link is invalid or has expired. Request a new link.');
      }
    };
    void Linking.getInitialURL().then(url => { if (url) void receive(url); });
    const listener = Linking.addEventListener('url', event => { void receive(event.url); });
    return () => { active = false; listener.remove(); };
  }, []);

  useEffect(() => {
    setProfile(null);
    void refreshProfile();
    return () => { ++profileVersion.current; };
  }, [session?.user.id]);

  const value = useMemo<AuthContextValue>(() => ({
    passwordRecovery,
    finishPasswordRecovery: () => setPasswordRecovery(false),
    callbackError,
    session,
    user: session?.user ?? null,
    profile,
    loading,
    profileLoading,
    refreshProfile,
  }), [loading, profile, profileLoading, session, passwordRecovery, callbackError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
