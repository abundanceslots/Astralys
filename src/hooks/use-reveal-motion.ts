import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useMotionPreferences } from '@/context/motion-context';

export function useRevealMotion(delay = 0, replayKey?: string) {
  const { reducedMotion, foreground, launching, launchRevealing } = useMotionPreferences();
  const awaitingLaunch = launching && !launchRevealing;
  const progress = useSharedValue(reducedMotion || launching ? 1 : 0);
  useFocusEffect(useCallback(() => {
    cancelAnimation(progress);
    if (reducedMotion || !foreground || awaitingLaunch) progress.value = 1;
    else {
      progress.value = 0;
      progress.value = withDelay(Math.min(Math.max(delay, 0), 180), withTiming(1, {
        duration: 240, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System,
      }), ReduceMotion.System);
    }
    return () => { cancelAnimation(progress); progress.value = 1; };
  }, [delay, replayKey, reducedMotion, foreground, awaitingLaunch, progress]));
  return useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: 6 * (1 - progress.value) }] }));
}
