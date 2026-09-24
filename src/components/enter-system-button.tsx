/**
 * « Enter my system » : bouton animé + effet de saut dans l'espace avant d'ouvrir le système.
 * Repos : reflet qui traverse le bouton dans un sens puis dans l'autre, flèche qui pousse vers la droite.
 * Appui : le bouton s'enfonce, une onde part du bouton, la flèche file, puis un « warp »
 * (traînées d'étoiles, voile noir) pendant la navigation, puis un fondu qui révèle le système.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { ArrowRight, Orbit } from 'lucide-react-native';
import { Text } from '@/components/astralys-text';
import { useMotionPreferences } from '@/context/motion-context';
import { haptic } from '@/features/orbital/haptics';
import { playWarp } from '@/components/warp-overlay';

const VIOLET = '#C8BAF5';
export function EnterSystemButton({ onEnter, label = 'Enter my system', disabled = false, style }: {
  onEnter: () => void; label?: string; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { reducedMotion } = useMotionPreferences();
  const [width, setWidth] = useState(0);
  const busy = useRef(false);
  const scale = useSharedValue(1);
  const shine = useSharedValue(0);
  const arrow = useSharedValue(0);
  const ripple = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion || disabled) return;
    // Le reflet traverse le bouton, marque une pause, puis repasse dans l'autre sens (aller-retour, sans saut visible).
    shine.value = withRepeat(withSequence(
      withDelay(2600, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) })),
      withDelay(2600, withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) })),
    ), -1, false);
    arrow.value = withRepeat(withSequence(withDelay(1800, withTiming(0.35, { duration: 260 })), withTiming(0, { duration: 260 })), -1, false);
    return () => { cancelAnimation(shine); cancelAnimation(arrow); };
  }, [reducedMotion, disabled, shine, arrow]);

  const press = () => {
    if (busy.current || disabled) return;
    busy.current = true;
    haptic('launch');
    if (reducedMotion) { onEnter(); busy.current = false; return; }
    scale.value = withSequence(withTiming(0.94, { duration: 80 }), withTiming(1.04, { duration: 140 }), withTiming(1, { duration: 140 }));
    ripple.value = 0;
    ripple.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
    cancelAnimation(arrow);
    arrow.value = withTiming(3, { duration: 260, easing: Easing.in(Easing.quad) });
    // Voile noir complet → navigation cachée derrière → fondu qui révèle le système (effet à la racine de l'app).
    playWarp(onEnter, () => { busy.current = false; arrow.value = 0; ripple.value = 0; });
  };

  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const shineStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -60 + shine.value * (width + 120) }, { rotate: '20deg' }] }));
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: arrow.value * 8 }], opacity: arrow.value > 2 ? Math.max(0, 3 - arrow.value) : 1 }));
  const rippleStyle = useAnimatedStyle(() => ({ opacity: ripple.value <= 0 || ripple.value >= 1 ? 0 : (1 - ripple.value) * 0.6, transform: [{ scaleX: 1 + ripple.value * 0.12 }, { scaleY: 1 + ripple.value * 0.45 }] }));

  return <View style={style}>
    <Animated.View pointerEvents="none" style={[styles.ripple, rippleStyle]} />
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
      onPressIn={() => { if (!reducedMotion && !busy.current) scale.value = withTiming(0.96, { duration: 90 }); }}
      onPressOut={() => { if (!busy.current) scale.value = withTiming(1, { duration: 140 }); }}
      onPress={press} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <Animated.View style={[styles.button, disabled && styles.disabled, buttonStyle]}>
        <Animated.View pointerEvents="none" style={[styles.shine, shineStyle]} />
        <Orbit size={18} color="#141826" />
        <Text style={styles.label}>{label}</Text>
        <Animated.View style={arrowStyle}><ArrowRight size={17} color="#141826" /></Animated.View>
      </Animated.View>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  button: { minHeight: 50, borderRadius: 25, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 22, backgroundColor: VIOLET },
  disabled: { opacity: 0.5 },
  label: { color: '#141826', fontSize: 15, fontWeight: '700' },
  shine: { position: 'absolute', top: -20, bottom: -20, width: 34, backgroundColor: 'rgba(255,255,255,0.45)' },
  ripple: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 25, borderWidth: 2, borderColor: VIOLET },
});
