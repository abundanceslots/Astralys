import { ObservatoryPressable as Pressable, ObservatoryButton } from '@/components/observatory-button';
import { House, ArrowLeft, ArrowRight, Search, SlidersHorizontal, X, Sparkles, Scale, Crosshair, Orbit, ChevronRight } from 'lucide-react-native';
import { useContentKeyboard } from '@/hooks/use-content-keyboard';
import { supabase } from '@/lib/supabase';
import { CelestialVisual } from '@/components/celestial-visual';
import { CelestialComparisonModal } from '@/components/celestial-comparison-modal';
import { StarDetailModal, type StarDetail } from '@/components/star-detail-modal';
import { findLocalStarSourceIds, getCelestialDisplayName } from '@/utils/celestial-display-name';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Keyboard,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { MotionSection } from '@/components/motion-section';
import { Text, TextInput } from '@/components/astralys-text';
import { navigationClearance } from '@/constants/observatory-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { defaultStarSort, getSkyRegionOption, regionOptions, sortOptions, type SkyRegion, type StarSort } from '@/features/catalogue-filters';

const PAGE_SIZE = 20;

type StarColor = 'all' | 'blue' | 'blue-white' | 'white-yellow' | 'golden' | 'orange-red';

const colorOptions: { value: StarColor; label: string }[] = [
  { value: 'all', label: 'All colors' },
  { value: 'blue', label: 'Blue' },
  { value: 'blue-white', label: 'Blue-white' },
  { value: 'white-yellow', label: 'White-yellow' },
  { value: 'golden', label: 'Golden' },
  { value: 'orange-red', label: 'Orange-red' },
];

const starColors: Record<string, string> = {
  blue: '#78AFFF',
  'blue-white': '#B7D2FF',
  'white-yellow': '#F4F0D6',
  golden: '#F2CE77',
  'orange-red': '#E9906E',
};

function formatDistance(distance: number | null) {
  if (distance === null) return 'Unknown distance';
  return `${Math.round(distance).toLocaleString('en-US')} light-years`;
}

function formatMagnitude(magnitude: number | null) {
  if (magnitude === null) return 'Unknown magnitude';
  return `Magnitude ${magnitude.toFixed(2)}`;
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const filterSheetRef = useRef<View>(null);
  const closeFilters = useCallback(() => setFiltersVisible(false), []);
  const requestVersion = useRef(0);
  const morePending = useRef(false);
  const [stars, setStars] = useState<StarDetail[]>([]);
  const [selectedStar, setSelectedStar] = useState<StarDetail | null>(null);
  const [comparisonBase, setComparisonBase] = useState<StarDetail | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [region, setRegion] = useState<SkyRegion>('all');
  const [starColor, setStarColor] = useState<StarColor>('all');
  const [sort, setSort] = useState<StarSort>(defaultStarSort);

  useContentKeyboard(filtersVisible, closeFilters, filterSheetRef, true);

  const loadStars = useCallback(
    async (
      from: number,
      replace: boolean,
      search: string,
      selectedRegion: SkyRegion,
      selectedColor: StarColor,
      selectedSort: StarSort,
    ) => {
      if (!replace && morePending.current) return;
      const version = replace ? ++requestVersion.current : requestVersion.current;
      morePending.current = !replace;
      replace ? setLoading(true) : setLoadingMore(true);
      setError(null);

      const sortOption = sortOptions.find((option) => option.value === selectedSort) ?? sortOptions[0];

      let request = supabase
        .from('celestial_objects')
        .select(
          'id, object_type, source_catalog, source_id, scientific_name, common_name, ra_deg, dec_deg, distance_ly, apparent_magnitude, visual_category, temperature_k, radius_solar, mass_solar, radius_earth, mass_earth, equilibrium_temperature_k',
          { count: 'exact' },
        )
        .eq('object_type', 'star')
        .order(sortOption.column, { ascending: sortOption.ascending, nullsFirst: false })
        .order('id', { ascending: true });

      if (search) {
        const localMatches = findLocalStarSourceIds(search);
        request = localMatches.length > 0
          ? request.in('source_id', localMatches)
          : (/^\d+$/.test(search) ? request.eq('source_id', search) : request.ilike('scientific_name', `%${search}%`));
      }

      const regionOption = getSkyRegionOption(selectedRegion);
      if (regionOption.minimumDeclination !== undefined) request = request.gte('dec_deg', regionOption.minimumDeclination);
      if (regionOption.maximumDeclination !== undefined) request = request.lt('dec_deg', regionOption.maximumDeclination);

      if (selectedColor !== 'all') {
        request = request.eq('visual_category', selectedColor);
      }

      const { data, error: requestError, count } = await request.range(from, from + PAGE_SIZE - 1);

      if (version !== requestVersion.current) return;
      morePending.current = false;
      if (requestError) {
        setError('The catalogue could not be loaded right now.');
      } else {
        const nextStars = (data ?? []) as StarDetail[];
        setStars((current) => (replace ? nextStars : [...current, ...nextStars]));
        setTotalCount(count ?? nextStars.length);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [],
  );

  useEffect(() => {
    void loadStars(0, true, activeSearch, region, starColor, sort);
  }, [activeSearch, loadStars, region, sort, starColor]);

  const submitSearch = () => {
    Keyboard.dismiss();
    const nextSearch = searchInput.trim();

    if (nextSearch === activeSearch) {
      void loadStars(0, true, nextSearch, region, starColor, sort);
      return;
    }

    setActiveSearch(nextSearch);
  };

  const clearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
  };

  const canLoadMore = stars.length < totalCount;
  const activeFilterCount = Number(region !== 'all') + Number(starColor !== 'all') + Number(sort !== defaultStarSort);
  const activeSortLabel = sortOptions.find((option) => option.value === sort)?.label ?? 'Nearest first';

  const resetFilters = () => {
    setRegion('all');
    setStarColor('all');
    setSort(defaultStarSort);
  };

  useFocusEffect(useCallback(() => () => {
    setSelectedStar(null);
    setComparisonBase(null);
    setFiltersVisible(false);
  }, []));

  const returnHome = () => {
    setSelectedStar(null);
    setComparisonBase(null);
    setFiltersVisible(false);
    router.replace('/');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      <View pointerEvents="none" style={styles.sky}>
        <View style={[styles.skyStar, styles.skyStarOne]} />
        <View style={[styles.skyStar, styles.skyStarTwo]} />
        <View style={[styles.skyStar, styles.skyStarThree]} />
        <View style={styles.glow} />
      </View>

      {!selectedStar && !comparisonBase ? <View style={styles.shell}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Return to home"
            accessibilityRole="button"
            onPress={returnHome}
            style={({ pressed }) => [styles.homeButton, pressed && styles.navigationPressed]}>
            <ArrowLeft size={20} color="#C8BAF5" />
            <Text style={styles.homeButtonText}>Home</Text>
          </Pressable>
          <Text selectable style={styles.brand}>ASTRALYS</Text>
        </View>

        <MotionSection style={styles.intro}>
          <View>
            <Text accessibilityRole="header" style={styles.title}>Explore stars</Text>
          </View>
          <Text accessibilityLiveRegion="polite" style={styles.count}>{`${totalCount.toLocaleString('en-US')} ${totalCount === 1 ? 'star' : 'stars'}`}</Text>
        </MotionSection>

        <MotionSection delay={60} style={styles.searchRow}>
          <View style={styles.searchField}>
            <Search size={22} color="#A7B0C5" />
            <TextInput
              accessibilityLabel="Search for a star"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setSearchInput}
              onSubmitEditing={submitSearch}
              placeholder="Name or catalogue ID"
              placeholderTextColor="#666D80"
              returnKeyType="search"
              selectionColor="#B9A8E8"
              style={styles.searchInput}
              value={searchInput}
            />
            {searchInput.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={clearSearch} style={styles.clearButton}>
                <X size={20} color="#A7B0C5" />
              </Pressable>
            ) : null}
          </View>
          <Pressable accessibilityRole="button" onPress={submitSearch} style={styles.searchButton}>
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </MotionSection>

        <MotionSection delay={100} style={styles.filterBar}>
          <Pressable accessibilityRole="button" onPress={() => setFiltersVisible(true)} style={styles.filterButton}>
            <SlidersHorizontal size={20} color="#C8BAF5" />
            <Text style={styles.filterButtonText}>Filters</Text>
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <Text numberOfLines={1} style={styles.sortSummary}>{activeSortLabel}</Text>
        </MotionSection>

        {activeFilterCount > 0 ? (
          <View style={styles.chipWrap}>
            {region !== 'all' ? <Pressable accessibilityRole="button" accessibilityLabel="Remove sky region filter" onPress={() => setRegion('all')} style={styles.colorChip}><Text style={styles.colorChipText}>{regionOptions.find(o => o.value === region)?.label} ×</Text></Pressable> : null}
            {starColor !== 'all' ? <Pressable accessibilityRole="button" accessibilityLabel="Remove color filter" onPress={() => setStarColor('all')} style={styles.colorChip}><Text style={styles.colorChipText}>{colorOptions.find(o => o.value === starColor)?.label} ×</Text></Pressable> : null}
            {sort !== defaultStarSort ? <Pressable accessibilityRole="button" accessibilityLabel="Reset sorting" onPress={() => setSort(defaultStarSort)} style={styles.colorChip}><Text style={styles.colorChipText}>{activeSortLabel} ×</Text></Pressable> : null}
          </View>
        ) : null}

        {error ? (
          <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void loadStars(0, true, activeSearch, region, starColor, sort)}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#B9A8E8" size="small" />
            <Text style={styles.stateText}>Opening the catalogue…</Text>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={[styles.listContent, { paddingBottom: navigationClearance(insets.bottom) + 16 }]}
            data={stars}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            keyExtractor={(item) => item.id}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptySymbol}>✦</Text>
                <Text style={styles.emptyTitle}>No stars found</Text>
                <Text style={styles.emptyText}>Try another search.</Text>
                <Pressable accessibilityRole="button" onPress={() => { clearSearch(); resetFilters(); }} style={styles.resetButton}><Text style={styles.resetButtonText}>Reset search</Text></Pressable>
              </View>
            }
            ListFooterComponent={
              canLoadMore ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
                  disabled={loadingMore}
                  onPress={() => void loadStars(stars.length, false, activeSearch, region, starColor, sort)}
                  style={({ pressed }) => [
                    styles.moreButton,
                    pressed && styles.moreButtonPressed,
                    loadingMore && styles.moreButtonDisabled,
                  ]}>
                  {loadingMore ? (
                    <ActivityIndicator color="#D8CEF2" size="small" />
                  ) : (
                    <Text style={styles.moreButtonText}>Show more</Text>
                  )}
                </Pressable>
              ) : stars.length > 0 ? (
                <Text style={styles.endText}>End of results</Text>
              ) : null
            }
            renderItem={({ item, index }) => {
              const Row = index < 6 ? MotionSection : View;
              return (
                <Row {...(index < 6 ? { delay: index * 25 } : {})}>
                  <Pressable
                    accessibilityHint="Opens the complete description of this star"
                    accessibilityLabel={`View ${getCelestialDisplayName(item)}`}
                    accessibilityRole="button"
                    onPress={() => setSelectedStar(item)}
                    style={({ pressed }) => [styles.starCard, pressed && styles.starCardPressed]}>
                    <View style={styles.starVisual}>
                      <CelestialVisual object={item} size={48} />
                    </View>

                    <View style={styles.starInfo}>
                      <Text numberOfLines={1} style={styles.starName}>
                        {getCelestialDisplayName(item)}
                      </Text>
                      <Text numberOfLines={1} style={styles.starDistance}>
                        {formatDistance(item.distance_ly)}
                      </Text>
                    </View>

                    <View style={styles.magnitudePill}>
                      <Text style={styles.magnitudeText}>{formatMagnitude(item.apparent_magnitude)}</Text>
                    </View>
                  </Pressable>
                </Row>
              );
            }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View> : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setFiltersVisible(false)}
        transparent
        visible={filtersVisible}>
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button" accessibilityLabel="Close filters"
            onPress={() => setFiltersVisible(false)}
            style={styles.modalBackdrop}
          />
          <View ref={filterSheetRef} role="dialog" aria-modal accessibilityViewIsModal accessibilityLabel="Filter stars" style={[styles.filterSheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.sheetHandle} />
            <View accessibilityViewIsModal style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetEyebrow}>CATALOGUE</Text>
                <Text accessibilityRole="header" style={styles.sheetTitle}>Filter stars</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close filters" onPress={() => setFiltersVisible(false)} style={styles.resetButton}><Text style={styles.resetButtonText}>Close ×</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={resetFilters} style={styles.resetButton}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </Pressable>
            </View>

            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.filterSectionTitle}>Sky region</Text>
              <View role="radiogroup" accessibilityLabel="Sky region" style={styles.optionGrid}>
                {regionOptions.map((option) => {
                  const selected = region === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      aria-checked={selected}
                      accessibilityLabel={option.label}
                      onPress={() => setRegion(option.value)}
                      style={[styles.regionOption, selected && styles.optionSelected]}>
                      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                        {option.label}
                      </Text>
                      <Text style={styles.optionDescription}>{option.description}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.filterSectionTitle}>Apparent color</Text>
              <View role="radiogroup" accessibilityLabel="Apparent color" style={styles.chipWrap}>
                {colorOptions.map((option) => {
                  const selected = starColor === option.value;
                  const color = option.value === 'all' ? '#B9A8E8' : starColors[option.value];
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      aria-checked={selected}
                      accessibilityLabel={option.label}
                      onPress={() => setStarColor(option.value)}
                      style={[styles.colorChip, selected && styles.optionSelected]}>
                      <View style={[styles.colorDot, { backgroundColor: color }]} />
                      <Text style={[styles.colorChipText, selected && styles.optionLabelSelected]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.filterSectionTitle}>Sort by</Text>
              <View role="radiogroup" accessibilityLabel="Sort by" style={styles.sortOptions}>
                {sortOptions.map((option) => {
                  const selected = sort === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      aria-checked={selected}
                      accessibilityLabel={option.label}
                      onPress={() => setSort(option.value)}
                      style={[styles.sortOption, selected && styles.optionSelected]}>
                      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                        {option.label}
                      </Text>
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected ? <View style={styles.radioCore} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <Pressable accessibilityRole="button" onPress={() => setFiltersVisible(false)} style={styles.applyButton}>
              <Text style={styles.applyButtonText}>
                View {totalCount.toLocaleString('en-US')} result{totalCount === 1 ? '' : 's'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <StarDetailModal
        onClose={() => setSelectedStar(null)}
        onHome={returnHome}
        onCompare={(star) => {
          setSelectedStar(null);
          setComparisonBase(star);
        }}
        star={selectedStar}
      />
      <CelestialComparisonModal
        baseObject={comparisonBase}
        onClose={() => { setSelectedStar(comparisonBase); setComparisonBase(null); }}
        onHome={returnHome}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#070911',
    paddingHorizontal: 20,
  },
  sky: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  skyStar: {
    position: 'absolute',
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
  },
  skyStarOne: { top: '10%', left: '9%', width: 2, height: 2, opacity: 0.34 },
  skyStarTwo: { top: '19%', right: '12%', width: 3, height: 3, opacity: 0.5 },
  skyStarThree: { top: '42%', left: '4%', width: 2, height: 2, opacity: 0.24 },
  glow: {
    position: 'absolute',
    top: 40,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(121, 91, 190, 0.055)',
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homeButton: {
    minWidth: 76,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: '#141824',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.11)',
  },
  homeArrow: {
    color: '#CFC4EC',
    fontSize: 23,
    lineHeight: 24,
    marginTop: -2,
  },
  homeButtonText: {
    color: '#D8D2E2',
    fontSize: 12,
    fontWeight: '800',
  },
  navigationPressed: {
    opacity: 0.65,
  },
  brand: {
    color: '#F5F3FF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  cataloguePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: '#101420',
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#A996DF',
  },
  cataloguePillText: {
    color: '#8B829F',
    fontSize: 12,
    fontWeight: '700',
  },
  intro: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 13,
  },
  eyebrow: {
    color: '#A996DF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 5,
  },
  title: {
    color: '#F6F4FB',
    fontSize: 27,
    lineHeight: 31,
    fontWeight: '600',
    letterSpacing: -0.7,
  },
  count: {
    color: '#747B8E',
    fontSize: 12,
    marginBottom: 3,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 13,
  },
  searchField: {
    flex: 1,
    minWidth: 0,
    gap: 8,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    borderRadius: 15,
    backgroundColor: '#10141F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.065)',
  },
  searchIcon: {
    color: '#968AAE',
    fontSize: 22,
    marginRight: 8,
    marginTop: -2,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    color: '#F0EDF6',
    fontSize: 16,
  },
  clearButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    color: '#8D849D',
    fontSize: 22,
    lineHeight: 24,
  },
  searchButton: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: '#C8BAF5',
  },
  searchButtonText: {
    color: '#171321',
    fontSize: 12,
    fontWeight: '800',
  },
  filterBar: {
    minHeight: 39,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 11,
  },
  filterButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    borderRadius: 12,
    backgroundColor: '#151927',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.12)',
  },
  filterIcon: {
    color: '#B9A8E8',
    fontSize: 14,
  },
  filterButtonText: {
    color: '#C8C1D7',
    fontSize: 12,
    fontWeight: '700',
  },
  filterBadge: {
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: '#D8CEF2',
  },
  filterBadgeText: {
    color: '#171321',
    fontSize: 12,
    fontWeight: '900',
  },
  sortSummary: {
    flex: 1,
    color: '#A1A9BB',
    fontSize: 12,
    textAlign: 'right',
  },
  errorCard: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: '#21141C',
    borderWidth: 1,
    borderColor: 'rgba(232,143,158,0.18)',
  },
  errorText: {
    flex: 1,
    color: '#CBA6AE',
    fontSize: 12,
  },
  retryText: {
    color: '#F1CED5',
    fontSize: 12,
    fontWeight: '800',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 54,
  },
  stateText: {
    color: '#808799',
    fontSize: 12,
  },
  listContent: {
    paddingBottom: 112,
  },
  separator: {
    height: 8,
  },
  starCard: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    borderRadius: 18,
    backgroundColor: '#0F131E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.055)',
  },
  starCardPressed: {
    opacity: 0.94,
  },
  starVisual: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: 1,
    backgroundColor: '#151927',
    overflow: 'hidden',
  },
  starInfo: {
    flex: 1,
    gap: 5,
    marginLeft: 12,
    marginRight: 8,
  },
  starName: {
    color: '#F0EDF6',
    fontSize: 13,
    fontWeight: '700',
  },
  starDistance: {
    color: '#A1A9BB',
    fontSize: 12,
  },
  magnitudePill: {
    maxWidth: 92,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#171A29',
  },
  magnitudeText: {
    color: '#ACA2C4',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  moreButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderRadius: 15,
    backgroundColor: '#151927',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.13)',
  },
  moreButtonPressed: {
    opacity: 0.75,
  },
  moreButtonDisabled: {
    opacity: 0.55,
  },
  moreButtonText: {
    color: '#D8CEF2',
    fontSize: 12,
    fontWeight: '800',
  },
  endText: {
    color: '#A1A9BB',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 18,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
    gap: 7,
    borderRadius: 18,
    backgroundColor: '#0D111A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  emptySymbol: {
    color: '#A996DF',
    fontSize: 25,
    marginBottom: 5,
  },
  emptyTitle: {
    color: '#E9E5F0',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    color: '#747B8E',
    fontSize: 12,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(2,3,8,0.76)',
  },
  filterSheet: {
    width: '100%', maxWidth: 560, alignSelf: 'center',
    maxHeight: '88%',
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#0D1019',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetHandle: {
    width: 38,
    height: 4,
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: '#323748',
    marginBottom: 17,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetEyebrow: {
    color: '#A996DF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.7,
    marginBottom: 5,
  },
  sheetTitle: {
    color: '#F5F2FA',
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  resetButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 11,
    borderRadius: 11,
    backgroundColor: '#151925',
  },
  resetButtonText: {
    color: '#AFA6C2',
    fontSize: 12,
    fontWeight: '700',
  },
  sheetContent: {
    paddingBottom: 18,
  },
  filterSectionTitle: {
    color: '#7D8496',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 10,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  regionOption: {
    width: '48%',
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#121620',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.055)',
  },
  optionSelected: {
    backgroundColor: '#211D31',
    borderColor: 'rgba(196,181,253,0.34)',
  },
  optionLabel: {
    color: '#C5C1CC',
    fontSize: 12,
    fontWeight: '700',
  },
  optionLabelSelected: {
    color: '#EEE8FF',
  },
  optionDescription: {
    color: '#A0A8BA',
    fontSize: 12,
    marginTop: 4,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },
  colorChip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    borderRadius: 12,
    backgroundColor: '#121620',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.055)',
  },
  colorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  colorChipText: {
    color: '#AFAAB8',
    fontSize: 12,
    fontWeight: '700',
  },
  sortOptions: {
    gap: 7,
  },
  sortOption: {
    minHeight: 45,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    borderRadius: 13,
    backgroundColor: '#121620',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.055)',
  },
  radio: {
    width: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#505668',
  },
  radioSelected: {
    borderColor: '#C8BAF5',
  },
  radioCore: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#C8BAF5',
  },
  applyButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: '#C8BAF5',
  },
  applyButtonText: {
    color: '#171321',
    fontSize: 13,
    fontWeight: '900',
  },
});
