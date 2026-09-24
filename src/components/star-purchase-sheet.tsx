import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, LockKeyhole, Sparkles, X } from 'lucide-react-native';
import { Text } from '@/components/astralys-text';
import { ObservatoryButton, ObservatoryPressable } from '@/components/observatory-button';
import type { StarDetail } from '@/components/star-detail-modal';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';
import { getCelestialDisplayName } from '@/utils/celestial-display-name';
import { useAcquisitions } from '@/context/acquisitions-context';
import { isFreeClaim, starTier, TIERS } from '@/features/store-catalog';
import { fetchPlanetCount } from '@/lib/store-stars';
import { systemComposition } from '@/features/store-catalog';

/**
 * Tant que Google Play Billing / App Store ne sont pas branchés, l'achat passe par l'aperçu :
 * seuls les comptes de la liste d'invités (purchase_preview_accounts, vérifiée côté serveur) peuvent acquérir,
 * sans paiement. Passer à false quand la vraie facturation est en place.
 */
const PREVIEW_MODE = true;

type Props = {
  acquired: boolean;
  onAcquired: () => void;
  onClose: () => void;
  star: StarDetail;
  visible: boolean;
};

export function StarPurchaseSheet({ acquired, onAcquired, onClose, star, visible }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { markAcquired, stars: owned } = useAcquisitions();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planetCount, setPlanetCount] = useState<number | null>(star.confirmed_planet_count ?? null);
  const displayName = getCelestialDisplayName(star);
  // L'écran appelant ne connaît pas toujours le nombre de planètes : on le récupère pour la rareté.
  useEffect(() => {
    setPlanetCount(star.confirmed_planet_count ?? null);
    if (star.confirmed_planet_count != null || !visible) return;
    let active = true;
    void fetchPlanetCount(star.id).then(count => { if (active) setPlanetCount(count); }).catch(() => {});
    return () => { active = false; };
  }, [star.id, star.confirmed_planet_count, visible]);
  const tier = TIERS[starTier({ ...star, confirmed_planet_count: planetCount ?? 0 })];
  const free = isFreeClaim(owned.length);
  const composition = systemComposition(planetCount);
  const actionLabel = free ? 'Claim for free' : `Buy for ${tier.price}`;

  const goToSignIn = () => {
    onClose();
    router.push({ pathname: '/profile', params: { mode: 'signIn' } });
  };

  const acquire = async () => {
    if (!user || submitting || acquired) return;
    setSubmitting(true);
    setError(null);
    const { error: requestError } = await supabase.rpc('complete_preview_star_acquisition', { p_star_id: star.id });
    setSubmitting(false);
    if (requestError) {
      setError(requestError.message.includes('not enabled')
        ? 'Star purchases open at launch. This account is not on the tester list yet.'
        : 'The acquisition could not be completed. Try again.');
      return;
    }
    markAcquired(star);
    onAcquired();
  };

  return <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
    <View style={styles.root}>
      <ObservatoryPressable accessibilityLabel="Close purchase" accessibilityRole="button" onPress={onClose} style={styles.backdrop} />
      <View accessibilityViewIsModal aria-modal role="dialog" style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>SYMBOLIC GUARDIANSHIP</Text>
            <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>{displayName}</Text>
          </View>
          <ObservatoryPressable accessibilityLabel="Close purchase" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <X size={19} color="#AAA4B7" />
          </ObservatoryPressable>
        </View>

        <View style={styles.summary}>
          <Sparkles size={19} color="#C8BAF5" />
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>Add this star to your Astralys sky</Text>
            <Text style={styles.summaryText}>Unlock its guardian system and keep the acquisition attached to your account.</Text>
          </View>
        </View>

        {/* Ce que contient le système : vraies planètes et planètes inventées, avant tout achat. */}
        <View style={styles.contents}>
          <Text style={styles.contentsEyebrow}>WHAT YOU GET</Text>
          <View style={styles.contentsRow}>
            <View style={[styles.contentsDot, { backgroundColor: '#9ED9BF' }]} />
            <Text style={styles.contentsText}><Text style={styles.contentsStrong}>A real star</Text> · {star.source_catalog === 'GAIA_DR3' ? 'Gaia DR3' : star.source_catalog} {star.source_id}</Text>
          </View>
          {composition === null ? <View style={styles.contentsRow}>
            <ActivityIndicator size="small" color="#8C94AA" />
            <Text style={styles.contentsText}>Checking known planets…</Text>
          </View> : <>
            {composition.real > 0 ? <View style={styles.contentsRow}>
              <View style={[styles.contentsDot, { backgroundColor: '#9ED9BF' }]} />
              <Text style={styles.contentsText}><Text style={styles.contentsStrong}>{composition.real} confirmed {composition.real === 1 ? 'planet' : 'planets'}</Text> · real, discovered by astronomers (NASA Exoplanet Archive)</Text>
            </View> : null}
            <View style={styles.contentsRow}>
              <View style={[styles.contentsDot, styles.contentsDotHollow]} />
              <Text style={styles.contentsText}><Text style={styles.contentsStrong}>{composition.imagined} imagined {composition.imagined === 1 ? 'world' : 'worlds'}</Text> · created by Astralys from the star's real data{composition.real === 0 ? '. No planet has been discovered around this star yet' : ''}</Text>
            </View>
          </>}
        </View>

        {acquired ? <View style={styles.stateBlock}>
          <View style={styles.successIcon}><Check size={22} color="#9ED9BF" /></View>
          <Text style={styles.stateTitle}>Already in your sky</Text>
          <Text style={styles.stateText}>This acquisition is saved to your Astralys account.</Text>
        </View> : !user ? <View style={styles.stateBlock}>
          <LockKeyhole size={22} color="#C8BAF5" />
          <Text style={styles.stateTitle}>Sign in to continue</Text>
          <Text style={styles.stateText}>Acquisitions are linked to an account so they can be restored on another device.</Text>
          <ObservatoryButton label="Sign in" onPress={goToSignIn} style={styles.mainAction} />
        </View> : <View style={styles.stateBlock}>
          <View style={styles.tierRow}>
            <View style={[styles.tierDot, { backgroundColor: tier.color }]} />
            <Text style={[styles.tierText, { color: tier.color }]}>{tier.label.toUpperCase()}</Text>
          </View>
          {free ? <>
            <Text style={styles.priceFree}>Free</Text>
            <Text style={styles.stateText}>Your first star is on us. Its system, relays and probes are yours to build.</Text>
          </> : <>
            <Text style={styles.price}>{tier.price}</Text>
            <Text style={styles.stateText}>One-time purchase · priced by the number of real planets.</Text>
          </>}
          <ObservatoryButton label={actionLabel} icon={Sparkles} loading={submitting} onPress={() => void acquire()} style={styles.mainAction} />
          {PREVIEW_MODE ? <View style={styles.previewRow}><View style={styles.previewDot} /><Text style={styles.previewText}>TEST MODE · NO PAYMENT COLLECTED</Text></View> : null}
        </View>}

        {error ? <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Text style={styles.legal}>Astralys provides symbolic guardianship inside the app. It does not sell legal ownership, naming rights or exclusive rights to a celestial object. Imagined worlds are fictional and marked as such in the app.</Text>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(2,4,10,0.78)' },
  sheet: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 10, paddingBottom: 28, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: '#0E121C' },
  handle: { width: 34, height: 3, alignSelf: 'center', borderRadius: 2, backgroundColor: '#3A4050', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1, minWidth: 0, gap: 4 },
  eyebrow: { color: '#89829B', fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: '#F4F1FF', fontSize: 24, lineHeight: 31, fontWeight: '700' },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 18, paddingVertical: 14 },
  summaryCopy: { flex: 1, minWidth: 0, gap: 4 },
  summaryTitle: { color: '#EAE6F3', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  summaryText: { color: '#949BAC', fontSize: 11, lineHeight: 17 },
  stateBlock: { alignItems: 'center', gap: 9, paddingHorizontal: 16, paddingVertical: 18, borderRadius: 18, backgroundColor: '#151A27' },
  successIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(82,154,120,0.16)' },
  stateTitle: { color: '#F3F0F8', fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  stateText: { maxWidth: 360, color: '#9BA2B3', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  contents: { gap: 8, marginBottom: 14, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#232A3D' },
  contentsEyebrow: { color: '#89829B', fontSize: 9, fontWeight: '800', letterSpacing: 1.3 },
  contentsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  contentsDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  contentsDotHollow: { borderWidth: 1.5, borderColor: '#C8BAF5', backgroundColor: 'transparent' },
  contentsText: { flex: 1, color: '#9BA2B3', fontSize: 11, lineHeight: 17 },
  contentsStrong: { color: '#EAE6F3', fontWeight: '700' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tierDot: { width: 7, height: 7, borderRadius: 4 },
  tierText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  price: { color: '#F4F1FF', fontSize: 30, lineHeight: 36, fontWeight: '700' },
  priceFree: { color: '#FFD66B', fontSize: 30, lineHeight: 36, fontWeight: '700' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  previewDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#9ED9BF' },
  previewText: { color: '#9ED9BF', fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  mainAction: { width: '100%', marginTop: 6 },
  error: { color: '#F0A9B5', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 10 },
  legal: { color: '#696F80', fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 14 },
});
