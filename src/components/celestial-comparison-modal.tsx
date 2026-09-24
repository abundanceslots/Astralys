import { ObservatoryPressable as Pressable, ObservatoryButton } from '@/components/observatory-button';
import { House, ArrowLeft, ArrowRight, Search, SlidersHorizontal, X, Sparkles, Scale, Crosshair, Orbit, ChevronRight } from 'lucide-react-native';
import { useContentKeyboard } from '@/hooks/use-content-keyboard';
import { supabase } from '@/lib/supabase';
import { CelestialVisual } from '@/components/celestial-visual';
import type { StarDetail } from '@/components/star-detail-modal';
import { findLocalStarSourceIds, getCelestialDisplayName } from '@/utils/celestial-display-name';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  BackHandler,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Text, TextInput } from '@/components/astralys-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type CelestialComparisonModalProps = {
  baseObject: StarDetail | null;
  onClose: () => void;
  onHome: () => void;
};

function typeLabel(object: StarDetail) {
  return object.object_type === 'planet' ? 'Planet' : 'Star';
}

function regionLabel(dec: number | null) {
  if (dec === null) return 'Unknown';
  if (dec > 20) return 'North';
  if (dec < -20) return 'South';
  return 'Equator';
}

function distanceLabel(distance: number | null) {
  if (distance === null) return 'Unknown';
  return `${Math.round(distance).toLocaleString('en-US')} ly`;
}

function discoveryLabel(object: StarDetail) {
  if (object.discovery_date) {
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${object.discovery_date}T00:00:00Z`));
  }

  if (object.discovery_year) return String(object.discovery_year);
  return 'Not documented';
}

function catalogDateLabel(object: StarDetail) {
  const date = object.catalog_release_date
    ?? (object.source_catalog === 'GAIA_DR3' ? '2022-06-13' : null);
  if (!date) return 'Unknown';

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function magnitudeLabel(value: number | null) {
  return value === null ? 'Not available' : value.toFixed(2);
}

function temperatureLabel(object: StarDetail) {
  const temperature = object.object_type === 'planet'
    ? object.equilibrium_temperature_k
    : object.temperature_k;
  return temperature ? `${Math.round(temperature).toLocaleString('en-US')} K` : 'Unknown';
}

function radiusLabel(object: StarDetail) {
  if (object.object_type === 'planet') {
    return object.radius_earth ? `${object.radius_earth.toFixed(2)} R⊕` : 'Unknown';
  }
  return object.radius_solar ? `${object.radius_solar.toFixed(2)} R☉` : 'Unknown';
}

function massLabel(object: StarDetail) {
  if (object.object_type === 'planet') {
    return object.mass_earth ? `${object.mass_earth.toFixed(2)} M⊕` : 'Unknown';
  }
  return object.mass_solar ? `${object.mass_solar.toFixed(2)} M☉` : 'Unknown';
}

function comparisonSummary(left: StarDetail, right: StarDetail) {
  const parts: string[] = [];
  if (left.distance_ly != null && right.distance_ly != null) {
    const difference = Math.abs(left.distance_ly - right.distance_ly);
    parts.push(difference < 0.5 ? 'Both objects are at approximately the same distance from Earth.' : `${getCelestialDisplayName(left.distance_ly < right.distance_ly ? left : right)} is about ${Math.round(difference).toLocaleString('en-US')} light-years closer to Earth.`);
  }
  if (left.apparent_magnitude != null && right.apparent_magnitude != null) {
    const delta = Math.abs(left.apparent_magnitude - right.apparent_magnitude);
    parts.push(delta < 0.05 ? 'Their apparent brightness is similar.' : `${getCelestialDisplayName(left.apparent_magnitude < right.apparent_magnitude ? left : right)} has the lower magnitude and appears brighter from Earth.`);
  }
  return parts.join(' ') || 'There is not enough documented data to summarize their differences.';
}
type ComparisonRowProps = {
  label: string;
  left: string;
  right: string;
};

function ComparisonRow({ label, left, right }: ComparisonRowProps) {
  return (
    <View style={styles.comparisonRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValues}>
        <Text selectable numberOfLines={2} style={styles.rowValue}>{left}</Text>
        <View style={styles.rowDivider} />
        <Text selectable numberOfLines={2} style={styles.rowValue}>{right}</Text>
      </View>
    </View>
  );
}

export function CelestialComparisonModal({ baseObject, onClose, onHome }: CelestialComparisonModalProps) {
  const requestVersion = useRef(0);
  const screenRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const [candidates, setCandidates] = useState<StarDetail[]>([]);
  const [target, setTarget] = useState<StarDetail | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCandidates = useCallback(async (term: string) => {
    if (!baseObject) return;

    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);

    let request = supabase
      .from('celestial_objects')
      .select('*')
      .neq('id', baseObject.id)
      .order('apparent_magnitude', { ascending: true, nullsFirst: false }).order('id')
      .limit(30);

    if (term.trim()) {
      const localMatches = findLocalStarSourceIds(term);
      request = localMatches.length > 0
        ? request.in('source_id', localMatches)
        : (/^\d+$/.test(term.trim()) ? request.eq('source_id', term.trim()) : request.ilike('scientific_name', `%${term.trim()}%`));
    }

    const { data, error: requestError } = await request;

    if (version !== requestVersion.current) return;
    if (requestError) {
      setError('The available celestial objects could not be loaded.');
      setCandidates([]);
    } else {
      setCandidates((data ?? []) as StarDetail[]);
    }

    setLoading(false);
  }, [baseObject]);

  useEffect(() => {
    setTarget(null);
    setSearch('');
    void loadCandidates('');
    return () => { ++requestVersion.current; };
  }, [baseObject, loadCandidates]);

  useEffect(() => {
    if (!baseObject) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => listener.remove();
  }, [baseObject, onClose]);
  useContentKeyboard(Boolean(baseObject), onClose, screenRef);
  if (!baseObject) return null;

  return (
    <View ref={screenRef} style={styles.overlay}>
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Return to reference star"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.backButton, pressed && styles.navigationPressed]}>
            <ArrowLeft size={20} color="#C8BAF5" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <View style={styles.headerIdentity}>
            <Text style={styles.brand}>ASTRALYS</Text>
            <Text numberOfLines={1} style={styles.headerContext}>COMPARISON</Text>
          </View>
          <Pressable
            accessibilityLabel="Return to home"
            accessibilityRole="button"
            onPress={onHome}
            style={({ pressed }) => [styles.closeButton, pressed && styles.navigationPressed]}>
            <House size={22} color="#C8BAF5" />
          </Pressable>
        </View>

        {target ? (
          <ScrollView
            contentContainerStyle={[styles.comparisonContent, { paddingBottom: Math.max(insets.bottom, 18) + 100 }]}
            showsVerticalScrollIndicator={false}>
            <Text accessibilityRole="header" style={styles.title}>Comparison</Text>
            <Animated.View entering={FadeInDown.duration(420)} style={styles.comparisonHeader}>
              <View style={styles.objectHeading}>
                <View style={styles.objectOrb}>
                  <CelestialVisual object={baseObject} size={56} />
                </View>
                <Text numberOfLines={2} style={styles.objectName}>{getCelestialDisplayName(baseObject)}</Text>
                <Text style={styles.objectType}>{typeLabel(baseObject)}</Text>
              </View>
              <Text style={styles.versus}>VS</Text>
              <View style={styles.objectHeading}>
                <View style={styles.objectOrb}>
                  <CelestialVisual object={target} size={56} />
                </View>
                <Text numberOfLines={2} style={styles.objectName}>{getCelestialDisplayName(target)}</Text>
                <Text style={styles.objectType}>{typeLabel(target)}</Text>
              </View>
            </Animated.View>

            <View style={styles.notice}><Text style={styles.subtitle}>{comparisonSummary(baseObject, target)}</Text></View>
            <Animated.View entering={FadeIn.duration(420).delay(90)} style={styles.table}>
              <ComparisonRow label="Type" left={typeLabel(baseObject)} right={typeLabel(target)} />
              <ComparisonRow label="Distance" left={distanceLabel(baseObject.distance_ly)} right={distanceLabel(target.distance_ly)} />
              <ComparisonRow label="Sky region" left={regionLabel(baseObject.dec_deg)} right={regionLabel(target.dec_deg)} />
              <ComparisonRow label="Discovery" left={discoveryLabel(baseObject)} right={discoveryLabel(target)} />
              <ComparisonRow label="Catalogue release" left={catalogDateLabel(baseObject)} right={catalogDateLabel(target)} />
              <ComparisonRow label="Apparent magnitude" left={magnitudeLabel(baseObject.apparent_magnitude)} right={magnitudeLabel(target.apparent_magnitude)} />
              {temperatureLabel(baseObject) !== 'Unknown' || temperatureLabel(target) !== 'Unknown' ? <ComparisonRow label="Temperature (different measures for stars and planets)" left={temperatureLabel(baseObject)} right={temperatureLabel(target)} /> : null}
              {radiusLabel(baseObject) !== 'Unknown' || radiusLabel(target) !== 'Unknown' ? <ComparisonRow label="Radius" left={radiusLabel(baseObject)} right={radiusLabel(target)} /> : null}
              {massLabel(baseObject) !== 'Unknown' || massLabel(target) !== 'Unknown' ? <ComparisonRow label="Mass" left={massLabel(baseObject)} right={massLabel(target)} /> : null}
            </Animated.View>

            <Pressable accessibilityRole="button" onPress={() => setTarget(null)} style={styles.changeButton}>
              <Text style={styles.changeButtonText}>Choose another object</Text>
            </Pressable>

            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Missing physical metrics are omitted when unavailable for both objects. Illustrations are not to scale. Lower magnitude means brighter from Earth. Radius and mass use solar units for stars and Earth units for planets. “Unknown” means the catalogue does not currently provide that value.
              </Text>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.pickerContent}>
            <Animated.View entering={FadeInDown.duration(420)}>
              <Text style={styles.eyebrow}>REFERENCE OBJECT</Text>
              <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{getCelestialDisplayName(baseObject)}</Text>
              <Text style={styles.subtitle}>Choose a star or planet to compare. Suggestions show the brightest catalogued objects first.</Text>
            </Animated.View>

            <View style={styles.searchRow}>
              <View style={styles.searchField}>
                <Search size={22} color="#A7B0C5" />
                <TextInput
                  accessibilityLabel="Search for a comparison object"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setSearch}
                  onSubmitEditing={() => void loadCandidates(search)}
                  placeholder="Name or catalogue ID"
                  placeholderTextColor="#656C7E"
                  returnKeyType="search"
                  selectionColor="#B9A8E8"
                  style={styles.searchInput}
                  value={search}
                />
              </View>
              <Pressable accessibilityRole="button" onPress={() => void loadCandidates(search)} style={styles.searchButton}>
                <Text style={styles.searchButtonText}>Search</Text>
              </Pressable>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color="#B9A8E8" />
                <Text style={styles.loadingText}>Loading celestial objects…</Text>
              </View>
            ) : (
              <FlatList
                contentContainerStyle={styles.candidateList}
                data={candidates}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={<Text style={styles.emptyText}>No object found. Try another name or clear the search.</Text>}
                renderItem={({ item, index }) => {
                  return (
                    <Animated.View entering={FadeInDown.duration(320).delay(Math.min(index, 6) * 30)}>
                      <Pressable accessibilityRole="button" onPress={() => setTarget(item)} style={styles.candidateCard}>
                        <View style={styles.candidateOrb}>
                          <CelestialVisual object={item} size={40} />
                        </View>
                        <View style={styles.candidateInfo}>
                          <Text numberOfLines={1} style={styles.candidateName}>{getCelestialDisplayName(item)}</Text>
                          <Text style={styles.candidateMeta}>
                            {typeLabel(item)} · {distanceLabel(item.distance_ly)}
                          </Text>
                        </View>
                        <ChevronRight size={22} color="#A7B0C5" />
                      </Pressable>
                    </Animated.View>
                  );
                }}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#070911' },
  screen: { flex: 1, backgroundColor: '#070911', paddingHorizontal: 20 },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  headerIdentity: { flex: 1, minWidth: 0, alignItems: 'center' },
  backButton: {
    width: 86,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    borderRadius: 13,
    backgroundColor: '#151925',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  backArrow: { color: '#D8D2E2', fontSize: 23, lineHeight: 25, marginTop: -2 },
  backText: { color: '#C8C1D2', fontSize: 12, fontWeight: '800' },
  navigationPressed: { opacity: 0.65 },
  brand: { color: '#F5F3FF', fontSize: 15, fontWeight: '600', letterSpacing: 2 },
  headerContext: { color: '#A7B0C5', fontSize: 10, fontWeight: '500', letterSpacing: 0.6, marginTop: 3 },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: '#151925',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  homeIcon: { color: '#D8D2E2', fontSize: 18, lineHeight: 21 },
  pickerContent: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingTop: 21 },
  eyebrow: { color: '#A996DF', fontSize: 12, fontWeight: '800', letterSpacing: 1.6, marginBottom: 7 },
  title: { color: '#F4F1F8', fontSize: 25, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { color: '#A7B0C5', fontSize: 14, lineHeight: 22, marginTop: 7 },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 21, marginBottom: 13 },
  searchField: {
    flex: 1,
    minWidth: 0,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    borderRadius: 15,
    backgroundColor: '#10141F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.065)',
  },
  searchIcon: { color: '#968AAE', fontSize: 22, marginRight: 8, marginTop: -2 },
  searchInput: { flex: 1, minWidth: 0, height: '100%', color: '#F0EDF6', fontSize: 16 },
  searchButton: { height: 48, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#22283B' },
  searchButtonText: { color: '#F4F1FF', fontSize: 12, fontWeight: '800' },
  errorText: { color: '#D09FA9', fontSize: 12, marginBottom: 10 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 55 },
  loadingText: { color: '#A1A9BB', fontSize: 11 },
  candidateList: { paddingBottom: 112 },
  separator: { height: 8 },
  candidateCard: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    borderRadius: 17,
    backgroundColor: '#0F131D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.055)',
  },
  candidateOrb: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(196,181,253,0.14)', backgroundColor: '#161A27', overflow: 'hidden' },
  candidateInfo: { flex: 1, gap: 5, marginHorizontal: 11 },
  candidateName: { color: '#EDEAF2', fontSize: 12, fontWeight: '700' },
  candidateMeta: { color: '#A1A9BB', fontSize: 9 },
  candidateArrow: { color: '#9B91B0', fontSize: 24 },
  emptyText: { color: '#A1A9BB', fontSize: 12, textAlign: 'center', paddingTop: 60 },
  comparisonContent: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingTop: 18 },
  comparisonHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 21 },
  objectHeading: { flex: 1, alignItems: 'center', gap: 6 },
  objectOrb: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(196,181,253,0.14)', backgroundColor: '#141824', overflow: 'hidden' },
  objectName: { color: '#F0EDF5', fontSize: 12, lineHeight: 18, fontWeight: '700', textAlign: 'center', minHeight: 30 },
  objectType: { color: '#A1A9BB', fontSize: 9 },
  versus: { color: '#A996DF', fontSize: 12, fontWeight: '900', letterSpacing: 1.2, marginHorizontal: 8 },
  table: { overflow: 'hidden', borderRadius: 18, backgroundColor: '#0F131D', borderWidth: 1, borderColor: 'rgba(255,255,255,0.055)' },
  comparisonRow: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.045)' },
  rowLabel: { color: '#A1A9BB', fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center', marginBottom: 9 },
  rowValues: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { flex: 1, color: '#DCD7E4', fontSize: 12, lineHeight: 18, fontWeight: '700', textAlign: 'center' },
  rowDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.07)', marginHorizontal: 8 },
  changeButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 11, borderRadius: 15, backgroundColor: '#191D2B', borderWidth: 1, borderColor: 'rgba(196,181,253,0.12)' },
  changeButtonText: { color: '#D4CBE9', fontSize: 12, fontWeight: '800' },
  notice: { padding: 14, marginTop: 10 },
  noticeText: { color: '#A1A9BB', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
