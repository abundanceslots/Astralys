import {
  colorWithAlpha,
  getCelestialVisualProfile,
  type CelestialVisualObject,
} from '@/components/celestial-visual.shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useMotionPreferences } from '@/context/motion-context';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type CelestialVisualProps = {
  object: CelestialVisualObject;
  size?: number;
  animated?: boolean;
  fillFrame?: boolean;
};

export function CelestialVisual({ object, size = 96, animated = false, fillFrame = false }: CelestialVisualProps) {
  const { reducedMotion, foreground } = useMotionPreferences();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const profile = useMemo(() => getCelestialVisualProfile(object), [object]);
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    if (animated && !reducedMotion && foreground && focused) {
      progress.value = withRepeat(withTiming(1, { duration: 24000, easing: Easing.linear }), -1);
    } else {
      progress.value = 0;
    }

    return () => cancelAnimation(progress);
  }, [animated, reducedMotion, foreground, focused, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));
  const radius = size * (fillFrame ? 0.48 : profile.bodyRatio);
  const diameter = radius * 2;
  const sphereStyle = {
    width: diameter,
    height: diameter,
    borderRadius: radius,
    backgroundColor: profile.baseColor,
    experimental_backgroundImage: `radial-gradient(circle at 31% 27%, ${profile.highlightColor} 0%, ${profile.baseColor} 46%, ${profile.shadowColor} 100%)`,
  } as const;

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Animated.View style={[styles.fill, animatedStyle]}>
        {profile.kind === 'star' ? (
          <>
            <View
              style={[
                styles.centered,
                styles.glow,
                {
                  width: radius * 2.9,
                  height: radius * 2.9,
                  borderRadius: radius * 1.45,
                  backgroundColor: colorWithAlpha(profile.glowColor, 0.18),
                },
              ]}
            />
            <View style={[styles.starRay, { width: radius * 2.8, backgroundColor: colorWithAlpha(profile.accentColor, 0.22) }]} />
            <View style={[styles.starRay, styles.starRayVertical, { width: radius * 2.8, backgroundColor: colorWithAlpha(profile.accentColor, 0.18) }]} />
          </>
        ) : profile.hasRings ? (
          <View
            style={[
              styles.centered,
              styles.ring,
              {
                width: radius * 2.9,
                height: radius * 0.72,
                borderRadius: radius,
                borderColor: colorWithAlpha(profile.accentColor, 0.65),
                transform: [{ translateX: -radius * 1.45 }, { translateY: -radius * 0.36 }, { rotate: '-13deg' }],
              },
            ]}
          />
        ) : null}

        <View style={[styles.centered, styles.sphere, sphereStyle, { transform: [{ translateX: -radius }, { translateY: -radius }] }]}>
          {profile.kind === 'gas'
            ? [0.24, 0.4, 0.58, 0.72].map((top, index) => (
                <View
                  key={top}
                  style={{
                    position: 'absolute',
                    top: diameter * top,
                    left: -diameter * 0.05,
                    width: diameter * 1.1,
                    height: Math.max(1, diameter * (index % 2 === 0 ? 0.055 : 0.035)),
                    backgroundColor: colorWithAlpha(index % 2 === 0 ? profile.accentColor : profile.highlightColor, 0.28),
                    transform: [{ rotate: index % 2 === 0 ? '-4deg' : '3deg' }],
                  }}
                />
              ))
            : profile.spots.slice(0, size < 60 ? 3 : 7).map((spot, index) => (
                <View
                  key={`${spot.x}-${spot.y}`}
                  style={{
                    position: 'absolute',
                    left: diameter * spot.x,
                    top: diameter * spot.y,
                    width: Math.max(1.5, diameter * spot.radius * 2),
                    height: Math.max(1.5, diameter * spot.radius * 1.3),
                    borderRadius: diameter * spot.radius,
                    backgroundColor: colorWithAlpha(index % 2 === 0 ? profile.accentColor : profile.shadowColor, spot.opacity),
                  }}
                />
              ))}
          {profile.kind !== 'star' ? (
            <View
              style={[
                styles.terminator,
                {
                  width: diameter * 0.86,
                  height: diameter * 1.08,
                  borderRadius: diameter * 0.54,
                  right: -diameter * 0.29,
                  top: -diameter * 0.03,
                },
              ]}
            />
          ) : null}
          <View
            style={{
              position: 'absolute',
              left: diameter * 0.2,
              top: diameter * 0.15,
              width: diameter * 0.24,
              height: diameter * 0.12,
              borderRadius: diameter * 0.12,
              backgroundColor: colorWithAlpha('#FFFFFF', profile.kind === 'star' ? 0.28 : 0.2),
              transform: [{ rotate: '-24deg' }],
            }}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', inset: 0 },
  centered: { position: 'absolute', left: '50%', top: '50%' },
  glow: { opacity: 0.8 },
  starRay: { position: 'absolute', left: '50%', top: '50%', height: 1, transform: [{ translateX: '-50%' }] },
  starRayVertical: { transform: [{ translateX: '-50%' }, { rotate: '90deg' }] },
  ring: { borderWidth: 1.5 },
  sphere: { overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  terminator: { position: 'absolute', backgroundColor: 'rgba(2, 5, 13, 0.42)' },
});
