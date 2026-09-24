import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react-native';

import { ObservatoryPressable as Pressable } from '@/components/observatory-button';
import { CelestialVisual } from '@/components/celestial-visual';
import { MotionSection } from '@/components/motion-section';
import type { StarDetail } from '@/components/star-detail-modal';
import { Text } from '@/components/astralys-text';
import { fetchStars, formatDistance, systemLabel, type StarCategory } from '@/features/star-catalogue';
import type { StarSort } from '@/features/catalogue-filters';
import { getCelestialDisplayName } from '@/utils/celestial-display-name';

/**
 * Accueil d'Explore (version B) : une étoile du jour, puis une rangée
 * horizontale par collection. « See all » ouvre la liste complète.
 */

type Collection = { key: string; title: string; category: StarCategory; sort: StarSort; tone: string };

const COLLECTIONS: readonly Collection[] = [
  { key: 'nearby', title: 'Nearby real worlds', category: 'nearby-confirmed', sort: 'nearest', tone: '#9ED7E5' },
  { key: 'bright', title: 'Bright beacons', category: 'bright', sort: 'brightness', tone: '#C8BAF5' },
  { key: 'frontiers', title: 'Distant frontiers', category: 'imagined-distant', sort: 'nearest', tone: '#F2CE77' },
] as const;

const ROW_SIZE = 10;
/** L'étoile du jour est tirée parmi les N systèmes réels les plus proches. */
const DAILY_POOL = 40;

type Rows = Record<string, StarDetail[]>;

type Props = {
  bottomInset: number;
  onHome: () => void;
  onSearch: () => void;
  onOpenStar: (star: StarDetail) => void;
  onSeeAll: (category: StarCategory, sort: StarSort) => void;
};

function dayIndex() {
  const now = new Date();
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
}

export function ExploreCollections({ bottomInset, onHome, onSearch, onOpenStar, onSeeAll }: Props) {
  const [daily, setDaily] = useState<StarDetail | null>(null);
  const [rows, setRows] = useState<Rows>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    const [pool, ...collections] = await Promise.all([
      fetchStars({ category: 'nearby-confirmed', sort: 'nearest', limit: DAILY_POOL }),
      ...COLLECTIONS.map(c => fetchStars({ category: c.category, sort: c.sort, limit: ROW_SIZE })),
    ]);
    const nextRows: Rows = {};
    COLLECTIONS.forEach((c, i) => { nextRows[c.key] = collections[i].stars; });
    setRows(nextRows);
    setDaily(pool.stars.length > 0 ? pool.stars[dayIndex() % pool.stars.length] : null);
    setFailed(pool.error && collections.every(r => r.error));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Return to home" onPress={onHome} style={styles.iconButton}>
          <ArrowLeft size={20} color="#C8BAF5" />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>Explore</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Search for a star" onPress={onSearch} style={styles.iconButton}>
          <Search size={20} color="#C8BAF5" />
        </Pressable>
      </View>

      {failed ? (
        <View accessibilityRole="alert" style={styles.errorCard}>
          <Text style={styles.errorText}>The catalogue could not be loaded right now.</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.dailySkeleton}><ActivityIndicator color="#B9A8E8" size="small" /></View>
      ) : daily ? (
        <MotionSection>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Star of the day: ${getCelestialDisplayName(daily)}`}
            onPress={() => onOpenStar(daily)}
            style={styles.daily}>
            <CelestialVisual object={daily} size={76} />
            <View style={styles.dailyCopy}>
              <Text style={styles.dailyEyebrow}>STAR OF THE DAY</Text>
              <Text numberOfLines={1} style={styles.dailyName}>{getCelestialDisplayName(daily)}</Text>
              <Text numberOfLines={1} style={styles.dailyMeta}>{`${formatDistance(daily.distance_ly)} · ${systemLabel(daily).toLowerCase()}`}</Text>
            </View>
            <ChevronRight size={20} color="#C8BAF5" />
          </Pressable>
        </MotionSection>
      ) : null}

      {COLLECTIONS.map((collection, index) => {
        const stars = rows[collection.key] ?? [];
        if (!loading && stars.length === 0) return null;
        return (
          <MotionSection key={collection.key} delay={40 + index * 40} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>{collection.title}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`See all ${collection.title}`}
                onPress={() => onSeeAll(collection.category, collection.sort)}
                style={styles.seeAll}>
                <Text style={[styles.seeAllText, { color: collection.tone }]}>See all</Text>
                <ChevronRight size={14} color={collection.tone} />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroller} contentContainerStyle={styles.row}>
              {loading
                ? Array.from({ length: 3 }, (_, i) => <View key={i} style={[styles.card, styles.cardSkeleton]} />)
                : stars.map(star => (
                  <Pressable
                    key={star.id}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${getCelestialDisplayName(star)}`}
                    onPress={() => onOpenStar(star)}
                    style={styles.card}>
                    <CelestialVisual object={star} size={52} />
                    <View style={styles.cardCopy}>
                      <Text numberOfLines={1} style={styles.cardName}>{getCelestialDisplayName(star)}</Text>
                      <Text numberOfLines={1} style={styles.cardMeta}>{formatDistance(star.distance_ly, true)}</Text>
                    </View>
                    <Text numberOfLines={1} style={[styles.cardTag, { color: collection.tone }]}>{systemLabel(star)}</Text>
                  </Pressable>
                ))}
            </ScrollView>
          </MotionSection>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: 24 },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, color: '#F6F4FB', fontSize: 26, lineHeight: 31, fontWeight: '600', letterSpacing: -0.6 },
  iconButton: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14,
    backgroundColor: '#141824', borderWidth: 1, borderColor: 'rgba(196,181,253,0.11)',
  },
  daily: {
    flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: 22,
    backgroundColor: '#111629', borderWidth: 1, borderColor: 'rgba(200,186,245,0.18)',
  },
  dailySkeleton: { height: 110, borderRadius: 22, backgroundColor: '#0F131E', alignItems: 'center', justifyContent: 'center' },
  dailyCopy: { flex: 1, minWidth: 0, gap: 5 },
  dailyEyebrow: { color: '#C8BAF5', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  dailyName: { color: '#F4F1FF', fontSize: 18, fontWeight: '600' },
  dailyMeta: { color: '#A1A9BB', fontSize: 12 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#F0EDF6', fontSize: 16, fontWeight: '600' },
  seeAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 12 },
  seeAllText: { fontSize: 12, fontWeight: '700' },
  rowScroller: { marginHorizontal: -20 },
  row: { gap: 10, paddingHorizontal: 20 },
  card: {
    width: 136, minHeight: 168, padding: 14, gap: 10, borderRadius: 18,
    backgroundColor: '#0F131E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.055)',
  },
  cardSkeleton: { opacity: 0.5 },
  cardCopy: { gap: 3 },
  cardName: { color: '#F0EDF6', fontSize: 13, fontWeight: '700' },
  cardMeta: { color: '#A1A9BB', fontSize: 11 },
  cardTag: { marginTop: 'auto', fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  errorCard: {
    minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#21141C', borderWidth: 1, borderColor: 'rgba(232,143,158,0.18)',
  },
  errorText: { flex: 1, color: '#CBA6AE', fontSize: 12 },
  retryText: { color: '#F1CED5', fontSize: 12, fontWeight: '800' },
});
