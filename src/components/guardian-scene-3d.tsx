import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useFocusEffect } from 'expo-router';
import { Text } from '@/components/astralys-text';
import { useMotionPreferences } from '@/context/motion-context';
import { navigableDemoPlanets, nextDemoPlanet, type DemoPlanet } from '@/features/guardian-demo-model';

/** Planètes que la vue d'ensemble doit cadrer : les accessibles + la prochaine, encore voilée. */
const framedPlanets = (connected: readonly DemoPlanet[]) => {
  const next = nextDemoPlanet(connected);
  return next ? [...navigableDemoPlanets(connected), next] : navigableDemoPlanets(connected);
};
import { adjustRelayInspection, bodiesAt, clamp, scenePlanets, dragRelayInspection, focusedCamera, initialRelayInspection, minimumCameraDistance, overviewCamera, panCamera, pickPlanet, pickComet, cometPosition, type SceneComet, type SceneBodyLike, relayOverviewDistance, relayZoomDistance, type SceneCamera } from '@/features/guardian-scene';
import { createGuardianRenderer, type RenderScene } from '@/features/guardian-gl-renderer';
import type { SystemDefinition } from '@/features/system-definition';

export type GuardianSceneControls = { focusPlanet: (planet: DemoPlanet) => void; overview: () => void; zoom: (factor: number) => void; rotate: (yaw: number, pitch: number) => void };
export type GuardianCameraView = 'overview' | 'focused' | 'manual';
type Props = { mode: 'system' | 'relay'; selected: DemoPlanet; connected: readonly DemoPlanet[]; relayLevel: number; resetKey: number; onSelect: (planet: DemoPlanet) => void; onViewChange?: (view: GuardianCameraView) => void; paused?: boolean; probeTarget?: DemoPlanet | null; probeProgress?: number;
  /** Système construit depuis la base (planètes, étoile). Absent : système de démonstration. */
  system?: SystemDefinition | null;
  /** Comète de passage : elle traverse la scène, et la toucher appelle onCometPress. */
  comet?: SceneComet | null; onCometPress?: (point: { x: number; y: number }) => void;
  /** Essaim de drones (anneau parasite) autour d'une planète. */
  swarm?: { planet: DemoPlanet; stage: number; length: number } | null };
const touchInfo = (event: GestureResponderEvent) => {
  const touches = event.nativeEvent.touches, first = touches[0], second = touches[1];
  return { count: touches.length, x: first ? (first.pageX + (second?.pageX ?? first.pageX)) / 2 : 0,
    y: first ? (first.pageY + (second?.pageY ?? first.pageY)) / 2 : 0,
    distance: first && second ? Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY) : 0 };
};

// memo : l'écran parent se redessine souvent (comptes à rebours) ; la scène ne suit que si ses props changent.
export const GuardianScene3D = memo(forwardRef<GuardianSceneControls, Props>(function GuardianScene3D(props, ref) {
  const { reducedMotion, foreground } = useMotionPreferences();
  const [focused, setFocused] = useState(false);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const renderer = useRef<ReturnType<typeof createGuardianRenderer> | null>(null);
  const scene = useRef<RenderScene>({ mode: props.mode, camera: { x: 0, z: 0, distance: 16 }, selected: props.selected, connected: props.connected, relayLevel: props.relayLevel, time: 0 });
  const target = useRef<SceneCamera>({ x: 0, z: 0, distance: 16 });
  const runtime = useRef({ mounted: true, active: false, animated: false, overview: true, frame: null as number | null, lastTime: 0,
    // Geste en cours, inertie après le lâcher, et préférence « réduire les animations ».
    interacting: false, reduce: false, vx: 0, vz: 0, lastX: 0, lastZ: 0, lastMoveAt: 0,
    // Planète que la caméra suit pendant qu'elle tourne autour de l'étoile.
    followed: null as DemoPlanet | null });
  const gesture = useRef({ count: 0, x: 0, y: 0, pinch: 0, localX: 0, localY: 0, moved: false, camera: { x: 0, z: 0, distance: 16 }, relayView: initialRelayInspection() });
  const cameraView = useRef<GuardianCameraView>('overview');
  // Planètes du système affiché, partagées par le rendu, la caméra et la sélection au toucher.
  const bodies = useRef(props.system?.bodies);
  const onCometPress = useRef(props.onCometPress);
  onCometPress.current = props.onCometPress;
  bodies.current = props.system?.bodies;
  /** Planètes à leur position actuelle sur leur orbite. */
  const movedBodies = useCallback(() => bodiesAt<SceneBodyLike>(bodies.current ?? scenePlanets, scene.current.orbitClock), []);
  const changeView = useCallback((view: GuardianCameraView) => {
    cameraView.current = view; props.onViewChange?.(view);
  }, [props.onViewChange]);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => {
      runtime.current.active = false;
      if (runtime.current.frame !== null) cancelAnimationFrame(runtime.current.frame);
      runtime.current.frame = null;
      setFocused(false);
    };
  }, []));

  const requestRender = useCallback(() => {
    const state = runtime.current;
    if (!state.mounted || !state.active || !renderer.current || state.frame !== null) return;
    const frame = (timestamp: number) => {
      state.frame = null;
      if (!state.mounted || !state.active || !renderer.current) return;
      const camera = scene.current.camera, goal = target.current;
      const coasting = state.vx !== 0 || state.vz !== 0;
      const moving = Math.abs(goal.x - camera.x) + Math.abs(goal.z - camera.z) + Math.abs(goal.distance - camera.distance) > 0.001;
      // 60 i/s pendant un geste, l'inertie ou un vol de caméra ; ~30 i/s au repos pour économiser la batterie.
      if (state.animated && !state.interacting && !coasting && !moving && state.lastTime && timestamp - state.lastTime < 32) { state.frame = requestAnimationFrame(frame); return; }
      const dt = state.lastTime ? Math.min(0.05, Math.max(0.001, (timestamp - state.lastTime) / 1000)) : 1 / 60;
      state.lastTime = timestamp;
      if (coasting) {
        // Inertie : la caméra continue sur sa lancée et ralentit doucement.
        const nx = clamp(goal.x + state.vx * dt, -10, 10), nz = clamp(goal.z + state.vz * dt, -10, 10);
        if (nx === goal.x + state.vx * dt) state.vx *= Math.exp(-dt * 3.2); else state.vx = 0;
        if (nz === goal.z + state.vz * dt) state.vz *= Math.exp(-dt * 3.2); else state.vz = 0;
        goal.x = nx; goal.z = nz; camera.x = nx; camera.z = nz;
        if (Math.hypot(state.vx, state.vz) < 0.04) { state.vx = 0; state.vz = 0; }
      }
      const factor = state.animated ? 1 - Math.exp(-dt * 8) : 1;
      camera.x += (goal.x - camera.x) * factor; camera.z += (goal.z - camera.z) * factor; camera.distance += (goal.distance - camera.distance) * factor;
      if (state.animated) { scene.current.time += dt; scene.current.orbitClock = Date.now() / 1000; }
      // Caméra centrée sur une planète : elle l'accompagne sur son orbite.
      if (state.followed && !state.interacting && scene.current.mode === 'system') {
        const body = movedBodies().find(b => b.id === state.followed);
        if (body) { goal.x = body.position[0]; goal.z = body.position[2]; }
      }
      try { renderer.current.render(scene.current); }
      catch { setError(true); state.active = false; return; }
      if (state.animated || state.vx !== 0 || state.vz !== 0 || state.interacting) state.frame = requestAnimationFrame(frame);
    };
    state.frame = requestAnimationFrame(frame);
  }, []);
  useLayoutEffect(() => {
    runtime.current.mounted = true;
    return () => {
      const state = runtime.current; state.mounted = false; state.active = false;
      if (state.frame !== null) cancelAnimationFrame(state.frame);
      state.frame = null; renderer.current?.dispose(); renderer.current = null;
    };
  }, []);
  useEffect(() => {
    runtime.current.active = foreground && focused && !props.paused; runtime.current.animated = !reducedMotion && props.mode === 'system'; runtime.current.reduce = reducedMotion;
    scene.current.orbitClock = reducedMotion ? null : Date.now() / 1000; runtime.current.lastTime = 0;
    if (runtime.current.frame !== null) cancelAnimationFrame(runtime.current.frame);
    runtime.current.frame = null; requestRender();
  }, [foreground, focused, reducedMotion, props.mode, props.paused, requestRender]);
  useEffect(() => {
    scene.current.mode = props.mode; scene.current.selected = props.selected; scene.current.connected = props.connected; scene.current.relayLevel = props.relayLevel;
    scene.current.probeTarget = props.probeTarget ?? null; scene.current.probeProgress = props.probeProgress ?? 0;
    scene.current.bodies = props.system?.bodies; scene.current.star = props.system?.star; scene.current.comet = props.comet ?? null; scene.current.swarm = props.swarm ?? null;
    if (runtime.current.overview && props.mode === 'system') target.current = overviewCamera(size.width, size.height, framedPlanets(props.connected), bodies.current);
    requestRender();
  }, [props.mode, props.selected, props.connected, props.relayLevel, props.probeTarget, props.probeProgress, props.system, props.comet, props.swarm, size, requestRender]);
  useEffect(() => {
    runtime.current.overview = true;
    changeView('overview');
    scene.current.relayView = initialRelayInspection();
    target.current = props.mode === 'relay' ? { x: 0, z: 0, distance: relayOverviewDistance(size.width, size.height) } : overviewCamera(size.width, size.height, framedPlanets(scene.current.connected), bodies.current);
    scene.current.camera = { ...target.current }; requestRender();
  }, [size, props.mode, props.resetKey, props.system?.starId, requestRender, changeView]);
  const focusPlanet = useCallback((planet: DemoPlanet) => {
    if (props.mode !== 'system' || !navigableDemoPlanets(scene.current.connected).includes(planet)) return;
    runtime.current.vx = 0; runtime.current.vz = 0;
    runtime.current.overview = false; runtime.current.followed = planet; changeView('focused'); target.current = focusedCamera(planet, size.width, size.height, movedBodies()); requestRender();
  }, [props.mode, requestRender, size, changeView]);
  const overview = useCallback(() => {
    runtime.current.vx = 0; runtime.current.vz = 0;
    runtime.current.overview = true; runtime.current.followed = null; changeView('overview'); scene.current.relayView = initialRelayInspection();
    target.current = props.mode === 'relay' ? { x: 0, z: 0, distance: relayOverviewDistance(size.width, size.height) } : overviewCamera(size.width, size.height, framedPlanets(scene.current.connected), bodies.current); requestRender();
  }, [props.mode, size, changeView, requestRender]);
  const zoom = useCallback((factor: number) => {
    if (!Number.isFinite(factor) || factor <= 0) return;
    runtime.current.overview = false; changeView('manual');
    target.current.distance = props.mode === 'relay' ? relayZoomDistance(target.current.distance * factor) : clamp(target.current.distance * factor, minimumCameraDistance, 40); requestRender();
  }, [props.mode, changeView, requestRender]);
  const rotate = useCallback((yaw: number, pitch: number) => {
    if (props.mode !== 'relay') return;
    scene.current.relayView = adjustRelayInspection(scene.current.relayView ?? initialRelayInspection(), yaw, pitch);
    runtime.current.overview = false; changeView('manual'); requestRender();
  }, [props.mode, changeView, requestRender]);
  useImperativeHandle(ref, () => ({ focusPlanet, overview, zoom, rotate }), [focusPlanet, overview, zoom, rotate]);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => {
      const t = touchInfo(event);
      const rt = runtime.current;
      rt.interacting = true; rt.vx = 0; rt.vz = 0;
      rt.lastX = scene.current.camera.x; rt.lastZ = scene.current.camera.z; rt.lastMoveAt = Date.now();
      target.current = { ...scene.current.camera };
      const first = event.nativeEvent.touches[0];
      gesture.current = { count: t.count, x: t.x, y: t.y, pinch: t.distance, camera: { ...scene.current.camera }, relayView: { ...(scene.current.relayView ?? initialRelayInspection()) },
        localX: event.nativeEvent.locationX + (t.x - (first?.pageX ?? t.x)), localY: event.nativeEvent.locationY + (t.y - (first?.pageY ?? t.y)), moved: t.count > 1 };
    },
    onPanResponderMove: event => {
      const t = touchInfo(event), start = gesture.current;
      if (t.count !== start.count) {
        start.localX += t.x - start.x; start.localY += t.y - start.y;
        start.count = t.count; start.x = t.x; start.y = t.y; start.pinch = t.distance; start.camera = { ...scene.current.camera }; start.relayView = { ...(scene.current.relayView ?? initialRelayInspection()) }; start.moved = true; return;
      }
      const dx = t.x - start.x, dy = t.y - start.y;
      if (Math.hypot(dx, dy) > 6 || t.count > 1) start.moved = true;
      if (!start.moved) return;
      const distance = t.count > 1 && start.pinch > 0 && t.distance > 0 ? start.camera.distance * start.pinch / t.distance : start.camera.distance;
      runtime.current.overview = false; runtime.current.followed = null;
      if (cameraView.current !== 'manual') changeView('manual');
      if (props.mode === 'relay') {
        target.current = { x: 0, z: 0, distance: relayZoomDistance(distance) };
        scene.current.relayView = t.count === 1 ? dragRelayInspection(start.relayView, dx, dy, size.width, size.height) : start.relayView;
      } else {
        target.current = panCamera(start.camera, dx, dy, size.width, size.height, start.localX, start.localY, distance);
        // Vitesse lissée du déplacement, utilisée pour l'inertie au lâcher (un seul doigt).
        const rt = runtime.current, now = Date.now(), elapsed = Math.max(1, now - rt.lastMoveAt) / 1000;
        const ivx = t.count === 1 ? (target.current.x - rt.lastX) / elapsed : 0, ivz = t.count === 1 ? (target.current.z - rt.lastZ) / elapsed : 0;
        rt.vx = rt.vx * 0.4 + ivx * 0.6; rt.vz = rt.vz * 0.4 + ivz * 0.6;
        rt.lastX = target.current.x; rt.lastZ = target.current.z; rt.lastMoveAt = now;
      }
      // Direct manipulation must follow the finger; easing remains for button-driven camera flights.
      scene.current.camera = { ...target.current };
      requestRender();
    },
    onPanResponderRelease: () => {
      const rt = runtime.current;
      rt.interacting = false;
      if (props.mode === 'relay') return;
      const start = gesture.current;
      if (start.moved) {
        // Lancer l'inertie seulement si le doigt bougeait encore au moment du lâcher.
        const speed = Math.hypot(rt.vx, rt.vz);
        if (rt.reduce || Date.now() - rt.lastMoveAt > 90 || speed < 0.35) { rt.vx = 0; rt.vz = 0; }
        else if (speed > 22) { rt.vx *= 22 / speed; rt.vz *= 22 / speed; }
        requestRender();
        return;
      }
      rt.vx = 0; rt.vz = 0;
      // La comète passe avant les planètes : c'est elle qu'on vise quand on la touche.
      const comet = scene.current.comet;
      if (comet && onCometPress.current) {
        const moved = movedBodies();
        const at = cometPosition(comet, scene.current.orbitClock, Math.max(3, ...moved.map(b => b.orbit)));
        if (pickComet(start.localX, start.localY, scene.current.camera, size.width, size.height, at)) { onCometPress.current({ x: start.localX, y: start.localY }); return; }
      }
      // La planète voilée suivante est touchable aussi : elle affiche ce qu'il faut pour la débloquer.
      const planet = pickPlanet(start.localX, start.localY, scene.current.camera, size.width, size.height, framedPlanets(scene.current.connected), movedBodies());
      if (planet) { focusPlanet(planet); props.onSelect(planet); }
    },
    onPanResponderTerminationRequest: () => props.mode !== 'relay', onPanResponderTerminate: () => { gesture.current.moved = true; runtime.current.interacting = false; runtime.current.vx = 0; runtime.current.vz = 0; },
  }), [props.mode, props.onSelect, size, focusPlanet, requestRender, changeView]);
  const createContext = useCallback((gl: ExpoWebGLRenderingContext) => {
    if (!runtime.current.mounted) return;
    try { renderer.current?.dispose(); renderer.current = null; renderer.current = createGuardianRenderer(gl); setReady(true); requestRender(); }
    catch { runtime.current.active = false; setError(true); }
  }, [requestRender]);
  return <View {...responder.panHandlers} accessible={props.mode === 'relay'} accessibilityRole={props.mode === 'relay' ? 'adjustable' : undefined}
    accessibilityLabel={props.mode === 'relay' ? error ? '3D unavailable. Reload the app.' : !ready ? 'Opening your satellite' : '3D satellite. Drag to rotate and pinch to zoom.' : undefined}
    accessibilityState={props.mode === 'relay' ? { busy: !ready && !error, disabled: error } : undefined}
    accessibilityActions={props.mode === 'relay' ? [{ name: 'increment', label: 'Rotate right' }, { name: 'decrement', label: 'Rotate left' }, { name: 'tiltUp', label: 'View from above' }, { name: 'tiltDown', label: 'View from below' }, { name: 'zoomIn', label: 'Zoom in' }, { name: 'zoomOut', label: 'Zoom out' }, { name: 'reset', label: 'Reset satellite view' }] : undefined}
    onAccessibilityAction={event => {
      switch (event.nativeEvent.actionName) {
        case 'increment': rotate(-0.3, 0); break; case 'decrement': rotate(0.3, 0); break;
        case 'tiltUp': rotate(0, 0.25); break; case 'tiltDown': rotate(0, -0.25); break;
        case 'zoomIn': zoom(0.8); break; case 'zoomOut': zoom(1.25); break; case 'reset': overview(); break;
      }
    }} style={styles.surface} onLayout={event => setSize({ width: Math.max(1, event.nativeEvent.layout.width), height: Math.max(1, event.nativeEvent.layout.height) })}>
    <GLView pointerEvents="none" msaaSamples={4} style={StyleSheet.absoluteFill} onContextCreate={createContext} />
    {!ready || error ? <View pointerEvents="none" style={styles.loading}><Text accessibilityLiveRegion="polite" style={styles.loadingText}>{error ? '3D unavailable. Reload the app.' : props.mode === 'relay' ? 'Opening your satellite…' : 'Opening your system…'}</Text></View> : null}
  </View>;
}));
const styles = StyleSheet.create({ surface: { flex: 1, backgroundColor: '#070911' }, loading: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }, loadingText: { color: '#A7B0C5', fontSize: 12 } });
