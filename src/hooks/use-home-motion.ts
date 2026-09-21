import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useMotionPreferences } from '@/context/motion-context';
import { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

export function useHomeMotion() {
  const { reducedMotion, foreground } = useMotionPreferences();
  const [focused, setFocused] = useState(false);
  const drift = useSharedValue(0);
  const twinkle = useSharedValue(0);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  useEffect(() => {
    cancelAnimation(drift);
    cancelAnimation(twinkle);
    if (focused && foreground && !reducedMotion) {
      const easing = Easing.inOut(Easing.sin);
      drift.value = withRepeat(withTiming(1, { duration: 4200, easing }), -1, true);
      twinkle.value = withRepeat(withTiming(1, { duration: 3100, easing }), -1, true);
    } else {
      drift.value = 0;
      twinkle.value = 0;
    }
    return () => { cancelAnimation(drift); cancelAnimation(twinkle); };
  }, [focused, foreground, reducedMotion, drift, twinkle]);

  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * drift.value }, { scale: 1 + 0.012 * drift.value }],
  }));
  const starOneStyle = useAnimatedStyle(() => ({ opacity: 0.2 + 0.3 * twinkle.value }));
  const starTwoStyle = useAnimatedStyle(() => ({ opacity: 0.45 - 0.25 * twinkle.value }));
  const starThreeStyle = useAnimatedStyle(() => ({ opacity: 0.18 + 0.16 * twinkle.value }));
  return { reducedMotion, heroStyle, starOneStyle, starTwoStyle, starThreeStyle };
}
