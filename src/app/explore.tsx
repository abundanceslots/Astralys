import { ObservatoryPressable as Pressable } from '@/components/observatory-button';
import { ArrowLeft, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { useContentKeyboard } from '@/hooks/use-content-keyboard';
import { CelestialVisual } from '@/components/celestial-visual';
import { CelestialComparisonModal } from '@/components/celestial-comparison-modal';
import { ExploreCollections } from '@/components/explore-collections';
import { StarDetailModal, type StarDetail } from '@/components/star-detail-modal';
import { getCelestialDisplayName } from '@/utils/celestial-display-name';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Modal,
  Keyboard,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { MotionSection } from '@/components/motion-section';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { Text, TextInput } from '@/components/astralys-text';
import { navigationClearance } from '@/constants/observatory-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { defaultStarSort, regionOptions, sortOptions, type SkyRegion, type StarSort } from '@/features/catalogue-filters';
import {
  categoryOptions,
  fetchStars,
  formatDistance,
  getCategoryOption,
  systemLabel,
  type StarCategory,
  type StarColor,
} from '@/features/star-catalogue';

const PAGE_SIZE = 20;

/** 'collections' = accueil d'Explore (étoile du jour + rangées), 'list' = catalogue complet. */
type ExploreView = 'collections' | 'list';

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

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const firstStarMode = intent === 'first-star';
  const filterSheetRef = useRef<View>(null);
  const closeFilters = useCallback(() => setFiltersVisible(false), []);
  const requestVersion = useRef(0);
  const morePending = useRef(false);
  const [view, setView] = useState<ExploreView>(firstStarMode ? 'list' : 'collections');
  const [stars, setStars] = useState<StarDetail[]>([]);
  const [selectedStar, setSelectedStar] = useState<StarDetail | null>(null);
  const [comparisonBase, setComparisonBase] = useState<StarDetail | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
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
  const [category, setCategory] = useState<StarCategory>(firstStarMode ? 'nearby-confirmed' : 'all');

  // Arrivée depuis « Choisir ma première étoile » alors que l'écran était déjà monté.
  useEffect(() => {
    if (!firstStarMode) return;
    setView('list');
    setCategory('nearby-confirmed');
  }, [firstStarMode]);

  useContentKeyboard(filtersVisible, closeFilters, filterSheetRef, true);

  const loadStars = useCallback(
    async (
      from: number,
      replace: boolean,
      search: string,
      selectedRegion: SkyRegion,
      selectedColor: StarColor,
      selectedSort: StarSort,
      selectedCategory: StarCategory,
    ) => {
      if (!replace && morePending.current) return;
      const version = replace ? ++requestVersion.current : requestVersion.current;
      morePending.current = !replace;
      replace ? setLoading(true) : setLoadingMore(true);
      setError(null);

      const result = await fetchStars({
        from,
        limit: PAGE_SIZE,
        search,
        region: selectedRegion,
        color: selectedColor,
        sort: selectedSort,
        category: selectedCategory,
        withCount: true,
      });

      if (version !== requestVersion.current) return;
      morePending.current = false;
      if (result.error) {
        setError('The catalogue could not be loaded right now.');
      } else {
        setStars(current => (replace ? result.stars : [...current, ...result.stars]));
        setTotalCount(result.total ?? result.stars.length);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [],
  );

  // La liste ne se charge que lorsqu'elle est affichée.
  useEffect(() => {
    if (view !== 'list') return;
    void loadStars(0, true, activeSearch, region, starColor, sort, category);
  }, [view, activeSearch, loadStars, region, sort, starColor, category]);

  const submitSearch = () => {
    Keyboard.dismiss();
    const nextSearch = searchInput.trim();
    if (nextSearch === activeSearch) {
      void loadStars(0, true, nextSearch, region, starColor, sort, category);
      return;
    }
    setActiveSearch(nextSearch);
  };

  const clearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
  };

  const closeSearch = () => {
    Keyboard.dismiss();
    clearSearch();
    setSearchOpen(false);
  };

  const canLoadMore = stars.length < totalCount;
  const activeFilterCount = Number(region !== 'all') + Number(starColor !== 'all') + Number(sort !== defaultStarSort);
  const activeSortLabel = sortOptions.find((option) => option.value === sort)?.label ?? 'Nearest first';
  const activeCategory = getCategoryOption(category);

  const resetFilters = () => {
    setRegion('all');
    setStarColor('all');
    setSort(defaultStarSort);
  };

  /* ---- navigation entre l'accueil (collections) et la liste ---- */
  const openList = (nextCategory: StarCategory, nextSort: StarSort = defaultStarSort) => {
    setCategory(nextCategory);
    setSort(nextSort);
    setView('list');
  };

  const openSearch = () => {
    setCategory('all');
    setSearchOpen(true);
    setView('list');
  };

  const backToCollections = useCallback(() => {
    Keyboard.dismiss();
    setSearchOpen(false);
    setSearchInput('');
    setActiveSearch('');
    setRegion('all');
    setStarColor('all');
    setSort(defaultStarSort);
    setView('collections');
  }, []);

  const returnHome = () => {
    setSelectedStar(null);
    setComparisonBase(null);
    setFiltersVisible(false);
    router.replace('/');
  };

  // Android : le bouton retour ramène d'abord de la liste aux collections.
  useFocusEffect(useCallback(() => {
    if (view !== 'list' || firstStarMode) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      backToCollections();
      return true;
    });
    return () => sub.remove();
  }, [view, firstStarMode, backToCollections]));

  useFocusEffect(useCallback(() => () => {
    setSelectedStar(null);
    setComparisonBase(null);
    setFiltersVisible(false);
  }, []));

  const listTitle = firstStarMode ? 'Choose your first star' : 'Explore';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      <View pointerEvents="none" style={styles.sky}>
        <View style={[styles.skyStar, styles.skyStarOne]} />
        <View style={[styles.skyStar, styles.skyStarTwo]} />
        <View style={[styles.skyStar, styles.skyStarThree]} />
        <View style={styles.glow} />
      </View>

      {!selectedStar && !comparisonBase && view === 'collections' ? (
        <Animated.View key="collections" entering={FadeIn.duration(220)} style={styles.shell}>
          <ExploreCollections
            bottomInset={navigationClearance(insets.bottom) + 16}
            onHome={returnHome}
            onSearch={openSearch}
            onOpenStar={setSelectedStar}
            onSeeAll={openList}
          />
        </Animated.View>
      ) : null}

      {!selectedStar && !comparisonBase && view === 'list' ? <Animated.View key="list" entering={SlideInRight.duration(240)} style={styles.shell}>
        <View style={styles.listHeader}>
          <Pressable
            accessibilityLabel={firstStarMode ? 'Return to home' : 'Back to collections'}
            accessibilityRole="button"
            onPress={firstStarMode ? returnHome : backToCollections}
            style={styles.iconButton}>
            <ArrowLeft size={20} color="#C8BAF5" />
          </Pressable>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.listTitle}>{listTitle}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={searchOpen ? 'Close search' : 'Search for a star'}
            accessibilityState={{ expanded: searchOpen }}
            onPress={searchOpen ? closeSearch : () => setSearchOpen(true)}
            style={[styles.iconButton, searchOpen && styles.iconButtonActive]}>
            {searchOpen ? <X size={20} color="#C8BAF5" /> : <Search size={20} color="#C8BAF5" />}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : 'Filters'}
            onPress={() => setFiltersVisible(true)}
            style={styles.iconButton}>
            <SlidersHorizontal size={20} color="#C8BAF5" />
            {activeFilterCount > 0 ? (
              <View style={styles.iconBadge}><Text style={styles.filterBadgeText}>{activeFilterCount}</Text></View>
            ) : null}
          </Pressable>
        </View>

        {searchOpen ? (
          <View style={styles.searchField}>
            <Search size={18} color="#A7B0C5" />
            <TextInput
              accessibilityLabel="Search for a star"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
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
                <X size={18} color="#A7B0C5" />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabScroller}
          contentContainerStyle={styles.tabs}
          accessibilityRole="tablist">
          {categoryOptions.map(option => {
            const selected = category === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setCategory(option.value)}
                style={[styles.tab, selected && styles.tabSelected]}>
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{option.tab}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.summaryRow}>
          <Text accessibilityLiveRegion="polite" numberOfLines={1} style={styles.summaryText}>
            {loading ? activeCategory.description : `${totalCount.toLocaleString('en-US')} ${totalCount === 1 ? 'star' : 'stars'} · ${activeCategory.description}`}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Sorted by ${activeSortLabel}. Change sorting`} onPress={() => setFiltersVisible(true)} style={styles.sortButton}>
            <Text style={styles.sortButtonText}>{activeSortLabel.replace(' first', '')} ▾</Text>
          </Pressable>
        </View>

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
            <Pressable accessibilityRole="button" onPress={() => void loadStars(0, true, activeSearch, region, starColor, sort, category)}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#B9A8E8" size="small" />
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
                <Pressable accessibilityRole="button" onPress={() => { clearSearch(); resetFilters(); setCategory('all'); }} style={styles.resetButton}><Text style={styles.resetButtonText}>Reset search</Text></Pressable>
              </View>
            }
            ListFooterComponent={
              canLoadMore ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
                  disabled={loadingMore}
                  onPress={() => void loadStars(stars.length, false, activeSearch, region, starColor, sort, category)}
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
              ) : null
            }
            renderItem={({ item, index }) => {
              const Row = index < 6 ? MotionSection : View;
              const imagined = item.system_experience === 'imagined';
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
                      <Text numberOfLines={1} style={styles.starName}>{getCelestialDisplayName(item)}</Text>
                      <Text numberOfLines={1} style={styles.starDistance}>{formatDistance(item.distance_ly)}</Text>
                    </View>
                    <View style={[styles.systemPill, imagined && styles.systemPillImagined]}>
                      <Text style={[styles.systemPillText, imagined && styles.systemPillTextImagined]}>{systemLabel(item)}</Text>
                    </View>
                  </Pressable>
                </Row>
              );
            }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View> : null}

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
  listHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  listTitle: { flex: 1, color: '#F6F4FB', fontSize: 24, lineHeight: 30, fontWeight: '600', letterSpacing: -0.6 },
  iconButton: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14,
    backgroundColor: '#141824', borderWidth: 1, borderColor: 'rgba(196,181,253,0.11)',
  },
  iconButtonActive: { backgroundColor: '#211D31' },
  iconBadge: {
    position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#D8CEF2',
  },
  tabScroller: { flexGrow: 0, marginHorizontal: -20, marginBottom: 12 },
  tabs: { gap: 8, paddingHorizontal: 20 },
  tab: {
    minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 1, borderColor: '#262A3D',
  },
  tabSelected: { backgroundColor: '#C8BAF5', borderColor: '#C8BAF5' },
  tabText: { color: '#A7B0C5', fontSize: 13, fontWeight: '600' },
  tabTextSelected: { color: '#12101C' },
  summaryRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  summaryText: { flex: 1, color: '#A1A9BB', fontSize: 12 },
  sortButton: { minHeight: 44, justifyContent: 'center', paddingLeft: 10 },
  sortButtonText: { color: '#C8BAF5', fontSize: 12, fontWeight: '700' },
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
  searchField: {
    marginBottom: 12,
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
  filterBadgeText: {
    color: '#171321',
    fontSize: 12,
    fontWeight: '900',
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
  systemPill: {
    maxWidth: 104,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#171A29',
  },
  systemPillImagined: { backgroundColor: '#221B2B' },
  systemPillText: {
    color: '#ACA2C4',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.35,
    textAlign: 'center',
  },
  systemPillTextImagined: { color: '#C9A8D9' },
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
  },
  optionSelected: {
    backgroundColor: '#211D31',
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
    backgroundColor: '#22283B',
  },
  applyButtonText: {
    color: '#F4F1FF',
    fontSize: 13,
    fontWeight: '900',
  },
});
