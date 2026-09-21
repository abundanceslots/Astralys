import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { cancelAnimation, Easing, ReduceMotion, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useMotionPreferences } from '@/context/motion-context';
import { CelestialVisual } from '@/components/celestial-visual';
import { rotatingAstreShader } from '@/components/rotating-astre.shader';

const shader = Skia.RuntimeEffect.Make(rotatingAstreShader);
const fullTurn = Math.PI * 2;

export function RotatingAstre({ size }: { size: number }) {
  const { reducedMotion, foreground } = useMotionPreferences();
  const [focused, setFocused] = useState(false);
  const angle = useSharedValue(0);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    cancelAnimation(angle);
    if (shader && focused && foreground && !reducedMotion) {
      // Resume the remaining turn before repeating a full 40-second revolution.
      const phase = ((angle.value % fullTurn) + fullTurn) % fullTurn;
      angle.value = phase;
      angle.value = withTiming(fullTurn, {
        duration: Math.max(1, 40000 * (1 - phase / fullTurn)),
        easing: Easing.linear, reduceMotion: ReduceMotion.System,
      }, finished => {
        if (finished) {
          angle.value = 0;
          angle.value = withRepeat(withTiming(fullTurn, {
            duration: 40000, easing: Easing.linear, reduceMotion: ReduceMotion.System,
          }), -1, false);
        }
      });
    }
    return () => cancelAnimation(angle);
  }, [focused, foreground, reducedMotion, angle]);
  const uniforms = useDerivedValue(() => ({ size: [size, size], angle: angle.value }), [size]);
  return <View pointerEvents="none" accessible accessibilityRole="image"
    accessibilityLabel="Decorative lavender planet" style={{ width: size, height: size }}>
    {shader ? <Canvas style={{ width: size, height: size }}>
      <Fill><Shader source={shader} uniforms={uniforms} /></Fill>
    </Canvas> : <CelestialVisual object={{ id: 'home-astre', object_type: 'planet', radius_earth: 3 }} size={size} />}
  </View>;
}
