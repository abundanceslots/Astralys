import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Modal, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, ChevronLeft, ChevronRight, LockKeyhole, Radio, Send, Sparkles, X, Zap } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { Text } from '@/components/astralys-text';
import { haptic } from '@/features/orbital/haptics';
import { GuardianScene3D, type GuardianCameraView, type GuardianSceneControls } from '@/components/guardian-scene-3d';
import { GuardianRelayMenu } from '@/components/guardian-relay-menu';
import { OrbitalMissionGame } from '@/components/orbital-mission-game';
import { HoldToLaunchButton, NudgeBubble, RunFab, useWiggle, WaitingButton } from '@/components/run-ui';
import { StepDrawer } from '@/components/pull-up-sheet';
import { EVENT_COLORS, SystemEventBadge } from '@/components/system-event';
import { ObservatoryButton, ObservatoryPressable } from '@/components/observatory-button';
import { Observatory as theme, navigationClearance } from '@/constants/observatory-theme';
import { useMotionPreferences } from '@/context/motion-context';
import { useGuardianProgress } from '@/context/guardian-progress-context';
import { activeSystemEvent, droneDrainPerHour, systemEventSpecs, systemEventCompletionReward, systemEventLength, dailyDone, routeComplete, routeLength, routeStage, demoPlanets, energyPerHour, maximumPlanetLevel, nextDemoPlanet, nextRelayUpgrade, offlineCapMs, planetLevel, planetUpgradeCost, planetYield, probeCost, probeTravelTime, relayChannelCount, requiredRelayLevel, stateEnergyPerHour, type DemoPlanet } from '@/features/guardian-demo-model';
import { scenePlanets } from '@/features/guardian-scene';
import type { SystemDefinition } from '@/features/system-definition';

/** Format très court pour le bouton Run (« 36m », « 2h »). */
function formatShort(milliseconds: number) {
  const minutes = Math.max(1, Math.ceil(milliseconds / 60_000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? String(minutes % 60).padStart(2, '0') : ''}` : `${minutes}m`;
}

function formatCountdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60);
  if (hours) return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`;
  return minutes ? `${minutes}:${String(seconds % 60).padStart(2, '0')}` : `${seconds}s`;
}

/** Ce que rapporte l'arrivée sur la planète suivante (affiché AVANT de la débloquer). */
function unlockGain(explored: number, relayLevel: number, planet?: DemoPlanet) {
  const before = relayChannelCount(explored), after = relayChannelCount(explored + 1);
  const gain = energyPerHour(relayLevel, after) - energyPerHour(relayLevel, before) + (planet ? planetYield(planet, 1) : 0);
  return { channel: after > before, text: `+${gain.toLocaleString('en-US')} ⚡/h` };
}

const PAGE_GAP = 12;
const SEEN_KEY = 'astralys:guardian:seen-planets:v1';
const COACH_KEY = 'astralys:guardian:coach:v1';
const COACH_STEPS = [
  { title: 'Energy builds up on its own', text: 'Your relay produces energy, even while you are away.' },
  { title: 'Planets hide behind the dust', text: 'Spend energy to send a probe. The dust clears when it arrives.' },
  { title: 'Each world makes you stronger', text: 'Every two planets open a new production channel. While a probe travels, Orbital Run brings it closer.' },
] as const;
const readNumber = (key: string) => { try { const v = localStorage.getItem(key); return v === null ? null : Number(v); } catch { return null; } };
const writeValue = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* Stockage indisponible : sans conséquence. */ } };

export function GuardianDemo({ onClose, systemName = 'TRAPPIST-1', system }: { onClose: () => void; systemName?: string; system?: SystemDefinition | null }) {
  // Nom affiché d'une planète : son nom scientifique si elle est confirmée dans le catalogue, sinon « Étoile b ».
  const planetName = (p: DemoPlanet | null | undefined) => (p ? system?.bodies.find(body => body.id === p)?.name ?? `${systemName} ${p}` : systemName);
  const { state, dispatch, ready, cloud, activeSystemId } = useGuardianProgress();
  // Planètes déjà révélées : mémorisé séparément pour chaque système.
  const seenKey = `${SEEN_KEY}:${activeSystemId ?? 'default'}`;
  const [planet, setPlanet] = useState<DemoPlanet>('b');
  const [panel, setPanel] = useState<'system' | 'relay'>('system');
  const [cameraView, setCameraView] = useState<GuardianCameraView>('overview');
  const [controlsOpen, setControlsOpen] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const [gameTrack, setGameTrack] = useState<'event' | null>(null);
  const [revealed, setRevealed] = useState<DemoPlanet | null>(null);
  const [coachStep, setCoachStep] = useState<number | null>(() => (readNumber(COACH_KEY) === null ? 0 : null));
  const [now, setNow] = useState(Date.now());
  const [resourceGain, setResourceGain] = useState(0);
  const previousEnergy = useRef(state.energy);
  const gainTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width } = useWindowDimensions();
  const scene = useRef<GuardianSceneControls>(null);
  const { reducedMotion } = useMotionPreferences();
  const insets = useSafeAreaInsets();
  const showOverview = useCallback(() => { scene.current?.overview(); setCameraView('overview'); }, []);
  const goBack = useCallback(() => {
    if (panel === 'relay') { setPanel('system'); setCameraView('overview'); }
    else if (cameraView !== 'overview') showOverview();
    else onClose();
  }, [panel, cameraView, showOverview, onClose]);
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => listener.remove();
  }, [goBack]));

  useEffect(() => {
    // 2 fois par seconde suffit pour les comptes à rebours ; moins de travail qui concurrence la 3D.
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearInterval(timer);
      if (gainTimer.current) clearTimeout(gainTimer.current);
    };
  }, []);

  useEffect(() => {
    const gain = state.energy - previousEnergy.current;
    previousEnergy.current = state.energy;
    if (gain <= 0) return;
    setResourceGain(gain);
    if (gainTimer.current) clearTimeout(gainTimer.current);
    gainTimer.current = setTimeout(() => setResourceGain(0), 900);
  }, [state.energy]);

  // Nouveau système affiché : on ferme tout ce qui pourrait rester ouvert de l'ancien (carte, jeu, panneau).
  useEffect(() => {
    setRevealed(null); setGameOpen(false); setGameTrack(null); setControlsOpen(false); setPanel('system');
  }, [activeSystemId]);

  // Révélation : une sonde est arrivée (pendant la session ou pendant l'absence du joueur).
  useEffect(() => {
    // Attendre la vraie sauvegarde : l'état par défaut (1 planète) ferait croire à de fausses arrivées.
    if (!ready) return;
    // Changement de système : tant que la progression affichée est encore celle de l'ancien, on ne compare rien.
    if (system && activeSystemId && system.starId !== activeSystemId) return;
    const seen = readNumber(seenKey);
    const count = state.connected.length;
    if (seen === null || seen > count) { writeValue(seenKey, String(count)); return; }
    if (count > seen) { haptic('success'); setRevealed(state.connected[count - 1]); }
  }, [ready, state.connected, seenKey, system, activeSystemId]);

  const connected = state.connected.includes(planet), frontier = nextDemoPlanet(state.connected);
  const explorationCost = frontier ? probeCost(frontier) : 0;
  const explorationLabel = explorationCost >= 1000 ? `${explorationCost / 1000}k` : String(explorationCost);
  const channels = relayChannelCount(state.connected.length);
  const productionCycle = Math.round(3_600_000 / Math.max(1, stateEnergyPerHour(state)));
  const productionProgress = Math.min(1, Math.max(0, (now - state.lastSyncedAt) / productionCycle));
  const probeRemaining = state.probeReadyAt ? Math.max(0, state.probeReadyAt - now) : 0;
  const probeDuration = state.probeTarget ? probeTravelTime(state.probeTarget) : 1;
  const probeProgress = state.probeStartedAt ? Math.min(1, Math.max(0, (now - state.probeStartedAt) / probeDuration)) : 0;
  const selectPlanet = useCallback((p: DemoPlanet) => { setPlanet(p); scene.current?.focusPlanet(p); }, []);
  const unlockFrontier = useCallback(() => {
    if (!frontier) return;
    dispatch({ type: 'probe', planet: frontier });
  }, [dispatch, frontier]);

  /* ---- prochaine étape : une seule action principale, toujours visible ---- */
  const perHour = stateEnergyPerHour(state);
  // Pages du panneau « Planets » : une planète par page, la suivante dépasse un peu pour inviter à glisser.
  const pager = useRef<ScrollView>(null);
  const pageWidth = Math.min(340, width - 88);
  const pageInset = (width - pageWidth) / 2;
  const scrollToPlanet = useCallback((index: number, animated: boolean) => {
    pager.current?.scrollTo({ x: index * (pageWidth + PAGE_GAP), animated });
  }, [pageWidth]);
  useEffect(() => {
    if (!controlsOpen) return;
    const t = setTimeout(() => scrollToPlanet(demoPlanets.indexOf(planet), false), 0);
    return () => clearTimeout(t);
  }, [controlsOpen]);
  const upgrade = nextRelayUpgrade(state.relayLevel, state.energy, channels);
  const gain = unlockGain(state.connected.length, state.relayLevel, state.probeTarget ?? frontier);
  const missing = Math.max(0, explorationCost - state.energy);
  const neededRelay = frontier ? requiredRelayLevel(frontier) : 0;
  const relayTooLow = state.relayLevel < neededRelay;
  const waitMs = missing / perHour * 3_600_000;
  // Statut de la planète sélectionnée (celle qu'on vient de toucher), indépendant de la prochaine étape.
  const planetStatus = connected
    ? `Level ${planetLevel(state, planet)} · +${planetYield(planet, planetLevel(state, planet))} ⚡/h`
    : state.probeTarget === planet
      ? `Probe en route · ${formatCountdown(probeRemaining)}`
      : planet === frontier
        ? `Behind the dust · ${explorationLabel} ⚡${relayTooLow ? ` · relay level ${neededRelay}` : ''}`
        : 'Behind the dust';
  const openGame = () => { setGameTrack(null); setGameOpen(true); };
  /* ---- Événement en cours (essaim de drones / comète) ---- */
  const sysEvent = activeSystemEvent(state, now);
  const openEvent = () => { haptic('tick'); setGameTrack('event'); setGameOpen(true); };
  // Comète : dessinée dans la scène, récoltée d'un toucher.
  const cometSeq = sysEvent?.kind === 'comet' ? sysEvent.seq : 0;
  const cometStart = sysEvent?.kind === 'comet' ? sysEvent.startedAt : 0;
  // Essaim : anneau parasite autour de la planète attaquée, qui perd un tiers par niveau de défense.
  const swarmPlanet = sysEvent?.kind === 'drones' ? sysEvent.planet : null;
  const swarmStage = sysEvent?.kind === 'drones' ? sysEvent.stage : 0;
  const sceneSwarm = useMemo(() => (swarmPlanet ? { planet: swarmPlanet, stage: swarmStage, length: systemEventSpecs.drones.length } : null), [swarmPlanet, swarmStage]);
  const sceneComet = useMemo(() => (cometSeq ? { seq: cometSeq, startedAt: cometStart } : null), [cometSeq, cometStart]);
  // Gain affiché en petit, là où la comète a été touchée.
  const [cometToast, setCometToast] = useState<{ reward: number; x: number; y: number } | null>(null);
  const catchComet = useCallback((point: { x: number; y: number }) => {
    const reward = systemEventCompletionReward(state, 'comet');
    dispatch({ type: 'catch-comet', now: Date.now() });
    haptic('success');
    setCometToast({ reward, x: point.x, y: point.y });
    setTimeout(() => setCometToast(null), 1800);
  }, [dispatch, state]);
  const openRelay = () => setPanel('relay');
  // Amélioration de planète la plus rentable (gain par énergie dépensée), pour la fin de partie.
  const bestPlanetUpgrade = state.connected
    .filter(p => planetLevel(state, p) < maximumPlanetLevel)
    .map(p => { const level = planetLevel(state, p); const cost = planetUpgradeCost(p, level); return { planet: p, level, cost, gain: planetYield(p, level + 1) - planetYield(p, level) }; })
    .sort((a, b) => b.gain / b.cost - a.gain / a.cost)[0];
  // `id` ne dépend que du type d'étape : le texte (énergie, compte à rebours) peut changer sans rejouer l'animation d'entrée.
  type Step = { id: string; eyebrow: string; title: string; detail: string; progress?: number; waiting?: string; action?: { label: string; icon: typeof Send; onPress: () => void; variant?: 'primary' | 'secondary'; hold?: boolean } };
  const routeOpen = state.probeTarget !== null && !routeComplete(state);
  const dailyOpen = !dailyDone(state, now);
  const runFabState = routeOpen ? 'route' : state.probeTarget ? 'waiting' : dailyOpen ? 'daily' : 'idle';
  // Rappels : une bulle apparaît 5 s toutes les 40 s à côté du bouton concerné (Run et relais en alternance).
  const runNudge = routeOpen ? 'Shorten the trip' : dailyOpen ? 'Daily trials ready' : null;
  const relayNudge = upgrade?.affordable ? 'Relay upgrade ready' : null;
  const tick = Math.floor(now / 1000);
  const showRunNudge = coachStep === null && !gameOpen && tick % 40 < 5;
  const showRelayNudge = coachStep === null && !gameOpen && (tick + 20) % 40 < 5;
  const runWiggle = useWiggle(Boolean(runNudge) && coachStep === null);
  const relayWiggle = useWiggle(Boolean(relayNudge) && coachStep === null, 9000);
  const step: Step = state.probeTarget
    ? routeOpen
      ? { id: 'probe-route', eyebrow: 'PROBE EN ROUTE', title: `${planetName(state.probeTarget)} · ${formatCountdown(probeRemaining)}`, detail: `Clear the route to arrive sooner · ${gain.text} on arrival`, progress: probeProgress, action: { label: `Shorten the trip · ${routeStage(state)}/${routeLength(state.probeTarget)}`, icon: Radio, onPress: () => setGameOpen(true), variant: 'secondary' } }
      : { id: 'probe-wait', eyebrow: 'ROUTE COMPLETE · JUST WAIT', title: `${planetName(state.probeTarget)}`, detail: `Nothing left to do for this step. The dust clears on arrival · ${gain.text}`, waiting: `Arrives in ${formatCountdown(probeRemaining)}`, progress: probeProgress }
    : frontier && relayTooLow && upgrade
      ? { id: 'relay-required', eyebrow: 'NEXT STEP', title: `Upgrade the relay to level ${state.relayLevel + 1}`, detail: `Level ${neededRelay} is needed to reach ${planetName(frontier)} · ${upgrade.affordable ? `${upgrade.cost.toLocaleString('en-US')} ⚡` : `${upgrade.missingEnergy.toLocaleString('en-US')} ⚡ missing`}`, progress: upgrade.affordable ? undefined : state.energy / upgrade.cost, action: upgrade.affordable ? { label: 'Open satellite relay', icon: ArrowRight, onPress: openRelay } : undefined }
    : frontier && missing === 0
      ? { id: 'launch', eyebrow: 'NEXT STEP', title: `Reach ${planetName(frontier)}`, detail: `${formatCountdown(probeTravelTime(frontier))} trip · ${gain.text}`, action: { label: `Hold to launch · ${explorationLabel} ⚡`, icon: Send, onPress: unlockFrontier, hold: true } }
      : frontier && upgrade?.affordable
        ? { id: 'relay-boost', eyebrow: 'NEXT STEP', title: `Upgrade the relay to ${upgrade.title.toLowerCase()}`, detail: `${upgrade.cost} ⚡ · +${(upgrade.production - perHour).toLocaleString('en-US')} ⚡/h, then reach ${planetName(frontier)} faster`, action: { label: 'Open satellite relay', icon: ArrowRight, onPress: openRelay } }
        : frontier
          ? { id: 'save-up', eyebrow: 'NEXT STEP', title: `${missing.toLocaleString('en-US')} ⚡ to reach ${planetName(frontier)}`, detail: waitMs > offlineCapMs ? `About ${formatCountdown(waitMs)} of production · visit every 8 h to keep it running` : `Ready in about ${formatCountdown(waitMs)} · or earn it faster`, progress: state.energy / explorationCost }
          : upgrade
            ? { id: 'relay-final', eyebrow: 'NEXT STEP', title: `Upgrade the relay to ${upgrade.title.toLowerCase()}`, detail: upgrade.affordable ? `${upgrade.cost} ⚡ · +${(upgrade.production - perHour).toLocaleString('en-US')} ⚡/h` : `${upgrade.missingEnergy} ⚡ missing`, action: { label: 'Open satellite relay', icon: ArrowRight, onPress: openRelay } }
            : bestPlanetUpgrade
              ? { id: `planet-${bestPlanetUpgrade.planet}`, eyebrow: 'NEXT STEP', title: `Upgrade ${planetName(bestPlanetUpgrade.planet)} to level ${bestPlanetUpgrade.level + 1}`, detail: `${bestPlanetUpgrade.cost.toLocaleString('en-US')} ⚡ · +${bestPlanetUpgrade.gain} ⚡/h`, action: { label: 'Open planets', icon: ArrowRight, onPress: () => { selectPlanet(bestPlanetUpgrade.planet); setControlsOpen(true); } } }
              : { id: 'complete', eyebrow: 'SYSTEM COMPLETE', title: 'Every planet is at its best', detail: `Your system produces ${perHour.toLocaleString('en-US')} ⚡/h.` };

  const finishCoach = () => { setCoachStep(null); writeValue(COACH_KEY, '1'); };
  const closeReveal = () => {
    if (revealed) { writeValue(seenKey, String(state.connected.length)); selectPlanet(revealed); }
    setRevealed(null);
  };
  const revealIndex = revealed ? state.connected.indexOf(revealed) + 1 : 0;
  const revealOpenedChannel = revealed ? relayChannelCount(revealIndex) > relayChannelCount(revealIndex - 1) : false;

  return <View style={[styles.screen, { paddingTop: insets.top + 4, paddingBottom: navigationClearance(insets.bottom) }]}>
    {panel === 'relay' ? <View style={styles.header}>
      <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Back to my system" onPress={goBack} style={styles.iconButton}><ChevronLeft size={24} color={theme.text} /></ObservatoryPressable>
    </View> : null}
    {panel === 'system' ? <View style={styles.pageHeading}>
      <View style={styles.headingRow}><ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel={cameraView !== 'overview' ? 'Back to system overview' : 'Exit observatory'} onPress={goBack} style={styles.iconButton}><ChevronLeft size={24} color={theme.text} /></ObservatoryPressable><View style={styles.headingCopy}><Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{systemName}</Text><Text style={styles.pageSubtitle}>My system</Text></View>
        <View accessible accessibilityLabel={`${state.energy} energy available. ${channels} production channels. One energy produced every ${Math.round(productionCycle / 1000)} seconds`} style={styles.resourcePanel}><View style={styles.resourceValue}><Zap size={15} color={theme.primary} /><Text style={styles.resourceAmount}>{state.energy.toLocaleString('en-US')}</Text>{resourceGain ? <Animated.Text key={state.energy} entering={FadeInDown.duration(200)} exiting={FadeOut.duration(300)} accessibilityLiveRegion="polite" style={styles.resourceGainFloat}>+{resourceGain}</Animated.Text> : null}</View><Text style={styles.resourceRate}>+1 · {Math.round(productionCycle / 1000)}s</Text><View style={styles.productionTrack}><View style={[styles.productionFill, { width: `${productionProgress * 100}%` }]} /></View></View>
      </View>
    </View> : null}
    {panel === 'system' ? <Animated.View key="system" entering={SlideInLeft.duration(260)} exiting={FadeOut.duration(120)} style={styles.systemContent}><View style={styles.sceneShell}>
      <GuardianScene3D ref={scene} paused={gameOpen || revealed !== null} mode="system" selected={planet} connected={state.connected} relayLevel={state.relayLevel} resetKey={0} onSelect={selectPlanet} onViewChange={setCameraView} probeTarget={state.probeTarget} probeProgress={Math.round(probeProgress * 50) / 50} system={system} comet={sceneComet} onCometPress={catchComet} swarm={sceneSwarm} />
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {cometToast ? <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(500)} pointerEvents="none"
          style={[styles.cometGain, { left: cometToast.x - 40, top: cometToast.y - 30 }]}>
          <Text style={styles.cometGainText}>+{cometToast.reward.toLocaleString('en-US')} ⚡</Text>
        </Animated.View> : null}
        <View pointerEvents="box-none" style={styles.topHud}>
          <View>
            <NudgeBubble text={runNudge} color={routeOpen ? '#C8BAF5' : '#F2C879'} visible={showRunNudge} onPress={openGame} />
            <Animated.View style={runWiggle}>
              <RunFab state={runFabState} progress={state.probeTarget ? routeStage(state) / Math.max(1, routeLength(state.probeTarget)) : 0}
                waitLabel={formatShort(probeRemaining)} dailyBadge={dailyOpen} onPress={openGame}
                accessibilityLabel={`Open Orbital Run.${routeOpen ? ' A progress trial is open.' : runFabState === 'waiting' ? ' Route complete, the probe is on its way.' : ''}${dailyOpen ? ' Daily trials are available.' : ''}`} />
            </Animated.View>
          </View>
          <View>
            <NudgeBubble text={relayNudge} color="#9CCCB7" visible={showRelayNudge} onPress={openRelay} />
            <Animated.View style={relayWiggle}>
              <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel={`Open satellite relay, level ${state.relayLevel}${upgrade?.affordable ? '. An upgrade is ready' : ''}`} onPress={openRelay} style={styles.runButton}>
                <Zap size={20} color={theme.primary} />
                <Text style={styles.runButtonText}>Lv {state.relayLevel}</Text>
                {upgrade?.affordable ? <View style={styles.relayBadge} /> : null}
              </ObservatoryPressable>
            </Animated.View>
          </View>
          {/* Événement en cours : symbole temporaire sous le relais (anneau = temps restant). */}
          {sysEvent && coachStep === null ? <SystemEventBadge key={sysEvent.seq} event={sysEvent}
            remaining={(sysEvent.endsAt - now) / Math.max(1, sysEvent.endsAt - sysEvent.startedAt)}
            caption={sysEvent.kind === 'drones' ? `${sysEvent.stage}/${systemEventLength(sysEvent)}` : formatShort(sysEvent.endsAt - now)}
            accessibilityLabel={sysEvent.kind === 'drones'
              ? `Drone ring on ${planetName(sysEvent.planet)}, siphoning ${droneDrainPerHour(state)} energy per hour for ${formatCountdown(sysEvent.endsAt - now)}. Open the defense.`
              : `A comet is crossing your system for ${formatCountdown(sysEvent.endsAt - now)}. Tap it in the scene to collect ${systemEventCompletionReward(state, 'comet')} energy.`}
            onPress={sysEvent.kind === 'drones' ? openEvent : () => { haptic('tick'); scene.current?.overview(); }} /> : null}
        </View>
      </View>
      <Text pointerEvents="none" style={styles.sceneHint}>{cameraView === 'overview' ? 'Tap a planet · veiled worlds are still to reach' : 'Drag to move · pinch to zoom'}</Text>
    </View>
    <View style={styles.bottomHud}>
          {coachStep !== null ? <View accessibilityLiveRegion="polite" style={styles.coach}>
            <View style={styles.coachCopy}><Text style={styles.coachCount}>{coachStep + 1} / {COACH_STEPS.length}</Text><Text style={styles.coachTitle}>{COACH_STEPS[coachStep].title}</Text><Text style={styles.coachText}>{COACH_STEPS[coachStep].text}</Text></View>
            <ObservatoryPressable variant="quiet" accessibilityRole="button" onPress={() => (coachStep < COACH_STEPS.length - 1 ? setCoachStep(coachStep + 1) : finishCoach())} style={styles.coachButton}><Text style={styles.coachButtonText}>{coachStep < COACH_STEPS.length - 1 ? 'Next' : 'Got it'}</Text></ObservatoryPressable>
          </View> : null}
          <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel={`${planetName(planet)}. ${planetStatus}. Open planet controls`} onPress={() => setControlsOpen(true)} style={styles.planetHeader}>
            <View style={[styles.statusDot, !connected && styles.pendingDot]} />
            <View style={styles.planetHeaderCopy}>
              <Text accessibilityRole="header" numberOfLines={1} style={styles.planetHeaderName}>{planetName(planet)}</Text>
              <Text numberOfLines={1} style={styles.planetHeaderStatus}>{planetStatus}</Text>
            </View>
            <ChevronRight size={18} color={theme.muted} />
          </ObservatoryPressable>
          <StepDrawer forceOpen={coachStep !== null} highlight={Boolean(step.action)}
            peek={<Animated.View key={`${step.id}-${state.probeTarget ?? frontier ?? ''}`} entering={FadeIn.duration(220)}>
        <Text style={styles.stepEyebrow}>{step.eyebrow}</Text>
        <Text numberOfLines={1} style={styles.peekTitle}>{step.title}</Text>
      </Animated.View>}>
          <View style={styles.stepCard}>
            {__DEV__ ? <View style={styles.devRow}>
              <Text style={styles.devLabel}>DEV · events</Text>
              <ObservatoryPressable variant="quiet" accessibilityRole="button" onPress={() => dispatch({ type: 'debug-event', kind: 'drones', now: Date.now() })} style={styles.devButton}><Text style={[styles.devText, { color: EVENT_COLORS.drones }]}>Drones</Text></ObservatoryPressable>
              <ObservatoryPressable variant="quiet" accessibilityRole="button" onPress={() => dispatch({ type: 'debug-event', kind: 'comet', now: Date.now() })} style={styles.devButton}><Text style={[styles.devText, { color: EVENT_COLORS.comet }]}>Comet</Text></ObservatoryPressable>
              <ObservatoryPressable variant="quiet" accessibilityRole="button" onPress={() => dispatch({ type: 'debug-event', kind: null, now: Date.now() })} style={styles.devButton}><Text style={styles.devText}>Clear</Text></ObservatoryPressable>
            </View> : null}
            <Text numberOfLines={2} style={styles.stepDetail}>{step.detail}</Text>
            {step.waiting ? <WaitingButton label={step.waiting} progress={step.progress} style={styles.stepButton} />
              : step.progress !== undefined ? <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(step.progress * 100) }} style={styles.missionTrack}><View style={[styles.missionFill, { width: `${Math.min(100, step.progress * 100)}%` }]} /></View> : null}
            {step.action?.hold ? <HoldToLaunchButton label={step.action.label} onConfirm={step.action.onPress} style={styles.stepButton} />
              : step.action ? <ObservatoryButton label={step.action.label} icon={step.action.icon} variant={step.action.variant ?? 'primary'} onPress={step.action.onPress} style={styles.stepButton} /> : null}
          </View>
          </StepDrawer>
    </View>
    </Animated.View> : <Animated.View key="relay" entering={SlideInRight.duration(260)} exiting={FadeOut.duration(120)} style={styles.relayPanel}><GuardianRelayMenu state={state} systemName={systemName} resetKey={0} onAction={action => { if (action.type === 'upgrade') haptic('success'); dispatch(action); }} onBack={goBack} /></Animated.View>}
    <OrbitalMissionGame visible={gameOpen} systemName={systemName} planetLabel={p => planetName(p as DemoPlanet)} initialTrack={gameTrack} onClose={() => { setGameOpen(false); setGameTrack(null); }} />
    <Modal visible={revealed !== null} transparent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={closeReveal}>
      <View style={styles.revealRoot}>
        {/* Toucher à côté ferme aussi la carte : l'écran n'est jamais bloqué. */}
        <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Close" onPress={closeReveal} style={styles.revealScrim} />
        {/* Pas d'animation d'entrée Reanimated dans un Modal : sur Android elle peut rester invisible et bloquer tous les touchers.
            Le fondu du Modal suffit. */}
        <View accessibilityViewIsModal style={styles.revealCard}>
          <Sparkles size={26} color={theme.primary} />
          <Text style={styles.stepEyebrow}>PROBE ARRIVED</Text>
          <Text accessibilityRole="header" style={styles.revealTitle}>{planetName(revealed)}</Text>
          <Text style={styles.revealText}>The dust has cleared. This world is now part of your system.</Text>
          <View style={styles.revealGains}>
            <Text style={styles.revealGain}>✦ Planet {revealIndex} of {demoPlanets.length} explored</Text>
            {revealed ? <Text style={styles.revealGain}>✦ Produces +{planetYield(revealed, 1)} ⚡/h · upgradable to level {maximumPlanetLevel}</Text> : null}
            {revealOpenedChannel ? <Text style={styles.revealGain}>✦ New production channel · {perHour.toLocaleString('en-US')} ⚡/h</Text> : null}
            {frontier ? <Text style={styles.revealNext}>Next: {planetName(frontier)} · {explorationLabel} ⚡</Text> : <Text style={styles.revealNext}>Your system is complete.</Text>}
          </View>
          <ObservatoryButton label={`Approach ${revealed ?? ''}`} icon={ArrowRight} onPress={closeReveal} style={styles.stepButton} />
        </View>
      </View>
    </Modal>
    <Modal visible={controlsOpen} transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={() => setControlsOpen(false)}>
      <View style={styles.modalRoot}>
        <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Dismiss planet controls" onPress={() => setControlsOpen(false)} style={styles.scrim} />
        <View accessibilityViewIsModal style={[styles.controlsSheet, { paddingBottom: Math.max(insets.bottom, 16), maxHeight: '85%' }]}>
          <View style={styles.sheetHeader}>
            <Text accessibilityRole="header" style={styles.sheetTitle}>Planets</Text>
            <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel="Close planets" onPress={() => setControlsOpen(false)} style={styles.iconButton}><X size={22} color={theme.text} /></ObservatoryPressable>
          </View>
          <ScrollView
            ref={pager}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={pageWidth + PAGE_GAP}
            decelerationRate="fast"
            disableIntervalMomentum
            style={styles.pager}
            contentContainerStyle={[styles.pages, { paddingHorizontal: pageInset }]}
            onMomentumScrollEnd={event => {
              const index = Math.round(event.nativeEvent.contentOffset.x / (pageWidth + PAGE_GAP));
              const next = demoPlanets[Math.max(0, Math.min(demoPlanets.length - 1, index))];
              if (next !== planet) { haptic('tick'); selectPlanet(next); }
            }}>
            {demoPlanets.map(p => {
              const explored = state.connected.includes(p), probing = state.probeTarget === p, next = p === frontier && !probing;
              const dark = !explored && !probing && !next;
              const level = planetLevel(state, p);
              const upgradeCost = planetUpgradeCost(p, Math.max(1, level));
              const [r, g, b] = (system?.bodies ?? scenePlanets).find(body => body.id === p)?.color ?? [0.5, 0.5, 0.6];
              const tint = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
              return <View key={p} accessibilityLabel={`${planetName(p)}`} style={[styles.page, { width: pageWidth }, dark && styles.pageDark]}>
                <View style={[styles.bigDisc, explored ? { backgroundColor: tint } : dark ? styles.planetDiscDark : styles.planetDiscVeiled, probing && styles.planetDiscProbing]}>
                  {explored ? <View style={styles.bigShine} /> : dark ? <LockKeyhole size={26} color="#3E4457" /> : <><View style={[styles.dust, styles.bigDustA]} /><View style={[styles.dust, styles.bigDustB]} /></>}
                </View>
                <Text style={[styles.pageName, dark && styles.planetCardNameDark]}>{planetName(p)}</Text>
                {system ? <Text style={styles.pageOrigin}>{system.bodies.find(body => body.id === p)?.real ? 'Confirmed planet · catalogue data' : 'Simulated world'}</Text> : null}
                {explored ? <>
                  <Text style={styles.pageValue}>+{planetYield(p, level)} ⚡/h</Text>
                  <View accessible accessibilityLabel={`Level ${level} of ${maximumPlanetLevel}`} style={styles.pips}>{Array.from({ length: maximumPlanetLevel }, (_, i) => <View key={i} style={[styles.pip, i < level && styles.pipOn]} />)}</View>
                  {level < maximumPlanetLevel
                    ? <ObservatoryButton label={state.energy >= upgradeCost ? `Level ${level + 1} · ${upgradeCost.toLocaleString('en-US')} ⚡` : `${(upgradeCost - state.energy).toLocaleString('en-US')} ⚡ missing`} disabled={state.energy < upgradeCost} onPress={() => { haptic('success'); dispatch({ type: 'upgrade-planet', planet: p }); }} style={styles.pageButton} />
                    : <Text style={styles.pageNote}>Maximum level</Text>}
                </> : probing ? <>
                  <Text style={styles.pageValue}>{formatCountdown(probeRemaining)}</Text>
                  <View style={[styles.missionTrack, styles.pageTrack]}><View style={[styles.missionFill, { width: `${probeProgress * 100}%` }]} /></View>
                  {routeOpen ? <ObservatoryButton label="Shorten the trip" icon={Radio} variant="secondary" onPress={() => { setControlsOpen(false); setGameOpen(true); }} style={styles.pageButton} /> : <WaitingButton label="Route complete · just wait" tone="done" style={styles.pageButton} />}
                </> : next ? <>
                  <Text style={styles.pageValue}>+{planetYield(p, 1)} ⚡/h</Text>
                  <HoldToLaunchButton label={relayTooLow ? `Relay level ${neededRelay} required` : state.energy < explorationCost ? `${missing.toLocaleString('en-US')} ⚡ missing` : `Hold to launch · ${explorationLabel} ⚡`} disabled={relayTooLow || state.energy < explorationCost || state.probeTarget !== null} onConfirm={unlockFrontier} style={styles.pageButton} />
                </> : <Text style={styles.pageNote}>Not reachable yet</Text>}
              </View>;
            })}
          </ScrollView>
          <View style={styles.dots}>
            {demoPlanets.map((p, i) => <ObservatoryPressable key={p} variant="quiet" accessibilityRole="button" accessibilityLabel={`Show ${planetName(p)}`} onPress={() => { selectPlanet(p); scrollToPlanet(i, true); }} style={styles.dotHit}>
              <View style={[styles.dot, state.connected.includes(p) ? styles.dotExplored : p === frontier || p === state.probeTarget ? styles.dotNext : null, planet === p && styles.dotActive]} />
            </ObservatoryPressable>)}
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  // Le « +N » flotte au-dessus du compteur : il ne pousse plus les chiffres quand l'énergie augmente.
  resourceGainFloat: { position: 'absolute', top: -14, right: 0, color: '#9CCCB7', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  relayPanel: { flex: 1 },
  runButton: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', gap: 1, backgroundColor: 'rgba(20,24,38,0.9)', borderWidth: 1, borderColor: 'rgba(200,186,245,0.35)' },
  runButtonText: { color: theme.primary, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  runBadge: { position: 'absolute', top: 4, right: 4, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: '#141826' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  sheetTitle: { color: theme.text, fontSize: 22, fontWeight: '600' },
  pager: { flexGrow: 0, marginHorizontal: -24 },
  pages: { gap: PAGE_GAP, paddingVertical: 8 },
  page: { alignItems: 'center', gap: 12, paddingVertical: 28, paddingHorizontal: 20, borderRadius: 28, backgroundColor: '#141927' },
  pageDark: { backgroundColor: '#0A0C13' },
  bigDisc: { width: 128, height: 128, borderRadius: 64, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 6 },
  bigShine: { position: 'absolute', top: 18, left: 24, width: 44, height: 28, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.28)' },
  bigDustA: { width: 110, height: 64, top: 12, left: -18 },
  bigDustB: { width: 96, height: 58, bottom: 8, right: -20 },
  pageName: { color: theme.text, fontSize: 22, fontWeight: '600', textAlign: 'center' },
  pageValue: { color: '#9CCCB7', fontSize: 28, lineHeight: 34, fontWeight: '600' },
  pageNote: { color: theme.muted, fontSize: 14 },
  pageOrigin: { color: '#7D869C', fontSize: 11, marginTop: -4 },
  pageButton: { alignSelf: 'stretch', marginTop: 8 },
  pageTrack: { alignSelf: 'stretch' },
  pips: { flexDirection: 'row', gap: 6 },
  pip: { width: 22, height: 6, borderRadius: 3, backgroundColor: '#2A3045' },
  pipOn: { backgroundColor: theme.primary },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 2, marginTop: 4 },
  dotHit: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#262B3C' },
  dotExplored: { backgroundColor: '#9CCCB7' },
  dotNext: { backgroundColor: '#6E6590' },
  dotActive: { width: 22, backgroundColor: theme.primary },
  cardsViewport: { flexGrow: 0, marginHorizontal: -24 },
  cards: { gap: 10, paddingHorizontal: 24, paddingVertical: 4 },
  planetCard: { width: 96, alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 18, backgroundColor: '#141927', borderWidth: 1, borderColor: 'transparent' },
  planetCardSelected: { borderColor: theme.primary, backgroundColor: '#1B1830' },
  planetCardDark: { backgroundColor: '#0B0E16', opacity: 0.7 },
  planetDisc: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 4 },
  planetDiscDark: { backgroundColor: '#07080D', borderWidth: 1, borderColor: '#1C2030' },
  planetDiscVeiled: { backgroundColor: '#23202F', borderWidth: 1, borderColor: '#3A3550' },
  planetDiscProbing: { borderWidth: 1.5, borderColor: theme.primary, borderStyle: 'dashed' },
  planetShine: { position: 'absolute', top: 6, left: 8, width: 14, height: 10, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.35)' },
  dust: { position: 'absolute', borderRadius: 20, backgroundColor: 'rgba(160,150,190,0.35)' },
  dustA: { width: 34, height: 22, top: 4, left: -4 },
  dustB: { width: 30, height: 20, bottom: 2, right: -6 },
  planetCardName: { color: theme.text, fontSize: 16, fontWeight: '600' },
  planetCardNameDark: { color: '#596071' },
  planetCardLine: { color: theme.muted, fontSize: 11, lineHeight: 15 },
  planetCardLevel: { color: theme.primary, fontWeight: '700' },
  planetCardYield: { color: '#9CCCB7', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  planetCardYieldMuted: { color: '#6E7589', fontWeight: '400' },
  planetStatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 },
  planetStatValue: { color: theme.text, fontSize: 14, fontWeight: '600' },
  planetStatNext: { color: '#9CCCB7' },
  planetHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  planetHeaderCopy: { flex: 1, minWidth: 0, gap: 2 },
  planetHeaderName: { color: theme.text, fontSize: 17, lineHeight: 23, fontWeight: '600' },
  planetHeaderStatus: { color: theme.muted, fontSize: 12, lineHeight: 17 },
  stepCard: { gap: 5, paddingTop: 2, paddingBottom: 6 },
  peekTitle: { color: theme.text, fontSize: 15, lineHeight: 20, fontWeight: '600', marginTop: 2 },
  relayBadge: { position: 'absolute', top: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#9CCCB7', borderWidth: 2, borderColor: '#0C1020' },
  stepEyebrow: { color: theme.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  stepTitle: { color: theme.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  stepDetail: { color: theme.muted, fontSize: 12, lineHeight: 18 },
  stepButton: { marginTop: 6 },
  quickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  quickLink: { minHeight: 44, flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6 },
  quickText: { color: '#DDD7EC', fontSize: 11, lineHeight: 16, fontWeight: '600', flexShrink: 1 },
  coach: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, padding: 12, borderRadius: 16, backgroundColor: '#1A1830', borderWidth: 1, borderColor: 'rgba(200,186,245,0.22)' },
  coachCopy: { flex: 1, gap: 3 },
  coachCount: { color: theme.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  coachTitle: { color: theme.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  coachText: { color: theme.muted, fontSize: 11, lineHeight: 16 },
  coachButton: { minHeight: 44, minWidth: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  coachButtonText: { color: theme.primary, fontSize: 12, fontWeight: '700' },
  revealRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(3,4,10,0.72)' },
  revealScrim: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'transparent' },
  revealCard: { width: '100%', maxWidth: 380, alignItems: 'center', gap: 10, padding: 24, borderRadius: 28, backgroundColor: '#111629', borderWidth: 1, borderColor: 'rgba(200,186,245,0.25)' },
  revealTitle: { color: theme.text, fontSize: 26, lineHeight: 32, fontWeight: '600', textAlign: 'center' },
  revealText: { color: theme.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  revealGains: { alignSelf: 'stretch', gap: 6, marginTop: 4, padding: 14, borderRadius: 16, backgroundColor: 'rgba(7,9,17,0.6)' },
  revealGain: { color: '#9CCCB7', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  revealNext: { color: theme.muted, fontSize: 12, lineHeight: 18 },
  screen: { flex: 1, backgroundColor: theme.background }, header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }, iconButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, headerSpacer: { width: 48 }, brand: { flexDirection: 'row', alignItems: 'center', gap: 5 }, wordmark: { color: theme.text, fontSize: 15, letterSpacing: 3, fontWeight: '500' }, pageHeading: { paddingLeft: 8, paddingRight: 24, paddingTop: 4, gap: 10 }, headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, headingCopy: { flex: 1, minWidth: 0 }, title: { color: theme.text, fontSize: 26, lineHeight: 34, fontWeight: '600' }, pageSubtitle: { color: theme.muted, fontSize: 14, lineHeight: 21 }, resourcePanel: { minWidth: 96, alignItems: 'flex-end', gap: 2 }, resourceValue: { position: 'relative', flexDirection: 'row', alignItems: 'center', gap: 6 }, resourceAmount: { minWidth: 72, textAlign: 'right', fontVariant: ['tabular-nums'], color: theme.text, fontSize: 19, lineHeight: 25, fontWeight: '700' }, resourceGain: { color: '#9CCCB7', fontSize: 11, lineHeight: 16, fontWeight: '800' }, resourceRate: { color: '#9CCCB7', fontSize: 9, lineHeight: 14, fontWeight: '700' }, productionTrack: { width: 72, height: 2, overflow: 'hidden', borderRadius: 1, backgroundColor: '#202637' }, productionFill: { height: '100%', borderRadius: 1, backgroundColor: theme.primary }, progressSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, progressLabel: { color: '#70788A', fontSize: 9, lineHeight: 14, fontWeight: '700', letterSpacing: 1.3 }, progressValue: { color: theme.muted, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  systemContent: { flex: 1 }, sceneShell: { flex: 1, minHeight: 100, position: 'relative' },
  sceneHint: { position: 'absolute', bottom: 10, left: 12, right: 12, textAlign: 'center', color: theme.muted, fontSize: 11, lineHeight: 17 },
  topHud: { position: 'absolute', top: '24%', right: 16, gap: 12 },
  cometGain: { position: 'absolute', width: 80, alignItems: 'center' },
  cometGainText: { color: '#8FE3FF', fontSize: 12, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 },
  devRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#3A4158' },
  devLabel: { flex: 1, color: '#6F7690', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  devButton: { minHeight: 30, paddingHorizontal: 10, justifyContent: 'center' },
  devText: { color: '#A7B0C5', fontSize: 11, fontWeight: '700' }, balance: { flexDirection: 'row', alignItems: 'center', gap: 5 }, energyValue: { color: theme.text, fontSize: 21, fontWeight: '600' }, caption: { color: theme.muted, fontSize: 12, lineHeight: 18 }, cameraTools: { gap: 8 }, cameraButton: { width: 48, minHeight: 48, backgroundColor: 'rgba(15,19,30,0.85)', alignItems: 'center', justifyContent: 'center' },
  simulationCaption: { textAlign: 'right', color: '#858EA3', fontSize: 10, lineHeight: 16, paddingHorizontal: 24, paddingBottom: 8 },
  bottomHud: { marginHorizontal: 14, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: '#0F131D', borderRadius: 24, flexShrink: 0 }, handleButton: { width: 64, minHeight: 48, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }, handle: { height: 3, width: 30, borderRadius: 2, backgroundColor: '#3B4050' }, contextRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, contextStack: { flexDirection: 'column', alignItems: 'stretch' }, connectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#9CCCB7' }, pendingDot: { backgroundColor: theme.muted }, connectionText: { color: '#9CCCB7', fontSize: 11, lineHeight: 17, flexShrink: 1 }, pendingText: { color: theme.muted },
  planetStripViewport: { height: 48, flexGrow: 0 }, planetStrip: { flexGrow: 1, justifyContent: 'center' }, planetChip: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 4 }, planetChipLocked: { opacity: 0.58 }, planetChipText: { color: theme.muted, fontSize: 16 }, planetChipSelected: { color: theme.text, fontWeight: '600' }, planetUnderline: { height: 3, width: 18, borderRadius: 2, backgroundColor: theme.primary },
  relayTransfer: { position: 'absolute', right: 4, bottom: -12 },
  relayShortcut: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, flexShrink: 1 }, stackedRelay: { width: '100%' }, relayButtonText: { color: theme.onPrimary, fontSize: 12, lineHeight: 18, fontWeight: '600', flexShrink: 1 },
  gameShortcut: { minHeight: 44, marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 7 }, gameShortcutText: { flex: 1, color: '#DDD7EC', fontSize: 12, lineHeight: 18, fontWeight: '600' }, gameShortcutReward: { color: '#8FA698', fontSize: 10, lineHeight: 16 },
  navigator: { flexDirection: 'row', minHeight: 64, alignItems: 'center', gap: 2 }, planetArrow: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, planetIdentity: { flex: 1, minWidth: 0, minHeight: 48, justifyContent: 'center', gap: 5 }, planetName: { color: theme.text, fontSize: 17, lineHeight: 24, fontWeight: '600' }, controlsPlanetName: { color: theme.text, fontSize: 14, fontWeight: '600' }, harvestHud: { flexDirection: 'row', gap: 8 }, collect: { flex: 1, minHeight: 48, paddingVertical: 10 }, timeButton: { width: 52, minHeight: 48, backgroundColor: 'rgba(15,19,30,0.92)', alignItems: 'center', justifyContent: 'center' }, timeText: { color: theme.primary, fontSize: 12 }, message: { color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', minHeight: 18 }, disclaimer: { color: '#858EA3', fontSize: 10, lineHeight: 14, textAlign: 'center', paddingVertical: 4 }, transferText: { color: theme.primary, fontSize: 22, fontWeight: '600' },
  unlockBlock: { gap: 9, paddingTop: 4 }, unlockCopy: { flex: 1, minWidth: 0, gap: 3 }, unlockTitle: { color: theme.text, fontSize: 13, lineHeight: 19, fontWeight: '600' }, missionBlock: { gap: 10, paddingVertical: 6 }, missionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, missionTime: { color: theme.primary, fontSize: 16, lineHeight: 22, fontWeight: '700' }, missionTrack: { width: '100%', height: 4, overflow: 'hidden', borderRadius: 2, backgroundColor: '#22283A' }, missionFill: { height: '100%', borderRadius: 2, backgroundColor: theme.primary }, completionText: { color: '#9CCCB7', fontSize: 12, lineHeight: 18, textAlign: 'center', paddingVertical: 8 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' }, scrim: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.65)' }, controlsSheet: { backgroundColor: '#0F131D', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12 }, controlsContent: { gap: 12, paddingBottom: 8 },
  relayContent: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 10, gap: 12 }, relayScene: { height: 210, position: 'relative' }, relayTag: { position: 'absolute', bottom: 2, left: 0, right: 0, alignItems: 'center' }, relayStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }, statValue: { color: theme.text, fontSize: 23, lineHeight: 30, fontWeight: '500' }, upgradeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10141F', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 10, gap: 10 }, upgradeCopy: { flex: 1, minWidth: 0, gap: 4 }, cardTitle: { color: theme.text, fontSize: 12, fontWeight: '600' }, upgradeAction: { paddingHorizontal: 9, maxWidth: '36%' }, storagePanel: { gap: 10, marginTop: 'auto' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, progressTrack: { height: 3, backgroundColor: '#202337', borderRadius: 2, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: theme.primary },
});
