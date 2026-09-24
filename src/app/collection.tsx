import { ObservatoryButton } from '@/components/observatory-button';
import { haptic } from '@/features/orbital/haptics';
import { ArrowRight, Send, Sparkles, Star, Zap } from 'lucide-react-native';
import { CelestialVisual } from '@/components/celestial-visual';
import { StarDetailModal, type StarDetail } from '@/components/star-detail-modal';
import { CelestialComparisonModal } from '@/components/celestial-comparison-modal';
import { useAuth } from '@/context/auth-context';
import { useFollowing } from '@/context/following-context';
import { useAcquisitions } from '@/context/acquisitions-context';
import { useGuardianProgress } from '@/context/guardian-progress-context';
import { demoPlanets, stateEnergyPerHour } from '@/features/guardian-demo-model';
import { getCelestialDisplayName } from '@/utils/celestial-display-name';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable as RNPressable, ScrollView, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/astralys-text';
import { navigationClearance } from '@/constants/observatory-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotionSection } from '@/components/motion-section';
import { EnterSystemButton } from '@/components/enter-system-button';

const VIOLET = '#C8BAF5', GREEN = '#9CCCB7', GOLD = '#F2C879', MUTED = '#8C94AA';
const distanceLabel = (star: StarDetail) => star.distance_ly == null ? 'Distance unknown' : `${Math.round(star.distance_ly).toLocaleString('en-US')} light-years`;

/** Bouton avec petit enfoncement + vibration légère, sans le style automatique des boutons de l'app. */
function Pressable({ style, onPress, ...props }: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> }) {
  return <RNPressable {...props} onPress={event => { haptic('tick'); onPress?.(event); }}
    style={({ pressed }) => [style, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]} />;
}

export default function CollectionScreen() {
  const { user } = useAuth();
  const { stars, error: storageError } = useFollowing();
  const { stars: guardians, loading, error, refresh } = useAcquisitions();
  const { progressFor } = useGuardianProgress();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selected, setSelected] = useState<StarDetail | null>(null);
  const [base, setBase] = useState<StarDetail | null>(null);
  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));
  useFocusEffect(useCallback(() => () => { setSelected(null); setBase(null); }, []));
  const home = () => { setSelected(null); setBase(null); router.replace('/'); };
  const enter = (star: StarDetail) => router.push({ pathname: '/observatory', params: { view: 'system', starId: star.id } });

  const total = demoPlanets.length;

  /* ---- Vitrine d'un système possédé ---- */
  const showcase = (star: StarDetail, index: number) => {
    // Chaque système a sa propre progression.
    const progress = progressFor(star.id);
    const reached = progress.connected.length;
    const perHour = stateEnergyPerHour(progress);
    return <MotionSection key={star.id} delay={index * 60}>
      <View style={styles.showcase}>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${getCelestialDisplayName(star)} details`} onPress={() => setSelected(star)} style={styles.showcaseTop}>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: 'rgba(156,204,183,0.14)' }]}><View style={[styles.badgeDot, { backgroundColor: GREEN }]} /><Text style={[styles.badgeText, { color: GREEN }]}>ONLINE</Text></View>
            {progress.probeTarget ? <View style={[styles.badge, { backgroundColor: 'rgba(200,186,245,0.14)' }]}><Send size={10} color={VIOLET} /><Text style={[styles.badgeText, { color: VIOLET }]}>PROBE EN ROUTE</Text></View> : null}
          </View>
          <View style={styles.showcaseArt}>
            <View style={styles.showcaseStar}><CelestialVisual animated object={star} size={168} /></View>
          </View>
        </Pressable>
        <View style={styles.showcaseInfo}>
          <Text numberOfLines={1} accessibilityRole="header" style={styles.showcaseName}>{getCelestialDisplayName(star)}</Text>
          <Text numberOfLines={1} style={styles.showcaseMeta}>{distanceLabel(star)}</Text>
            <View accessible accessibilityLabel={`${reached} of ${total} planets reached`} style={styles.segments}>
              {Array.from({ length: total }, (_, i) => <View key={i} style={[styles.segment, i < reached && styles.segmentOn]} />)}
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.stat}>{reached} / {total} planets</Text>
              <View style={styles.statRight}><Zap size={12} color={VIOLET} /><Text style={styles.stat}>{perHour.toLocaleString('en-US')} ⚡/h</Text></View>
            </View>
          <EnterSystemButton onEnter={() => enter(star)} style={styles.enterButton} />
        </View>
      </View>
    </MotionSection>;
  };

  /* ---- Carte d'une étoile suivie (carrousel) ---- */
  const followCard = (star: StarDetail) => <Pressable key={star.id} accessibilityRole="button" accessibilityLabel={`View ${getCelestialDisplayName(star)}`} onPress={() => setSelected(star)} style={styles.followCard}>
    <View style={styles.followArt}><CelestialVisual object={star} size={54} /></View>
    <Text numberOfLines={1} style={styles.followName}>{getCelestialDisplayName(star)}</Text>
    <Text numberOfLines={1} style={styles.followMeta}>{star.distance_ly == null ? '—' : `${Math.round(star.distance_ly).toLocaleString('en-US')} ly`}</Text>
  </Pressable>;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      {!selected && !base ? <ScrollView contentContainerStyle={[styles.content, { paddingBottom: navigationClearance(insets.bottom) + 16 }]} showsVerticalScrollIndicator={false}>
        <MotionSection style={styles.hero}>
          <Text style={styles.eyebrow}>YOUR UNIVERSE</Text>
          <Text accessibilityRole="header" style={styles.title}>My sky</Text>
        </MotionSection>

        {loading && !guardians.length ? <ActivityIndicator accessibilityLabel="Loading acquired systems" color={VIOLET} style={styles.loader} />
          : error ? <View style={styles.emptyCard}>
            <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            <ObservatoryButton label="Try again" variant="secondary" onPress={() => void refresh()} />
          </View>
          : guardians.length ? guardians.map(showcase)
          : <MotionSection style={styles.emptyCard}>
            <Sparkles size={24} color={GOLD} />
            <Text style={styles.emptyTitle}>Your first system starts with a star.</Text>
            <Text style={styles.body}>{user ? 'Explore the sky to find yours.' : 'Sign in to see your systems.'}</Text>
            {!user ? <Link href={{ pathname: '/profile', params: { mode: 'signIn' } }} asChild><ObservatoryButton label="Sign in" variant="secondary" /></Link> : null}
            <Link href="/explore" asChild><ObservatoryButton label="Explore stars" icon={Sparkles} /></Link>
          </MotionSection>}

        <View style={styles.sectionRow}>
          <Text accessibilityRole="header" style={styles.section}>Following</Text>
          <Text style={styles.sectionCount}>{stars.length} {stars.length === 1 ? 'star' : 'stars'}</Text>
        </View>
        {storageError ? <Text accessibilityRole="alert" style={styles.error}>{storageError}</Text> : null}
        {stars.length
          ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel} style={styles.carouselFrame}>{stars.map(followCard)}</ScrollView>
          : <Text style={styles.body}>Stars you follow will appear here.</Text>}

        {guardians.length ? <MotionSection delay={120}>
          <Link href="/store" asChild>
            <Pressable accessibilityRole="button" style={styles.claimRow}>
              <Star size={20} color={GOLD} />
              <View style={styles.claimCopy}>
                <Text style={styles.claimTitle}>Claim another star</Text>
                <Text style={styles.claimText}>Open a new system · from €1.99</Text>
              </View>
              <ArrowRight size={18} color={MUTED} />
            </Pressable>
          </Link>
        </MotionSection> : null}
      </ScrollView> : null}
      <StarDetailModal star={selected} onClose={() => setSelected(null)} onHome={home} onCompare={star => { setSelected(null); setBase(star); }} />
      <CelestialComparisonModal baseObject={base} onClose={() => { setSelected(base); setBase(null); }} onHome={home} />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#070911', paddingHorizontal: 16 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 14 },
  hero: { gap: 4, paddingTop: 6, paddingHorizontal: 4 },
  eyebrow: { color: '#A996DF', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: '#F4F1FF', fontSize: 28, fontWeight: '700' },
  loader: { marginVertical: 40 },

  showcase: { borderRadius: 26, overflow: 'hidden', backgroundColor: '#0E1222', borderWidth: 1, borderColor: 'rgba(200,186,245,0.18)' },
  showcaseTop: { minHeight: 190, paddingTop: 16, paddingHorizontal: 16, backgroundColor: 'transparent' },
  badges: { flexDirection: 'row', gap: 6, zIndex: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  showcaseArt: { position: 'absolute', right: 6, top: 6, width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  showcaseStar: { width: 168, height: 168, alignItems: 'center', justifyContent: 'center' },
  showcaseInfo: { paddingHorizontal: 18, paddingBottom: 18, gap: 2 },
  showcaseName: { color: '#F4F1FF', fontSize: 24, lineHeight: 30, fontWeight: '700' },
  showcaseMeta: { color: MUTED, fontSize: 12 },
  segments: { flexDirection: 'row', gap: 5, marginTop: 12 },
  segment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#252A3E' },
  segmentOn: { backgroundColor: VIOLET },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  statRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stat: { color: '#B3BACB', fontSize: 12 },
  enterButton: { marginTop: 14 },

  emptyCard: { alignItems: 'center', gap: 10, padding: 24, borderRadius: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: '#2A3048' },
  emptyTitle: { color: '#F4F1FF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  body: { color: '#A7B0C5', fontSize: 14, lineHeight: 22, textAlign: 'center' },
  error: { color: '#FFC0CC', fontSize: 14, lineHeight: 21, textAlign: 'center' },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6, paddingHorizontal: 4 },
  section: { color: '#F4F1FF', fontSize: 17, fontWeight: '700' },
  sectionCount: { color: MUTED, fontSize: 12 },
  carouselFrame: { marginHorizontal: -16 },
  carousel: { gap: 12, paddingHorizontal: 16 },
  followCard: { width: 118, minHeight: 150, padding: 12, borderRadius: 20, backgroundColor: '#10141F', borderWidth: 1, borderColor: '#1F2436', justifyContent: 'flex-end' },
  followArt: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 70 },
  followName: { color: '#F4F1FF', fontSize: 14, fontWeight: '600' },
  followMeta: { color: MUTED, fontSize: 11, marginTop: 2 },

  claimRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#2A3048', backgroundColor: 'transparent' },
  claimCopy: { flex: 1, gap: 2 },
  claimTitle: { color: '#F4F1FF', fontSize: 14, fontWeight: '600' },
  claimText: { color: MUTED, fontSize: 12 },
});
