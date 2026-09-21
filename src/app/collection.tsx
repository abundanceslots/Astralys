import { ObservatoryPressable as Pressable, ObservatoryButton } from '@/components/observatory-button';
import { House, ArrowLeft, ArrowRight, Search, SlidersHorizontal, X, Sparkles, Scale, Crosshair, Orbit, ChevronRight } from 'lucide-react-native';
import { CelestialVisual } from '@/components/celestial-visual';
import { StarDetailModal, type StarDetail } from '@/components/star-detail-modal';
import { CelestialComparisonModal } from '@/components/celestial-comparison-modal';
import { useAuth } from '@/context/auth-context';
import { useFollowing } from '@/context/following-context';
import { supabase } from '@/lib/supabase';
import { getCelestialDisplayName } from '@/utils/celestial-display-name';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/astralys-text';
import { navigationClearance } from '@/constants/observatory-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotionSection } from '@/components/motion-section';

export default function CollectionScreen() {
  const { user } = useAuth();
  const { stars, error: storageError } = useFollowing();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selected, setSelected] = useState<StarDetail | null>(null);
  const [base, setBase] = useState<StarDetail | null>(null);
  const [guardians, setGuardians] = useState<StarDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setGuardians([]);
    setError(null);
    setLoading(Boolean(user));
    if (user) void supabase.from('guardian_systems')
      .select('id, planetary_systems(celestial_objects(*))').eq('user_id', user.id)
      .then(({ data, error: requestError }) => {
        if (!active) return;
        if (requestError) setError('Could not load your systems. Try again.');
        else {
          const rows = (data ?? []) as unknown as { planetary_systems: { celestial_objects: StarDetail | null } | null }[];
          setGuardians(rows.flatMap(row => row.planetary_systems?.celestial_objects ? [row.planetary_systems.celestial_objects] : []));
        }
        setLoading(false);
      });
    return () => { active = false; };
  }, [user?.id, retry]));
  useFocusEffect(useCallback(() => () => { setSelected(null); setBase(null); }, []));
  const home = () => { setSelected(null); setBase(null); router.replace('/'); };
  const card = (star: StarDetail, index: number) => {
    const Row = index < 6 ? MotionSection : View;
    return <Row key={star.id} {...(index < 6 ? { delay: index * 25 } : {})}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${getCelestialDisplayName(star)}`} onPress={() => setSelected(star)} style={styles.card}>
      <CelestialVisual object={star} size={48} />
      <View style={styles.cardCopy}><Text style={styles.cardTitle}>{getCelestialDisplayName(star)}</Text><Text style={styles.body}>{star.distance_ly == null ? 'Distance unknown' : `${Math.round(star.distance_ly).toLocaleString('en-US')} light-years`}</Text></View>
      <ChevronRight size={22} color="#A7B0C5" />
    </Pressable></Row>;
  };
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      {!selected && !base ? <ScrollView contentContainerStyle={[styles.content, { paddingBottom: navigationClearance(insets.bottom) + 16 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><Text style={styles.brand}>ASTRALYS</Text><Text style={styles.body}>{user ? 'Connected' : 'Guest'}</Text></View>
        <MotionSection><Text accessibilityRole="header" style={styles.title}>Collection</Text></MotionSection>
        <Text accessibilityRole="header" style={styles.section}>Following · {stars.length}</Text>
        {stars.length ? <Text style={styles.body}>Tap a star to open.</Text> : null}
        {storageError ? <Text accessibilityRole="alert" style={styles.error}>{storageError}</Text> : null}
        {stars.length ? stars.map(card) : <Text style={styles.body}>Choose your first star ↓</Text>}
        <MotionSection delay={80}><Link href="/explore" asChild><ObservatoryButton label="Explore stars" icon={Sparkles} /></Link></MotionSection>
        <Text accessibilityRole="header" style={styles.section}>Guardian systems</Text>
        {guardians.length ? <Text style={styles.body}>Tap a system to open.</Text> : null}
        {loading ? <ActivityIndicator accessibilityLabel="Loading guardian systems" color="#C8BAF5" /> : error ? <><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setRetry(n => n + 1)} style={styles.card}><Text style={styles.cardTitle}>Try again</Text></Pressable></> : guardians.length ? guardians.map(card) : <Text style={styles.body}>{user ? 'No systems yet.' : 'View your systems ↓'}</Text>}
        {!user ? <Link href={{ pathname: '/profile', params: { mode: 'signIn' } }} asChild><ObservatoryButton label="Sign in" variant="secondary" /></Link> : null}
      </ScrollView> : null}
      <StarDetailModal star={selected} onClose={() => setSelected(null)} onHome={home} onCompare={star => { setSelected(null); setBase(star); }} />
      <CelestialComparisonModal baseObject={base} onClose={() => { setSelected(base); setBase(null); }} onHome={home} />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#070911', paddingHorizontal: 20 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingBottom: 112, gap: 14 },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: '#F4F1FF', fontSize: 17, fontWeight: '900', letterSpacing: 3 },
  title: { color: '#F4F1FF', fontSize: 28, fontWeight: '700' },
  section: { color: '#F4F1FF', fontSize: 18, fontWeight: '700', marginTop: 10 },
  body: { color: '#A7B0C5', fontSize: 14, lineHeight: 22 },
  card: { minHeight: 80, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, backgroundColor: '#111827', gap: 12 },
  cardCopy: { flex: 1, gap: 4 },
  cardTitle: { color: '#F4F1FF', fontSize: 15, fontWeight: '700' },
  arrow: { color: '#BCDCEE', fontSize: 24 },
  primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#C8BAF5' },
  primaryText: { color: '#10232C', fontSize: 15, fontWeight: '800' },
  error: { color: '#FFC0CC', fontSize: 14, lineHeight: 21 },
});
