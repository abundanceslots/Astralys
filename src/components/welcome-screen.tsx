import { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import { Mail } from 'lucide-react-native';

import { Text } from '@/components/astralys-text';
import { AstralysMark } from '@/components/astralys-mark';
import { GoogleSignInButton } from '@/components/google-sign-in-button';
import { haptic } from '@/features/orbital/haptics';
import { signInWithSocialProvider, type SocialProvider } from '@/lib/social-auth';
import { openLegal } from '@/lib/legal-links';

/**
 * Fond de l'écran d'accueil. Quand l'image Higgsfield est prête, place-la dans
 * assets/images/welcome-bg.jpg puis remplace `null` par :
 *   require('../../assets/images/welcome-bg.jpg')
 * En attendant, un ciel dessiné en code est affiché.
 */
const WELCOME_BACKGROUND: ImageSourcePropType | null = null;

/* Étoiles déterministes : même ciel à chaque lancement. */
const STARS = Array.from({ length: 90 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  const c = Math.sin(i * 39.425) * 24634.6345;
  const fx = a - Math.floor(a);
  const fy = b - Math.floor(b);
  const fr = c - Math.floor(c);
  return { x: fx, y: fy * 0.62, r: 0.4 + fr * 1.1, o: 0.25 + fr * 0.6 };
});

function DrawnSky({ width, height }: { width: number; height: number }) {
  const cx = width / 2;
  const cy = height * 0.27;
  const rx = width * 0.42;
  return <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
    <Defs>
      <RadialGradient id="haze" cx="50%" cy="26%" r="60%">
        <Stop offset="0" stopColor="#3B2F6B" stopOpacity="0.55" />
        <Stop offset="0.5" stopColor="#1A1838" stopOpacity="0.35" />
        <Stop offset="1" stopColor="#05060B" stopOpacity="0" />
      </RadialGradient>
      <RadialGradient id="star" cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor="#FFF6E0" stopOpacity="1" />
        <Stop offset="0.25" stopColor="#FFD9A0" stopOpacity="0.85" />
        <Stop offset="1" stopColor="#FFB870" stopOpacity="0" />
      </RadialGradient>
      <RadialGradient id="ice" cx="35%" cy="35%" r="70%">
        <Stop offset="0" stopColor="#CFE8FF" />
        <Stop offset="1" stopColor="#355C8A" />
      </RadialGradient>
      <RadialGradient id="rock" cx="35%" cy="35%" r="70%">
        <Stop offset="0" stopColor="#F0C39E" />
        <Stop offset="1" stopColor="#6B4232" />
      </RadialGradient>
      <RadialGradient id="giant" cx="35%" cy="35%" r="70%">
        <Stop offset="0" stopColor="#D8C7F2" />
        <Stop offset="1" stopColor="#4B3D72" />
      </RadialGradient>
      <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0.38" stopColor="#05060B" stopOpacity="0" />
        <Stop offset="0.62" stopColor="#05060B" stopOpacity="0.92" />
        <Stop offset="1" stopColor="#05060B" stopOpacity="1" />
      </LinearGradient>
    </Defs>
    <Rect width={width} height={height} fill="#05060B" />
    <Rect width={width} height={height} fill="url(#haze)" />
    {STARS.map((s, i) => <Circle key={i} cx={s.x * width} cy={s.y * height} r={s.r} fill="#FFFFFF" opacity={s.o} />)}
    {[0.34, 0.58, 0.82, 1.06].map((k, i) =>
      <Ellipse key={k} cx={cx} cy={cy} rx={rx * k} ry={rx * k * 0.3} fill="none" stroke="#C8BAF5" strokeWidth={0.8} opacity={0.34 - i * 0.06} />)}
    <Circle cx={cx} cy={cy} r={width * 0.34} fill="url(#star)" opacity={0.55} />
    <Circle cx={cx} cy={cy} r={11} fill="#FFF8EA" />
    <Circle cx={cx + rx * 0.3} cy={cy + rx * 0.34 * 0.3 * 0.5} r={4.5} fill="url(#rock)" />
    <Circle cx={cx - rx * 0.56} cy={cy + rx * 0.58 * 0.3 * 0.3} r={6.5} fill="url(#ice)" />
    <Circle cx={cx + rx * 0.72} cy={cy - rx * 0.82 * 0.3 * 0.6} r={10} fill="url(#giant)" />
    <Ellipse cx={cx + rx * 0.72} cy={cy - rx * 0.82 * 0.3 * 0.6} rx={17} ry={4} fill="none" stroke="#D8C7F2" strokeWidth={1} opacity={0.6} />
    <Circle cx={cx - rx * 0.98} cy={cy - rx * 1.06 * 0.3 * 0.4} r={5} fill="#2A2E44" opacity={0.8} />
    <Rect width={width} height={height} fill="url(#fade)" />
  </Svg>;
}

type Busy = SocialProvider | null;

export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const finish = onDone;

  const social = async (provider: SocialProvider) => {
    haptic('tick');
    setBusy(provider);
    setError(null);
    try {
      const result = await signInWithSocialProvider(provider);
      if (result.status === 'success') finish();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message.toLowerCase() : '';
      const name = provider === 'google' ? 'Google' : 'Apple';
      setError(message.includes('not enabled') || message.includes('unsupported provider')
        ? `${name} sign-in isn't available yet. Use email instead.`
        : `${name} sign-in failed. Try again.`);
    } finally {
      setBusy(null);
    }
  };

  const openProfile = (mode: 'signUp' | 'signIn') => {
    haptic('tick');
    finish();
    router.push({ pathname: '/profile', params: { mode } });
  };

  const explore = () => { haptic('tick'); finish(); };

  // Apple d'abord sur iPhone, Google d'abord ailleurs.
  const providers: SocialProvider[] = Platform.OS === 'ios' ? ['apple', 'google'] : ['google', 'apple'];

  return <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(260)} style={[StyleSheet.absoluteFill, styles.root]}>
    {WELCOME_BACKGROUND
      ? <>
        <Image source={WELCOME_BACKGROUND} resizeMode="cover" style={StyleSheet.absoluteFill} accessible={false} />
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="imgFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.4" stopColor="#05060B" stopOpacity="0" />
              <Stop offset="0.68" stopColor="#05060B" stopOpacity="0.85" />
              <Stop offset="1" stopColor="#05060B" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width={width} height={height} fill="url(#imgFade)" />
        </Svg>
      </>
      : <DrawnSky width={width} height={height} />}

    <View style={[styles.brand, { top: insets.top + 18 }]}>
      <AstralysMark size={22} />
      <Text style={styles.brandText}>ASTRALYS</Text>
    </View>

    <View style={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
      <Animated.View entering={FadeInDown.delay(120).duration(420)}>
        <Text accessibilityRole="header" style={styles.title}>Your star is already up there.</Text>
        <Text style={styles.subtitle}>Explore real stars, claim one, and build its system.</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(240).duration(420)} style={styles.actions}>
        {providers.map((provider, index) => provider === 'google'
          ? <GoogleSignInButton key={provider} theme={index === 0 ? 'light' : 'dark'}
            loading={busy === 'google'} disabled={busy !== null} onPress={() => void social('google')} />
          : <Pressable key={provider} accessibilityRole="button"
            disabled={busy !== null} onPress={() => void social(provider)}
            style={({ pressed }) => [styles.button, index === 0 ? styles.buttonPrimary : styles.buttonSecondary, pressed && styles.pressed]}>
            {busy === provider
              ? <ActivityIndicator color={index === 0 ? '#0B0C14' : '#F4F1FF'} />
              : <Text style={[styles.buttonText, index === 0 && styles.buttonTextPrimary]}>Continue with Apple</Text>}
          </Pressable>)}
        <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => openProfile('signUp')}
          style={({ pressed }) => [styles.button, styles.buttonSecondary, pressed && styles.pressed]}>
          <Mail size={18} color="#F4F1FF" strokeWidth={1.8} />
          <Text style={styles.buttonText}>Continue with email</Text>
        </Pressable>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

        <View style={styles.links}>
          <Pressable accessibilityRole="button" hitSlop={10} disabled={busy !== null} onPress={explore}>
            <Text style={styles.link}>Explore first</Text>
          </Pressable>
          <Text style={styles.dot}>·</Text>
          <Pressable accessibilityRole="button" hitSlop={10} disabled={busy !== null} onPress={() => openProfile('signIn')}>
            <Text style={styles.link}>I have an account</Text>
          </Pressable>
        </View>
        <Text style={styles.terms}>By continuing you accept the{' '}
          <Text accessibilityRole="link" onPress={() => openLegal('terms')} style={styles.termsLink}>Terms</Text> and{' '}
          <Text accessibilityRole="link" onPress={() => openLegal('privacy')} style={styles.termsLink}>Privacy Policy</Text>.</Text>
      </Animated.View>
    </View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#05060B', zIndex: 2000, elevation: 2000 },
  brand: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  brandText: { color: '#F4F1FF', fontSize: 13, fontWeight: '600', letterSpacing: 4 },
  content: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, gap: 28 },
  title: { color: '#F4F1FF', fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { color: '#A7B0C5', fontSize: 15, lineHeight: 22, marginTop: 10 },
  actions: { gap: 10 },
  button: { minHeight: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonPrimary: { backgroundColor: '#F4F1FF' },
  buttonSecondary: { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(200,186,245,0.22)' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  buttonText: { color: '#F4F1FF', fontSize: 16, fontWeight: '600' },
  buttonTextPrimary: { color: '#0B0C14' },
  error: { color: '#F3A6A6', fontSize: 13, textAlign: 'center', marginTop: 2 },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 8 },
  link: { color: '#C8BAF5', fontSize: 15, fontWeight: '600', paddingVertical: 6 },
  dot: { color: '#5A6378', fontSize: 15 },
  terms: { color: '#7D869C', fontSize: 12, textAlign: 'center', marginTop: 4 },
  termsLink: { color: '#A9B1C6', textDecorationLine: 'underline' },
});
