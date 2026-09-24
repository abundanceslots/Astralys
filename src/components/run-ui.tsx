/**
 * Boutons animés d'Orbital Run et du système.
 * Code couleur partout : violet = avancement, doré = quotidien, vert = terminé / attendre.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, ZoomIn,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { CalendarDays, Check, Flame, Hourglass, LockKeyhole, Play, Radio, Send, type LucideIcon } from 'lucide-react-native';
import { Text } from '@/components/astralys-text';
import { useMotionPreferences } from '@/context/motion-context';
import { haptic } from '@/features/orbital/haptics';

export const RUN_COLORS = {
  route: '#C8BAF5',
  daily: '#F2C879',
  done: '#9CCCB7',
  text: '#F4F1FF',
  muted: '#8C94AA',
  dim: '#4B5270',
  surface: '#10141F',
  line: '#2A3048',
} as const;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* ------------------------------------------------------------------ */
/* Briques d'animation                                                  */
/* ------------------------------------------------------------------ */

/** Halo qui respire autour d'un élément actif. */
export function PulseHalo({ size, color, active = true }: { size: number; color: string; active?: boolean }) {
  const { reducedMotion } = useMotionPreferences();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!active || reducedMotion) { cancelAnimation(t); t.value = 0; return; }
    t.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(t);
  }, [active, reducedMotion, t]);
  const style = useAnimatedStyle(() => ({ opacity: 0.45 * (1 - t.value), transform: [{ scale: 1 + t.value * 0.45 }] }));
  if (!active) return null;
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color }, style]} />;
}

/** Anneau de progression dont le remplissage glisse vers sa nouvelle valeur. */
export function ProgressRing({ size, stroke, progress, color, track = '#1D2236' }: { size: number; stroke: number; progress: number; color: string; track?: string }) {
  const { reducedMotion } = useMotionPreferences();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = useSharedValue(progress);
  useEffect(() => {
    value.value = reducedMotion ? progress : withTiming(progress, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [progress, reducedMotion, value]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - Math.max(0, Math.min(1, value.value))) }));
  return <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
    <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
    <AnimatedCircle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
      strokeDasharray={`${circumference} ${circumference}`} animatedProps={animatedProps} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
  </Svg>;
}

/** Petit rebond à l'appui, partagé par tous les boutons ci-dessous. */
function usePressScale(scaleTo = 0.95) {
  const { reducedMotion } = useMotionPreferences();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    pressIn: () => { if (!reducedMotion) scale.value = withTiming(scaleTo, { duration: 90 }); },
    pressOut: () => { if (!reducedMotion) scale.value = withSequence(withTiming(1.03, { duration: 110 }), withTiming(1, { duration: 120 })); },
  };
}

/** Sablier qui se retourne régulièrement : « le temps passe, rien à faire ». */
function FlippingHourglass({ size, color }: { size: number; color: string }) {
  const { reducedMotion } = useMotionPreferences();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    turn.value = withRepeat(withSequence(withDelay(1800, withTiming(1, { duration: 500, easing: Easing.inOut(Easing.cubic) })), withTiming(0, { duration: 0 })), -1, false);
    return () => cancelAnimation(turn);
  }, [reducedMotion, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  return <Animated.View style={style}><Hourglass size={size} color={color} strokeWidth={1.9} /></Animated.View>;
}

/* ------------------------------------------------------------------ */
/* 1 · Bouton Run du système (4 états)                                  */
/* ------------------------------------------------------------------ */
export type RunFabState = 'route' | 'daily' | 'waiting' | 'idle';

export function RunFab({ state, progress = 0, waitLabel, dailyBadge, onPress, accessibilityLabel }: {
  state: RunFabState; progress?: number; waitLabel?: string; dailyBadge?: boolean; onPress: () => void; accessibilityLabel: string;
}) {
  const press = usePressScale(0.92);
  const { reducedMotion } = useMotionPreferences();
  const badge = useSharedValue(1);
  useEffect(() => {
    if (!dailyBadge || reducedMotion) { cancelAnimation(badge); badge.value = 1; return; }
    badge.value = withRepeat(withSequence(withTiming(1.35, { duration: 450 }), withTiming(1, { duration: 450 }), withDelay(1400, withTiming(1, { duration: 0 }))), -1, false);
    return () => cancelAnimation(badge);
  }, [dailyBadge, reducedMotion, badge]);
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badge.value }] }));
  const color = state === 'idle' ? RUN_COLORS.dim : state === 'waiting' ? RUN_COLORS.muted : RUN_COLORS.route;

  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => { haptic('tick'); onPress(); }}
    onPressIn={press.pressIn} onPressOut={press.pressOut} hitSlop={6}>
    <Animated.View style={[fab.root, press.style]}>
      <PulseHalo size={64} color={RUN_COLORS.route} active={state === 'route'} />
      {state === 'route' ? <ProgressRing size={64} stroke={3} progress={progress} color={RUN_COLORS.route} /> : null}
      {state === 'waiting' ? <ProgressRing size={64} stroke={3} progress={1} color="#2F3550" track="#2F3550" /> : null}
      <View style={[fab.core, state === 'idle' && fab.coreIdle]}>
        {state === 'waiting' ? <FlippingHourglass size={18} color={color} /> : <Radio size={21} color={color} />}
        <Text numberOfLines={1} style={[fab.label, { color }]}>{state === 'waiting' ? waitLabel ?? 'Wait' : 'Run'}</Text>
      </View>
      {dailyBadge ? <Animated.View style={[fab.badge, badgeStyle]} /> : null}
    </Animated.View>
  </Pressable>;
}
const fab = StyleSheet.create({
  root: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  core: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', gap: 1, backgroundColor: 'rgba(20,24,38,0.95)', borderWidth: 1, borderColor: 'rgba(200,186,245,0.3)' },
  coreIdle: { borderColor: 'rgba(75,82,112,0.5)' },
  label: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  badge: { position: 'absolute', top: 2, right: 2, width: 13, height: 13, borderRadius: 7, backgroundColor: RUN_COLORS.daily, borderWidth: 2, borderColor: '#0C1020' },
});

/* ------------------------------------------------------------------ */
/* 2 · Nœuds de route                                                   */
/* ------------------------------------------------------------------ */
export type NodeState = 'done' | 'current' | 'locked';

export function RouteNode({ state, onPress, accessibilityLabel }: { state: NodeState; onPress?: () => void; accessibilityLabel: string }) {
  const press = usePressScale(0.9);
  const { reducedMotion } = useMotionPreferences();
  const bob = useSharedValue(0);
  useEffect(() => {
    if (state !== 'current' || reducedMotion) { cancelAnimation(bob); bob.value = 0; return; }
    bob.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(bob);
  }, [state, reducedMotion, bob]);
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + bob.value * 0.05 }] }));

  if (state === 'done') {
    return <Animated.View entering={reducedMotion ? undefined : ZoomIn.springify().damping(12)} accessible accessibilityLabel={accessibilityLabel} style={[node.small, node.done]}>
      <Check size={20} color="#141826" strokeWidth={2.6} />
    </Animated.View>;
  }
  if (state === 'locked') {
    return <View accessible accessibilityLabel={accessibilityLabel} style={[node.small, node.locked]}><LockKeyhole size={16} color={RUN_COLORS.dim} /></View>;
  }
  return <View style={node.currentWrap}>
    <PulseHalo size={70} color={RUN_COLORS.route} />
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => { haptic('tick'); onPress?.(); }} onPressIn={press.pressIn} onPressOut={press.pressOut}>
      <Animated.View style={[node.current, bobStyle, press.style]}><Play size={22} color="#141826" fill="#141826" /></Animated.View>
    </Pressable>
  </View>;
}
const node = StyleSheet.create({
  small: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  done: { backgroundColor: RUN_COLORS.route },
  locked: { backgroundColor: '#141826', borderWidth: 1, borderColor: RUN_COLORS.line },
  currentWrap: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  current: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: RUN_COLORS.route, shadowColor: RUN_COLORS.route, shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
});

/* ------------------------------------------------------------------ */
/* Route complète : station → niveaux → planète                         */
/* ------------------------------------------------------------------ */
export function RoutePath({ width, height, length, stage, planetLabel, arrival, onPlay }: {
  width: number; height: number; length: number; stage: number; planetLabel: string; arrival: string; onPlay: () => void;
}) {
  // Points : station (bas), niveaux en zigzag, planète (haut).
  const count = length + 2;
  const top = 58, bottom = height - 40;
  const points = Array.from({ length: count }, (_, i) => {
    const y = bottom - (bottom - top) * (i / (count - 1));
    const x = i === 0 ? width * 0.22 : i === count - 1 ? width * 0.7 : i % 2 ? width * 0.72 : width * 0.3;
    return { x, y };
  });
  const segment = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const mid = (a.y + b.y) / 2;
    return `C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`;
  };
  const full = points.slice(1).reduce((d, p, i) => `${d} ${segment(points[i], p)}`, `M ${points[0].x} ${points[0].y}`);
  const reached = Math.min(count - 1, stage + 1); // jusqu'au niveau à jouer (ou la planète si tout est fait)
  const lit = points.slice(1, reached + 1).reduce((d, p, i) => `${d} ${segment(points[i], p)}`, `M ${points[0].x} ${points[0].y}`);
  const done = stage >= length;
  const planet = points[count - 1];

  return <View style={{ width, height }}>
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="planetGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={RUN_COLORS.route} stopOpacity={done ? 0.45 : 0.18} />
          <Stop offset="1" stopColor={RUN_COLORS.route} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Path d={full} stroke={RUN_COLORS.line} strokeWidth={3} strokeDasharray="2 9" strokeLinecap="round" fill="none" />
      <Path d={lit} stroke={RUN_COLORS.route} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.85} />
      <Circle cx={planet.x} cy={planet.y} r={64} fill="url(#planetGlow)" />
      <Circle cx={planet.x} cy={planet.y} r={30} fill="#2B2550" stroke={RUN_COLORS.route} strokeOpacity={0.5} strokeWidth={1} />
    </Svg>
    <Text style={[path.caption, { left: points[0].x - 40, top: points[0].y + 24 }]}>Station</Text>
    <View style={[path.station, { left: points[0].x - 7, top: points[0].y - 7 }]} />
    {points.slice(1, count - 1).map((p, i) => {
      const state: NodeState = i < stage ? 'done' : i === stage ? 'current' : 'locked';
      const size = state === 'current' ? 76 : 44;
      return <View key={i} style={{ position: 'absolute', left: p.x - size / 2, top: p.y - size / 2 }}>
        <RouteNode state={state} onPress={onPlay} accessibilityLabel={state === 'current' ? `Play level ${i + 1} of ${length}` : `Level ${i + 1}, ${state === 'done' ? 'cleared' : 'locked'}`} />
      </View>;
    })}
    <Text numberOfLines={1} style={[path.planetName, { left: planet.x - 90, top: planet.y + 36 }]}>{planetLabel}</Text>
    <Text numberOfLines={1} style={[path.caption, { left: planet.x - 90, width: 180, top: planet.y + 54 }]}>{arrival}</Text>
  </View>;
}
const path = StyleSheet.create({
  station: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: RUN_COLORS.route },
  caption: { position: 'absolute', width: 80, textAlign: 'center', color: RUN_COLORS.muted, fontSize: 11 },
  planetName: { position: 'absolute', width: 180, textAlign: 'center', color: RUN_COLORS.text, fontSize: 13, fontWeight: '600' },
});

/* ------------------------------------------------------------------ */
/* 3 · Maintenir pour lancer                                            */
/* ------------------------------------------------------------------ */
export function HoldToLaunchButton({ label, onConfirm, disabled = false, duration = 650, style }: {
  label: string; onConfirm: () => void; disabled?: boolean; duration?: number; style?: StyleProp<ViewStyle>;
}) {
  const { reducedMotion } = useMotionPreferences();
  const [width, setWidth] = useState(0);
  const [holding, setHolding] = useState(false);
  const fill = useSharedValue(0);
  const confirm = useCallback(() => {
    haptic('launch');
    setHolding(false);
    onConfirm();
    fill.value = withDelay(250, withTiming(0, { duration: 250 }));
  }, [fill, onConfirm]);
  const start = () => {
    if (disabled) return;
    haptic('tick');
    setHolding(true);
    fill.value = withTiming(1, { duration: reducedMotion ? 250 : duration, easing: Easing.linear }, finished => {
      'worklet';
      if (finished) scheduleOnRN(confirm);
    });
  };
  const stop = () => {
    setHolding(false);
    if (fill.value < 1) fill.value = withTiming(0, { duration: 180 });
  };
  const fillStyle = useAnimatedStyle(() => ({ width: fill.value * width }));
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Press and hold to confirm"
    accessibilityState={{ disabled }} disabled={disabled} onPressIn={start} onPressOut={stop}
    accessibilityActions={[{ name: 'activate' }]} onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'activate' && !disabled) confirm(); }}
    onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[hold.root, disabled && hold.disabled, style]}>
    <Animated.View style={[hold.fill, fillStyle]} />
    <View style={hold.content}>
      <Send size={18} color={disabled ? RUN_COLORS.muted : RUN_COLORS.text} />
      <Text numberOfLines={1} style={[hold.label, disabled && { color: RUN_COLORS.muted }]}>{holding ? 'Keep holding…' : label}</Text>
    </View>
  </Pressable>;
}
const hold = StyleSheet.create({
  root: { minHeight: 54, borderRadius: 27, overflow: 'hidden', backgroundColor: '#1A1D33', borderWidth: 1, borderColor: 'rgba(200,186,245,0.35)', justifyContent: 'center' },
  disabled: { backgroundColor: RUN_COLORS.surface, borderColor: '#22283B' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(200,186,245,0.45)' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  label: { color: RUN_COLORS.text, fontSize: 15, fontWeight: '600' },
});

/* ------------------------------------------------------------------ */
/* 4 · Bouton d'attente informatif                                      */
/* ------------------------------------------------------------------ */
export function WaitingButton({ label, progress, tone = 'wait', style }: { label: string; progress?: number; tone?: 'wait' | 'done'; style?: StyleProp<ViewStyle> }) {
  const { reducedMotion } = useMotionPreferences();
  const [width, setWidth] = useState(0);
  const value = useSharedValue(progress ?? 0);
  useEffect(() => {
    value.value = reducedMotion ? progress ?? 0 : withTiming(progress ?? 0, { duration: 600 });
  }, [progress, reducedMotion, value]);
  const fillStyle = useAnimatedStyle(() => ({ width: value.value * width }));
  return <View accessible accessibilityRole="text" accessibilityLabel={label} onLayout={event => setWidth(event.nativeEvent.layout.width)}
    style={[wait.root, tone === 'done' && wait.dashed, style]}>
    {progress !== undefined ? <Animated.View style={[wait.fill, fillStyle]} /> : null}
    <View style={wait.content}>
      {tone === 'wait' ? <FlippingHourglass size={17} color={RUN_COLORS.done} /> : <Check size={18} color={RUN_COLORS.done} strokeWidth={2.4} />}
      <Text numberOfLines={1} style={[wait.label, tone === 'done' && { color: RUN_COLORS.muted }]}>{label}</Text>
    </View>
  </View>;
}
const wait = StyleSheet.create({
  root: { minHeight: 52, borderRadius: 26, overflow: 'hidden', backgroundColor: RUN_COLORS.surface, borderWidth: 1, borderColor: '#22283B', justifyContent: 'center' },
  dashed: { borderStyle: 'dashed', borderColor: RUN_COLORS.line },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(156,204,183,0.10)' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  label: { color: RUN_COLORS.done, fontSize: 14, fontWeight: '600' },
});

/* ------------------------------------------------------------------ */
/* 5 · Ticket des épreuves du jour                                      */
/* ------------------------------------------------------------------ */
export function DailyTicket({ stage, total, chapterName, streak, reward, done, resetIn, onPlay }: {
  stage: number; total: number; chapterName: string; streak: number; reward: string; done: boolean; resetIn: string; onPlay: () => void;
}) {
  const { reducedMotion } = useMotionPreferences();
  const press = usePressScale(0.94);
  const [stubWidth, setStubWidth] = useState(88);
  const shine = useSharedValue(0);
  useEffect(() => {
    if (done || reducedMotion) { cancelAnimation(shine); shine.value = 0; return; }
    shine.value = withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), withDelay(2600, withTiming(0, { duration: 0 }))), -1, false);
    return () => cancelAnimation(shine);
  }, [done, reducedMotion, shine]);
  const shineStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -40 + shine.value * (stubWidth + 80) }, { rotate: '18deg' }] }));

  return <View style={ticket.root}>
    <View style={ticket.body}>
      <View style={ticket.tagRow}>
        <CalendarDays size={13} color={RUN_COLORS.daily} />
        <Text style={ticket.tag}>DAILY · {Math.min(stage, total)} / {total}</Text>
      </View>
      <Text numberOfLines={1} style={ticket.title}>{chapterName}</Text>
      <View style={ticket.metaRow}>
        <Flame size={13} color={streak > 0 ? RUN_COLORS.daily : RUN_COLORS.muted} />
        <Text numberOfLines={1} style={ticket.meta}>{streak > 0 ? `${streak}-day streak` : 'Start a streak'} · {done ? `new in ${resetIn}` : reward}</Text>
      </View>
      <View style={ticket.dots}>{Array.from({ length: total }, (_, i) => <View key={i} style={[ticket.dot, i < stage && ticket.dotOn]} />)}</View>
    </View>
    <View style={ticket.perforation}>{Array.from({ length: 9 }, (_, i) => <View key={i} style={ticket.hole} />)}</View>
    {done
      ? <View accessible accessibilityLabel={`Daily trials done. New trials in ${resetIn}`} style={[ticket.stub, ticket.stubDone]}>
        <FlippingHourglass size={18} color={RUN_COLORS.muted} />
        <Text style={ticket.stubWait}>{resetIn}</Text>
      </View>
      : <Pressable accessibilityRole="button" accessibilityLabel={`Play daily trial ${stage + 1} of ${total}`} onPress={() => { haptic('tick'); onPlay(); }}
        onPressIn={press.pressIn} onPressOut={press.pressOut} onLayout={e => setStubWidth(e.nativeEvent.layout.width)} style={ticket.stubHit}>
        <Animated.View style={[ticket.stub, press.style]}>
          <Animated.View pointerEvents="none" style={[ticket.shine, shineStyle]} />
          <Play size={18} color="#241A06" fill="#241A06" />
          <Text style={ticket.stubText}>Play</Text>
        </Animated.View>
      </Pressable>}
  </View>;
}
const ticket = StyleSheet.create({
  root: { flexDirection: 'row', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(242,200,121,0.35)', backgroundColor: 'rgba(242,200,121,0.07)' },
  body: { flex: 1, padding: 14, gap: 3 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { color: RUN_COLORS.daily, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: RUN_COLORS.text, fontSize: 16, fontWeight: '600', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { flex: 1, color: RUN_COLORS.muted, fontSize: 11 },
  dots: { flexDirection: 'row', gap: 5, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: RUN_COLORS.daily },
  dotOn: { backgroundColor: RUN_COLORS.daily },
  perforation: { width: 6, justifyContent: 'space-evenly', alignItems: 'center' },
  hole: { width: 3, height: 5, borderRadius: 1.5, backgroundColor: 'rgba(242,200,121,0.45)' },
  stubHit: { width: 88 },
  stub: { flex: 1, width: 88, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: RUN_COLORS.daily, overflow: 'hidden' },
  stubDone: { backgroundColor: 'rgba(255,255,255,0.03)' },
  stubText: { color: '#241A06', fontSize: 13, fontWeight: '700' },
  stubWait: { color: RUN_COLORS.muted, fontSize: 11, fontWeight: '600' },
  shine: { position: 'absolute', top: -20, bottom: -20, width: 24, backgroundColor: 'rgba(255,255,255,0.45)' },
});

/* ------------------------------------------------------------------ */
/* 7 · Carte d'intro de chapitre  ·  8 · Boutons de fin                 */
/* ------------------------------------------------------------------ */
export function ChapterIntroCard({ number, name, rule, onStart }: { number: number; name: string; rule: string; onStart: () => void }) {
  return <Animated.View entering={ZoomIn.springify().damping(15)} style={intro.card}>
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="introGlow" cx="85%" cy="0%" r="75%">
          <Stop offset="0" stopColor="#FFB870" stopOpacity={0.26} />
          <Stop offset="1" stopColor="#FFB870" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#introGlow)" />
    </Svg>
    <Text style={intro.tag}>NEW MECHANIC · CHAPTER {number}</Text>
    <Text accessibilityRole="header" style={intro.title}>{name}</Text>
    <Text style={intro.rule}>{rule}</Text>
    <PillButton label="Start" tone="route" onPress={onStart} style={{ marginTop: 12 }} />
  </Animated.View>;
}
const intro = StyleSheet.create({
  card: { width: '100%', maxWidth: 340, padding: 22, borderRadius: 22, overflow: 'hidden', backgroundColor: RUN_COLORS.surface, borderWidth: 1, borderColor: '#22283B', gap: 6 },
  tag: { color: RUN_COLORS.route, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: RUN_COLORS.text, fontSize: 26, lineHeight: 32, fontWeight: '600' },
  rule: { color: '#B3BACB', fontSize: 15, lineHeight: 22 },
});

export function PillButton({ label, tone, icon: Icon, onPress, style, trailing }: {
  label: string; tone: 'route' | 'daily-outline'; icon?: LucideIcon; onPress: () => void; style?: StyleProp<ViewStyle>; trailing?: ReactNode;
}) {
  const press = usePressScale(0.96);
  const filled = tone === 'route';
  const color = filled ? '#141826' : RUN_COLORS.daily;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { haptic('tick'); onPress(); }} onPressIn={press.pressIn} onPressOut={press.pressOut} style={style}>
    <Animated.View style={[pill.root, filled ? pill.filled : pill.outline, press.style]}>
      {Icon ? <Icon size={17} color={color} /> : null}
      <Text style={[pill.label, { color }]}>{label}</Text>
      {trailing}
    </Animated.View>
  </Pressable>;
}
const pill = StyleSheet.create({
  root: { minHeight: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  filled: { backgroundColor: RUN_COLORS.route },
  outline: { borderWidth: 1, borderColor: 'rgba(242,200,121,0.45)' },
  label: { fontSize: 14, fontWeight: '700' },
});

/** Pastille de réussite pour l'écran de fin (rebond + halo). */
export function DoneBadge({ color }: { color: string }) {
  const { reducedMotion } = useMotionPreferences();
  return <View style={{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center' }}>
    <PulseHalo size={80} color={color} />
    <Animated.View entering={reducedMotion ? undefined : ZoomIn.springify().damping(10)} style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Check size={30} color={color} strokeWidth={2.4} />
    </Animated.View>
  </View>;
}

/* ------------------------------------------------------------------ */
/* Rappels : petite secousse et bulle à côté d'un bouton                */
/* ------------------------------------------------------------------ */
/** Secoue doucement un bouton toutes les quelques secondes tant qu'une activité l'attend. */
export function useWiggle(active: boolean, every = 7000) {
  const { reducedMotion } = useMotionPreferences();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (!active || reducedMotion) { cancelAnimation(turn); turn.value = withTiming(0, { duration: 150 }); return; }
    turn.value = withRepeat(withSequence(
      withTiming(-1, { duration: 70 }), withTiming(1, { duration: 110 }), withTiming(-0.6, { duration: 100 }),
      withTiming(0.3, { duration: 90 }), withTiming(0, { duration: 80 }), withDelay(every, withTiming(0, { duration: 0 })),
    ), -1, false);
    return () => cancelAnimation(turn);
  }, [active, every, reducedMotion, turn]);
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 9}deg` }, { scale: 1 + Math.abs(turn.value) * 0.06 }] }));
}

/** Bulle de rappel qui glisse depuis le bouton (« Daily trials ready »…). */
export function NudgeBubble({ text, color, visible, onPress }: { text: string | null; color: string; visible: boolean; onPress?: () => void }) {
  const { reducedMotion } = useMotionPreferences();
  const shown = useSharedValue(0);
  useEffect(() => {
    const target = visible && text ? 1 : 0;
    shown.value = reducedMotion ? target : withTiming(target, { duration: target ? 320 : 220, easing: Easing.out(Easing.cubic) });
  }, [visible, text, reducedMotion, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateX: (1 - shown.value) * 14 }, { scale: 0.92 + shown.value * 0.08 }] }));
  if (!text) return null;
  return <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[nudge.anchor, style]}>
    <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={onPress} style={[nudge.bubble, { borderColor: color }]}>
      <View style={[nudge.dot, { backgroundColor: color }]} />
      <Text numberOfLines={1} style={nudge.text}>{text}</Text>
    </Pressable>
    <View style={[nudge.tail, { borderLeftColor: color }]} />
  </Animated.View>;
}
const nudge = StyleSheet.create({
  anchor: { position: 'absolute', right: 70, top: 14, flexDirection: 'row', alignItems: 'center' },
  bubble: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, backgroundColor: 'rgba(15,19,29,0.95)' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { color: RUN_COLORS.text, fontSize: 12, fontWeight: '600' },
  tail: { width: 0, height: 0, borderTopWidth: 5, borderBottomWidth: 5, borderLeftWidth: 6, borderTopColor: 'transparent', borderBottomColor: 'transparent' },
});
