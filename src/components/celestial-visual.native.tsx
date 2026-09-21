import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Line,
  Oval,
  RadialGradient,
  Rect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import {
  colorWithAlpha,
  getCelestialVisualProfile,
  type CelestialVisualObject,
} from '@/components/celestial-visual.shared';
import { MenuStar, menuStarEffect } from './menu-star.native';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  useReducedMotion,
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
};

export function CelestialVisual({ object, size = 96, animated = false }: CelestialVisualProps) {
  const profile = useMemo(() => getCelestialVisualProfile(object), [object]);
  if (profile.kind === 'star' && menuStarEffect) return <MenuStar profile={profile} size={size} animated={animated} />;
  return <LegacyCelestialVisual object={object} size={size} animated={profile.kind === 'star' ? false : animated} />;
}

function LegacyCelestialVisual({ object, size = 96, animated = false }: CelestialVisualProps) {
  const reducedMotion = useReducedMotion();
  const profile = useMemo(() => getCelestialVisualProfile(object), [object]);
  const center = size / 2;
  const radius = size * profile.bodyRatio;
  const surfaceClip = useMemo(() => {
    const path = Skia.Path.Make();
    path.addCircle(center, center, radius);
    return path;
  }, [center, radius]);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (animated && !reducedMotion) {
      progress.value = withRepeat(withTiming(1, { duration: 26000, easing: Easing.linear }), -1);
    } else {
      progress.value = 0;
    }

    return () => cancelAnimation(progress);
  }, [animated, reducedMotion, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Animated.View style={[{ width: size, height: size }, animatedStyle]}>
        <Canvas style={{ width: size, height: size }}>
          {profile.kind === 'star' ? (
            <>
              <Circle cx={center} cy={center} r={radius * 1.3} color={colorWithAlpha(profile.glowColor, 0.24)}>
                <BlurMask blur={Math.max(3, radius * 0.42)} style="normal" />
              </Circle>
              <Line
                p1={vec(center - radius * 1.65, center)}
                p2={vec(center + radius * 1.65, center)}
                color={colorWithAlpha(profile.accentColor, 0.22)}
                strokeWidth={Math.max(0.7, size * 0.007)}>
                <BlurMask blur={Math.max(1, size * 0.018)} style="normal" />
              </Line>
              <Line
                p1={vec(center, center - radius * 1.65)}
                p2={vec(center, center + radius * 1.65)}
                color={colorWithAlpha(profile.accentColor, 0.16)}
                strokeWidth={Math.max(0.7, size * 0.006)}>
                <BlurMask blur={Math.max(1, size * 0.016)} style="normal" />
              </Line>
            </>
          ) : profile.hasRings ? (
            <Oval
              x={center - radius * 1.48}
              y={center - radius * 0.38}
              width={radius * 2.96}
              height={radius * 0.76}
              color={colorWithAlpha(profile.accentColor, 0.62)}
              style="stroke"
              strokeWidth={Math.max(1, size * 0.014)}
            />
          ) : null}

          <Circle cx={center} cy={center} r={radius}>
            <RadialGradient
              c={vec(center - radius * 0.34, center - radius * 0.32)}
              r={radius * 1.48}
              colors={[profile.highlightColor, profile.baseColor, profile.shadowColor]}
              positions={[0, 0.48, 1]}
            />
          </Circle>

          <Group clip={surfaceClip}>
            {profile.kind === 'gas'
              ? [0.25, 0.4, 0.57, 0.72].map((offset, index) => (
                  <Rect
                    key={offset}
                    x={center - radius}
                    y={center - radius + radius * 2 * offset}
                    width={radius * 2}
                    height={Math.max(1, radius * (index % 2 === 0 ? 0.12 : 0.075))}
                    color={colorWithAlpha(index % 2 === 0 ? profile.accentColor : profile.highlightColor, 0.3)}
                  />
                ))
              : profile.spots.slice(0, size < 60 ? 3 : 8).map((spot, index) => (
                  <Circle
                    key={`${spot.x}-${spot.y}`}
                    cx={center - radius + radius * 2 * spot.x}
                    cy={center - radius + radius * 2 * spot.y}
                    r={Math.max(0.8, radius * 2 * spot.radius)}
                    color={colorWithAlpha(index % 2 === 0 ? profile.accentColor : profile.shadowColor, spot.opacity)}
                  />
                ))}

            {profile.kind !== 'star' ? (
              <Circle
                cx={center + radius * 0.72}
                cy={center + radius * 0.08}
                r={radius * 1.03}
                color="rgba(2, 5, 13, 0.44)"
              />
            ) : null}
            <Circle
              cx={center - radius * 0.34}
              cy={center - radius * 0.34}
              r={radius * 0.14}
              color={colorWithAlpha('#FFFFFF', profile.kind === 'star' ? 0.34 : 0.22)}>
              <BlurMask blur={Math.max(0.6, radius * 0.06)} style="normal" />
            </Circle>
          </Group>
        </Canvas>
      </Animated.View>
    </View>
  );
}
