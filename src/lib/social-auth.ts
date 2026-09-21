import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

export type SocialProvider = 'google' | 'apple';

if (typeof window !== 'undefined') {
  WebBrowser.maybeCompleteAuthSession();
}

function getAuthParams(url: string) {
  const parsedUrl = new URL(url);
  const params = new URLSearchParams(parsedUrl.search);
  const fragmentParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));

  fragmentParams.forEach((value, key) => params.set(key, value));
  return params;
}

export async function createSessionFromCallback(url: string) {
  const params = getAuthParams(url);
  const errorDescription = params.get('error_description');
  if (errorDescription) throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));

  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) throw new Error('The sign-in flow did not return a valid session.');

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
}

export async function signInWithSocialProvider(provider: SocialProvider) {
  const redirectTo = makeRedirectUri({
    scheme: 'astrelys',
    path: 'profile',
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('The social sign-in provider is unavailable.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return { status: 'cancelled' as const, redirectTo };

  await createSessionFromCallback(result.url);
  return { status: 'success' as const, redirectTo };
}
