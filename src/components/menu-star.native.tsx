import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { cancelAnimation, Easing, ReduceMotion, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useMotionPreferences } from '@/context/motion-context';
import type { CelestialVisualProfile } from './celestial-visual.shared';
import { menuStarShader } from './menu-star.shader';

export const menuStarEffect = Skia.RuntimeEffect.Make(menuStarShader);
const turn = Math.PI * 2;
function rgb(hex: string) {
  return [1, 3, 5].map(start => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
}

export function MenuStar({ profile, size, animated }: { profile: CelestialVisualProfile; size: number; animated: boolean }) {
  const { reducedMotion, foreground } = useMotionPreferences();
  const [focused, setFocused] = useState(false);
  const phase = useSharedValue(0);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    cancelAnimation(phase);
    if (animated && size >= 60 && focused && foreground && !reducedMotion) {
      const current = ((phase.value % turn) + turn) % turn;
      phase.value = current;
      phase.value = withTiming(turn, { duration: Math.max(1, 42000 * (1 - current / turn)), easing: Easing.linear, reduceMotion: ReduceMotion.System }, finished => {
        if (finished) {
          phase.value = 0;
          phase.value = withRepeat(withTiming(turn, { duration: 42000, easing: Easing.linear, reduceMotion: ReduceMotion.System }), -1, false);
        }
      });
    }
    return () => cancelAnimation(phase);
  }, [animated, size, focused, foreground, reducedMotion, phase]);
  const palette = useMemo(() => ({ baseColor: rgb(profile.baseColor), highlightColor: rgb(profile.highlightColor) }), [profile.baseColor, profile.highlightColor]);
  const uniforms = useDerivedValue(() => ({ size: [size, size], bodyRatio: profile.bodyRatio, phase: phase.value,
    seed: profile.seed, detail: size >= 60 ? 1 : 0, ...palette }), [size, profile.bodyRatio, profile.seed, palette]);
  if (!menuStarEffect) return null; // Parent retains the existing static fallback if compilation fails.
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
    <Canvas style={{ width: size, height: size }}><Fill><Shader source={menuStarEffect} uniforms={uniforms} /></Fill></Canvas>
  </View>;
}
