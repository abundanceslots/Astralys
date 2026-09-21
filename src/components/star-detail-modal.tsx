import { ObservatoryPressable as Pressable, ObservatoryButton } from '@/components/observatory-button';
import { House, ArrowLeft, ArrowRight, Search, SlidersHorizontal, X, Sparkles, Scale, Crosshair, Orbit, ChevronRight } from 'lucide-react-native';
import { useFollowing } from '@/context/following-context';
import { Link } from 'expo-router';
import { useContentKeyboard } from '@/hooks/use-content-keyboard';
import { supabase } from '@/lib/supabase';
import { CelestialVisual } from '@/components/celestial-visual';
import { getCelestialVisualProfile } from '@/components/celestial-visual.shared';
import { StarActivityPanel } from '@/components/star-activity-panel';
import { ConfirmedPlanetsPanel } from '@/components/confirmed-planets-panel';
import { SkyLocatorModal } from '@/components/sky-locator-modal';
import { getCelestialDisplayName, getCelestialScientificName, hasAstralysCatalogueName } from '@/utils/celestial-display-name';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { MotionSection } from '@/components/motion-section';
import { Text } from '@/components/astralys-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type StarDetail = {
  id: string;
  object_type: 'star' | 'planet';
  source_catalog: string;
  source_id: string;
  scientific_name: string;
  common_name: string | null;
  ra_deg: number | null;
  dec_deg: number | null;
  distance_ly: number | null;
  apparent_magnitude: number | null;
  visual_category: string | null;
  discovery_year?: number | null;
  discovery_date?: string | null;
  discovery_method?: string | null;
  discovery_reference?: string | null;
  catalog_release_date?: string | null;
  source_updated_at?: string | null;
  updated_at?: string | null;
  temperature_k?: number | null;
  radius_solar?: number | null;
  mass_solar?: number | null;
  radius_earth?: number | null;
  mass_earth?: number | null;
  orbital_period_days?: number | null;
  equilibrium_temperature_k?: number | null;
};

type StarDetailModalProps = {
  star: StarDetail | null;
  onClose: () => void;
  onHome: () => void;
  onCompare: (star: StarDetail) => void;
};

const starColors: Record<string, string> = {
  blue: '#78AFFF',
  'blue-white': '#B7D2FF',
  'white-yellow': '#F4F0D6',
  golden: '#F2CE77',
  'orange-red': '#E9906E',
};

const colorLabels: Record<string, string> = {
  blue: 'Blue',
  'blue-white': 'Blue-white',
  'white-yellow': 'White-yellow',
  golden: 'Golden',
  'orange-red': 'Orange-red',
};

function formatDistance(distance: number | null) {
  if (distance === null) return 'Unknown';
  return `${Math.round(distance).toLocaleString('en-US')} ly`;
}

function formatCoordinate(coordinate: number | null) {
  if (coordinate === null) return 'Unknown';
  return `${coordinate.toFixed(4)}°`;
}

function getSkyRegion(dec: number | null) {
  if (dec === null) return 'Unknown region';
  if (dec > 20) return 'Northern sky';
  if (dec < -20) return 'Southern sky';
  return 'Celestial equator';
}

function getBrightnessDescription(magnitude: number | null) {
  if (magnitude === null) return 'its apparent brightness is not documented';
  if (magnitude <= 2) return 'it is one of the brightest stars in this selection';
  if (magnitude <= 4) return 'it appears bright in Earth’s night sky';
  if (magnitude <= 6) return 'it may be visible to the naked eye under dark skies';
  return 'it generally requires binoculars or a telescope to observe';
}

function formatDiscovery(star: StarDetail) {
  if (star.discovery_date) {
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${star.discovery_date}T00:00:00Z`));
  }

  if (star.discovery_year) return String(star.discovery_year);
  return 'Not documented';
}

function formatCatalogRelease(star: StarDetail) {
  const releaseDate = star.catalog_release_date
    ?? (star.source_catalog === 'GAIA_DR3' ? '2022-06-13' : null);

  if (!releaseDate) return 'Not available';

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${releaseDate}T00:00:00Z`));
}

function buildDescription(star: StarDetail) {
  const distance = star.distance_ly === null
    ? 'at a distance that is not currently documented'
    : `about ${Math.round(star.distance_ly).toLocaleString('en-US')} light-years from Earth`;

  if (star.object_type === 'planet') {
    const discovery = star.discovery_date || star.discovery_year
      ? `Its discovery is documented as ${formatDiscovery(star)}.`
      : 'Its discovery date is not currently documented.';
    return `${getCelestialScientificName(star)} is a catalogued planet located ${distance}. ${discovery} The visual interpretation uses the physical data currently available.`;
  }

  const color = colorLabels[star.visual_category ?? '']?.toLowerCase();
  const colorSentence = color
    ? `Its apparent color is classified as ${color} from the imported photometric data.`
    : 'Its apparent color has not been classified yet.';
  const discoverySentence = star.discovery_date || star.discovery_year
    ? `Its discovery is documented as ${formatDiscovery(star)}.`
    : 'No reliable individual discovery date is documented for this star.';

  const identity = hasAstralysCatalogueName(star)
    ? `${getCelestialDisplayName(star)} is the Astralys name for ${getCelestialScientificName(star)}`
    : getCelestialScientificName(star);
  return `${identity}, a star listed in the ${star.source_catalog.replace(/_/g, ' ').replace(/^GAIA/i, 'Gaia')} catalogue. It is located ${distance}, in the ${getSkyRegion(star.dec_deg).toLowerCase()}. Based on its magnitude, ${getBrightnessDescription(star.apparent_magnitude)}. ${colorSentence} ${discoverySentence}`;
}

export function StarDetailModal({ star, onClose, onHome, onCompare }: StarDetailModalProps) {
  const { stars: followed, toggle } = useFollowing();
  const [followError, setFollowError] = useState<string | null>(null);
  const [scienceExpanded, setScienceExpanded] = useState(false);
  const screenRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const [details, setDetails] = useState<StarDetail | null>(star);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [locatorVisible, setLocatorVisible] = useState(false);
  const [relatedPlanet, setRelatedPlanet] = useState<StarDetail | null>(null);

  useEffect(() => {
    setDetails(star);
    setRelatedPlanet(null);
    setLocatorVisible(false);
    setScienceExpanded(false);
    setFollowError(null);

    if (!star) return;

    let active = true;
    setLoadingDetails(true);

    void supabase
      .from('celestial_objects')
      .select('*')
      .eq('id', star.id)
      .single()
      .then(({ data }) => {
        if (active && data) setDetails(data as StarDetail);
        if (active) setLoadingDetails(false);
      });

    return () => {
      active = false;
    };
  }, [star]);

  useEffect(() => {
    if (!star || locatorVisible || relatedPlanet) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => listener.remove();
  }, [star, locatorVisible, relatedPlanet, onClose]);

  useContentKeyboard(Boolean(star) && !locatorVisible && !relatedPlanet, onClose, screenRef);
  if (!star || !details) return null;

  const color = starColors[details.visual_category ?? ''] ?? '#D8CEF2';
  const visualProfile = getCelestialVisualProfile(details);
  const displayName = getCelestialDisplayName(details);
  const scientificDisplayName = getCelestialScientificName(details);
  const usesAstralysName = hasAstralysCatalogueName(details);

  return (
    <MotionSection key={star.id} ref={screenRef} style={styles.overlay}>
      <View accessibilityElementsHidden={Boolean(relatedPlanet)} importantForAccessibility={relatedPlanet ? 'no-hide-descendants' : 'auto'} style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View pointerEvents="none" style={styles.sky}>
          <View style={[styles.skyStar, styles.skyStarOne]} />
          <View style={[styles.skyStar, styles.skyStarTwo]} />
          <View style={[styles.skyStar, styles.skyStarThree]} />
          <View style={[styles.ambientGlow, { backgroundColor: `${color}0D` }]} />
        </View>

        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back to previous screen"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.backButton, pressed && styles.navigationPressed]}>
            <ArrowLeft size={20} color="#C8BAF5" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <View style={styles.headerIdentity}>
            <Text style={styles.brand}>ASTRALYS</Text>
            <Text numberOfLines={1} style={styles.headerContext}>CELESTIAL PROFILE</Text>
          </View>
          <Pressable
            accessibilityLabel="Return to home"
            accessibilityRole="button"
            onPress={onHome}
            style={({ pressed }) => [styles.closeButton, pressed && styles.navigationPressed]}>
            <House size={22} color="#C8BAF5" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 18) + 100 }]}
          showsVerticalScrollIndicator={false}>
          <MotionSection delay={40} style={styles.visualStage}>
            <View style={[styles.orbit, styles.orbitOuter, { borderColor: `${color}24` }]} />
            <View style={[styles.orbit, styles.orbitInner, { borderColor: `${color}1A` }]} />
            <CelestialVisual animated object={details} size={96} />
            <Text style={styles.visualCaption}>{visualProfile.description} · artistic rendering</Text>
          </MotionSection>

          <MotionSection delay={80} style={styles.identity}>
            <View style={styles.cataloguePill}>
              <View style={[styles.catalogueDot, { backgroundColor: color }]} />
              <Text style={styles.catalogueText}>{details.source_catalog.replace(/_/g, ' ').replace(/^GAIA/i, 'Gaia')}</Text>
            </View>
            <Text accessibilityRole="header" selectable style={styles.title}>{displayName}</Text>
            {usesAstralysName ? (
              <Text style={styles.scientificName}>ASTRALYS CATALOGUE NAME</Text>
            ) : displayName !== scientificDisplayName ? (
              <Text style={styles.scientificName}>{scientificDisplayName}</Text>
            ) : null}
            <Text selectable style={styles.sourceId}>Catalogue ID {details.source_id}</Text>
            {loadingDetails ? <ActivityIndicator color="#8F82AA" size="small" style={styles.detailsLoader} /> : null}
          </MotionSection>

          <Pressable accessibilityRole="button" accessibilityState={{ selected: followed.some(s => s.id === details.id) }} onPress={() => setFollowError(toggle(details))} style={styles.compareButton}>
            <Text style={styles.compareButtonText}>{followed.some(s => s.id === details.id) ? 'Following · remove from watchlist' : details.object_type === 'planet' ? 'Follow this planet' : 'Follow this star'}</Text>
            <Sparkles size={22} color="#171321" />
          </Pressable>
          <Pressable
            accessibilityHint={details.object_type === 'planet' ? 'Points towards the host system, not a directly visible exoplanet' : 'Opens the camera and points towards this star'}
            accessibilityLabel={details.object_type === 'planet' ? `Locate the host system of ${displayName}` : `Locate ${displayName} in the sky`}
            accessibilityRole="button"
            disabled={details.ra_deg === null || details.dec_deg === null}
            onPress={() => setLocatorVisible(true)}
            style={({ pressed }) => [
              styles.locatorButton,
              pressed && styles.navigationPressed,
              (details.ra_deg === null || details.dec_deg === null) && styles.locatorButtonDisabled,
            ]}>
            <Crosshair size={24} color="#C8BAF5" />
            <View style={styles.locatorButtonCopy}>
              
              <Text style={styles.locatorButtonText}>{details.object_type === 'planet' ? 'Locate host system' : 'Locate in the sky'}</Text>
            </View>
            <ArrowRight size={22} color="#C8BAF5" />
          </Pressable>

          <Pressable variant="secondary" accessibilityRole="button" onPress={() => onCompare(details)} style={styles.compareButton}>
            <View>
              
              <Text style={[styles.compareButtonText, { color: '#C8BAF5' }]}>Compare with another object</Text>
            </View>
            <Scale size={22} color="#C8BAF5" />
          </Pressable>

          <Text style={styles.description}>Save this real object in Collection to revisit its visibility and journal. The watchlist stays on this device; it is not paid guardianship.</Text>
          {followError ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.description}>{followError}</Text> : null}
          <Link href="/collection" asChild><ObservatoryButton label="Open my collection" icon={Orbit} variant="secondary" /></Link>
          <Text style={styles.description}>Symbolic guardianship and paid acquisition are not available from this screen yet. No astronomical ownership is transferred.</Text>

          {details.object_type === 'star' ? <ConfirmedPlanetsPanel key={details.id} starId={details.id} onSelect={setRelatedPlanet} /> : null}

          <Pressable accessibilityRole="button" accessibilityState={{ expanded: scienceExpanded }} onPress={() => setScienceExpanded(v => !v)} style={styles.changeScienceButton}>
            <Text style={styles.locatorButtonText}>Scientific details {scienceExpanded ? '−' : '+'}</Text>
          </Pressable>
          {scienceExpanded ? <Animated.View entering={FadeIn.duration(240).reduceMotion(ReduceMotion.System)} style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>DISTANCE</Text>
              <Text style={styles.metricValue}>{formatDistance(details.distance_ly)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>{details.object_type === 'planet' ? 'ORBITAL PERIOD' : 'MAGNITUDE'}</Text>
              <Text style={styles.metricValue}>
                {details.object_type === 'planet'
                  ? details.orbital_period_days ? `${Number(details.orbital_period_days).toLocaleString('en-US', { maximumFractionDigits: 2 })} d` : 'Unknown'
                  : details.apparent_magnitude === null ? 'Unknown' : details.apparent_magnitude.toFixed(2)}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>REGION</Text>
              <Text numberOfLines={1} style={styles.metricValueSmall}>{getSkyRegion(details.dec_deg)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>{details.object_type === 'planet' ? 'RADIUS · EARTH' : 'COLOR'}</Text>
              <Text numberOfLines={1} style={styles.metricValueSmall}>
                {details.object_type === 'planet' ? details.radius_earth ? `${Number(details.radius_earth).toLocaleString('en-US', { maximumFractionDigits: 2 })} R⊕` : 'Unknown' : colorLabels[details.visual_category ?? ''] ?? 'Unclassified'}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>DISCOVERY</Text>
              <Text numberOfLines={1} style={styles.metricValueSmall}>{formatDiscovery(details)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>CATALOGUE RELEASE</Text>
              <Text numberOfLines={1} style={styles.metricValueSmall}>{formatCatalogRelease(details)}</Text>
            </View>
          </Animated.View> : null}

          {scienceExpanded ? <><Animated.View entering={FadeInDown.duration(240).delay(40).reduceMotion(ReduceMotion.System)} style={styles.descriptionCard}>
            <Text style={styles.sectionEyebrow}>ABOUT</Text>
            <Text selectable style={styles.description}>{buildDescription(details)}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(240).delay(80).reduceMotion(ReduceMotion.System)} style={styles.coordinatesCard}>
            <View style={styles.coordinatesHeader}>
              <Text style={styles.sectionEyebrow}>CELESTIAL POSITION</Text>
              <Text style={styles.coordinatesHint}>{details.object_type === 'planet' ? 'Host-system direction' : 'Gaia coordinates'}</Text>
            </View>
            <View style={styles.coordinateRow}>
              <View style={styles.coordinateItem}>
                <Text style={styles.coordinateLabel}>Right ascension</Text>
                <Text selectable style={styles.coordinateValue}>{formatCoordinate(details.ra_deg)}</Text>
              </View>
              <View style={styles.coordinateDivider} />
              <View style={styles.coordinateItem}>
                <Text style={styles.coordinateLabel}>Declination</Text>
                <Text selectable style={styles.coordinateValue}>{formatCoordinate(details.dec_deg)}</Text>
              </View>
            </View>
          </Animated.View>

          </> : null}
          {details.object_type === 'planet' ? <Text style={styles.description}>Sky guidance and visibility refer to the host system. This exoplanet cannot be identified directly with your phone camera.</Text> : null}
          <StarActivityPanel star={details} />

          <Animated.View entering={FadeIn.duration(240).reduceMotion(ReduceMotion.System)} style={styles.notice}>
            <Text style={styles.noticeSymbol}>◇</Text>
            <Text style={styles.noticeText}>
              This visual is an artistic interpretation generated from the available catalogue data. It is not a photograph of the celestial object.
            </Text>
          </Animated.View>
        </ScrollView>

        <SkyLocatorModal
          onClose={() => setLocatorVisible(false)}
          star={details}
          visible={locatorVisible}
        />
      </View>
      {relatedPlanet ? <StarDetailModal star={relatedPlanet} onClose={() => setRelatedPlanet(null)} onHome={onHome} onCompare={onCompare} /> : null}
    </MotionSection>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#070911' },
  changeScienceButton: { minHeight: 48, marginTop: 10, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#171D2C' },
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
  skyStarOne: { top: '11%', left: '12%', width: 2, height: 2, opacity: 0.4 },
  skyStarTwo: { top: '21%', right: '9%', width: 3, height: 3, opacity: 0.54 },
  skyStarThree: { top: '42%', left: '7%', width: 2, height: 2, opacity: 0.27 },
  ambientGlow: {
    position: 'absolute',
    top: 55,
    left: '50%',
    width: 320,
    height: 320,
    marginLeft: -160,
    borderRadius: 160,
  },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  headerIdentity: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
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
  backArrow: {
    color: '#D8D2E2',
    fontSize: 23,
    lineHeight: 25,
    marginTop: -2,
  },
  backText: {
    color: '#C8C1D2',
    fontSize: 12,
    fontWeight: '800',
  },
  navigationPressed: { opacity: 0.65 },
  brand: {
    color: '#F5F3FF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
  },
  headerContext: {
    color: '#A7B0C5',
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.6,
    marginTop: 3,
  },
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
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  visualStage: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbit: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  orbitOuter: {
    width: 140,
    height: 80,
    transform: [{ rotate: '-13deg' }],
  },
  orbitInner: {
    width: 110,
    height: 110,
    transform: [{ rotate: '23deg' }],
  },
  visualCaption: {
    position: 'absolute',
    bottom: 8,
    color: '#A1A9BB',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.35,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  identity: {
    alignItems: 'center',
    paddingHorizontal: 8,
    marginTop: -5,
    marginBottom: 10,
  },
  cataloguePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: '#111520',
    marginBottom: 11,
  },
  catalogueDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  catalogueText: {
    color: '#8B849A',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    color: '#F6F3FA',
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.7,
  },
  scientificName: {
    color: '#91899F',
    fontSize: 12,
    marginTop: 6,
  },
  sourceId: {
    color: '#A1A9BB',
    fontSize: 12,
    marginTop: 7,
  },
  detailsLoader: {
    marginTop: 9,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCard: {
    width: '48.8%',
    minHeight: 80,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#0F131D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.055)',
  },
  metricLabel: {
    color: '#A1A9BB',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 7,
  },
  metricValue: {
    color: '#ECE8F2',
    fontSize: 16,
    fontWeight: '700',
  },
  metricValueSmall: {
    color: '#E4DFEB',
    fontSize: 12,
    fontWeight: '700',
  },
  locatorButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: '#171D2C',
    borderWidth: 1,
    borderColor: 'rgba(151,203,255,0.20)',
  },
  locatorButtonDisabled: { opacity: 0.42 },
  locatorButtonIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locatorButtonRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#8DBBE4',
  },
  locatorButtonCore: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#CBE6FF',
  },
  locatorButtonCopy: { flex: 1, marginLeft: 9 },
  locatorButtonEyebrow: {
    color: '#829BB5',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 5,
  },
  locatorButtonText: { color: '#EBF4FC', fontSize: 13, fontWeight: '900' },
  locatorButtonArrow: { color: '#BBDCF7', fontSize: 21 },
  compareButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 17,
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: '#C8BAF5',
  },
  compareEyebrow: {
    color: '#655A7D',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  compareButtonText: {
    color: '#171321',
    fontSize: 13,
    fontWeight: '900',
  },
  compareArrow: {
    color: '#312840',
    fontSize: 24,
    fontWeight: '600',
  },
  descriptionCard: {
    padding: 17,
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: '#10141F',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.09)',
  },
  sectionEyebrow: {
    color: '#A996DF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  description: {
    color: '#A6A4AE',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 10,
  },
  coordinatesCard: {
    padding: 17,
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: '#0E121B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  coordinatesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  coordinatesHint: {
    color: '#A1A9BB',
    fontSize: 12,
  },
  coordinateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coordinateItem: {
    flex: 1,
    gap: 5,
  },
  coordinateDivider: {
    width: 1,
    height: 34,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 15,
  },
  coordinateLabel: {
    color: '#A1A9BB',
    fontSize: 12,
  },
  coordinateValue: {
    color: '#D8D3DF',
    fontSize: 12,
    fontWeight: '700',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 14,
    marginTop: 10,
  },
  noticeSymbol: {
    color: '#8E83A8',
    fontSize: 16,
  },
  noticeText: {
    flex: 1,
    color: '#A1A9BB',
    fontSize: 12,
    lineHeight: 18,
  },
});
