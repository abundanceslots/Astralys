import { DarkTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useFonts, Sora_400Regular, Sora_500Medium, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';

import { FollowingProvider } from '@/context/following-context';
import AppTabs from '@/components/app-tabs';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { WelcomeScreen } from '@/components/welcome-screen';
import { WarpOverlayHost } from '@/components/warp-overlay';
import { MotionProvider, useMotionPreferences } from '@/context/motion-context';
import { GuardianProgressProvider } from '@/context/guardian-progress-context';
import { AcquisitionsProvider } from '@/context/acquisitions-context';
import { useStarWidgetSync } from '@/lib/star-widget';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function TabLayout() {
  const [fontsLoaded, fontError] = useFonts({ Sora_400Regular, Sora_500Medium, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold });
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={DarkTheme}>
      <StatusBar style="light" />
      <AuthProvider>
        <FollowingProvider><AcquisitionsProvider><GuardianProgressProvider><MotionProvider><AppEntry /></MotionProvider></GuardianProgressProvider></AcquisitionsProvider></FollowingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AppEntry() {
  const { reducedMotion } = useMotionPreferences();
  const { user, loading } = useAuth();
  const splashHidden = useRef(false);
  // Écran d'accueil à chaque lancement tant que personne n'est connecté
  // (« Explore first » le ferme jusqu'au prochain lancement).
  const [welcome, setWelcome] = useState(true);
  useEffect(() => { if (user) setWelcome(false); }, [user]);
  return <View style={{ flex: 1, backgroundColor: '#070911' }} onLayout={() => {
    if (splashHidden.current) return;
    splashHidden.current = true;
    SplashScreen.setOptions({ fade: !reducedMotion, duration: reducedMotion ? 0 : 180 });
    void SplashScreen.hideAsync().catch(() => {});
  }}>
    <AppTabs />
    <StarWidgetSync />
    <WarpOverlayHost />
    {welcome && loading ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#05060B', zIndex: 2000, elevation: 2000 }} /> : null}
    {welcome && !loading && !user ? <WelcomeScreen onDone={() => setWelcome(false)} /> : null}
  </View>;
}

/** Tient le widget « Mon étoile » à jour (composant séparé : ses rendus n'affectent pas le reste de l'app). */
function StarWidgetSync() {
  useStarWidgetSync();
  return null;
}
