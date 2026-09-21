import { DarkTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useRef } from 'react';
import { useFonts, Sora_400Regular, Sora_500Medium, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';

import { FollowingProvider } from '@/context/following-context';
import AppTabs from '@/components/app-tabs';
import { AuthProvider } from '@/context/auth-context';
import { MotionProvider, useMotionPreferences } from '@/context/motion-context';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function TabLayout() {
  const [fontsLoaded, fontError] = useFonts({ Sora_400Regular, Sora_500Medium, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold });
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={DarkTheme}>
      <StatusBar style="light" />
      <AuthProvider>
        <FollowingProvider><MotionProvider><AppEntry /></MotionProvider></FollowingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AppEntry() {
  const { reducedMotion } = useMotionPreferences();
  const splashHidden = useRef(false);
  return <View style={{ flex: 1, backgroundColor: '#070911' }} onLayout={() => {
    if (splashHidden.current) return;
    splashHidden.current = true;
    SplashScreen.setOptions({ fade: !reducedMotion, duration: reducedMotion ? 0 : 180 });
    void SplashScreen.hideAsync().catch(() => {});
  }}><AppTabs /></View>;
}
