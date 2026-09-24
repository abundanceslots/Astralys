import { ObservatoryPressable as Pressable } from '@/components/observatory-button';
import { House, ArrowLeft, Sparkles, Scale, Crosshair, ChevronRight, ChevronDown, ChevronUp, Eye, BookOpen, ShoppingBag, Orbit } from 'lucide-react-native';
import { useFollowing } from '@/context/following-context';
import { useAcquisitions } from '@/context/acquisitions-context';
import { useContentKeyboard } from '@/hooks/use-content-keyboard';
import { supabase } from '@/lib/supabase';
import { CelestialVisual } from '@/components/celestial-visual';
import { getCelestialVisualProfile } from '@/components/celestial-visual.shared';
import { StarActivityPanel } from '@/components/star-activity-panel';
import { ConfirmedPlanetsPanel } from '@/components/confirmed-planets-panel';
import { ImaginedPlanetsPanel } from '@/components/imagined-planets-panel';
import { SkyLocatorModal } from '@/components/sky-locator-modal';
import { getCelestialDisplayName, getCelestialScientificName, hasAstralysCatalogueName } from '@/utils/celestial-display-name';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  PanResponder,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { Extrapolation, FadeIn, FadeInDown, LinearTransition, interpolate, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { MotionSection } from '@/components/motion-section';
import { Text } from '@/components/astralys-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StarPurchaseSheet } from '@/components/star-purchase-sheet';
import { useRouter } from 'expo-router';

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
  confirmed_planet_count?: number;
  system_experience?: 'catalogue' | 'imagined';
  is_purchasable?: boolean;
};

type StarDetailModalProps = {
  star: StarDetail | null;
  onClose: () => void;
  onHome: () => void;
  onCompare: (star: StarDetail) => void;
};

const colorLabels: Record<string, string> = {
  blue: 'Blue',
  'blue-white': 'Blue-white',
  'white-yellow': 'White-yellow',
  golden: 'Golden',
  'orange-red': 'Orange-red',
};

const accordionTransition = LinearTransition.springify()
  .damping(20)
  .stiffness(180)
  .mass(0.8)
  .reduceMotion(ReduceMotion.System);

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

function getVisibilitySummary(star: StarDetail) {
  if (star.object_type === 'planet') {
    return 'This exoplanet is not directly visible. Locate its host system to find its position in the sky.';
  }
  if (star.apparent_magnitude === null) return 'Visibility is not documented for this star.';
  if (star.apparent_magnitude <= 2) return 'Very bright · readily visible to the naked eye.';
  if (star.apparent_magnitude <= 4) return 'Visible to the naked eye from a reasonably dark location.';
  if (star.apparent_magnitude <= 6) return 'Best seen under a dark sky, away from city lights.';
  return 'Binoculars or a telescope are recommended.';
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
  const { stars: acquiredStars } = useAcquisitions();
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [followError, setFollowError] = useState<string | null>(null);
  const [openCategory, setOpenCategory] = useState<'science' | 'catalogue' | null>(null);
  const [planetExpanded, setPlanetExpanded] = useState(false);
  const screenRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const [details, setDetails] = useState<StarDetail | null>(star);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [locatorVisible, setLocatorVisible] = useState(false);
  const [relatedPlanet, setRelatedPlanet] = useState<StarDetail | null>(null);
  const [purchaseVisible, setPurchaseVisible] = useState(false);
  const planetExpansion = useSharedValue(0);
  const planetDragStart = useRef(0);
  const contentWidth = Math.min(screenWidth - 40, 520);
  const planetStageWidth = contentWidth + 40;
  const planetVisualSize = Math.min(planetStageWidth * 1.08, 560);
  const compactPlanetHeight = 260;
  const expandedPlanetHeight = Math.max(520, Math.min(screenHeight - insets.top - 82, 760));
  const planetTravel = Math.max(1, expandedPlanetHeight - compactPlanetHeight);

  const settlePlanet = (expanded: boolean) => {
    setPlanetExpanded(expanded);
    planetExpansion.value = withSpring(expanded ? 1 : 0, {
      damping: 20,
      stiffness: 170,
      mass: 0.82,
    });
  };

  const planetPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => {
      planetDragStart.current = planetExpansion.value;
    },
    onPanResponderMove: (_, gesture) => {
      planetExpansion.value = Math.max(0, Math.min(1, planetDragStart.current + gesture.dy / planetTravel));
    },
    onPanResponderRelease: (_, gesture) => {
      const shouldExpand = gesture.vy > 0.35 || (gesture.vy > -0.2 && planetExpansion.value >= 0.45);
      settlePlanet(shouldExpand);
    },
    onPanResponderTerminate: () => settlePlanet(planetExpansion.value >= 0.5),
  }), [planetExpansion, planetTravel]);

  const planetStageStyle = useAnimatedStyle(() => ({
    height: interpolate(
      planetExpansion.value,
      [0, 1],
      [compactPlanetHeight, expandedPlanetHeight],
      Extrapolation.CLAMP,
    ),
  }));
  const planetVisualStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          planetExpansion.value,
          [0, 1],
          [planetStageWidth - planetVisualSize * 0.64, (planetStageWidth - planetVisualSize) / 2],
          Extrapolation.CLAMP,
        ),
      },
      {
        translateY: interpolate(
          planetExpansion.value,
          [0, 1],
          [-planetVisualSize * 0.05, (expandedPlanetHeight - planetVisualSize) / 2],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(planetExpansion.value, [0, 1], [1, 0.76], Extrapolation.CLAMP),
      },
    ],
  }));

  useEffect(() => {
    setDetails(star);
    setRelatedPlanet(null);
    setLocatorVisible(false);
    setOpenCategory(null);
    setPlanetExpanded(false);
    planetExpansion.value = 0;
    setFollowError(null);
    setPurchaseVisible(false);

    if (!star) return;

    let active = true;
    setLoadingDetails(true);

    void supabase
      .from('celestial_objects')
      .select('*')
      .eq('id', star.id)
      .single()
      .then(({ data }) => {
        if (active && data) setDetails(current => ({
          ...(data as StarDetail),
          confirmed_planet_count: current?.confirmed_planet_count,
          system_experience: current?.system_experience,
        }));
        if (active) setLoadingDetails(false);
      });

    return () => {
      active = false;
    };
  }, [star, planetExpansion]);

  useEffect(() => {
    if (!star || locatorVisible || relatedPlanet) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => listener.remove();
  }, [star, locatorVisible, relatedPlanet, onClose]);

  useContentKeyboard(Boolean(star) && !locatorVisible && !relatedPlanet, onClose, screenRef);
  if (!star || !details) return null;

  const visualProfile = getCelestialVisualProfile(details);
  const displayName = getCelestialDisplayName(details);
  const scientificDisplayName = getCelestialScientificName(details);
  const scienceExpanded = openCategory === 'science';
  const referenceExpanded = openCategory === 'catalogue';
  const acquired = acquiredStars.some(item => item.id === details.id);

  return (
    <MotionSection key={star.id} ref={screenRef} style={styles.overlay}>
      <View accessibilityElementsHidden={Boolean(relatedPlanet)} importantForAccessibility={relatedPlanet ? 'no-hide-descendants' : 'auto'} style={[styles.screen, { paddingTop: insets.top + 8 }]}>
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
          <Animated.View {...planetPanResponder.panHandlers} style={[styles.planetStage, planetStageStyle]}>
            <Animated.View pointerEvents="none" style={[styles.planetVisualPosition, { width: planetVisualSize, height: planetVisualSize }, planetVisualStyle]}>
              <CelestialVisual animated fillFrame object={details} size={planetVisualSize} />
            </Animated.View>
            <Pressable
              variant="quiet"
              accessibilityHint="Drag down to enlarge the celestial object or drag up to return"
              accessibilityRole="button"
              accessibilityState={{ expanded: planetExpanded }}
              onPress={() => settlePlanet(!planetExpanded)}
              style={styles.planetHandle}>
              <View style={styles.planetHandleSurface}>
                <View style={styles.planetGrabber} />
                <Text style={styles.planetHandleText}>{planetExpanded ? 'Return' : 'Explore'}</Text>
                {planetExpanded ? <ChevronUp size={12} color="rgba(220,214,233,0.62)" /> : <ChevronDown size={12} color="rgba(220,214,233,0.62)" />}
              </View>
            </Pressable>
            {planetExpanded ? <Animated.View entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)} pointerEvents="none" style={styles.planetExpandedCaption}>
              <Text style={styles.planetExpandedCaptionText}>{visualProfile.description} · artistic rendering</Text>
            </Animated.View> : null}
          </Animated.View>

          <MotionSection delay={80} style={styles.identity}>
            <Text accessibilityRole="header" selectable style={styles.title}>{displayName}</Text>
            {loadingDetails ? <ActivityIndicator color="#8F82AA" size="small" style={styles.detailsLoader} /> : null}
          </MotionSection>

          <View style={styles.visibilityCard}>
            <Eye size={20} color="#9ED7E5" />
            <View style={styles.visibilityCopy}>
              <Text style={styles.visibilityLabel}>VISIBILITY</Text>
              <Text style={styles.visibilityText}>{getVisibilitySummary(details)}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            {details.object_type === 'star' ? <Pressable variant="primary" accessibilityRole="button" disabled={!acquired && details.is_purchasable === false} onPress={() => acquired
              ? router.push({ pathname: '/observatory', params: { view: 'system', starId: details.id } })
              : setPurchaseVisible(true)} style={styles.primaryAction}>
              {acquired ? <Orbit size={20} color="#C8BAF5" /> : <ShoppingBag size={19} color="#C8BAF5" />}
              <Text style={styles.primaryActionText}>{acquired ? 'Open my system' : details.is_purchasable === false ? 'Unavailable' : 'Claim this star'}</Text>
            </Pressable> : <Pressable variant="primary" accessibilityRole="button" accessibilityState={{ selected: followed.some(s => s.id === details.id) }} onPress={() => setFollowError(toggle(details))} style={styles.primaryAction}>
              <Sparkles size={20} color="#C8BAF5" />
              <Text style={styles.primaryActionText}>{followed.some(s => s.id === details.id) ? 'In my collection' : 'Add to my collection'}</Text>
            </Pressable>}
            <View style={styles.secondaryActions}>
              {details.object_type === 'star' ? <Pressable variant="quiet" accessibilityRole="button" accessibilityState={{ selected: followed.some(s => s.id === details.id) }} onPress={() => setFollowError(toggle(details))} style={styles.secondaryAction}>
                <Sparkles size={18} color="#C8BAF5" />
                <Text numberOfLines={1} style={styles.secondaryActionText}>{followed.some(s => s.id === details.id) ? 'Following' : 'Follow'}</Text>
              </Pressable> : null}
              <Pressable
                variant="quiet"
                accessibilityHint={details.object_type === 'planet' ? 'Points towards the host system, not a directly visible exoplanet' : 'Opens the camera and points towards this star'}
                accessibilityLabel={details.object_type === 'planet' ? `Locate the host system of ${displayName}` : `Locate ${displayName} in the sky`}
                accessibilityRole="button"
                disabled={details.ra_deg === null || details.dec_deg === null}
                onPress={() => setLocatorVisible(true)}
                style={[styles.secondaryAction, (details.ra_deg === null || details.dec_deg === null) && styles.locatorButtonDisabled]}>
                <Crosshair size={18} color="#C8BAF5" />
                <Text style={styles.secondaryActionText}>{details.object_type === 'planet' ? 'Locate host' : 'Locate'}</Text>
              </Pressable>
              <Pressable variant="quiet" accessibilityRole="button" onPress={() => onCompare(details)} style={styles.secondaryAction}>
                <Scale size={18} color="#C8BAF5" />
                <Text style={styles.secondaryActionText}>Compare</Text>
              </Pressable>
            </View>
          </View>
          {followError ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.description}>{followError}</Text> : null}

          {details.object_type === 'star' ? details.system_experience === 'imagined'
            ? <ImaginedPlanetsPanel key={details.id} starId={details.id} />
            : <ConfirmedPlanetsPanel key={details.id} starId={details.id} onSelect={setRelatedPlanet} />
          : null}

          <Animated.View layout={accordionTransition}>
          <Pressable variant="quiet" accessibilityRole="button" accessibilityState={{ expanded: scienceExpanded }} onPress={() => setOpenCategory(current => current === 'science' ? null : 'science')} style={[styles.categoryButton, scienceExpanded && styles.categoryButtonExpanded]}>
            <View style={styles.categoryIcon}><Eye size={18} color="#C8BAF5" /></View>
            <View style={styles.categoryCopy}>
              <Text style={styles.categoryTitle}>Scientific details</Text>
              <Text style={styles.categoryHint}>Physical data, discovery and position</Text>
            </View>
            <ChevronRight size={19} color="#8F88A0" style={scienceExpanded ? styles.categoryChevronExpanded : undefined} />
          </Pressable>
          {scienceExpanded ? <Animated.View entering={FadeInDown.duration(260).reduceMotion(ReduceMotion.System)} layout={accordionTransition} style={styles.metricsGrid}>
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
          {scienceExpanded && details.object_type === 'planet' ? <Text style={styles.description}>Sky guidance and visibility refer to the host system. This exoplanet cannot be identified directly with your phone camera.</Text> : null}
          </Animated.View>

          <Animated.View layout={accordionTransition}>
          <Pressable variant="quiet" accessibilityRole="button" accessibilityState={{ expanded: referenceExpanded }} onPress={() => setOpenCategory(current => current === 'catalogue' ? null : 'catalogue')} style={[styles.categoryButton, referenceExpanded && styles.categoryButtonExpanded]}>
            <View style={styles.categoryIcon}><BookOpen size={18} color="#C8BAF5" /></View>
            <View style={styles.categoryCopy}>
              <Text style={styles.categoryTitle}>Catalogue & activity</Text>
              <Text style={styles.categoryHint}>Sources, updates and interpretation notes</Text>
            </View>
            <ChevronRight size={19} color="#8F88A0" style={referenceExpanded ? styles.categoryChevronExpanded : undefined} />
          </Pressable>
          {referenceExpanded ? <Animated.View entering={FadeInDown.duration(260).reduceMotion(ReduceMotion.System)} layout={accordionTransition}>
            <View style={styles.referenceCard}>
              <Text style={styles.referenceEyebrow}>CATALOGUE REFERENCE</Text>
              {displayName !== scientificDisplayName ? <View style={styles.referenceRow}>
                <Text style={styles.referenceLabel}>Scientific designation</Text>
                <Text selectable style={styles.referenceValue}>{scientificDisplayName}</Text>
              </View> : null}
              <View style={styles.referenceRow}>
                <Text style={styles.referenceLabel}>Source</Text>
                <Text selectable style={styles.referenceValue}>
                  {details.source_catalog.replace(/_/g, ' ').replace(/^GAIA/i, 'Gaia')} · {details.source_id}
                </Text>
              </View>
            </View>
            <StarActivityPanel star={details} />
            <View style={styles.notice}>
              <Text style={styles.noticeSymbol}>◇</Text>
              <Text style={styles.noticeText}>
                This visual is an artistic interpretation generated from the available catalogue data. It is not a photograph of the celestial object.
              </Text>
            </View>
          </Animated.View> : null}
          </Animated.View>
        </ScrollView>

        <SkyLocatorModal
          onClose={() => setLocatorVisible(false)}
          star={details}
          visible={locatorVisible}
        />
        {details.object_type === 'star' ? <StarPurchaseSheet
          acquired={acquired}
          onAcquired={() => setPurchaseVisible(false)}
          onClose={() => setPurchaseVisible(false)}
          star={details}
          visible={purchaseVisible}
        /> : null}
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
  planetStage: {
    position: 'relative',
    marginHorizontal: -20,
    overflow: 'hidden',
    backgroundColor: '#090D15',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  planetVisualPosition: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  planetHandle: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    zIndex: 5,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  planetHandleSurface: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(16,19,29,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  planetGrabber: {
    width: 26,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(187,179,207,0.42)',
  },
  planetHandleText: {
    color: 'rgba(197,190,215,0.68)',
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  planetExpandedCaption: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 48,
    alignItems: 'flex-end',
  },
  planetExpandedCaptionText: {
    maxWidth: 250,
    color: '#8E91A0',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 0.35,
    textAlign: 'right',
    textTransform: 'uppercase',
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
    marginTop: 18,
    marginBottom: 16,
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
  sourceReference: {
    color: '#686779',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 6,
    letterSpacing: 0.25,
  },
  referenceCard: {
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#0D111B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  referenceEyebrow: {
    color: '#777287',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  referenceRow: { gap: 3 },
  referenceLabel: { color: '#898495', fontSize: 10, fontWeight: '600' },
  referenceValue: { color: '#B1AABA', fontSize: 11, lineHeight: 16 },
  detailsLoader: {
    marginTop: 9,
  },
  visibilityCard: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 18,
    backgroundColor: '#0E1721',
    borderWidth: 1,
    borderColor: 'rgba(153,216,232,0.14)',
  },
  visibilityCopy: { flex: 1, minWidth: 0, gap: 4 },
  visibilityLabel: { color: '#86BECC', fontSize: 10, fontWeight: '800', letterSpacing: 1.25 },
  visibilityText: { color: '#E5ECF2', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  actions: { marginTop: 10, gap: 8 },
  primaryAction: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
    backgroundColor: '#22283B',
  },
  primaryActionText: { color: '#F4F1FF', fontSize: 14, fontWeight: '700' },
  secondaryActions: { flexDirection: 'row', gap: 8 },
  secondaryAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  secondaryActionText: { color: '#C8BAF5', fontSize: 13, fontWeight: '800' },
  categoryButton: {
    minHeight: 62,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 16,
    backgroundColor: '#111622',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.055)',
  },
  categoryButtonExpanded: {
    backgroundColor: '#151A28',
    borderColor: 'rgba(200,186,245,0.18)',
  },
  categoryIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#1B2030',
  },
  categoryCopy: { flex: 1, minWidth: 0, gap: 2 },
  categoryTitle: { color: '#F0EDF7', fontSize: 14, fontWeight: '700' },
  categoryHint: { color: '#858394', fontSize: 11, lineHeight: 16 },
  categoryChevronExpanded: { transform: [{ rotate: '90deg' }] },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
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
    backgroundColor: '#22283B',
  },
  compareEyebrow: {
    color: '#B9ABE8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  compareButtonText: {
    color: '#F4F1FF',
    fontSize: 13,
    fontWeight: '900',
  },
  compareArrow: {
    color: '#C8BAF5',
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
