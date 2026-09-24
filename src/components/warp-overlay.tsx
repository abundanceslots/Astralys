/**
 * Effet de « saut » (warp) plein écran, affiché au-dessus de toute l'app.
 * Il vit à la racine (_layout), jamais dans un écran : un écran mis en pause par la navigation
 * ne peut donc plus le laisser coincé. Il ne capte aucun toucher (pointerEvents « none »).
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const VIOLET = '#C8BAF5';
const STREAKS = 22;

function Streak({ index, progress, reach }: { index: number; progress: SharedValue<number>; reach: number }) {
  const angle = (index / STREAKS) * Math.PI * 2 + (index % 3) * 0.09;
  const speed = 0.75 + ((index * 37) % 10) / 20;
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, progress.value * speed);
    return {
      opacity: t < 0.05 ? 0 : (1 - t) * 0.9,
      transform: [
        { rotate: `${angle}rad` },
        { translateX: 20 + t * reach },
        { scaleX: 0.3 + t * 3.2 },
      ],
    };
  });
  return <Animated.View style={[styles.streak, style]} />;
}

type WarpPhase = 'off' | 'in' | 'out';

/** Saut : traînées d'étoiles et voile noir ('in'), puis fondu qui révèle le système ('out'). */
function WarpLayer({ phase }: { phase: WarpPhase }) {
  const { width, height } = useWindowDimensions();
  const progress = useSharedValue(0);
  const cover = useSharedValue(0);
  useEffect(() => {
    if (phase === 'in') {
      progress.value = 0;
      progress.value = withTiming(1, { duration: 520, easing: Easing.in(Easing.quad) });
      cover.value = withTiming(1, { duration: 440, easing: Easing.in(Easing.quad) });
    } else if (phase === 'out') {
      cover.value = withTiming(0, { duration: 480, easing: Easing.out(Easing.cubic) });
    } else {
      progress.value = 0; cover.value = 0;
    }
  }, [phase, progress, cover]);
  const veil = useAnimatedStyle(() => ({ opacity: cover.value }));
  const streaks = useAnimatedStyle(() => ({ opacity: cover.value }));
  const reach = Math.hypot(width, height) / 2;
  return <View pointerEvents="none" style={styles.warpRoot}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.veil, veil]} />
      <Animated.View style={[styles.center, streaks]}>
        {Array.from({ length: STREAKS }, (_, i) => <Streak key={i} index={i} progress={progress} reach={reach} />)}
      </Animated.View>
  </View>;
}


type Play = { onEnter: () => void; onDone?: () => void };
let request: ((play: Play) => void) | null = null;

/** Lance le saut : voile + traînées, navigation cachée derrière (onEnter), puis fondu. */
export function playWarp(onEnter: () => void, onDone?: () => void) {
  if (request) request({ onEnter, onDone });
  else { onEnter(); onDone?.(); }
}

export function WarpOverlayHost() {
  const [phase, setPhase] = useState<WarpPhase>('off');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const handler = ({ onEnter, onDone }: Play) => {
      timers.current.forEach(clearTimeout);
      timers.current = [
        setTimeout(() => setPhase('in'), 120),
        setTimeout(() => onEnter(), 580),
        setTimeout(() => setPhase('out'), 680),
        setTimeout(() => { setPhase('off'); onDone?.(); }, 1200),
      ];
    };
    request = handler;
    return () => { if (request === handler) request = null; timers.current.forEach(clearTimeout); };
  }, []);
  if (phase === 'off') return null;
  return <WarpLayer phase={phase} />;
}

const styles = StyleSheet.create({
  warpRoot: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1500, elevation: 1500 },
  veil: { backgroundColor: '#05060B' },
  center: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  streak: { position: 'absolute', left: 0, top: -1, width: 46, height: 2, borderRadius: 1, backgroundColor: VIOLET, transformOrigin: 'left center' },
});
