import { CelestialVisual } from '@/components/celestial-visual';
import type { CelestialVisualObject } from '@/components/celestial-visual.shared';
import { useMotionPreferences } from '@/context/motion-context';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

const featuredStar = {
  id: 'first-star-preview',
  object_type: 'star' as const,
  visual_category: 'blue-white',
  apparent_magnitude: 2.1,
};

type OrbitStarProps = {
  color: string;
  phase: number;
  progress: SharedValue<number>;
  radiusX: number;
  radiusY: number;
  size: number;
};

function OrbitStar({ color, phase, progress, radiusX, radiusY, size }: OrbitStarProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const angle = (progress.value + phase) * Math.PI * 2;
    const depth = (Math.sin(angle) + 1) / 2;
    return {
      opacity: 0.42 + depth * 0.58,
      transform: [
        { translateX: Math.cos(angle) * radiusX },
        { translateY: Math.sin(angle) * radiusY },
        { scale: 0.72 + depth * 0.4 },
      ],
    };
  });

  return (
    <Animated.View style={[styles.orbitStarAnchor, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }, animatedStyle]}>
      <View style={[styles.orbitStarGlow, { backgroundColor: color }]} />
      <View style={[styles.orbitStarCore, { backgroundColor: color }]} />
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Satellites en orbite (système actif) : même dessin que dans la 3D,   */
/* en version 2D légère — ailes à cellules, corps doré, parabole, feux. */
/* ------------------------------------------------------------------ */
type SatelliteVariant = 'dish' | 'mast' | 'cross';

function SatelliteSprite({ variant, width }: { variant: SatelliteVariant; width: number }) {
  const id = `sat-${variant}`;
  const wing = (x: number, y: number, w: number, h: number) => <G>
    <Rect x={x} y={y} width={w} height={h} rx={0.8} fill="#15235F" stroke="#9AA3BC" strokeWidth={0.6} />
    {Array.from({ length: Math.floor(w / 4) - 1 }, (_, i) => <Line key={i} x1={x + 4 * (i + 1)} y1={y} x2={x + 4 * (i + 1)} y2={y + h} stroke="#6F7DB4" strokeWidth={0.4} />)}
    <Line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke="#6F7DB4" strokeWidth={0.4} />
  </G>;
  return <Svg width={width} height={width / 2} viewBox="0 0 64 32">
    <Defs>
      <LinearGradient id={`${id}-foil`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#F2C46A" />
        <Stop offset="0.45" stopColor="#B7802C" />
        <Stop offset="0.7" stopColor="#E7B458" />
        <Stop offset="1" stopColor="#8A5A1C" />
      </LinearGradient>
    </Defs>
    {variant === 'cross' ? <>{wing(28.5, 0, 7, 9)}{wing(28.5, 23, 7, 9)}</> : null}
    {wing(2, 11, 22, 10)}
    {wing(40, 11, 22, 10)}
    <Rect x={23} y={15} width={5} height={2} fill="#C9CEDA" />
    <Rect x={36} y={15} width={5} height={2} fill="#C9CEDA" />
    <Rect x={27} y={9} width={10} height={14} rx={1.2} fill={`url(#${id}-foil)`} stroke="#6B4A1A" strokeWidth={0.5} />
    <Line x1={29} y1={12} x2={35} y2={13.5} stroke="#7A521A" strokeWidth={0.5} />
    <Line x1={29} y1={18} x2={35} y2={17} stroke="#FFE3A0" strokeWidth={0.4} />
    <Rect x={26.5} y={8} width={11} height={1.6} rx={0.5} fill="#D6DAE4" />
    <Rect x={26.5} y={22.4} width={11} height={1.6} rx={0.5} fill="#D6DAE4" />
    {variant === 'dish'
      ? <><Line x1={32} y1={8} x2={32} y2={4.5} stroke="#C9CEDA" strokeWidth={0.8} /><Ellipse cx={32} cy={3.6} rx={5.5} ry={2} fill="#E6E9F0" stroke="#9AA3BC" strokeWidth={0.4} /><Circle cx={32} cy={2.2} r={0.8} fill="#F2C46A" /></>
      : <><Line x1={32} y1={8} x2={32} y2={2.5} stroke="#C9CEDA" strokeWidth={0.7} /><Circle cx={32} cy={2.2} r={1.1} fill="#C8BAF5" /></>}
    <Circle cx={28} cy={10.5} r={0.9} fill="#FF5A5A" />
    <Circle cx={36} cy={10.5} r={0.9} fill="#5CFF8F" />
  </Svg>;
}

type OrbitSatelliteProps = { variant: SatelliteVariant; phase: number; progress: SharedValue<number>; radiusX: number; radiusY: number; width: number; speed: number };

const AnimatedPath = Animated.createAnimatedComponent(Path);
const TRAIL_SEGMENTS = 6;
const TRAIL_LENGTH = 0.09; // fraction d'orbite couverte par la traînée

/**
 * Traînée fluide : un arc d'ellipse découpé en segments de plus en plus fins et transparents.
 * Deux calques (derrière / devant l'étoile) pour que la ligne passe derrière l'étoile avec le satellite.
 */
function TrailSegment({ phase, progress, radiusX, radiusY, speed, index, cx, cy, front }: {
  phase: number; progress: SharedValue<number>; radiusX: number; radiusY: number; speed: number; index: number; cx: number; cy: number; front: boolean;
}) {
  const animatedProps = useAnimatedProps(() => {
    const head = (progress.value * speed + phase) % 1;
    const from = head - (TRAIL_LENGTH * index) / TRAIL_SEGMENTS;
    const to = head - (TRAIL_LENGTH * (index + 1)) / TRAIL_SEGMENTS;
    let d = '';
    for (let k = 0; k <= 4; k++) {
      const a = (from + (to - from) * (k / 4)) * Math.PI * 2;
      d += `${k === 0 ? 'M' : 'L'}${(cx + Math.cos(a) * radiusX).toFixed(1)} ${(cy + Math.sin(a) * radiusY).toFixed(1)} `;
    }
    const mid = (from + to) / 2 * Math.PI * 2;
    const inFront = Math.sin(mid) > 0;
    const depth = (Math.sin(mid) + 1) / 2;
    return { d, strokeOpacity: inFront === front ? (1 - index / TRAIL_SEGMENTS) * (0.35 + depth * 0.55) : 0 };
  });
  return <AnimatedPath animatedProps={animatedProps} stroke="#C8BAF5" strokeWidth={1.6 * (1 - index / (TRAIL_SEGMENTS + 1))} strokeLinecap="round" fill="none" />;
}

type Orbit = { variant: SatelliteVariant; phase: number; radiusX: number; radiusY: number; width: number };
const ORBITS: readonly Orbit[] = [
  { variant: 'dish', phase: 0, radiusX: 128, radiusY: 46, width: 18 },
  { variant: 'mast', phase: 0.45, radiusX: 96, radiusY: 66, width: 14 },
  { variant: 'cross', phase: 0.78, radiusX: 140, radiusY: 58, width: 16 },
];

function Trails({ progress, width, height, front }: { progress: SharedValue<number>; width: number; height: number; front: boolean }) {
  return <Svg pointerEvents="none" width={width} height={height} style={[StyleSheet.absoluteFill, { zIndex: front ? 3 : 0 }]}>
    {/* Trajectoires : ellipses très pâles, moitié arrière derrière l'étoile, moitié avant devant. */}
    {ORBITS.map(orbit => {
      const cx = width / 2, cy = height / 2;
      const d = front
        ? `M${cx + orbit.radiusX} ${cy} A${orbit.radiusX} ${orbit.radiusY} 0 0 1 ${cx - orbit.radiusX} ${cy}`
        : `M${cx - orbit.radiusX} ${cy} A${orbit.radiusX} ${orbit.radiusY} 0 0 1 ${cx + orbit.radiusX} ${cy}`;
      return <Path key={`orbit-${orbit.variant}`} d={d} stroke="#C8BAF5" strokeOpacity={front ? 0.16 : 0.08} strokeWidth={0.8} strokeDasharray="2 5" fill="none" />;
    })}
    {ORBITS.map(orbit => Array.from({ length: TRAIL_SEGMENTS }, (_, index) => <TrailSegment key={`${orbit.variant}-${index}`}
      phase={orbit.phase} progress={progress} radiusX={orbit.radiusX} radiusY={orbit.radiusY} speed={1} index={index} cx={width / 2} cy={height / 2} front={front} />))}
  </Svg>;
}

function OrbitSatellite({ variant, phase, progress, radiusX, radiusY, width, speed }: OrbitSatelliteProps) {
  const style = useAnimatedStyle(() => {
    const angle = ((progress.value * speed + phase) % 1) * Math.PI * 2;
    const depth = (Math.sin(angle) + 1) / 2;
    // Léger roulis qui suit l'orbite en douceur (fonction continue : aucun basculement brusque).
    const bank = -Math.cos(angle) * 0.22;
    return {
      opacity: 0.45 + depth * 0.55,
      zIndex: depth > 0.5 ? 4 : 0,
      transform: [
        { translateX: Math.cos(angle) * radiusX },
        { translateY: Math.sin(angle) * radiusY },
        { rotate: `${bank}rad` },
        { scale: 0.65 + depth * 0.45 },
      ],
    };
  });
  // Éclat : les ailes brillent brièvement quand elles passent face à l'étoile.
  const glint = useAnimatedStyle(() => {
    const angle = ((progress.value * speed + phase) % 1) * Math.PI * 2;
    return { opacity: Math.pow(Math.max(0, Math.cos(angle - 0.9)), 14) * 0.8 };
  });
  return <>
    <Animated.View pointerEvents="none" style={[styles.orbitStarAnchor, { width, height: width / 2, marginLeft: -width / 2, marginTop: -width / 4 }, style]}>
      <SatelliteSprite variant={variant} width={width} />
      <Animated.View style={[StyleSheet.absoluteFill, glint]}>
        <View style={[styles.glint, { left: '3%' }]} />
        <View style={[styles.glint, { right: '3%' }]} />
      </Animated.View>
    </Animated.View>
  </>;
}

export function FirstStarSystem({ active = false, height = 300, star }: { active?: boolean; height?: number; star?: CelestialVisualObject }) {
  const { foreground, reducedMotion } = useMotionPreferences();
  const [focused, setFocused] = useState(false);
  const [sceneWidth, setSceneWidth] = useState(0);
  const progress = useSharedValue(0.08);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  // Horloge continue : la position avance à chaque image, elle n'est jamais remise à zéro.
  // Quitter l'écran met simplement en pause, et le mouvement reprend exactement où il s'était arrêté.
  const period = active ? 24000 : 12000;
  const clock = useFrameCallback(frame => {
    'worklet';
    const dt = Math.min(64, frame.timeSincePreviousFrame ?? 16);
    progress.value = (progress.value + dt / period) % 1000;
  }, false);
  useEffect(() => {
    clock.setActive(focused && foreground && !reducedMotion);
  }, [clock, focused, foreground, reducedMotion]);

  return (
    <View
      accessibilityLabel="Animated system of stars surrounding the first star in a collection"
      accessibilityRole="image"
      onLayout={event => setSceneWidth(event.nativeEvent.layout.width)}
      style={[styles.scene, { height }]}>
      <View pointerEvents="none" style={[styles.centerStar, { zIndex: 2 }]}>
        <CelestialVisual animated object={star ?? featuredStar} size={280} />
      </View>
      {active ? <>
        {/* Système en ligne : les satellites du joueur tournent autour de son étoile. */}
        {sceneWidth > 0 ? <><Trails progress={progress} width={sceneWidth} height={height} front={false} /><Trails progress={progress} width={sceneWidth} height={height} front /></> : null}
        {ORBITS.map(orbit => <OrbitSatellite key={orbit.variant} {...orbit} progress={progress} speed={1} />)}
      </> : <>
        <OrbitStar color="#87D9F0" phase={0} progress={progress} radiusX={112} radiusY={43} size={13} />
        <OrbitStar color="#F0C58A" phase={0.34} progress={progress} radiusX={86} radiusY={62} size={10} />
        <OrbitStar color="#C8BAF5" phase={0.68} progress={progress} radiusX={119} radiusY={52} size={8} />
      </>}
      <View style={[styles.fixedStar, styles.fixedStarOne]} />
      <View style={[styles.fixedStar, styles.fixedStarTwo]} />
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    width: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  centerStar: { width: 280, height: 280, alignItems: 'center', justifyContent: 'center' },
  orbitStarAnchor: { position: 'absolute', left: '50%', top: '50%', alignItems: 'center', justifyContent: 'center' },
  orbitStarGlow: { position: 'absolute', width: '100%', height: '100%', borderRadius: 99, opacity: 0.2 },
  orbitStarCore: { width: '48%', height: '48%', borderRadius: 99 },
  glint: { position: 'absolute', width: '34%', top: '34%', height: '32%', borderRadius: 2, backgroundColor: '#FFFFFF' },
  fixedStar: { position: 'absolute', width: 3, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF' },
  fixedStarOne: { top: 34, left: 36, opacity: 0.42 },
  fixedStarTwo: { right: 32, bottom: 38, opacity: 0.26 },
});
