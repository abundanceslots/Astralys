import { FirstStarSystem } from '@/components/first-star-system';
import { ObservatoryButton } from '@/components/observatory-button';
import { Text } from '@/components/astralys-text';
import { Observatory as theme, navigationClearance } from '@/constants/observatory-theme';
import { useAcquisitions } from '@/context/acquisitions-context';
import { useGuardianProgress } from '@/context/guardian-progress-context';
import { Link, useRouter } from 'expo-router';
import { EnterSystemButton } from '@/components/enter-system-button';
import { Orbit, Sparkles } from 'lucide-react-native';
import { getCelestialDisplayName } from '@/utils/celestial-display-name';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatSignalWait(milliseconds: number) {
  if (milliseconds <= 0) return 'Signal ready';
  const totalMinutes = Math.ceil(milliseconds / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `Next signal in ${hours} h ${minutes.toString().padStart(2, '0')}` : `Next signal in ${minutes} min`;
}

export default function ObservatoryHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { stars: acquiredStars, loading: acquisitionsLoading, error: acquisitionsError, refresh: refreshAcquisitions } = useAcquisitions();
  const { progressFor, ready: progressReady } = useGuardianProgress();
  const [now, setNow] = useState(Date.now());
  const compact = height < 760;
  const firstAcquiredStar = acquiredStars[0];
  // Progression du système mis en avant sur l'accueil (chaque étoile a la sienne).
  const progress = progressFor(firstAcquiredStar?.id);
  const hasFirstPurchase = Boolean(firstAcquiredStar);
  const signalReady = progressReady && now >= progress.nextSignalAt;
  const atlasProgress = progress.signalsAnalyzed === 0 ? 0 : ((progress.signalsAnalyzed - 1) % 7) + 1;
  const cinematicHeight = Math.max(260, Math.min(390, height * 0.44));

  useEffect(() => {
    if (!hasFirstPurchase) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [hasFirstPurchase]);

  return (
    <View style={[styles.screen, { paddingBottom: navigationClearance(insets.bottom) }]}>
      {/* Page fixe : aucun défilement, tout tient dans l'écran. */}
      <View style={[styles.shell, { paddingTop: insets.top + 10 }]}>
        <View style={styles.header}>
          <Text style={styles.brand}>ASTRALYS</Text>
        </View>

        <View style={styles.main}>
          {/* Pas d'animation d'apparition : la page reste immobile à chaque retour sur l'accueil. */}
          <View style={[styles.acquisitionScene, compact && styles.acquisitionSceneCompact]}>
            <FirstStarSystem active={hasFirstPurchase} height={cinematicHeight} star={firstAcquiredStar} />

            <View style={styles.copy}>
              <Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact]}>
                {hasFirstPurchase ? 'Your system is online.' : acquisitionsLoading ? 'Opening your sky…' : acquisitionsError ? 'Your sky is out of reach.' : 'Begin with one star.'}
              </Text>
              <Text style={styles.subtitle}>
                {hasFirstPurchase
                  ? `${getCelestialDisplayName(firstAcquiredStar)} is yours. Your observatory and its instruments are ready.`
                  : acquisitionsError
                    ? 'Astralys could not restore your acquisition. Try reconnecting your account.'
                    : 'Choose the star that will become the first point in your personal sky.'}
              </Text>
            </View>

            <View style={styles.actionArea}>
              {acquisitionsError && !hasFirstPurchase ? <ObservatoryButton
                label="Restore my system"
                icon={Orbit}
                loading={acquisitionsLoading}
                onPress={() => void refreshAcquisitions()}
                style={styles.primaryAction}
              /> : hasFirstPurchase ? <EnterSystemButton
                disabled={acquisitionsLoading}
                onEnter={() => router.push({ pathname: '/observatory', params: { view: 'system', starId: firstAcquiredStar.id } })}
                style={styles.enterAction}
              /> : <Link href={{ pathname: '/explore', params: { intent: 'first-star' } }} asChild>
                <ObservatoryButton label="Acquire my first star" icon={Sparkles} disabled={acquisitionsLoading} style={styles.primaryAction} />
              </Link>}

              {hasFirstPurchase ? <>
                <View style={styles.progressLine}>
                  <Text style={[styles.signalStatus, signalReady && styles.signalStatusReady]}>{progressReady ? formatSignalWait(progress.nextSignalAt - now) : 'Restoring observatory…'}</Text>
                  <View style={styles.progressDot} />
                  <Text style={styles.atlasStatus}>{acquiredStars.length} {acquiredStars.length === 1 ? 'star' : 'stars'} · Atlas {atlasProgress}/7</Text>
                </View>
              </> : <Text style={styles.disclaimer}>A personal addition to your Astralys collection. Scientific names remain unchanged.</Text>}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background, overflow: 'hidden' },
  shell: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: { minHeight: 48, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  brand: { color: theme.text, fontSize: 20, fontWeight: '800', letterSpacing: 4 },
  main: { flex: 1 },
  acquisitionScene: {
    flexGrow: 1,
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 18,
  },
  acquisitionSceneCompact: { paddingTop: 2, paddingBottom: 12 },
  copy: { alignItems: 'center', paddingHorizontal: 6 },
  title: { color: '#F7F4FF', fontSize: 34, lineHeight: 41, fontWeight: '600', letterSpacing: -1, textAlign: 'center' },
  titleCompact: { fontSize: 28, lineHeight: 34 },
  subtitle: { maxWidth: 390, marginTop: 7, color: '#A7B0C5', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  actionArea: { marginTop: 18 },
  enterAction: { alignSelf: 'center', minWidth: 230, marginTop: 14 },
  primaryAction: { alignSelf: 'center', minWidth: 230, marginTop: 14, paddingHorizontal: 18 },
  progressLine: { minHeight: 28, marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  signalStatus: { color: '#8B93A7', fontSize: 10, fontWeight: '600' },
  signalStatusReady: { color: '#9CCCB7' },
  progressDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#4B5263' },
  atlasStatus: { color: '#70778A', fontSize: 10, fontWeight: '600' },
  disclaimer: { maxWidth: 360, alignSelf: 'center', marginTop: 10, color: '#696F80', fontSize: 10, lineHeight: 15, textAlign: 'center' },
});
