import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { BackHandler, Modal, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, ChevronLeft, ChevronRight, Expand, Minus, Plus, RotateCcw, Send, X, Zap } from 'lucide-react-native';
import { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Text } from '@/components/astralys-text';
import { AstralysMark } from '@/components/astralys-mark';
import { GuardianScene3D, type GuardianCameraView, type GuardianSceneControls } from '@/components/guardian-scene-3d';
import { GuardianRelayMenu } from '@/components/guardian-relay-menu';
import { ObservatoryButton, ObservatoryPressable } from '@/components/observatory-button';
import { Observatory as theme, navigationClearance } from '@/constants/observatory-theme';
import { useMotionPreferences } from '@/context/motion-context';
import { createGuardianDemo, guardianDemoReducer, navigableDemoPlanets, nextDemoPlanet, probeCost, type DemoPlanet } from '@/features/guardian-demo-model';

export function GuardianDemo({ onClose }: { onClose: () => void }) {
  const [state, dispatch] = useReducer(guardianDemoReducer, undefined, createGuardianDemo);
  const [planet, setPlanet] = useState<DemoPlanet>('c');
  const [panel, setPanel] = useState<'system' | 'relay'>('system');
  const [resetKey, setResetKey] = useState(0);
  const [focused, setFocused] = useState(false);
  const [cameraView, setCameraView] = useState<GuardianCameraView>('overview');
  const [controlsOpen, setControlsOpen] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  const lastAnimatedCollection = useRef(0);
  const scene = useRef<GuardianSceneControls>(null);
  const { reducedMotion, foreground } = useMotionPreferences();
  const insets = useSafeAreaInsets();
  const transfer = useSharedValue(1);
  const showOverview = useCallback(() => { scene.current?.overview(); setCameraView('overview'); }, []);
  const goBack = useCallback(() => {
    if (panel === 'relay') { setPanel('system'); setCameraView('overview'); }
    else if (cameraView !== 'overview') showOverview();
    else onClose();
  }, [panel, cameraView, showOverview, onClose]);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => { setFocused(false); listener.remove(); };
  }, [goBack]));
  useEffect(() => {
    cancelAnimation(transfer);
    const newCollection = state.collectionId !== lastAnimatedCollection.current;
    lastAnimatedCollection.current = state.collectionId;
    if (newCollection && state.collectionId && !reducedMotion && foreground && focused) {
      transfer.value = 0;
      transfer.value = withTiming(1, { duration: 850, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System });
    } else transfer.value = 1;
    return () => cancelAnimation(transfer);
  }, [state.collectionId, foreground, focused, reducedMotion, transfer]);
  const transferStyle = useAnimatedStyle(() => ({ opacity: Math.sin(transfer.value * Math.PI), transform: [{ translateY: -32 * transfer.value }] }));
  const connected = state.connected.includes(planet), frontier = nextDemoPlanet(state.connected);
  const explorationCost = probeCost(planet);
  const explorationLabel = explorationCost >= 1000 ? `${explorationCost / 1000}k` : String(explorationCost);
  const available = navigableDemoPlanets(state.connected), position = available.indexOf(planet);
  const selectPlanet = useCallback((p: DemoPlanet) => { setPlanet(p); scene.current?.focusPlanet(p); }, []);
  const reset = () => { dispatch({ type: 'reset' }); setPlanet('c'); setPanel('system'); setControlsOpen(false); setCameraView('overview'); setResetKey(k => k + 1); transfer.value = 1; };
  const energyReadout = <View style={styles.balance}><Zap size={16} color={theme.primary} /><Text accessibilityLabel={`${state.energy} energy available`} style={styles.energyValue}>{state.energy}</Text></View>;

  return <View style={[styles.screen, { paddingTop: insets.top + 4, paddingBottom: navigationClearance(insets.bottom) }]}>
    <View style={styles.header}>
      <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel={panel === 'relay' ? 'Back to my system' : cameraView !== 'overview' ? 'Back to system overview' : 'Exit guardian demo'} onPress={goBack} style={styles.iconButton}><ChevronLeft size={24} color={theme.text} /></ObservatoryPressable>
      <View accessible accessibilityLabel="Astralys" style={styles.brand}><AstralysMark size={40} /><Text maxFontSizeMultiplier={1.2} style={styles.wordmark}>ASTRALYS</Text></View>
      <View style={styles.headerSpacer} />
    </View>
    {panel === 'system' ? <View style={styles.pageHeading}><Text accessibilityRole="header" style={styles.title}>TRAPPIST-1</Text><Text style={styles.pageSubtitle}>My system</Text></View> : null}
    {panel === 'system' ? <View style={styles.systemContent}><View style={styles.sceneShell}>
      <GuardianScene3D ref={scene} mode="system" selected={planet} connected={state.connected} relayLevel={state.relayLevel} resetKey={resetKey} onSelect={selectPlanet} onViewChange={setCameraView} />
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View pointerEvents="box-none" style={styles.topHud}>
          <View style={styles.cameraTools}>
            <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Zoom in" onPress={() => scene.current?.zoom(0.8)} style={styles.cameraButton}><Plus size={18} color={theme.text} /></ObservatoryPressable>
            <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Zoom out" onPress={() => scene.current?.zoom(1.25)} style={styles.cameraButton}><Minus size={18} color={theme.text} /></ObservatoryPressable>
            <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Show the entire explored system" onPress={showOverview} style={styles.cameraButton}><Expand size={18} color={theme.text} /></ObservatoryPressable>
          </View>
        </View>
      </View>
      <Text pointerEvents="none" style={styles.sceneHint}>{cameraView === 'overview' ? 'Tap a planet to approach' : 'Drag to move · pinch to zoom'}</Text>
    </View><Text style={styles.simulationCaption}>Illustrative view · Simulation</Text><View style={styles.bottomHud}>
          <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Open planet controls and exploration" accessibilityState={{ expanded: controlsOpen }} onPress={() => setControlsOpen(true)} style={styles.handleButton}><View style={styles.handle} /></ObservatoryPressable>
          <View style={[styles.contextRow, stacked && styles.contextStack]}>
            <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel={`TRAPPIST-1 ${planet}. ${connected ? 'Probe connected' : 'Probe not connected'}. Open planet controls`} onPress={() => setControlsOpen(true)} style={styles.planetIdentity}><Text style={styles.planetName}>TRAPPIST-1 {planet}</Text><View style={styles.connectionRow}><View style={[styles.statusDot, !connected && styles.pendingDot]} /><Text style={[styles.connectionText, !connected && styles.pendingText]}>{connected ? 'Probe connected' : 'Probe not connected'}</Text></View></ObservatoryPressable>
            <ObservatoryPressable variant="primary" accessibilityRole="button" accessibilityLabel="Open satellite relay and upgrades" onPress={() => setPanel('relay')} style={[styles.relayShortcut, stacked && styles.stackedRelay]}><Text style={styles.relayButtonText}>Satellite relay</Text><ArrowRight size={18} color={theme.onPrimary} /></ObservatoryPressable>
          </View>
        </View></View> : <GuardianRelayMenu state={state} resetKey={resetKey} onAction={dispatch} onBack={goBack} transferStyle={transferStyle} />}
    <Modal visible={controlsOpen} transparent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={() => setControlsOpen(false)}>
      <View style={styles.modalRoot}>
        <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Dismiss planet controls" onPress={() => setControlsOpen(false)} style={styles.scrim} />
        <View accessibilityViewIsModal style={[styles.controlsSheet, { paddingBottom: Math.max(insets.bottom, 16), maxHeight: '85%' }]}>
          <View style={styles.row}><Text accessibilityRole="header" style={styles.cardTitle}>Planet controls</Text><ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Close planet controls" onPress={() => setControlsOpen(false)} style={styles.iconButton}><X size={22} color={theme.text} /></ObservatoryPressable></View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.controlsContent}>
          <View style={styles.row}>{energyReadout}<Text style={styles.caption}>{state.connected.length} / 7 explored · Lv {state.relayLevel}</Text></View>
          <ScrollView horizontal style={styles.planetStripViewport} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planetStrip}>{available.map(p => <ObservatoryPressable key={p} variant="quiet" accessibilityRole="button" accessibilityLabel={`Approach TRAPPIST-1 ${p}`} accessibilityState={{ selected: planet === p }} onPress={() => { selectPlanet(p); setControlsOpen(false); }} style={styles.planetChip}><Text style={[styles.planetChipText, planet === p && styles.planetChipSelected]}>{p}</Text>{planet === p ? <View style={styles.planetUnderline} /> : null}</ObservatoryPressable>)}</ScrollView>
          <View style={styles.navigator}>
            <ObservatoryPressable accessibilityRole="button" accessibilityLabel="Previous explored planet" disabled={position <= 0} onPress={() => selectPlanet(available[position - 1])} style={styles.planetArrow}><ChevronLeft size={22} color={theme.primary} /></ObservatoryPressable>
            <View style={styles.planetIdentity}><Text style={styles.controlsPlanetName}>TRAPPIST-1 {planet}</Text><Text style={styles.caption}>{connected ? 'Probe connected' : state.energy < explorationCost ? `Need ${(explorationCost - state.energy).toLocaleString('en-US')} energy` : 'Ready to explore'}</Text></View>
            <ObservatoryPressable accessibilityRole="button" accessibilityLabel="Next available planet" disabled={position >= available.length - 1} onPress={() => selectPlanet(available[position + 1])} style={styles.planetArrow}><ChevronRight size={22} color={theme.primary} /></ObservatoryPressable>
          </View>
          {!connected ? <ObservatoryButton label={`Send probe · ${explorationLabel}`} icon={Send} disabled={planet !== frontier || state.energy < explorationCost} onPress={() => dispatch({ type: 'probe', planet })} accessibilityLabel={`Explore TRAPPIST-1 ${planet} for ${explorationCost} energy`} /> : null}
          <Text accessibilityLiveRegion="polite" style={styles.message}>{state.message}</Text>
          <ObservatoryButton variant="quiet" label="Reset demo" icon={RotateCcw} onPress={reset} />
          <Text style={styles.disclaimer}>Demo · fictional gameplay · not to scale</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background }, header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }, iconButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, headerSpacer: { width: 48 }, brand: { flexDirection: 'row', alignItems: 'center', gap: 5 }, wordmark: { color: theme.text, fontSize: 15, letterSpacing: 3, fontWeight: '500' }, pageHeading: { paddingHorizontal: 24, paddingTop: 16, gap: 4 }, title: { color: theme.text, fontSize: 26, lineHeight: 34, fontWeight: '600' }, pageSubtitle: { color: theme.muted, fontSize: 14, lineHeight: 21 },
  systemContent: { flex: 1 }, sceneShell: { flex: 1, minHeight: 100, position: 'relative' },
  sceneHint: { position: 'absolute', bottom: 10, left: 12, right: 12, textAlign: 'center', color: theme.muted, fontSize: 11, lineHeight: 17 },
  topHud: { position: 'absolute', top: '28%', right: 16 }, balance: { flexDirection: 'row', alignItems: 'center', gap: 5 }, energyValue: { color: theme.text, fontSize: 21, fontWeight: '600' }, caption: { color: theme.muted, fontSize: 12, lineHeight: 18 }, cameraTools: { gap: 8 }, cameraButton: { width: 48, minHeight: 48, backgroundColor: 'rgba(15,19,30,0.85)', alignItems: 'center', justifyContent: 'center' },
  simulationCaption: { textAlign: 'right', color: '#858EA3', fontSize: 10, lineHeight: 16, paddingHorizontal: 24, paddingBottom: 8 },
  bottomHud: { marginHorizontal: 14, paddingHorizontal: 16, paddingBottom: 18, backgroundColor: '#0F131D', borderRadius: 24, flexShrink: 0 }, handleButton: { width: 64, minHeight: 48, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }, handle: { height: 3, width: 30, borderRadius: 2, backgroundColor: '#3B4050' }, contextRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, contextStack: { flexDirection: 'column', alignItems: 'stretch' }, connectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#9CCCB7' }, pendingDot: { backgroundColor: theme.muted }, connectionText: { color: '#9CCCB7', fontSize: 11, lineHeight: 17, flexShrink: 1 }, pendingText: { color: theme.muted },
  planetStripViewport: { height: 48, flexGrow: 0 }, planetStrip: { flexGrow: 1, justifyContent: 'center' }, planetChip: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 4 }, planetChipText: { color: theme.muted, fontSize: 16 }, planetChipSelected: { color: theme.text, fontWeight: '600' }, planetUnderline: { height: 3, width: 18, borderRadius: 2, backgroundColor: theme.primary },
  relayTransfer: { position: 'absolute', right: 4, bottom: -12 },
  relayShortcut: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, flexShrink: 1 }, stackedRelay: { width: '100%' }, relayButtonText: { color: theme.onPrimary, fontSize: 12, lineHeight: 18, fontWeight: '600', flexShrink: 1 },
  navigator: { flexDirection: 'row', minHeight: 64, alignItems: 'center', gap: 2 }, planetArrow: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, planetIdentity: { flex: 1, minWidth: 0, minHeight: 48, justifyContent: 'center', gap: 5 }, planetName: { color: theme.text, fontSize: 17, lineHeight: 24, fontWeight: '600' }, controlsPlanetName: { color: theme.text, fontSize: 14, fontWeight: '600' }, harvestHud: { flexDirection: 'row', gap: 8 }, collect: { flex: 1, minHeight: 48, paddingVertical: 10 }, timeButton: { width: 52, minHeight: 48, backgroundColor: 'rgba(15,19,30,0.92)', alignItems: 'center', justifyContent: 'center' }, timeText: { color: theme.primary, fontSize: 12 }, message: { color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', minHeight: 18 }, disclaimer: { color: '#858EA3', fontSize: 10, lineHeight: 14, textAlign: 'center', paddingVertical: 4 }, transferText: { color: theme.primary, fontSize: 22, fontWeight: '600' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' }, scrim: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.65)' }, controlsSheet: { backgroundColor: '#0F131D', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12 }, controlsContent: { gap: 12, paddingBottom: 8 },
  relayContent: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 10, gap: 12 }, relayScene: { height: 210, position: 'relative' }, relayTag: { position: 'absolute', bottom: 2, left: 0, right: 0, alignItems: 'center' }, relayStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }, statValue: { color: theme.text, fontSize: 23, lineHeight: 30, fontWeight: '500' }, upgradeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10141F', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 10, gap: 10 }, upgradeCopy: { flex: 1, minWidth: 0, gap: 4 }, cardTitle: { color: theme.text, fontSize: 12, fontWeight: '600' }, upgradeAction: { paddingHorizontal: 9, maxWidth: '36%' }, storagePanel: { gap: 10, marginTop: 'auto' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, progressTrack: { height: 3, backgroundColor: '#202337', borderRadius: 2, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: theme.primary },
});
