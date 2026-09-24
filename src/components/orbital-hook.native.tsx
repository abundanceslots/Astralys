/**
 * Orbital Hook — version native (iOS / Android).
 *
 * Remplace la WebView : physique et rendu tournent sur le thread UI
 * (Reanimated worklets + Skia). Même API publique que `orbital-hook.tsx`,
 * donc `orbital-mission-game.tsx` n'a pas besoin de changer.
 *
 * Ajouts par rapport à la version WebView :
 * - retours haptiques (visée, lancement, réussite, crash) ;
 * - trajectoire fantôme du dernier tir raté ;
 * - « So close! » quand la sonde frôle la cible ;
 * - note 1 à 3 étoiles par mission (événement `mission.stars`) ;
 * - avance rapide ×3 : toucher l'écran pendant le vol ;
 * - annulation : relâcher le doigt sur la station ;
 * - éclats au crash, onde de choc à la livraison ;
 * - pause automatique quand l'app passe en arrière-plan ;
 * - timing indépendant du taux de rafraîchissement (60 / 90 / 120 Hz).
 */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, Picture, createPicture, type SkPicture } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { Text } from '@/components/astralys-text';
import { useMotionPreferences } from '@/context/motion-context';
import {
  CANCEL_RADIUS,
  FAIL_DELAY,
  SUCCESS_DELAY,
  allTargets,
  createState,
  isNearMiss,
  probesFor,
  resetTargets,
  launchVector,
  spawnDebris,
  stepParticles,
  stepProbe,
  type GameState,
} from '@/features/orbital/engine';
import { haptic, type HapticKind } from '@/features/orbital/haptics';
import { LEVELS, PALETTE, type Level, type Palette } from '@/features/orbital/levels';
import { starsForAttempts, type OrbitalEvent, type OrbitalHookHandle, type OrbitalHookProps } from '@/features/orbital/orbital-types';
import { CHAPTER_COUNT, drawScene, makeSkyPicture, makeStarfield, makeView, type View as GameView } from '@/features/orbital/render';

/* ------------------------------------------------------------------ */
/* Messages UI → JS                                                    */
/* ------------------------------------------------------------------ */

type Hud = { lvl: number; attempts: number; supply: number; flying: boolean; fast: boolean; done: boolean; dragging: boolean; satsLeft: number; probes: number; reached: number; beacons: number };
type Tone = 'ok' | 'ko' | 'warn' | 'info';

type Bridge =
  | { kind: 'event'; event: OrbitalEvent }
  | { kind: 'hud'; hud: Hud }
  | { kind: 'haptic'; type: HapticKind }
  | { kind: 'flash'; text: string; tone: Tone };

const INITIAL_HUD: Hud = { lvl: 0, attempts: 1, supply: 0, flying: false, fast: false, done: false, dragging: false, satsLeft: 1, probes: 1, reached: 0, beacons: 1 };

/* ------------------------------------------------------------------ */

const OrbitalHook = forwardRef<OrbitalHookHandle, OrbitalHookProps>(function OrbitalHook(
  { levels = LEVELS, palette, showHud = true, haptics = true, onEvent, onComplete, onMission, style },
  ref,
) {
  const { reducedMotion, foreground } = useMotionPreferences();
  const P = useMemo<Palette>(() => ({ ...PALETTE, ...palette }), [palette]);

  /* ---- état partagé avec le thread UI ---- */
  const game = useSharedValue<GameState | null>(null);
  const levelsSV = useSharedValue<Level[]>(levels);
  const view = useSharedValue<GameView>(makeView(1, 1));
  const stars = useSharedValue<number[]>([]);
  const sky = useSharedValue<SkPicture[] | null>(null);
  const clock = useSharedValue(0);
  const reduce = useSharedValue(reducedMotion);
  const hostPaused = useSharedValue(false);
  const bgPaused = useSharedValue(!foreground);
  const cancelArmed = useSharedValue(false);
  const aimPower = useSharedValue(0.75);
  const paletteSV = useSharedValue<Palette>(P);

  useEffect(() => { levelsSV.value = levels; }, [levels, levelsSV]);
  useEffect(() => { reduce.value = reducedMotion; }, [reducedMotion, reduce]);
  useEffect(() => { bgPaused.value = !foreground; }, [foreground, bgPaused]);
  useEffect(() => { paletteSV.value = P; }, [P, paletteSV]);

  /* ---- côté JS : HUD, flash, haptique, événements ---- */
  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  const [flash, setFlash] = useState<{ text: string; tone: Tone; id: number }>({ text: '', tone: 'info', id: 0 });
  const callbacks = useRef({ onEvent, onComplete, onMission, haptics });
  useLayoutEffect(() => { callbacks.current = { onEvent, onComplete, onMission, haptics }; });

  const receive = useCallback((msg: Bridge) => {
    const cb = callbacks.current;
    if (msg.kind === 'hud') setHud(msg.hud);
    else if (msg.kind === 'flash') setFlash(f => ({ text: msg.text, tone: msg.tone, id: f.id + 1 }));
    else if (msg.kind === 'haptic') { if (cb.haptics) haptic(msg.type); }
    else {
      const e = msg.event;
      cb.onEvent?.(e);
      if (e.type === 'mission') cb.onMission?.(e.mission, e.supply);
      if (e.type === 'complete') cb.onComplete?.(e.supply);
    }
  }, []);

  /* ---- worklets ---- */
  const send = useCallback((msg: Bridge) => {
    'worklet';
    scheduleOnRN(receive, msg);
  }, [receive]);

  const pushHud = useCallback((s: GameState) => {
    'worklet';
    const L = levelsSV.value[s.lvl];
    let reachedCount = 0;
    for (let i = 0; i < s.reached.length; i++) if (s.reached[i]) reachedCount += 1;
    send({
      kind: 'hud',
      hud: {
        lvl: s.lvl,
        attempts: s.attempts,
        supply: s.supply,
        flying: !!s.probe && !s.outcome,
        fast: s.speed > 1,
        done: s.done,
        dragging: s.dragging,
        satsLeft: s.satsLeft,
        probes: L ? probesFor(L) : 1,
        reached: reachedCount,
        beacons: L ? allTargets(L).length : 1,
      },
    });
  }, [levelsSV, send]);

  const resetLevel = useCallback((s: GameState) => {
    'worklet';
    s.probe = null;
    s.outcome = null;
    s.done = false;
    s.acc = 0;
    if (s.attempts === 1) { s.t = 0; s.ghost = []; }
    const L = levelsSV.value[s.lvl];
    if (L) resetTargets(L, s);
    pushHud(s);
  }, [levelsSV, pushHud]);

  /** Tir suivant du même essai (plusieurs balises) : balises atteintes et satellites restants conservés. */
  const nextShot = useCallback((s: GameState) => {
    'worklet';
    s.probe = null;
    s.outcome = null;
    s.partial = false;
    s.acc = 0;
    pushHud(s);
  }, [pushHud]);

  const ensureState = useCallback((): GameState => {
    'worklet';
    let s = game.value;
    if (!s) {
      s = createState(Date.now());
      const L0 = levelsSV.value[0];
      if (L0) resetTargets(L0, s);
      game.value = s;
      pushHud(s);
      send({ kind: 'event', event: { type: 'ready', missions: levelsSV.value.length } });
    }
    return s;
  }, [game, levelsSV, pushHud, send]);

  /* ---- boucle de jeu (thread UI) ---- */
  useFrameCallback(info => {
    'worklet';
    const s = ensureState();
    const now = info.timestamp;
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    const levelsNow = levelsSV.value;
    const L = levelsNow[s.lvl];
    s.paused = hostPaused.value || bgPaused.value;

    if (L && !s.paused) {
      if (!s.probe) s.t += dt;
      else if (!s.outcome) {
        const r = stepProbe(L, s, dt);
        if (r.kind === 'ok') {
          const beacon = allTargets(L)[r.index];
          s.reached[r.index] = true;
          s.outcome = 'ok';
          s.outcomeAt = now;
          s.burstAt = now;
          s.burstX = beacon.x;
          s.burstY = beacon.y;
          let left = 0;
          for (let i = 0; i < s.reached.length; i++) if (!s.reached[i]) left += 1;
          if (left > 0) {
            // Balise atteinte, mais il en reste : le satellite suivant part du même essai.
            s.partial = true;
            s.satsLeft -= 1;
            send({ kind: 'haptic', type: 'success' });
            send({ kind: 'flash', text: 'Beacon ' + (s.reached.length - left) + ' / ' + s.reached.length, tone: 'ok' });
            pushHud(s);
          } else {
          s.totalAttempts += 1;
          s.supply = Math.round(((s.lvl + 1) / levelsNow.length) * 100);
          const starsWon = starsForAttempts(s.attempts);
          send({ kind: 'haptic', type: 'success' });
          send({ kind: 'flash', text: 'Delivered  ' + '★★★'.slice(0, starsWon) + '☆☆☆'.slice(0, 3 - starsWon), tone: 'ok' });
          send({ kind: 'event', event: { type: 'mission', mission: s.lvl, name: L.name, attempts: s.attempts, supply: s.supply, stars: starsWon } });
          pushHud(s);
          }
        } else if (r.kind === 'ko') {
          s.satsLeft -= 1;
          s.outcome = 'ko';
          s.outcomeAt = now;
          const probe = s.probe;
          const near = !!probe && isNearMiss(L, probe.closest);
          if (probe) s.ghost = probe.trail.slice();
          if (!reduce.value) spawnDebris(s, r.x, r.y, paletteSV.value.danger);
          send({ kind: 'haptic', type: near ? 'warning' : 'error' });
          let unreached = 0;
          for (let i = 0; i < s.reached.length; i++) if (!s.reached[i]) unreached += 1;
          const spare = s.satsLeft > 0 && s.satsLeft >= unreached && s.reached.length > 1;
          send({ kind: 'flash', text: (near ? 'So close!' : r.reason) + (spare ? ' · ' + s.satsLeft + ' left' : ''), tone: near ? 'warn' : 'ko' });
          send({
            kind: 'event',
            event: { type: 'fail', mission: s.lvl, attempt: s.attempts, reason: r.reason, closest: probe ? Math.max(0, Math.round(probe.closest * 10) / 10) : undefined, nearMiss: near },
          });
        }
      }
      stepParticles(s, dt);

      // Enchaînement après l'issue du tir (remplace les setTimeout de la WebView).
      if (s.outcome === 'ok' && s.partial && now - s.outcomeAt > SUCCESS_DELAY) {
        nextShot(s);
      } else if (s.outcome === 'ok' && now - s.outcomeAt > SUCCESS_DELAY) {
        if (s.lvl >= levelsNow.length - 1) {
          s.outcome = null;
          s.probe = null;
          s.done = true;
          send({ kind: 'event', event: { type: 'complete', supply: s.supply, totalAttempts: s.totalAttempts, elapsedMs: Date.now() - s.startedAt } });
          pushHud(s);
        } else {
          s.lvl += 1;
          s.attempts = 1;
          resetLevel(s);
        }
      } else if (s.outcome === 'ko' && now - s.outcomeAt > FAIL_DELAY) {
        let unreached = 0;
        for (let i = 0; i < s.reached.length; i++) if (!s.reached[i]) unreached += 1;
        if (s.reached.length > 1 && s.satsLeft > 0 && s.satsLeft >= unreached) {
          nextShot(s);
        } else {
          // Plus assez de satellites : l'essai est perdu, tout recommence.
          s.attempts += 1;
          s.totalAttempts += 1;
          resetLevel(s);
        }
      }
    }
    clock.value = now;
  });

  /* ---- image Skia recalculée à chaque tick ---- */
  const picture = useDerivedValue(() => {
    const now = clock.value;
    const s = game.value;
    const v = view.value;
    const L = s ? levelsSV.value[s.lvl] : undefined;
    return createPicture(canvas => {
      if (!s || !L) return;
      drawScene(canvas, { s, level: L, view: v, stars: stars.value, sky: sky.value, P: paletteSV.value, now, reduce: reduce.value, cancelArmed: cancelArmed.value });
    }, { width: v.W, height: v.H });
  });

  /* ---- mise en page ---- */
  const lastSize = useRef({ w: 0, h: 0 });
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width < 1 || height < 1) return;
    // Pas de nouveau champ d'étoiles si la taille n'a pas changé (évite un « saut » du fond).
    if (Math.abs(width - lastSize.current.w) < 1 && Math.abs(height - lastSize.current.h) < 1) return;
    lastSize.current = { w: width, h: height };
    view.value = makeView(width, height);
    stars.value = makeStarfield(width, height);
    scheduleOnUI((w: number, h: number) => {
      'worklet';
      // Un fond par chapitre, pré-rendu une seule fois : le changement de chapitre ne coûte rien.
      const skies: SkPicture[] = [];
      for (let c = 1; c <= CHAPTER_COUNT; c++) skies.push(makeSkyPicture(w, h, c));
      sky.value = skies;
    }, width, height);
  }, [sky, stars, view]);

  /* ---- visée : glisser depuis n'importe où, relâcher pour lancer ---- */
  const aimFrom = useCallback((x: number, y: number) => {
    'worklet';
    const s = game.value;
    const L = s ? levelsSV.value[s.lvl] : undefined;
    if (!s || !L) return;
    const v = view.value;
    const dx = (x - v.OX) / v.SC - L.station.x;
    const dy = (y - v.OY) / v.SC - L.station.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    cancelArmed.value = dist < CANCEL_RADIUS;
    if (dist < 0.6) return;
    s.aimA = Math.atan2(dy, dx);
    s.aimP = Math.max(0.12, Math.min(1, dist / 30));
    aimPower.value = s.aimP;
    const tick = Math.floor(s.aimP * 10);
    if (tick !== s.aimTick) {
      s.aimTick = tick;
      send({ kind: 'haptic', type: 'tick' });
    }
  }, [aimPower, cancelArmed, game, levelsSV, send, view]);

  const pan = useMemo(() => Gesture.Pan()
    .minDistance(0)
    .maxPointers(1)
    .onBegin(e => {
      'worklet';
      const s = game.value;
      if (!s || s.done || s.paused) return;
      if (s.probe && !s.outcome) {
        // Avance rapide pendant le vol.
        s.speed = s.speed > 1 ? 1 : 3;
        send({ kind: 'haptic', type: 'tick' });
        pushHud(s);
        return;
      }
      if (s.probe || s.outcome) return;
      s.dragging = true;
      s.aimTick = Math.floor(s.aimP * 10);
      aimFrom(e.x, e.y);
      pushHud(s);
    })
    .onUpdate(e => {
      'worklet';
      const s = game.value;
      if (s && s.dragging) aimFrom(e.x, e.y);
    })
    .onFinalize((_e, success) => {
      'worklet';
      const s = game.value;
      if (!s || !s.dragging) return;
      s.dragging = false;
      const L = levelsSV.value[s.lvl];
      // Geste annulé par le système (fermeture de la modale, appel entrant…) : on ne tire pas.
      if (!success || cancelArmed.value || !L || s.paused) {
        cancelArmed.value = false;
        if (success) send({ kind: 'haptic', type: 'tick' });
        pushHud(s);
        return;
      }
      const v = launchVector(L, s);
      s.probe = { x: L.station.x, y: L.station.y, vx: v.vx, vy: v.vy, age: 0, trail: [L.station.x, L.station.y], closest: 1e9, n: 0 };
      s.acc = 0;
      send({ kind: 'haptic', type: 'launch' });
      send({ kind: 'event', event: { type: 'launch', mission: s.lvl, attempt: s.attempts, dv: Math.round(s.aimP * L.maxDv * 100) / 100, angle: Math.round(s.aimA * 1000) / 1000 } });
      pushHud(s);
    }), [aimFrom, cancelArmed, game, levelsSV, pushHud, send]);

  /* ---- API impérative (identique à la WebView) ---- */
  useImperativeHandle(ref, () => ({
    reset: () => scheduleOnUI(() => {
      'worklet';
      const s = createState(Date.now());
      game.value = s;
      resetLevel(s);
    }),
    goTo: (index: number) => scheduleOnUI((i: number) => {
      'worklet';
      const s = ensureState();
      const n = levelsSV.value.length;
      if (!Number.isInteger(i) || i < 0 || i >= n) return;
      s.lvl = i;
      s.attempts = 1;
      s.supply = Math.round((i / n) * 100);
      s.particles = [];
      s.burstAt = -1;
      resetLevel(s);
    }, Number(index) | 0),
    pause: () => { hostPaused.value = true; },
    resume: () => { hostPaused.value = false; },
    requestState: () => scheduleOnUI(() => {
      'worklet';
      const s = ensureState();
      send({ kind: 'event', event: { type: 'state', mission: s.lvl, attempts: s.attempts, supply: s.supply, done: s.done } });
    }),
  }), [ensureState, game, hostPaused, levelsSV, resetLevel, send]);

  /* ---- animations HUD ---- */
  const dvFill = useAnimatedStyle(() => ({ width: `${Math.round(aimPower.value * 100)}%` }));
  const flashOpacity = useSharedValue(0);
  useEffect(() => {
    if (!flash.text) return;
    flashOpacity.value = reducedMotion
      ? withSequence(withTiming(1, { duration: 0 }), withTiming(1, { duration: 900 }), withTiming(0, { duration: 0 }))
      : withSequence(withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 620 }), withTiming(0, { duration: 320 }));
  }, [flash.id, flash.text, flashOpacity, reducedMotion]);
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
    transform: [{ scale: 0.92 + flashOpacity.value * 0.08 }],
  }));

  const L = levels[hud.lvl] ?? levels[0];
  // Un seul conseil à la fois, et aucun pendant la visée ou une fois la série terminée.
  const [fastUsed, setFastUsed] = useState(false);
  useEffect(() => { if (hud.fast) setFastUsed(true); }, [hud.fast]);
  const hint = hud.done || hud.dragging
    ? ''
    : hud.flying
      ? fastUsed ? '' : 'Tap to fast-forward'
      : hud.attempts === 1 && hud.satsLeft === hud.probes ? L?.brief ?? '' : '';
  const toneColor = flash.tone === 'ok' ? P.colony : flash.tone === 'ko' ? P.danger : flash.tone === 'warn' ? P.star : P.ink;

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: P.void }, style]}>
      {/* Tout l'espace est pour le jeu : l'interface du niveau flotte en bas, discrète. */}
      <View style={styles.stage} onLayout={onLayout}>
        <GestureDetector gesture={pan}>
          <View style={StyleSheet.absoluteFill}>
            <Canvas style={StyleSheet.absoluteFill}>
              <Picture picture={picture} />
            </Canvas>
          </View>
        </GestureDetector>
        {hud.fast && hud.flying ? (
          <View pointerEvents="none" style={[styles.speed, { borderColor: P.trace }]}>
            <Text style={[styles.speedText, { color: P.trace }]}>×3</Text>
          </View>
        ) : null}
        {hint ? (
          <View pointerEvents="none" style={styles.hint}>
            <Text style={styles.hintText}>{hint}</Text>
          </View>
        ) : null}
        <Animated.View pointerEvents="none" style={[styles.flash, flashStyle]}>
          <Text accessibilityLiveRegion="polite" style={[styles.flashText, { color: toneColor }]}>{flash.text}</Text>
        </Animated.View>

        {showHud ? (
          <View pointerEvents="none" style={styles.hud}>
            {hud.dragging ? (
              <View style={[styles.track, styles.powerTrack, { backgroundColor: P.line }]}>
                <Animated.View style={[styles.fill, { backgroundColor: P.trace }, dvFill]} />
              </View>
            ) : null}
            <View style={styles.hudRow}>
              <Text numberOfLines={1} style={[styles.levelText, { color: P.dim }]}>{L?.sequence ? `${L.sequence.toLocaleString('en-US')}` : `${hud.lvl + 1}/${levels.length}`}</Text>
              <View style={styles.dots}>
                {levels.map((_, i) => (
                  <View key={i} style={[styles.dot, { backgroundColor: i < hud.lvl || hud.done ? P.star : i === hud.lvl ? P.trace : P.line }]} />
                ))}
              </View>
              {hud.probes > 1 ? (
                <View accessible accessibilityLabel={`${hud.satsLeft} satellites left, ${hud.reached} of ${hud.beacons} beacons reached`} style={styles.sats}>
                  {Array.from({ length: hud.probes }, (_, i) => (
                    <View key={i} style={[styles.sat, { borderColor: P.trace }, i < hud.satsLeft && { backgroundColor: P.trace }]} />
                  ))}
                </View>
              ) : hud.attempts > 1 ? <Text style={[styles.levelText, { color: P.dim }]}>×{hud.attempts}</Text> : <View />}
            </View>
          </View>
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
});

const styles = StyleSheet.create({
  hud: { position: 'absolute', left: 12, right: 12, bottom: 10, gap: 6 },
  hudRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: 'rgba(11,13,26,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  levelText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, fontVariant: ['tabular-nums'], minWidth: 40 },
  powerTrack: { height: 3, marginHorizontal: 40 },
  sats: { flexDirection: 'row', gap: 4, minWidth: 40, justifyContent: 'flex-end' },
  sat: { width: 8, height: 8, borderRadius: 2, borderWidth: 1, transform: [{ rotate: '45deg' }] },
  root: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 16, zIndex: 3 },
  barTop: { borderBottomWidth: StyleSheet.hairlineWidth },
  barBottom: { borderTopWidth: StyleSheet.hairlineWidth },
  mission: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', letterSpacing: -0.3 },
  gauge: { width: 96, gap: 5 },
  gaugeLabel: { fontSize: 10, letterSpacing: 1.4 },
  track: { height: 4, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  stage: { flex: 1, minHeight: 0, overflow: 'hidden' },
  hint: { position: 'absolute', left: 12, right: 12, top: 12, alignItems: 'center' },
  hintText: { color: '#D8D0EB', fontSize: 11, letterSpacing: 0.3, textAlign: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 9, overflow: 'hidden', backgroundColor: 'rgba(11,13,26,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  flash: { position: 'absolute', left: 0, right: 0, top: '44%', alignItems: 'center' },
  flashText: { fontSize: 20, fontWeight: '700', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 18, textShadowOffset: { width: 0, height: 2 } },
  speed: { position: 'absolute', top: 12, right: 12, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  speedText: { fontSize: 11, fontWeight: '700' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 16, height: 4, borderRadius: 3 },
  attempts: { marginLeft: 'auto', fontSize: 10, letterSpacing: 1.4, fontVariant: ['tabular-nums'] },
});

export default OrbitalHook;
export { LEVELS, PALETTE };
export type { Level, Palette };
export type { OrbitalEvent, OrbitalHookHandle, OrbitalHookProps };
