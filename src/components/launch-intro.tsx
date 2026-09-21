import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, Easing, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Text } from '@/components/astralys-text';
import { AstralysMark } from '@/components/astralys-mark';
import { useMotionPreferences } from '@/context/motion-context';
import { Observatory as theme } from '@/constants/observatory-theme';

export function LaunchIntro() {
  const { reducedMotion, foreground, finishLaunch, revealLaunchContent } = useMotionPreferences();
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(1);
  const entrance = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion || !foreground) { finishLaunch(); return; }
    entrance.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System });
    opacity.value = withDelay(1500, withTiming(0, { duration: 500, reduceMotion: ReduceMotion.System }, finished => {
      if (finished) runOnJS(finishLaunch)();
    }), ReduceMotion.System);
    // Also dismiss if the UI animation is interrupted: launch never depends on a network request.
    // Start the screen entrances underneath the outgoing fade, avoiding a second reveal after it.
    const reveal = setTimeout(revealLaunchContent, 1500);
    const fallback = setTimeout(finishLaunch, 2300);
    return () => { clearTimeout(reveal); clearTimeout(fallback); cancelAnimation(opacity); cancelAnimation(entrance); };
  }, [reducedMotion, foreground, finishLaunch, revealLaunchContent, entrance, opacity]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const markStyle = useAnimatedStyle(() => ({ opacity: entrance.value, transform: [{ scale: 0.96 + 0.04 * entrance.value }] }));
  const wordmarkStyle = useAnimatedStyle(() => ({ opacity: entrance.value, transform: [{ translateY: 5 * (1 - entrance.value) }] }));

  return <Animated.View accessibilityViewIsModal style={[styles.overlay, overlayStyle]}>
    <View pointerEvents="none" style={styles.identity}>
      <Animated.View style={markStyle}><AstralysMark /></Animated.View>
      <Animated.View style={wordmarkStyle}><Text accessibilityRole="header" style={styles.wordmark}>ASTRALYS</Text></Animated.View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Skip introduction" onPress={finishLaunch}
      style={[styles.skip, { bottom: Math.max(insets.bottom, 20) + 12 }]}>
      <Text style={styles.skipText}>Skip</Text>
    </Pressable>
  </Animated.View>;
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' },
  identity: { alignItems: 'center', gap: 18 },
  wordmark: { color: theme.text, fontSize: 22, fontWeight: '600', letterSpacing: 5 },
  skip: { position: 'absolute', minWidth: 80, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  skipText: { color: theme.muted, fontSize: 14 },
});
