import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Orbit, Radio, Sparkles, Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FirstStarSystem } from '@/components/first-star-system';
import { ObservatoryButton, ObservatoryPressable } from '@/components/observatory-button';
import { Text } from '@/components/astralys-text';
import { GuardianDemo } from '@/components/guardian-demo';
import { useSystemDefinition } from '@/lib/system-catalogue';
import { useGuardianProgress } from '@/context/guardian-progress-context';
import { useMotionPreferences } from '@/context/motion-context';
import { Observatory as theme, navigationClearance } from '@/constants/observatory-theme';
import { signalDiscoveries, signalDiscoveryAt, signalReward, type SignalDiscovery } from '@/features/guardian-demo-model';
import { useAcquisitions } from '@/context/acquisitions-context';
import { getCelestialDisplayName } from '@/utils/celestial-display-name';

function formatWait(milliseconds: number) {
  if (milliseconds <= 0) return 'Available now';
  const totalMinutes = Math.ceil(milliseconds / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} h ${minutes.toString().padStart(2, '0')}` : `${minutes} min`;
}

export function SignalObservatory() {
  const router = useRouter();
  const { view, starId } = useLocalSearchParams<{ view?: string; starId?: string }>();
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useMotionPreferences();
  const { state, dispatch, ready: progressReady, setActiveSystem } = useGuardianProgress();
  const { stars: acquiredStars } = useAcquisitions();
  const [now, setNow] = useState(Date.now());
  const [scanning, setScanning] = useState(false);
  const [revealed, setRevealed] = useState<SignalDiscovery | null>(null);
  const [systemOpen, setSystemOpen] = useState(view === 'system');
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      if (scanTimer.current) clearTimeout(scanTimer.current);
    };
  }, []);

  useEffect(() => {
    if (view === 'system') setSystemOpen(true);
  }, [starId, view]);

  const signalReady = progressReady && now >= state.nextSignalAt;
  const upcoming = signalDiscoveryAt(state.signalsAnalyzed);
  const atlasProgress = state.signalsAnalyzed === 0 ? 0 : ((state.signalsAnalyzed - 1) % signalDiscoveries.length) + 1;
  const activeStar = acquiredStars.find(star => star.id === starId) ?? acquiredStars[0];
  // Système propre à l'étoile : couleur, architecture et vraies planètes depuis la base.
  const { system } = useSystemDefinition(activeStar);
  // Chaque étoile a sa propre progression : on joue celle de l'étoile ouverte.
  useEffect(() => { if (activeStar) setActiveSystem(activeStar.id); }, [activeStar?.id, setActiveSystem]);

  const analyze = () => {
    if (!signalReady || scanning) return;
    setScanning(true);
    const discovery = upcoming;
    const finish = () => {
      dispatch({ type: 'analyze-signal', now: Date.now() });
      setNow(Date.now());
      setRevealed(discovery);
      setScanning(false);
    };
    if (reducedMotion) finish();
    else scanTimer.current = setTimeout(finish, 1500);
  };

  if (systemOpen) return <GuardianDemo systemName={activeStar ? getCelestialDisplayName(activeStar) : undefined} system={system} onClose={() => setSystemOpen(false)} />;

  return <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: navigationClearance(insets.bottom) }]}>
    <View style={styles.header}>
      <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Return home" onPress={() => router.replace('/')} style={styles.backButton}>
        <ArrowLeft size={21} color={theme.primary} />
      </ObservatoryPressable>
      <View style={styles.identity}><View style={styles.liveDot} /><Text style={styles.brand}>OBSERVATORY</Text></View>
      <View style={styles.headerSpacer} />
    </View>

    <View style={styles.content}>
      <View style={styles.visual}>
        <FirstStarSystem active={Boolean(activeStar)} height={250} star={activeStar} />
        {scanning ? <View style={styles.scanningOverlay}>
          <ActivityIndicator color={theme.primary} size="small" />
          <Text accessibilityLiveRegion="polite" style={styles.scanningText}>Stabilizing the signal…</Text>
        </View> : null}
      </View>

      {revealed ? <View style={styles.copy}>
        <View style={styles.rewardRow}><Sparkles size={15} color={theme.primary} /><Text style={styles.eyebrow}>{revealed.label}</Text></View>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>{revealed.title}</Text>
        <Text style={styles.description}>{revealed.description}</Text>
        <View style={styles.rewardSummary}>
          <View style={styles.metric}><Zap size={15} color={theme.primary} /><Text style={styles.metricValue}>+{signalReward(state, revealed)}</Text><Text style={styles.metricLabel}>energy</Text></View>
          <View style={styles.metric}><Orbit size={15} color="#9CCCB7" /><Text style={styles.metricValue}>{atlasProgress}/{signalDiscoveries.length}</Text><Text style={styles.metricLabel}>atlas</Text></View>
        </View>
      </View> : <View style={styles.copy}>
        <View style={styles.rewardRow}><Radio size={15} color={signalReady ? '#9CCCB7' : theme.muted} /><Text style={styles.eyebrow}>{signalReady ? 'SIGNAL AVAILABLE' : 'OBSERVATION IN PROGRESS'}</Text></View>
        <Text accessibilityRole="header" style={styles.title}>{signalReady ? 'A new fragment is waiting.' : 'The relay is listening.'}</Text>
        <Text style={styles.description}>{signalReady ? `Analyze one signal to reveal an atlas fragment. The announced reward is ${signalReward(state, upcoming)} energy.` : `Next signal in ${formatWait(state.nextSignalAt - now)}. Nothing is lost if you return later.`}</Text>
        <View style={styles.atlasRow}>
          <Text style={styles.atlasLabel}>SYSTEM ATLAS</Text>
          <Text style={styles.atlasValue}>{atlasProgress}/{signalDiscoveries.length}</Text>
        </View>
        <View accessibilityRole="progressbar" accessibilityLabel="System atlas progress" accessibilityValue={{ min: 0, max: signalDiscoveries.length, now: atlasProgress }} style={styles.track}>
          <View style={[styles.fill, { width: `${atlasProgress / signalDiscoveries.length * 100}%` }]} />
        </View>
      </View>}

      <View style={styles.actions}>
        {revealed ? <ObservatoryButton label="Explore the system" icon={Orbit} onPress={() => setSystemOpen(true)} />
          : signalReady ? <ObservatoryButton label="Analyze signal" icon={Radio} loading={scanning} onPress={analyze} />
            : <ObservatoryButton label="Explore current system" icon={Orbit} onPress={() => setSystemOpen(true)} />}
        <Text style={styles.disclaimer}>Illustrative exploration · rewards grow with your relay</Text>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 44 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#9CCCB7' },
  brand: { color: theme.text, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  content: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 14 },
  visual: { minHeight: 250, justifyContent: 'center' },
  scanningOverlay: { position: 'absolute', alignSelf: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 14, backgroundColor: 'rgba(10,13,22,0.88)' },
  scanningText: { color: theme.text, fontSize: 11, fontWeight: '700' },
  copy: { alignItems: 'center', paddingHorizontal: 8 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  eyebrow: { color: theme.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  title: { maxWidth: 410, color: theme.text, fontSize: 27, lineHeight: 34, fontWeight: '600', letterSpacing: -0.5, textAlign: 'center' },
  description: { maxWidth: 390, color: theme.muted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 9 },
  rewardSummary: { flexDirection: 'row', justifyContent: 'center', gap: 28, marginTop: 17 },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricValue: { color: theme.text, fontSize: 14, fontWeight: '800' },
  metricLabel: { color: theme.muted, fontSize: 10 },
  atlasRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  atlasLabel: { color: '#747B8D', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  atlasValue: { color: theme.muted, fontSize: 10, fontWeight: '700' },
  track: { width: '100%', height: 3, borderRadius: 2, backgroundColor: '#202536', overflow: 'hidden', marginTop: 7 },
  fill: { height: '100%', borderRadius: 2, backgroundColor: theme.primary },
  actions: { gap: 10, marginTop: 20 },
  disclaimer: { color: '#666D7E', fontSize: 9, lineHeight: 14, textAlign: 'center' },
});
