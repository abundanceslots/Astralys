import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, ArrowRight, CalendarDays, LockKeyhole, Send, ShieldAlert, Sparkle, X, Zap } from 'lucide-react-native';
import { ChapterIntroCard, DailyTicket, DoneBadge, PillButton, RoutePath, RUN_COLORS, WaitingButton } from '@/components/run-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/astralys-text';
import OrbitalHook, { type OrbitalEvent, type OrbitalHookHandle } from '@/components/orbital-hook';
import { ObservatoryPressable } from '@/components/observatory-button';
import { Observatory as theme } from '@/constants/observatory-theme';
import { useGuardianProgress } from '@/context/guardian-progress-context';
import { useMotionPreferences } from '@/context/motion-context';
import { haptic } from '@/features/orbital/haptics';
import {
  dailyCompletionBonus, dailyDone, dailyMissionReward, dailyStageToday, dailyStreak, dailyTrialLength, dayStamp,
  msUntilNextDaily, probeTravelTime, routeChapter, routeComplete, routeCutPerLevel, routeLength, routeMissionReward,
  routeStage, unlockedChapters, activeSystemEvent, systemEventCompletionReward, systemEventLength, systemEventLevelReward,
} from '@/features/guardian-demo-model';
import { EVENT_COLORS } from '@/components/system-event';
import { createDailyLevels, createRouteLevels, RUN_CHAPTERS } from '@/features/orbital/run-levels';

const CHAPTER_KEY = 'astralys:run:chapter-seen';
const readSeenChapter = () => { try { return Number(localStorage.getItem(CHAPTER_KEY) ?? 0) || 0; } catch { return 0; } };

/** Deux familles bien distinctes : couleur, icône et libellé propres. */
const TRACKS = {
  route: { label: 'PROGRESS TRIAL', color: '#C8BAF5', tint: 'rgba(200,186,245,0.10)', border: 'rgba(200,186,245,0.35)' },
  daily: { label: 'DAILY TRIALS', color: '#F2C879', tint: 'rgba(242,200,121,0.08)', border: 'rgba(242,200,121,0.32)' },
} as const;
/** Troisième famille : les événements (défense contre l'essaim, capture de la comète). */
type Track = keyof typeof TRACKS | 'event';
const eventPalette = (kind: 'drones' | 'comet') => ({ label: kind === 'drones' ? 'DEFENSE' : 'COMET CAPTURE', color: EVENT_COLORS[kind] });
type Screen = 'hub' | 'play' | 'done';

function formatCountdown(ms: number) {
  const minutes = Math.max(0, Math.ceil(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  if (hours) return `${hours} h ${String(minutes % 60).padStart(2, '0')}`;
  return minutes > 1 ? `${minutes} min` : 'less than a minute';
}

/** Score du niveau (O3) : 3 étoiles au premier essai, 2 jusqu'au 3e, sinon 1. */
const starLine = (stars: number | undefined) => { const n = Math.max(1, Math.min(3, stars ?? 1)); return '★'.repeat(n) + '☆'.repeat(3 - n); };

function Dots({ done, total, color }: { done: number; total: number; color: string }) {
  return <View accessible accessibilityLabel={`${done} of ${total} levels cleared`} style={styles.dots}>
    {Array.from({ length: total }, (_, i) => <View key={i} style={[styles.dot, { borderColor: color }, i < done && { backgroundColor: color }]} />)}
  </View>;
}

type Props = { visible: boolean; onClose: () => void; systemName?: string; planetLabel?: (planet: string) => string; initialTrack?: 'event' | null };

export function OrbitalMissionGame({ visible, onClose, systemName = 'TRAPPIST-1', planetLabel, initialTrack = null }: Props) {
  const { state, dispatch } = useGuardianProgress();
  const { reducedMotion } = useMotionPreferences();
  const insets = useSafeAreaInsets();
  const game = useRef<OrbitalHookHandle>(null);
  const expectedMission = useRef(0);
  const [seenChapter, setSeenChapter] = useState(readSeenChapter);
  const [track, setTrack] = useState<Track>('route');
  const [screen, setScreen] = useState<Screen>('hub');
  const [restartKey, setRestartKey] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [now, setNow] = useState(Date.now());
  const [pathSize, setPathSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!visible) return;
    setScreen('hub');
    setFeedback('');
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [visible]);

  /* ---- épreuve d'avancement (route vers la planète visée) ---- */
  const target = state.probeTarget;
  const routeLen = target ? routeLength(target) : 0;
  const rStage = routeStage(state);
  const routeDone = routeComplete(state);
  const routeChapterInfo = target ? RUN_CHAPTERS[routeChapter(target) - 1] : null;
  const routeLevels = useMemo(() => (target ? createRouteLevels(routeChapter(target), routeLength(target)) : []), [target]);
  const probeRemaining = state.probeReadyAt ? Math.max(0, state.probeReadyAt - now) : 0;
  const probeProgress = state.probeStartedAt && target ? Math.min(1, Math.max(0, (now - state.probeStartedAt) / Math.max(1, (state.probeReadyAt ?? now) - state.probeStartedAt))) : 0;
  const cutMinutes = target ? Math.max(1, Math.round(probeTravelTime(target) * routeCutPerLevel(target) / 60_000)) : 0;

  /* ---- épreuves du jour ---- */
  const today = dayStamp(now);
  const unlocked = unlockedChapters(state);
  const daily = useMemo(() => createDailyLevels(today, unlocked, dailyTrialLength), [today, unlocked]);
  const dStage = dailyStageToday(state, now);
  const dDone = dailyDone(state, now);
  const streak = dailyStreak(state, now);
  const dailyTotal = Array.from({ length: dailyTrialLength }, (_, i) => dailyMissionReward(state, i, 1)).reduce((a, b) => a + b, 0) + dailyCompletionBonus(state);

  /* ---- événement en cours ---- */
  // Seul l'essaim se joue dans Orbital Run (la comète se récolte en la touchant dans le système).
  const anyEvent = activeSystemEvent(state, now);
  const sysEvent = anyEvent?.kind === 'drones' ? anyEvent : null;
  const eventSeq = sysEvent?.seq ?? 0;
  const eventLen = sysEvent ? systemEventLength(sysEvent) : 0;
  const eventLevels = useMemo(() => (eventSeq ? createDailyLevels(90_000_000 + eventSeq, unlocked, eventLen).levels : []), [eventSeq, unlocked, eventLen]);
  const eventPlanet = sysEvent ? (planetLabel ? planetLabel(sysEvent.planet) : `${systemName} ${sysEvent.planet}`) : '';
  const [lastEventKind, setLastEventKind] = useState<'drones' | 'comet'>('comet');
  useEffect(() => { if (sysEvent) setLastEventKind(sysEvent.kind); }, [sysEvent]);

  // Ouvert depuis la bannière d'événement : on lance directement la partie.
  useEffect(() => {
    if (visible && initialTrack === 'event' && sysEvent) start('event');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialTrack]);

  // L'événement a expiré pendant la partie : on termine.
  useEffect(() => {
    if (visible && screen === 'play' && track === 'event' && !sysEvent) setScreen('done');
  }, [visible, screen, track, sysEvent]);

  // La sonde est arrivée pendant la partie : la route se ferme d'elle-même.
  useEffect(() => {
    if (visible && screen === 'play' && track === 'route' && !target) setScreen('done');
  }, [visible, screen, track, target]);

  const needsIntro = track === 'route' && routeChapterInfo !== null && routeChapterInfo.number > seenChapter && rStage === 0;
  const start = (next: Track) => {
    haptic('tick');
    setTrack(next);
    setFeedback('');
    expectedMission.current = next === 'route' ? rStage : next === 'event' ? (sysEvent?.stage ?? 0) : dStage;
    setRestartKey(key => key + 1);
    setScreen('play');
  };
  const dismissIntro = () => {
    if (!routeChapterInfo) return;
    setSeenChapter(routeChapterInfo.number);
    try { localStorage.setItem(CHAPTER_KEY, String(routeChapterInfo.number)); } catch { /* Stockage indisponible. */ }
  };

  const onEvent = useCallback((event: OrbitalEvent) => {
    if (event.type === 'ready') {
      if (expectedMission.current > 0) game.current?.goTo(expectedMission.current);
    } else if (event.type === 'mission') {
      if (event.mission !== expectedMission.current) return;
      expectedMission.current = event.mission + 1;
      if (track === 'route') {
        if (!state.probeTarget) return;
        const reward = routeMissionReward(state);
        dispatch({ type: 'orbital-mission', mission: event.mission, now: Date.now() });
        setFeedback(`${starLine(event.stars)}  +${reward} ⚡ · probe ${cutMinutes >= 60 ? `${Math.round(cutMinutes / 60)} h` : `${cutMinutes} min`} closer`);
        if (event.mission >= routeLevels.length - 1) { haptic('success'); setScreen('done'); }
      } else if (track === 'event') {
        const ev = activeSystemEvent(state, Date.now());
        if (!ev || ev.kind !== 'drones') return;
        const last = event.mission >= systemEventLength(ev) - 1;
        const reward = systemEventLevelReward(state, ev.kind) + (last ? systemEventCompletionReward(state, ev.kind) : 0);
        dispatch({ type: 'event-mission', mission: event.mission, now: Date.now() });
        setFeedback(`${starLine(event.stars)}  +${reward.toLocaleString('en-US')} ⚡`);
        if (last) { haptic('success'); setScreen('done'); }
      } else {
        const last = event.mission >= dailyTrialLength - 1;
        const reward = dailyMissionReward(state, event.mission, event.attempts) + (last ? dailyCompletionBonus(state) : 0);
        dispatch({ type: 'daily-mission', mission: event.mission, attempts: event.attempts, now: Date.now() });
        setFeedback(`${starLine(event.stars)}  +${reward.toLocaleString('en-US')} ⚡${event.attempts === 1 ? ' · first-try bonus' : ''}`);
        if (last) { haptic('success'); setScreen('done'); }
      }
    } else if (event.type === 'fail') {
      setFeedback('');
    } else if (event.type === 'complete') {
      setScreen('done');
    }
  }, [cutMinutes, dispatch, routeLevels.length, state, track]);

  const palette = track === 'event' ? eventPalette(sysEvent?.kind ?? lastEventKind) : TRACKS[track];
  const playStage = track === 'route' ? rStage : track === 'event' ? (sysEvent?.stage ?? eventLen) : dStage;
  const playTotal = track === 'route' ? routeLen : track === 'event' ? eventLen : dailyTrialLength;
  const playLevels = track === 'route' ? routeLevels : track === 'event' ? eventLevels : daily.levels;
  const eventTotalReward = sysEvent ? Array.from({ length: eventLen - sysEvent.stage }, () => systemEventLevelReward(state, sysEvent.kind)).reduce((a, b) => a + b, 0) + systemEventCompletionReward(state, sysEvent.kind) : 0;
  const eventTitle = sysEvent ? (sysEvent.kind === 'drones' ? `Defend ${eventPlanet}` : 'Catch the comet') : '';
  const backToHub = () => { setScreen('hub'); setFeedback(''); };

  return <Modal animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={screen === 'hub' ? onClose : backToHub} visible={visible}>
    <View style={[styles.screen, { paddingTop: insets.top + 4, paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.header}>
        {screen === 'hub'
          ? <ObservatoryPressable variant="quiet" accessibilityLabel="Close Orbital Run" accessibilityRole="button" onPress={onClose} style={styles.close}><X size={21} color={theme.text} /></ObservatoryPressable>
          : <ObservatoryPressable variant="quiet" accessibilityLabel="Back to trials" accessibilityRole="button" onPress={backToHub} style={styles.close}><ArrowLeft size={21} color={theme.text} /></ObservatoryPressable>}
        <View style={styles.headerCopy}>
          {screen === 'hub'
            ? <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>Orbital Run</Text>
            : <>
              <Text numberOfLines={1} style={[styles.headerTag, { color: palette.color }]}>{palette.label}</Text>
              <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
                {track === 'route' ? `Route to ${systemName} ${target ?? ''}` : track === 'event' ? (eventTitle || 'Event') : daily.chapter.name}
              </Text>
            </>}
        </View>
        {screen === 'play' ? <Dots done={playStage} total={playTotal} color={palette.color} /> : null}
        <View style={styles.energy}><Zap size={14} color={theme.primary} /><Text style={styles.energyText}>{state.energy.toLocaleString('en-US')}</Text></View>
      </View>

      {screen === 'hub' ? <View style={styles.hub}>
        {/* ---------- Événement en cours : prioritaire, en haut ---------- */}
        {sysEvent ? <Animated.View entering={FadeInDown.duration(260)}>
          <ObservatoryPressable variant="quiet" accessibilityRole="button" accessibilityLabel={`${eventTitle}. ${sysEvent.stage} of ${eventLen} levels cleared`} onPress={() => start('event')}
            style={[styles.eventCard, { borderColor: `${EVENT_COLORS[sysEvent.kind]}66` }]}>
            {sysEvent.kind === 'drones' ? <ShieldAlert size={20} color={EVENT_COLORS.drones} /> : <Sparkle size={20} color={EVENT_COLORS.comet} />}
            <View style={styles.eventCopy}>
              <Text style={[styles.cardTag, { color: EVENT_COLORS[sysEvent.kind] }]}>{sysEvent.kind === 'drones' ? 'DRONE SWARM' : 'COMET PASSING'} · {formatCountdown(sysEvent.endsAt - now)} left</Text>
              <Text style={styles.eventTitle}>{eventTitle}</Text>
              <Text style={styles.cardSub}>{eventLen} short levels · up to +{eventTotalReward.toLocaleString('en-US')} ⚡</Text>
            </View>
            <Dots done={sysEvent.stage} total={eventLen} color={EVENT_COLORS[sysEvent.kind]} />
          </ObservatoryPressable>
        </Animated.View> : null}
        {/* ---------- Épreuve d'avancement : la route en chemin de nœuds ---------- */}
        <View style={styles.routeHead}>
          <View style={styles.cardTop}>
            <Send size={15} color={TRACKS.route.color} />
            <Text style={[styles.cardTag, { color: TRACKS.route.color }]}>{TRACKS.route.label}</Text>
            {routeChapterInfo ? <Text style={styles.cardSub}>Chapter {routeChapterInfo.number} · {routeChapterInfo.name}</Text> : null}
          </View>
          <Text style={styles.cardTitle}>{target ? `Route to ${systemName} ${target}` : 'No route open'}</Text>
        </View>
        <View style={styles.pathArea} onLayout={event => setPathSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
          {!target ? <View style={styles.noRoute}>
            <LockKeyhole size={22} color={RUN_COLORS.dim} />
            <Text style={styles.noRouteText}>A route opens while a probe travels. Launch one from your system.</Text>
          </View> : pathSize.height > 0 ? <Animated.View entering={FadeIn.duration(300)}>
            <RoutePath width={pathSize.width} height={pathSize.height - (routeDone ? 64 : 34)} length={routeLen} stage={rStage}
              planetLabel={`${systemName} ${target}`} arrival={`Arrival in ${formatCountdown(probeRemaining)}`} onPlay={() => start('route')} />
            {routeDone
              ? <WaitingButton label={`Route complete · arrives in ${formatCountdown(probeRemaining)}`} progress={probeProgress} style={styles.pathFooter} />
              : <Text style={styles.pathHint}>Level {rStage + 1} · −{cutMinutes >= 60 ? `${Math.round(cutMinutes / 60)} h` : `${cutMinutes} min`} on the trip</Text>}
          </Animated.View> : null}
        </View>

        {/* ---------- Épreuves du jour : ticket doré ---------- */}
        <Animated.View entering={FadeInDown.delay(80).duration(260)}>
          <DailyTicket stage={dStage} total={dailyTrialLength} chapterName={daily.chapter.name} streak={streak}
            reward={`up to +${dailyTotal.toLocaleString('en-US')} ⚡`} done={dDone} resetIn={formatCountdown(msUntilNextDaily(now))} onPlay={() => start('daily')} />
        </Animated.View>
      </View> : null}

      {screen === 'play' ? <View style={styles.gameFrame}>
        {needsIntro && routeChapterInfo ? <View style={styles.intro}>
          <ChapterIntroCard number={routeChapterInfo.number} name={routeChapterInfo.name} rule={routeChapterInfo.rule} onStart={dismissIntro} />
        </View> : <OrbitalHook key={`${track}-${restartKey}`} ref={game} levels={playLevels} onEvent={onEvent} style={styles.game} />}
        {feedback ? <Animated.View key={feedback} entering={FadeIn.duration(200)} pointerEvents="none" style={styles.toast}><Text style={styles.toastText}>{feedback}</Text></Animated.View> : null}
      </View> : null}

      {screen === 'done' ? <Animated.View entering={FadeIn.duration(260)} style={styles.done}>
        <DoneBadge color={palette.color} />
        {track === 'event' ? (lastEventKind === 'drones' ? <>
          <Text style={[styles.introEyebrow, { color: palette.color }]}>SWARM REPELLED</Text>
          <Text accessibilityRole="header" style={styles.introTitle}>Your system is safe</Text>
          <Text style={styles.introRule}>The drone ring has broken apart. Production is back to normal and the salvaged parts were turned into energy.</Text>
        </> : <>
          <Text style={[styles.introEyebrow, { color: palette.color }]}>COMET CAPTURED</Text>
          <Text accessibilityRole="header" style={styles.introTitle}>Its ice is now energy</Text>
          <Text style={styles.introRule}>Comets pass by from time to time. Keep an eye on your sky.</Text>
        </>) : track === 'route' ? (target ? <>
          <Text style={[styles.introEyebrow, { color: palette.color }]}>ROUTE COMPLETE</Text>
          <Text accessibilityRole="header" style={styles.introTitle}>The probe is on its final approach</Text>
          <Text style={styles.introRule}>You have done everything for this step. Arrival in {formatCountdown(probeRemaining)}: come back then to discover {systemName} {target}.</Text>
        </> : <>
          <Text style={[styles.introEyebrow, { color: palette.color }]}>PROBE ARRIVED</Text>
          <Text accessibilityRole="header" style={styles.introTitle}>A new world is waiting</Text>
          <Text style={styles.introRule}>Go back to your system to see what the dust was hiding.</Text>
        </>) : <>
          <Text style={[styles.introEyebrow, { color: palette.color }]}>DAILY TRIALS COMPLETE</Text>
          <Text accessibilityRole="header" style={styles.introTitle}>See you tomorrow</Text>
          <Text style={styles.introRule}>{streak}-day streak. New trials in {formatCountdown(msUntilNextDaily(now))}.</Text>
        </>}
        {feedback ? <Text style={styles.doneGain}>{feedback}</Text> : null}
        {track === 'route' && target ? <WaitingButton label={`Arrives in ${formatCountdown(probeRemaining)}`} progress={probeProgress} style={styles.introButton} /> : null}
        {track === 'daily' ? <WaitingButton tone="done" label={`Done for today · ${formatCountdown(msUntilNextDaily(now))}`} style={styles.introButton} /> : null}
        <PillButton label="Back to my system" tone="route" trailing={<ArrowRight size={17} color="#141826" />} onPress={onClose} style={styles.introButton} />
        {track !== 'daily' && !dDone ? <PillButton label="Play the daily trials" tone="daily-outline" icon={CalendarDays} onPress={() => start('daily')} style={styles.introButton} /> : null}
      </Animated.View> : null}
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#070911' },
  header: { minHeight: 52, paddingHorizontal: 8, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTag: { fontSize: 10, lineHeight: 13, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: theme.text, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  energy: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  energyText: { color: theme.text, fontSize: 12, fontWeight: '700' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },

  hub: { flex: 1, padding: 16, paddingTop: 6, gap: 12 },
  routeHead: { gap: 4 },
  eventCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, backgroundColor: 'rgba(16,20,31,0.9)' },
  eventCopy: { flex: 1, minWidth: 0, gap: 2 },
  eventTitle: { color: theme.text, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTag: { flex: 1, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  cardTitle: { color: theme.text, fontSize: 21, lineHeight: 27, fontWeight: '600' },
  cardSub: { color: '#8C94AA', fontSize: 12, lineHeight: 17 },
  pathArea: { flex: 1, minHeight: 280 },
  pathHint: { color: '#B3BACB', fontSize: 12, textAlign: 'center', marginTop: 8 },
  pathFooter: { marginTop: 10 },
  noRoute: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 30, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: '#2A3048' },
  noRouteText: { color: '#8C94AA', fontSize: 14, lineHeight: 20, textAlign: 'center' },

  gameFrame: { flex: 1, overflow: 'hidden', backgroundColor: '#090D18' },
  game: { flex: 1 },
  toast: { position: 'absolute', top: 12, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, backgroundColor: 'rgba(12,14,28,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  toastText: { color: '#9CCCB7', fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  intro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#0C1020' },
  introEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 2, textAlign: 'center' },
  introTitle: { color: theme.text, fontSize: 26, lineHeight: 32, fontWeight: '600', textAlign: 'center' },
  introRule: { color: '#B3BACB', fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 320 },
  introButton: { alignSelf: 'stretch', maxWidth: 320, width: '100%', marginTop: 4 },

  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  doneGain: { color: '#9CCCB7', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
