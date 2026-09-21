import { useCallback, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Check, Expand, Minus, Plus, RotateCcw, X, Zap } from 'lucide-react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Text } from '@/components/astralys-text';
import { GuardianScene3D, type GuardianSceneControls } from '@/components/guardian-scene-3d';
import { ObservatoryButton, ObservatoryPressable } from '@/components/observatory-button';
import { Observatory as theme, navigationClearance } from '@/constants/observatory-theme';
import { useMotionPreferences } from '@/context/motion-context';
import { energyPerHour, nextRelayUpgrade, storageCapacity, type GuardianDemoAction, type GuardianDemoState } from '@/features/guardian-demo-model';

type Props = {
  state: GuardianDemoState;
  resetKey: number;
  onAction: (action: GuardianDemoAction) => void;
  onBack: () => void;
  transferStyle: ReturnType<typeof useAnimatedStyle<{ opacity: number; transform: { translateY: number }[] }>>;
};

export function GuardianRelayMenu({ state, resetKey, onAction, onBack, transferStyle }: Props) {
  const scene = useRef<GuardianSceneControls>(null);
  const fullScene = useRef<GuardianSceneControls>(null);
  const [energyOpen, setEnergyOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const { height, width, fontScale } = useWindowDimensions();
  const stackedHeading = width < 360 || fontScale > 1.2;
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useMotionPreferences();
  const ignoreSelection = useCallback(() => {}, []);
  const upgrade = nextRelayUpgrade(state.relayLevel, state.energy);
  const capacity = storageCapacity(state.relayLevel);

  return <View style={styles.screen}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <View style={styles.headingRow}><Text accessibilityRole="header" style={[styles.title, stackedHeading && { marginRight: 0 }]}>Satellite relay</Text>
          <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel={`${state.energy} energy. Open storage to collect ${state.stored} energy`} onPress={() => setEnergyOpen(true)} style={[styles.balance, stackedHeading && styles.stackedBalance]}>
            <View style={styles.inline}><Zap size={15} color={theme.primary} /><Text style={styles.balanceText}>{state.energy} energy</Text></View>
            {state.stored > 0 ? <Text style={styles.readyText}>{state.stored} ready · Collect</Text> : null}
          </ObservatoryPressable>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.subtitle}>TRAPPIST-1 · Level {state.relayLevel}</Text>
      </View>
      <View style={[styles.hero, { height: Math.max(170, Math.min(300, height - insets.top - 60 - navigationClearance(insets.bottom) - 450)) }]}>
        <GuardianScene3D ref={scene} paused={energyOpen || viewerOpen} mode="relay" selected="c" connected={state.connected} relayLevel={state.relayLevel} resetKey={resetKey} onSelect={ignoreSelection} />
        <View style={styles.viewControls}>
          <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Zoom in on satellite" onPress={() => scene.current?.zoom(0.8)} style={styles.iconButton}><Plus size={18} color={theme.text} /></ObservatoryPressable>
          <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Zoom out from satellite" onPress={() => scene.current?.zoom(1.25)} style={styles.iconButton}><Minus size={18} color={theme.text} /></ObservatoryPressable>
          <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Reset satellite view" onPress={() => scene.current?.overview()} style={styles.iconButton}><RotateCcw size={17} color={theme.text} /></ObservatoryPressable>
          <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Inspect satellite in full screen" onPress={() => setViewerOpen(true)} style={styles.iconButton}><Expand size={18} color={theme.text} /></ObservatoryPressable>
        </View>
      </View>
      <View style={styles.heroCaption}><Text style={styles.hint}>Drag to rotate · pinch to zoom</Text><View style={styles.inline}><View style={styles.statusDot} /><Text style={styles.connected}>Connected</Text></View></View>
      <View style={styles.upgrade}>
        <Text style={styles.overline}>{upgrade ? 'NEXT UPGRADE' : 'RELAY COMPLETE'}</Text>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.upgradeTitle}>{upgrade?.title ?? 'Deep-space relay'}</Text>
        <View style={styles.productionRow}><Text style={styles.caption}>Production</Text><View style={styles.inline}><Text style={styles.oldProduction}>{energyPerHour(state.relayLevel)} / h</Text>{upgrade ? <><ArrowRight size={22} color={theme.primary} /><Text style={styles.newProduction}>{upgrade.production} / h</Text></> : <Check size={22} color={theme.primary} />}</View></View>
        {upgrade ? <>
          <ObservatoryButton label={`Upgrade · ${upgrade.cost}`} disabled={!upgrade.affordable} onPress={() => onAction({ type: 'upgrade' })} accessibilityLabel={`Upgrade to level ${upgrade.level} for ${upgrade.cost} energy. Production ${upgrade.production} per hour; storage ${upgrade.capacity}`} />
          <Text style={styles.upgradeHint}>{upgrade.affordable ? `Storage → ${upgrade.capacity}` : state.stored >= upgrade.missingEnergy ? 'Collect energy first' : `Need ${upgrade.missingEnergy} more energy`}</Text>
        </> : <Text style={styles.upgradeHint}>All upgrades complete · {capacity} capacity</Text>}
      </View>
      <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Back to my system" onPress={onBack} style={styles.backButton}><Text style={styles.backText}>Back to my system</Text><ArrowRight size={19} color={theme.primary} /></ObservatoryPressable>
      <Text style={styles.disclaimer}>Simulation · illustrative 3D</Text>
    </ScrollView>
    <Modal visible={viewerOpen} animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={() => setViewerOpen(false)}>
      {viewerOpen ? <View style={[styles.fullViewer, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.sheetHeading}><Text accessibilityRole="header" style={styles.upgradeTitle}>Satellite · Level {state.relayLevel}</Text><ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Close satellite viewer" onPress={() => setViewerOpen(false)} style={styles.iconButton}><X size={22} color={theme.text} /></ObservatoryPressable></View>
        <GuardianScene3D ref={fullScene} mode="relay" selected="c" connected={state.connected} relayLevel={state.relayLevel} resetKey={resetKey} onSelect={ignoreSelection} />
        <Text style={styles.hint}>Drag to rotate · pinch to zoom</Text>
        <View style={styles.fullToolbar}>
          <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Rotate satellite left" onPress={() => fullScene.current?.rotate(0.3, 0)} style={styles.iconButton}><RotateCcw size={20} color={theme.primary} /></ObservatoryPressable>
          <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Zoom in" onPress={() => fullScene.current?.zoom(0.8)} style={styles.iconButton}><Plus size={20} color={theme.text} /></ObservatoryPressable>
          <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Zoom out" onPress={() => fullScene.current?.zoom(1.25)} style={styles.iconButton}><Minus size={20} color={theme.text} /></ObservatoryPressable>
          <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Reset satellite view" onPress={() => fullScene.current?.overview()} style={styles.iconButton}><Expand size={20} color={theme.text} /></ObservatoryPressable>
        </View>
        <Text style={styles.disclaimer}>Illustrative 3D · Simulation</Text>
      </View> : null}
    </Modal>
    <Modal visible={energyOpen} transparent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={() => setEnergyOpen(false)}>
      <View style={styles.modalRoot}>
        <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Dismiss energy storage" onPress={() => setEnergyOpen(false)} style={styles.scrim} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.sheetHeading}><Text accessibilityRole="header" style={styles.upgradeTitle}>Energy & storage</Text><ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Close energy storage" onPress={() => setEnergyOpen(false)} style={styles.iconButton}><X size={22} color={theme.text} /></ObservatoryPressable></View>
          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            <View style={styles.sheetStats}><View><Text style={styles.newProduction}>{state.energy}</Text><Text style={styles.caption}>Available</Text></View><View><Text style={styles.newProduction}>{state.stored} / {capacity}</Text><Text style={styles.caption}>Stored</Text></View></View>
            <View accessibilityRole="progressbar" accessibilityLabel="Relay energy storage" accessibilityValue={{ min: 0, max: capacity, now: state.stored }} style={styles.track}><View style={[styles.fill, { width: `${state.stored / capacity * 100}%` }]} /></View>
            <Text style={styles.caption}>Production · {energyPerHour(state.relayLevel)} / h</Text>
            <ObservatoryButton label={state.stored ? `Collect · ${state.stored}` : 'No energy ready'} icon={Zap} disabled={!state.stored} onPress={() => onAction({ type: 'collect' })} />
            <ObservatoryButton label="+6 demo hours" variant="quiet" onPress={() => onAction({ type: 'advance' })} />
            <Text accessibilityLiveRegion="polite" style={styles.message}>{state.message}</Text>
            <Text style={styles.disclaimer}>Demo · fictional gameplay · no real purchases</Text>
          </ScrollView>
          <Animated.View pointerEvents="none" accessibilityElementsHidden style={[styles.transfer, transferStyle]}><Text style={styles.newProduction}>+{state.lastCollected}</Text></Animated.View>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, gap: 8, width: '100%', maxWidth: 520, alignSelf: 'center' },
  heading: { gap: 4 }, headingRow: { position: 'relative' }, title: { color: theme.text, fontSize: 24, lineHeight: 34, fontWeight: '600', marginRight: 100 }, subtitle: { color: theme.muted, fontSize: 14, lineHeight: 21 },
  balance: { position: 'absolute', right: 0, top: -7, minHeight: 48, justifyContent: 'center', alignItems: 'flex-end', gap: 2 }, balanceText: { color: theme.muted, fontSize: 12, lineHeight: 18 }, readyText: { color: theme.primary, fontSize: 10, lineHeight: 16 }, inline: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  stackedBalance: { position: 'relative', top: 0, alignSelf: 'flex-start', alignItems: 'flex-start' },
  hero: { position: 'relative', marginHorizontal: -8 }, viewControls: { position: 'absolute', right: 0, bottom: 0, flexDirection: 'row', gap: 6 }, iconButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,19,29,0.85)' },
  heroCaption: { alignItems: 'center', gap: 4, paddingBottom: 6 }, hint: { color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' }, connected: { color: theme.muted, fontSize: 14, lineHeight: 21 }, statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#9CCCB7' },
  upgrade: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingTop: 16, gap: 8 }, overline: { color: theme.primary, fontSize: 11, lineHeight: 17, letterSpacing: 2, fontWeight: '500' }, upgradeTitle: { color: theme.text, fontSize: 21, lineHeight: 28, fontWeight: '600' },
  productionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border, paddingVertical: 10, marginBottom: 4 }, caption: { color: theme.muted, fontSize: 14, lineHeight: 21 }, oldProduction: { color: theme.muted, fontSize: 21, lineHeight: 32 }, newProduction: { color: theme.primary, fontSize: 21, lineHeight: 32, fontWeight: '500' },
  upgradeHint: { color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' }, message: { color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' }, backButton: { minHeight: 48, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' }, backText: { color: theme.primary, fontSize: 14, lineHeight: 21 }, disclaimer: { color: '#858EA3', fontSize: 10, lineHeight: 16, textAlign: 'center', paddingBottom: 6 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' }, scrim: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.65)' }, sheet: { backgroundColor: '#0F131D', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, maxHeight: '85%' }, sheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, sheetContent: { gap: 16, paddingTop: 16, paddingBottom: 8 }, sheetStats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }, track: { height: 3, borderRadius: 2, backgroundColor: '#252D3E', overflow: 'hidden' }, fill: { height: '100%', backgroundColor: theme.primary }, transfer: { position: 'absolute', right: 24, top: 64 },
  fullViewer: { flex: 1, backgroundColor: theme.background, paddingHorizontal: 20, gap: 12 }, fullToolbar: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
});
