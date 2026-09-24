/**
 * Événements de système affichés sur la scène 3D :
 *  (la comète et l'anneau de drones sont dessinés dans la scène 3D, voir guardian-gl-renderer)
 *  · SystemEventBadge : symbole temporaire sous le bouton du relais, avec le temps restant en anneau.
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { cancelAnimation, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { ShieldAlert, Sparkle } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '@/components/astralys-text';
import { useMotionPreferences } from '@/context/motion-context';
import type { SystemEvent } from '@/features/guardian-demo-model';

export const EVENT_COLORS = { drones: '#FF8A7A', comet: '#8FE3FF' } as const;

/* ------------------------------------------------------------------ */
/* Symbole temporaire, sous le bouton du relais, tant que l'événement dure */
/* ------------------------------------------------------------------ */
type BadgeProps = {
  event: SystemEvent;
  /** Part de temps restante (1 → 0), dessinée en anneau autour du symbole. */
  remaining: number;
  /** Légende très courte sous le symbole, ex. « 18h ». */
  caption: string;
  accessibilityLabel: string;
  onPress: () => void;
};

const BADGE = 44;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function SystemEventBadge({ event, remaining, caption, accessibilityLabel, onPress }: BadgeProps) {
  const color = EVENT_COLORS[event.kind];
  const Icon = event.kind === 'drones' ? ShieldAlert : Sparkle;
  const { reducedMotion } = useMotionPreferences();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 2200 }), -1, false);
    return () => cancelAnimation(pulse);
  }, [pulse, reducedMotion]);
  // Onde qui s'élargit et s'efface, lentement : attire l'œil sans clignoter.
  const wave = useAnimatedStyle(() => ({ opacity: (1 - pulse.value) * 0.45, transform: [{ scale: 1 + pulse.value * 0.45 }] }));
  const r = BADGE / 2 - 2, circumference = 2 * Math.PI * r;
  return <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(500)} exiting={FadeOut.duration(300)} style={styles.badgeWrap}>
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} hitSlop={6} onPress={onPress}
      style={({ pressed }) => [styles.badge, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}>
      <Animated.View pointerEvents="none" style={[styles.badgeWave, { borderColor: color }, wave]} />
      <Svg width={BADGE} height={BADGE} style={StyleSheet.absoluteFill}>
        <Circle cx={BADGE / 2} cy={BADGE / 2} r={r} stroke={`${color}33`} strokeWidth={2} fill="none" />
        <AnimatedCircle cx={BADGE / 2} cy={BADGE / 2} r={r} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, remaining)))}
          transform={`rotate(-90 ${BADGE / 2} ${BADGE / 2})`} />
      </Svg>
      <Icon size={18} color={color} strokeWidth={2} />
    </Pressable>
    <Text numberOfLines={1} style={[styles.badgeCaption, { color }]}>{caption}</Text>
  </Animated.View>;
}

const styles = StyleSheet.create({
  badgeWrap: { alignItems: 'center', gap: 3 },
  badge: { width: BADGE, height: BADGE, borderRadius: BADGE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,24,38,0.9)' },
  badgeWave: { position: 'absolute', width: BADGE, height: BADGE, borderRadius: BADGE / 2, borderWidth: 1.5 },
  badgeCaption: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
});
