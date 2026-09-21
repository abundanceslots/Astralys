import { useEffect } from 'react';
import { useMotionPreferences } from '@/context/motion-context';
import { cancelAnimation, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

export function usePressMotion(enabled = true, pressedScale = 0.975) {
  const { reducedMotion, foreground } = useMotionPreferences();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!enabled || reducedMotion || !foreground) {
      cancelAnimation(scale);
      scale.value = 1;
    }
    return () => cancelAnimation(scale);
  }, [enabled, reducedMotion, foreground, scale]);
  const pressIn = () => {
    if (enabled && !reducedMotion && foreground) {
      scale.value = withTiming(pressedScale, { duration: 90, reduceMotion: ReduceMotion.System });
    }
  };
  const pressOut = () => {
    if (enabled && !reducedMotion && foreground) {
      scale.value = withSpring(1, { stiffness: 360, damping: 28, mass: 0.7, reduceMotion: ReduceMotion.System });
    } else scale.value = 1;
  };
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return { animatedStyle, pressIn, pressOut };
}
