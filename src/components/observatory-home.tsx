import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import { GuardianDemo } from '@/components/guardian-demo';
import { RotatingAstre } from '@/components/rotating-astre';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/astralys-text';
import { Sparkles, Orbit, UserRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ObservatoryButton, ObservatoryPressable } from '@/components/observatory-button';
import { Observatory as theme, navigationClearance } from '@/constants/observatory-theme';
import Animated from 'react-native-reanimated';
import { MotionSection } from '@/components/motion-section';
import { useHomeMotion } from '@/hooks/use-home-motion';
export default function ObservatoryHome() {
  const [demoOpen, setDemoOpen] = useState(false);
  const closeDemo = useCallback(() => setDemoOpen(false), []);
  const openDemo = useCallback(() => setDemoOpen(true), []);
  return demoOpen ? <GuardianDemo onClose={closeDemo} /> : <ObservatoryHomeContent onOpenDemo={openDemo} />;
}
function ObservatoryHomeContent({ onOpenDemo }: { onOpenDemo: () => void }) {
  const insets = useSafeAreaInsets();
  const { heroStyle, starOneStyle, starTwoStyle, starThreeStyle } = useHomeMotion();
  const { height, width, fontScale } = useWindowDimensions();
  const compact = height < 740;
  const heroHeight = Math.max(60, Math.min(320, width - 40, height - insets.top - 460));
  return <View style={[styles.screen, { paddingTop: insets.top + 10, paddingBottom: navigationClearance(insets.bottom) }]}>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.star, styles.starOne, starOneStyle]} />
      <Animated.View style={[styles.star, styles.starTwo, starTwoStyle]} />
      <Animated.View style={[styles.star, styles.starThree, starThreeStyle]} />
    </View>
    <ScrollView contentContainerStyle={styles.shell} showsVerticalScrollIndicator={false} scrollEnabled={height < 640 || fontScale > 1.2}>
      <View style={styles.header}><Text style={styles.brand}>ASTRALYS</Text><Link href="/profile" asChild><ObservatoryPressable accessibilityRole="button" accessibilityLabel="Open profile" style={styles.profile}><UserRound size={24} color={theme.primary} /></ObservatoryPressable></Link></View>
      <View style={[styles.main, compact && styles.mainCompact]}>
        <MotionSection style={[styles.hero, { height: heroHeight }]}>
          <Animated.View style={[styles.imageFrame, heroStyle]}><RotatingAstre size={heroHeight} /></Animated.View>
        </MotionSection>
        <MotionSection delay={60} style={styles.copy}><Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact]}>Your sky. Your story.</Text></MotionSection>
        <MotionSection delay={120} style={styles.actions}><Link href="/explore" asChild><ObservatoryButton label="Explore stars" icon={Sparkles} /></Link><Link href="/collection" asChild><ObservatoryButton label="View collection" icon={Orbit} variant="secondary" /></Link><ObservatoryButton label="Try guardian demo" variant="quiet" onPress={onOpenDemo} /></MotionSection>
      </View>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background, paddingHorizontal: 20 }, shell: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { color: theme.text, fontSize: 20, fontWeight: '800', letterSpacing: 4 },
  profile: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface }, main: { flexGrow: 1, justifyContent: 'center', gap: 18, paddingVertical: 12 }, mainCompact: { gap: 10, paddingVertical: 8 },
  hero: { alignItems: 'center' }, imageFrame: { width: '100%', flex: 1, alignItems: 'center', justifyContent: 'center' },
  star: { position: 'absolute', width: 3, height: 3, borderRadius: 2, backgroundColor: theme.primary },
  starOne: { top: '16%', left: '12%' }, starTwo: { top: '28%', right: '10%', width: 2, height: 2 }, starThree: { top: '42%', left: '7%', width: 2, height: 2 },
  copy: { gap: 8 }, title: { color: theme.text, fontSize: 32, lineHeight: 42, fontWeight: '600', letterSpacing: -0.7 }, titleCompact: { fontSize: 26, lineHeight: 34 },
  actions: { gap: 10 },
});
