import { CelestialVisual } from '@/components/celestial-visual';

import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/astralys-text';
import { navigationClearance } from '@/constants/observatory-theme';
import { ObservatoryButton } from '@/components/observatory-button';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const giftStar = {
  id: 'astralys-gift-star',
  object_type: 'star' as const,
  visual_category: 'blue-white',
  apparent_magnitude: 2.3,
};

const giftPlanet = {
  id: 'astralys-gift-planet',
  object_type: 'planet' as const,
  radius_earth: 7.4,
  equilibrium_temperature_k: 320,
};

// Archived screen: no longer exposed in the mobile navigation.
export default function OfferScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 740;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10, paddingBottom: navigationClearance(insets.bottom) }]}>
      <View pointerEvents="none" style={styles.backdrop}>
        <View style={styles.coralGlow} />
        <View style={styles.violetGlow} />
        <View style={[styles.skyStar, styles.starOne]} />
        <View style={[styles.skyStar, styles.starTwo]} />
        <View style={[styles.skyStar, styles.starThree]} />
      </View>

      <View style={styles.shell}>
        <View style={styles.header}>
          <Text selectable style={styles.brand}>ASTRALYS</Text>
          <View style={styles.headerPill}>
            <Text style={styles.headerPillIcon}>◇</Text>
            <Text style={styles.headerPillText}>GIFT</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={[styles.content, compact && styles.contentCompact]} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.duration(650)} style={[styles.giftScene, compact && styles.giftSceneCompact]}>
            <View style={styles.connectionLine} />
            <View style={styles.starPosition}>
              <CelestialVisual animated object={giftStar} size={compact ? 116 : 142} />
            </View>
            <View style={styles.planetPosition}>
              <CelestialVisual animated object={giftPlanet} size={compact ? 82 : 102} />
            </View>
            <View style={styles.messageCapsule}>
              <Text style={styles.messageIcon}>✦</Text>
              <Text style={styles.messageText}>FOR YOUR ORBIT</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(480).delay(80)} style={styles.copy}>
            <Text accessibilityRole="header" selectable style={[styles.title, compact && styles.titleCompact]}>Gift a star.</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(480).delay(150)} style={styles.steps}>
            {[
              ['01', 'Choose'],
              ['02', 'Dedicate'],
              ['03', 'Reveal'],
            ].map(([number, title]) => (
              <View key={number} style={styles.stepCard}>
                <Text style={styles.stepNumber}>{number}</Text>
                <Text style={styles.stepTitle}>{title}</Text>
              </View>
            ))}
          </Animated.View>

          <ObservatoryButton label="Coming soon" disabled />
          <Text style={styles.subtitle}>Symbolic guardianship, not legal ownership.</Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#070911', paddingHorizontal: 20, overflow: 'hidden' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  coralGlow: { position: 'absolute', top: 80, left: -130, width: 330, height: 330, borderRadius: 165, backgroundColor: 'rgba(221,112,105,0.08)' },
  violetGlow: { position: 'absolute', bottom: 30, right: -120, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(128,94,210,0.08)' },
  skyStar: { position: 'absolute', borderRadius: 5, backgroundColor: '#FFF5E8' },
  starOne: { top: '17%', left: '9%', width: 2, height: 2, opacity: 0.55 },
  starTwo: { top: '31%', right: '12%', width: 3, height: 3, opacity: 0.45 },
  starThree: { bottom: '19%', left: '20%', width: 2, height: 2, opacity: 0.3 },
  shell: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: { minHeight: 48, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: '#F7F4FF', fontSize: 17, fontWeight: '900', letterSpacing: 3.3 },
  headerPill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99, backgroundColor: '#15131B' },
  headerPillIcon: { color: '#F1A68E', fontSize: 11 },
  headerPillText: { color: '#A993A1', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  content: { flexGrow: 1, justifyContent: 'center', gap: 18, paddingVertical: 16 },
  contentCompact: { gap: 11 },
  giftScene: { height: 210, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  giftSceneCompact: { height: 140 },
  connectionLine: { position: 'absolute', width: 210, height: 1, backgroundColor: 'rgba(242,185,158,0.25)', transform: [{ rotate: '-19deg' }] },
  starPosition: { position: 'absolute', left: '14%', top: '4%' },
  planetPosition: { position: 'absolute', right: '16%', bottom: '2%' },
  messageCapsule: { position: 'absolute', left: '24%', right: 0, top: '43%', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 99, backgroundColor: '#17141D', borderWidth: 1, borderColor: 'rgba(242,185,158,0.2)' },
  messageIcon: { color: '#F4B08F', fontSize: 10 },
  messageText: { flex: 1, color: '#BCA4A8', fontSize: 10, lineHeight: 16, fontWeight: '600', letterSpacing: 0.4 },
  copy: { alignItems: 'center' },
  title: { maxWidth: 420, color: '#FAF5F4', fontSize: 32, lineHeight: 37, fontWeight: '600', letterSpacing: -1, textAlign: 'center' },
  titleCompact: { fontSize: 27, lineHeight: 31 },
  subtitle: { maxWidth: 390, alignSelf: 'center', marginTop: 9, color: '#A7B0C5', fontSize: 14, lineHeight: 22, textAlign: 'center' },
  steps: { flexDirection: 'row', gap: 8 },
  stepCard: { flex: 1, minHeight: 72, padding: 11, borderRadius: 17, backgroundColor: '#111219', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  stepNumber: { color: '#D68E79', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  stepTitle: { color: '#F0E9EA', fontSize: 12, fontWeight: '800', marginTop: 9 },
  primaryButton: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, borderRadius: 17, backgroundColor: '#F3DDD6' },
  primaryButtonText: { color: '#25181A', fontSize: 13, fontWeight: '900' },
  primaryButtonArrow: { color: '#25181A', fontSize: 20 },
});
