import { useCallback, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Check, Expand, Minus, Plus, RotateCcw, X, Zap } from 'lucide-react-native';
import { Text } from '@/components/astralys-text';
import { GuardianScene3D, type GuardianSceneControls } from '@/components/guardian-scene-3d';
import { ObservatoryButton, ObservatoryPressable } from '@/components/observatory-button';
import { Observatory as theme, navigationClearance } from '@/constants/observatory-theme';
import { useMotionPreferences } from '@/context/motion-context';
import { energyPerHour, nextChannelQuota, nextRelayUpgrade, relayChannelCount, stateEnergyPerHour, type GuardianDemoAction, type GuardianDemoState } from '@/features/guardian-demo-model';

type Props = {
  state: GuardianDemoState;
  systemName: string;
  resetKey: number;
  onAction: (action: GuardianDemoAction) => void;
  onBack: () => void;
};

export function GuardianRelayMenu({ state, systemName, resetKey, onAction, onBack }: Props) {
  const scene = useRef<GuardianSceneControls>(null);
  const fullScene = useRef<GuardianSceneControls>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const { height, width, fontScale } = useWindowDimensions();
  const stackedHeading = width < 360 || fontScale > 1.2;
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useMotionPreferences();
  const ignoreSelection = useCallback(() => {}, []);
  const channels = relayChannelCount(state.connected.length);
  const quota = nextChannelQuota(state.connected.length);
  const hourlyProduction = energyPerHour(state.relayLevel, channels);
  const totalProduction = stateEnergyPerHour(state);
  const upgrade = nextRelayUpgrade(state.relayLevel, state.energy, channels);

  return <View style={styles.screen}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <View style={styles.headingRow}>
          <Text accessibilityRole="header" style={[styles.title, stackedHeading && { marginRight: 0 }]}>Satellite relay</Text>
          <View accessible accessibilityLabel={`${state.energy} energy. ${totalProduction} produced per hour by the relay and your planets`} style={[styles.balance, stackedHeading && styles.stackedBalance]}>
            <View style={styles.inline}><Zap size={15} color={theme.primary} /><Text style={styles.balanceText}>{state.energy} energy</Text></View>
            <Text style={styles.readyText}>+{totalProduction} / hour · relay + planets</Text>
          </View>
        </View>
        <Text accessibilityLiveRegion="polite" numberOfLines={1} style={styles.subtitle}>{systemName} · Level {state.relayLevel}</Text>
      </View>

      <View style={[styles.hero, { height: Math.max(220, Math.min(380, height - insets.top - 60 - navigationClearance(insets.bottom) - 330)) }]}>
        <GuardianScene3D ref={scene} paused={viewerOpen} mode="relay" selected="c" connected={state.connected} relayLevel={state.relayLevel} resetKey={resetKey} onSelect={ignoreSelection} />
        <View style={styles.viewControls}>
          <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Zoom in on satellite" onPress={() => scene.current?.zoom(0.8)} style={styles.iconButton}><Plus size={18} color={theme.text} /></ObservatoryPressable>
          <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Zoom out from satellite" onPress={() => scene.current?.zoom(1.25)} style={styles.iconButton}><Minus size={18} color={theme.text} /></ObservatoryPressable>
          <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Reset satellite view" onPress={() => scene.current?.overview()} style={styles.iconButton}><RotateCcw size={17} color={theme.text} /></ObservatoryPressable>
          <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Inspect satellite in full screen" onPress={() => setViewerOpen(true)} style={styles.iconButton}><Expand size={18} color={theme.text} /></ObservatoryPressable>
        </View>
      </View>

      <View style={styles.heroCaption}>
        <Text style={styles.channelCaption}>{channels} {channels === 1 ? 'channel' : 'channels'} · {quota === null ? 'all active' : `${state.connected.length}/${quota} planets to next`}</Text>
      </View>

      <View style={styles.upgrade}>
        <Text style={styles.overline}>{upgrade ? 'NEXT UPGRADE' : 'RELAY COMPLETE'}</Text>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.upgradeTitle}>{upgrade?.title ?? 'Deep-space relay'}</Text>
        <View style={styles.productionRow}>
          <Text style={styles.caption}>Relay production</Text>
          <View style={styles.inline}>
            <Text style={styles.oldProduction}>{hourlyProduction} / h</Text>
            {upgrade ? <><ArrowRight size={22} color={theme.primary} /><Text style={styles.newProduction}>{upgrade.production} / h</Text></> : <Check size={22} color={theme.primary} />}
          </View>
        </View>
        {upgrade ? <>
          <ObservatoryButton label={`Upgrade · ${upgrade.cost}`} disabled={!upgrade.affordable} onPress={() => onAction({ type: 'upgrade' })} accessibilityLabel={`Upgrade to level ${upgrade.level} for ${upgrade.cost} energy. Production ${upgrade.production} per hour`} />
          {upgrade.affordable ? null : <Text style={styles.upgradeHint}>{upgrade.missingEnergy.toLocaleString('en-US')} ⚡ missing</Text>}
        </> : null}
      </View>


      <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Back to my system" onPress={onBack} style={styles.backButton}><Text style={styles.backText}>Back to my system</Text><ArrowRight size={19} color={theme.primary} /></ObservatoryPressable>
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
      </View> : null}
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, gap: 8, width: '100%', maxWidth: 520, alignSelf: 'center' },
  heading: { gap: 4 },
  headingRow: { position: 'relative' },
  title: { color: theme.text, fontSize: 24, lineHeight: 34, fontWeight: '600', marginRight: 130 },
  subtitle: { color: theme.muted, fontSize: 14, lineHeight: 21 },
  balance: { position: 'absolute', right: 0, top: -7, minHeight: 48, justifyContent: 'center', alignItems: 'flex-end', gap: 2 },
  balanceText: { color: theme.text, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  readyText: { color: theme.muted, fontSize: 9, lineHeight: 14 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stackedBalance: { position: 'relative', top: 0, alignSelf: 'flex-start', alignItems: 'flex-start' },
  hero: { position: 'relative', marginHorizontal: -8 },
  viewControls: { position: 'absolute', right: 0, bottom: 0, flexDirection: 'row', gap: 6 },
  iconButton: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,19,29,0.85)' },
  heroCaption: { alignItems: 'center', gap: 4, paddingBottom: 6 },
  hint: { color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  channelCaption: { color: theme.primary, fontSize: 11, lineHeight: 18 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#9CCCB7' },
  upgrade: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingTop: 16, gap: 8 },
  overline: { color: theme.primary, fontSize: 10, lineHeight: 16, letterSpacing: 1.8, fontWeight: '700' },
  upgradeTitle: { color: theme.text, fontSize: 20, lineHeight: 27, fontWeight: '600' },
  productionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border, paddingVertical: 10, marginBottom: 4 },
  caption: { color: theme.muted, fontSize: 12, lineHeight: 18 },
  oldProduction: { color: theme.muted, fontSize: 18, lineHeight: 26 },
  newProduction: { color: theme.primary, fontSize: 18, lineHeight: 26, fontWeight: '600' },
  upgradeHint: { color: theme.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  backButton: { minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  backText: { color: theme.primary, fontSize: 13, lineHeight: 19 },
  disclaimer: { color: '#858EA3', fontSize: 10, lineHeight: 16, textAlign: 'center', paddingBottom: 6 },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fullViewer: { flex: 1, backgroundColor: theme.background, paddingHorizontal: 20, gap: 12 },
  fullToolbar: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
});
