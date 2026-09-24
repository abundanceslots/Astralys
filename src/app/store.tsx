/**
 * Boutique (design S1 « vitrine vedette ») : une étoile riche en vraies planètes mise en avant,
 * puis les paliers de prix (nombre de vraies planètes) et la liste. Première étoile offerte.
 * Pas de monnaie ni de boosts payants. Les cosmétiques sont annoncés « bientôt ».
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable as RNPressable, ScrollView, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronRight, Gift, Palette, RotateCcw, Sparkles } from 'lucide-react-native';
import { Text } from '@/components/astralys-text';
import { CelestialVisual } from '@/components/celestial-visual';
import { MotionSection } from '@/components/motion-section';
import { StarPurchaseSheet } from '@/components/star-purchase-sheet';
import type { StarDetail } from '@/components/star-detail-modal';
import { navigationClearance } from '@/constants/observatory-theme';
import { useAcquisitions } from '@/context/acquisitions-context';
import { haptic } from '@/features/orbital/haptics';
import { formatDistance } from '@/features/star-catalogue';
import { isFreeClaim, systemComposition, TIER_ORDER, TIERS, UPCOMING_COSMETICS, type StarTier } from '@/features/store-catalog';
import { fetchStoreStars } from '@/lib/store-stars';
import { getCelestialDisplayName } from '@/utils/celestial-display-name';

const MUTED = '#8C94AA', GOLD = '#FFD66B';

function Pressable({ style, onPress, ...props }: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> }) {
  return <RNPressable {...props} onPress={event => { haptic('tick'); onPress?.(event); }}
    style={({ pressed }) => [style, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]} />;
}

const compositionLabel = (star: StarDetail) => {
  const c = systemComposition(star.confirmed_planet_count ?? 0)!;
  return c.real ? `${c.real} real · ${c.imagined} imagined` : `${c.imagined} imagined worlds`;
};

type Shelf = { stars: StarDetail[]; loading: boolean; error: boolean };

const SHORT: Record<StarTier, string> = { real4: '4+ real', real2: '2–3 real', real1: '1 real', imagined: 'Imagined' };

/** 7 emplacements : pastille pleine verte = vraie planète, cercle violet = planète imaginée. */
function PlanetDots({ real }: { real: number }) {
  const c = systemComposition(real)!;
  return <View style={styles.dots} accessibilityLabel={`${c.real} real planets, ${c.imagined} imagined`}>
    {Array.from({ length: c.real + c.imagined }, (_, i) => <View key={i} style={[styles.dot, i < c.real ? styles.dotReal : styles.dotImagined]} />)}
  </View>;
}

export default function StoreScreen() {
  const insets = useSafeAreaInsets();
  const { stars: owned, refresh } = useAcquisitions();
  const [tier, setTier] = useState<StarTier>('real4');
  const [shelves, setShelves] = useState<Partial<Record<StarTier, Shelf>>>({});
  const [selected, setSelected] = useState<StarDetail | null>(null);
  const free = isFreeClaim(owned.length);
  const loading = useRef(new Set<StarTier>());

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const load = useCallback((key: StarTier) => {
    if (loading.current.has(key)) return;
    loading.current.add(key);
    setShelves(current => ({ ...current, [key]: { stars: [], loading: true, error: false } }));
    fetchStoreStars(key)
      .then(stars => setShelves(current => ({ ...current, [key]: { stars, loading: false, error: false } })))
      .catch(() => { loading.current.delete(key); setShelves(current => ({ ...current, [key]: { stars: [], loading: false, error: true } })); });
  }, []);
  // La vedette vient toujours des systèmes les plus riches ; la liste suit le palier choisi.
  useEffect(() => { load('real4'); }, [load]);
  useEffect(() => { load(tier); }, [load, tier]);

  const shelf = shelves[tier];
  const info = TIERS[tier];
  const richest = shelves.real4?.stars ?? [];
  const featured = richest.find(star => !owned.some(item => item.id === star.id)) ?? richest[0] ?? null;
  const featuredOwned = featured ? owned.some(item => item.id === featured.id) : false;
  const priceLabel = (key: StarTier) => free ? 'Free' : TIERS[key].price;

  return <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: navigationClearance(insets.bottom) + 16 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>ASTRALYS STORE</Text>
        <Text accessibilityRole="header" style={styles.title}>Claim a star</Text>
      </View>

      {/* Vitrine vedette */}
      {featured ? <MotionSection>
        <Pressable accessibilityRole="button" accessibilityLabel={`Featured star ${getCelestialDisplayName(featured)}, ${featuredOwned ? 'owned' : priceLabel('real4')}`}
          onPress={() => setSelected(featured)} style={styles.feature}>
          <View pointerEvents="none" style={styles.featureArt}><CelestialVisual object={featured} size={150} animated /></View>
          <Text style={styles.featureEyebrow}>FEATURED · 4+ REAL PLANETS</Text>
          <Text numberOfLines={2} style={styles.featureName}>{getCelestialDisplayName(featured)}</Text>
          <Text style={styles.featureMeta}>{formatDistance(featured.distance_ly ?? null)}</Text>
          <PlanetDots real={featured.confirmed_planet_count ?? 0} />
          <Text style={styles.featureComposition}>{compositionLabel(featured)}</Text>
          <View style={styles.featureFooter}>
            <View>
              {free && !featuredOwned ? <Text style={styles.struck}>{TIERS.real4.price}</Text> : null}
              <Text style={styles.featurePrice}>{featuredOwned ? 'Yours' : priceLabel('real4')}</Text>
            </View>
            <View style={[styles.claim, featuredOwned && styles.claimOwned]}>
              <Text style={[styles.claimText, featuredOwned && styles.claimOwnedText]}>{featuredOwned ? 'View' : free ? 'Claim for free' : 'Claim'}</Text>
            </View>
          </View>
        </Pressable>
      </MotionSection> : shelves.real4?.loading ? <View style={[styles.feature, styles.featureLoading]}><ActivityIndicator color={GOLD} /></View> : null}

      {free ? <View style={styles.freeLine}><Gift size={15} color={GOLD} /><Text style={styles.freeText}>Your first star is free, whatever its tier.</Text></View> : null}

      {/* Paliers : nombre de vraies planètes */}
      <View style={styles.segment} accessibilityRole="tablist">
        {TIER_ORDER.map(key => {
          const active = key === tier;
          return <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={`${TIERS[key].label}, ${priceLabel(key)}`}
            onPress={() => setTier(key)} style={[styles.segmentItem, active && { borderColor: TIERS[key].color, backgroundColor: '#141A2C' }]}>
            <Text style={[styles.segmentText, active && { color: TIERS[key].color }]}>{SHORT[key]}</Text>
            <Text style={styles.segmentPrice}>{TIERS[key].price}</Text>
          </Pressable>;
        })}
      </View>
      <Text style={styles.why}>{info.why} · {info.share}</Text>

      {!shelf || shelf.loading ? <ActivityIndicator color={info.color} style={styles.loader} />
        : shelf.error ? <Pressable accessibilityRole="button" onPress={() => load(tier)}><Text style={styles.error}>The store could not be loaded. Tap to retry.</Text></Pressable>
        : shelf.stars.map((star, index) => {
          const mine = owned.some(item => item.id === star.id);
          return <MotionSection key={star.id} delay={index * 40}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${getCelestialDisplayName(star)}, ${compositionLabel(star)}, ${mine ? 'owned' : priceLabel(tier)}`}
              onPress={() => setSelected(star)} style={styles.starRow}>
              <View style={styles.starArt}><CelestialVisual object={star} size={42} /></View>
              <View style={styles.flex}>
                <Text numberOfLines={1} style={styles.starName}>{getCelestialDisplayName(star)}</Text>
                <Text numberOfLines={1} style={styles.starMeta}>{compositionLabel(star)} · {formatDistance(star.distance_ly ?? null, true)}</Text>
              </View>
              {mine ? <View style={styles.ownedChip}><Check size={13} color="#9ED9BF" /><Text style={styles.ownedText}>Yours</Text></View>
                : <View style={[styles.priceChip, { borderColor: free ? GOLD : info.color }]}><Text style={[styles.priceText, { color: free ? GOLD : info.color }]}>{priceLabel(tier)}</Text></View>}
              <ChevronRight size={16} color={MUTED} />
            </Pressable>
          </MotionSection>;
        })}
      <Text style={styles.hint}>Every star is real. Each system has 7 planets: confirmed planets are real, the others are imagined by Astralys. The price depends on how many planets are real. Any star in Explore can be claimed.</Text>

      {/* Cosmétiques à venir */}
      <View style={styles.sectionRow}>
        <Text accessibilityRole="header" style={styles.section}>Cosmetics</Text>
        <Text style={styles.soon}>COMING SOON</Text>
      </View>
      {UPCOMING_COSMETICS.map(item => <View key={item.id} style={styles.cosmetic}>
        <Palette size={18} color="#6F7690" />
        <View style={styles.flex}>
          <Text style={styles.cosmeticTitle}>{item.label}</Text>
          <Text style={styles.cosmeticText}>{item.detail}</Text>
        </View>
      </View>)}

      <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.restore}>
        <RotateCcw size={15} color={MUTED} />
        <Text style={styles.restoreText}>Restore purchases</Text>
      </Pressable>
      <View style={styles.legalRow}>
        <Sparkles size={12} color="#5C6275" />
        <Text style={styles.legal}>Symbolic guardianship inside Astralys. It does not grant legal ownership, naming rights or exclusive rights to a celestial object. Prices include VAT where applicable.</Text>
      </View>
    </ScrollView>

    {selected ? <StarPurchaseSheet
      star={selected}
      visible
      acquired={owned.some(item => item.id === selected.id)}
      onAcquired={() => setSelected(null)}
      onClose={() => setSelected(null)}
    /> : null}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#070911', paddingHorizontal: 16 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  hero: { gap: 4, paddingTop: 6, paddingHorizontal: 4 },
  eyebrow: { color: '#A996DF', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: '#F4F1FF', fontSize: 28, fontWeight: '700' },
  lead: { color: '#A7B0C5', fontSize: 13, lineHeight: 20, marginTop: 2 },
  feature: { minHeight: 236, padding: 16, borderRadius: 24, overflow: 'hidden', backgroundColor: '#15112B', borderWidth: 1, borderColor: 'rgba(200,186,245,0.22)' },
  featureLoading: { alignItems: 'center', justifyContent: 'center' },
  featureArt: { position: 'absolute', right: -6, top: -4, width: 170, height: 170, alignItems: 'center', justifyContent: 'center' },
  featureEyebrow: { color: GOLD, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  featureName: { color: '#F4F1FF', fontSize: 22, lineHeight: 28, fontWeight: '700', marginTop: 6, maxWidth: '58%' },
  featureMeta: { color: MUTED, fontSize: 12, marginTop: 2, marginBottom: 10 },
  featureComposition: { color: '#B3BACB', fontSize: 11, marginTop: 6 },
  featureFooter: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 'auto', paddingTop: 14 },
  featurePrice: { color: '#F4F1FF', fontSize: 22, fontWeight: '700' },
  struck: { color: '#6F7690', textDecorationLine: 'line-through', fontSize: 12 },
  claim: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: GOLD },
  claimText: { color: '#1A1405', fontSize: 14, fontWeight: '800' },
  claimOwned: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#7E89A3' },
  claimOwnedText: { color: '#F4F1FF' },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  dotReal: { backgroundColor: '#9ED9BF' },
  dotImagined: { borderWidth: 1.5, borderColor: '#C8BAF5' },
  freeLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  freeText: { color: '#D9CFA8', fontSize: 12 },
  segment: { flexDirection: 'row', gap: 6, marginTop: 4 },
  segmentItem: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', gap: 1, borderRadius: 12, backgroundColor: '#10141F', borderWidth: 1, borderColor: '#1F2436' },
  segmentText: { color: '#C9CDDA', fontSize: 11, fontWeight: '700' },
  segmentPrice: { color: MUTED, fontSize: 10 },
  why: { color: '#A7B0C5', fontSize: 12, lineHeight: 18, paddingHorizontal: 4 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8, paddingHorizontal: 4 },
  section: { color: '#F4F1FF', fontSize: 17, fontWeight: '700' },
  soon: { color: '#6F7690', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  loader: { marginVertical: 30 },
  error: { color: '#FFC0CC', fontSize: 13, textAlign: 'center', marginVertical: 20 },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: '#10141F', borderWidth: 1, borderColor: '#1F2436' },
  starArt: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  starName: { color: '#F4F1FF', fontSize: 15, fontWeight: '600' },
  starMeta: { color: MUTED, fontSize: 11, marginTop: 2 },
  priceChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1 },
  priceText: { fontSize: 12, fontWeight: '700' },
  ownedChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: 'rgba(82,154,120,0.16)' },
  ownedText: { color: '#9ED9BF', fontSize: 12, fontWeight: '700' },
  hint: { color: MUTED, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 2, paddingHorizontal: 8 },
  cosmetic: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#262C40' },
  cosmeticTitle: { color: '#C9CDDA', fontSize: 14, fontWeight: '600' },
  cosmeticText: { color: '#7A8198', fontSize: 11, lineHeight: 16, marginTop: 2 },
  restore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, marginTop: 8 },
  restoreText: { color: MUTED, fontSize: 13, fontWeight: '600' },
  legalRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 8 },
  legal: { flex: 1, color: '#5C6275', fontSize: 9, lineHeight: 14 },
});
