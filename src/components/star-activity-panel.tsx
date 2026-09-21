import { supabase } from '@/lib/supabase';
import type { StarDetail } from '@/components/star-detail-modal';
import {
  calculateVisibility,
  calculateWeeklyVisibility,
  type ObserverLocation,
} from '@/utils/astronomy';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text, TextInput } from '@/components/astralys-text';

type ObservationEntry = {
  id: string;
  note: string;
  observedAt: string;
};

type CelestialUpdate = {
  id: string;
  update_type: string;
  source_name: string;
  title: string;
  summary: string | null;
  published_at: string;
};

const PARIS: ObserverLocation = {
  latitude: 48.8566,
  longitude: 2.3522,
  label: 'Paris · default location',
};

function formatTime(date: Date | null) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatShortDate(date: Date | string | null | undefined) {
  if (!date) return 'Not available';
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(typeof date === 'string' ? new Date(date) : date);
}

function getReferenceUpdateDate(star: StarDetail, updates: CelestialUpdate[]) {
  if (updates[0]?.published_at) return updates[0].published_at;
  if (star.source_updated_at) return star.source_updated_at;
  if (star.catalog_release_date) return `${star.catalog_release_date}T00:00:00Z`;
  if (star.source_catalog === 'GAIA_DR3') return '2022-06-13T00:00:00Z';
  return star.updated_at ?? null;
}

export function StarActivityPanel({ star }: { star: StarDetail }) {
  const storageKey = `astrelys.observations.${star.id}`;
  const [observer, setObserver] = useState<ObserverLocation>(PARIS);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [observations, setObservations] = useState<ObservationEntry[]>([]);
  const [note, setNote] = useState('');
  const [journalError, setJournalError] = useState<string | null>(null);
  const [updatesError, setUpdatesError] = useState<string | null>(null);
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const [updates, setUpdates] = useState<CelestialUpdate[]>([]);

  const visibility = useMemo(
    () => calculateVisibility(star.ra_deg, star.dec_deg, observer),
    [observer, star.dec_deg, star.ra_deg],
  );
  const weeklyVisibility = useMemo(
    () => calculateWeeklyVisibility(star.ra_deg, star.dec_deg, observer),
    [observer, star.dec_deg, star.ra_deg],
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed) || parsed.some(entry => !entry || typeof entry.id !== 'string' || typeof entry.note !== 'string' || typeof entry.observedAt !== 'string')) throw new Error('Invalid journal');
      setObservations(parsed as ObservationEntry[]);
      setJournalError(null);
    } catch {
      setObservations([]);
      setJournalError('The journal could not be read from device storage.');
    }
  }, [storageKey]);

  useEffect(() => {
    let active = true;
    setUpdates([]);
    setUpdatesError(null);
    setUpdatesLoading(true);

    void supabase
      .from('celestial_updates')
      .select('id, update_type, source_name, title, summary, published_at')
      .eq('celestial_object_id', star.id)
      .order('published_at', { ascending: false })
      .limit(3)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setUpdatesError('Scientific updates could not be loaded. Try reopening this profile.');
        else setUpdates((data ?? []) as CelestialUpdate[]);
        setUpdatesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [star.id]);

  const useCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationMessage(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationMessage('Location denied: calculations still use Paris.');
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 15 * 60 * 1000 });
      const location = lastKnown ?? await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setObserver({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        label: 'My approximate location',
      });
      setLocationMessage('Visibility updated for your location.');
    } catch {
      setLocationMessage('Location unavailable: calculations still use Paris.');
    } finally {
      setLocationLoading(false);
    }
  };

  const addObservation = () => {
    const cleanNote = note.trim();
    if (!cleanNote) return;

    const nextEntry: ObservationEntry = {
      id: `${Date.now()}`,
      note: cleanNote,
      observedAt: new Date().toISOString(),
    };
    const nextObservations = [nextEntry, ...observations];

    try {
      localStorage.setItem(storageKey, JSON.stringify(nextObservations));
    } catch {
      setJournalError('The note could not be saved. Check the storage available on this device.');
      return;
    }

    setJournalError(null);
    setObservations(nextObservations);
    setNote('');
  };

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyObservationCount = observations.filter(
    (observation) => new Date(observation.observedAt).getTime() >= oneWeekAgo,
  ).length;
  const lastUpdate = getReferenceUpdateDate(star, updates);

  return (
    <>
      <Animated.View entering={FadeInDown.duration(430).delay(300)} style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.eyebrow}>PERSONAL OBSERVATORY</Text>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Visibility tonight</Text>
          </View>
          <View style={[styles.statusPill, visibility?.observableTonight ? styles.statusPositive : styles.statusQuiet]}>
            <View style={[styles.statusDot, visibility?.observableTonight && styles.statusDotPositive]} />
            <Text style={styles.statusText}>
              {visibility?.visibleNow ? 'Visible now' : visibility?.observableTonight ? 'Observable' : 'Low visibility'}
            </Text>
          </View>
        </View>

        {visibility ? (
          <>
            <Text style={styles.visibilitySentence}>
              {visibility.observableTonight
                ? `Best viewing around ${formatTime(visibility.bestTime)}, facing ${visibility.direction.toLowerCase()}.`
                : 'No favorable passage above 20° during the coming night.'}
            </Text>
            <View style={styles.visibilityMetrics}>
              <View style={styles.visibilityMetric}>
                <Text style={styles.metricLabel}>FIRST VISIBILITY</Text>
                <Text style={styles.metricValue}>{formatTime(visibility.firstVisibleTime)}</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.visibilityMetric}>
                <Text style={styles.metricLabel}>MAX. ALTITUDE</Text>
                <Text style={styles.metricValue}>
                  {visibility.bestAltitude === null ? '—' : `${Math.round(visibility.bestAltitude)}°`}
                </Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.visibilityMetric}>
                <Text style={styles.metricLabel}>DIRECTION</Text>
                <Text style={styles.metricValue}>{visibility.direction}</Text>
              </View>
            </View>
          </>
        ) : (
          <Text style={styles.visibilitySentence}>The coordinates are insufficient to calculate visibility.</Text>
        )}

        <View style={styles.locationRow}>
          <View style={styles.locationCopy}>
            <Text style={styles.locationLabel}>CALCULATED FOR</Text>
            <Text style={styles.locationValue}>{observer.label}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Calculate sky visibility for my approximate location" accessibilityState={{ disabled: locationLoading, busy: locationLoading }} disabled={locationLoading} onPress={useCurrentLocation} style={styles.locationButton}>
            {locationLoading ? (
              <ActivityIndicator color="#D8CEF2" size="small" />
            ) : (
              <Text style={styles.locationButtonText}>My location</Text>
            )}
          </Pressable>
        </View>
        {locationMessage ? <Text style={styles.locationMessage}>{locationMessage}</Text> : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(430).delay(340)} style={styles.sectionCard}>
        <Text style={styles.eyebrow}>THIS WEEK</Text>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Your celestial summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{weeklyVisibility?.visibleNights ?? 0}/7</Text>
            <Text style={styles.summaryLabel}>favorable nights</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{weeklyObservationCount}</Text>
            <Text style={styles.summaryLabel}>logged observations</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{updates.length}</Text>
            <Text style={styles.summaryLabel}>recent updates</Text>
          </View>
        </View>
        {weeklyVisibility?.bestNight ? (
          <Text style={styles.summaryHint}>
            Best opportunity: {formatShortDate(weeklyVisibility.bestNight)}, around {formatTime(weeklyVisibility.bestNight)}.
          </Text>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(430).delay(380)} style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.eyebrow}>SCIENTIFIC MONITORING</Text>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Updates</Text>
          </View>
          <View style={styles.updateDatePill}>
            <Text style={styles.updateDateText}>Ref. {formatShortDate(lastUpdate)}</Text>
          </View>
        </View>

        {updatesLoading ? <ActivityIndicator accessibilityLabel="Loading scientific updates" color="#C8BAF5" /> : updatesError ? <Text accessibilityRole="alert" style={styles.visibilitySentence}>{updatesError}</Text> : updates.length > 0 ? (
          <View style={styles.updateList}>
            {updates.map((update) => (
              <View key={update.id} style={styles.updateItem}>
                <View style={styles.updateDot} />
                <View style={styles.updateCopy}>
                  <Text style={styles.updateSource}>{update.source_name} · {formatShortDate(update.published_at)}</Text>
                  <Text style={styles.updateTitle}>{update.title}</Text>
                  {update.summary ? <Text numberOfLines={3} style={styles.updateSummary}>{update.summary}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.quietNews}>
            <Text style={styles.quietNewsSymbol}>◎</Text>
            <View style={styles.updateCopy}>
              <Text style={styles.quietNewsTitle}>No recent scientific publication</Text>
              <Text style={styles.quietNewsText}>The latest reference data remains visible without inventing an update.</Text>
            </View>
          </View>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(430).delay(420)} style={styles.sectionCard}>
        <Text style={styles.eyebrow}>PERSONAL LOG</Text>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Observation journal</Text>
        <TextInput
          accessibilityLabel="Observation journal note"
          maxLength={280}
          multiline
          onChangeText={setNote}
          placeholder="Example: observed from the balcony under a clear sky…"
          placeholderTextColor="#656C7E"
          selectionColor="#B9A8E8"
          style={styles.noteInput}
          value={note}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !note.trim() }}
          disabled={!note.trim()}
          onPress={addObservation}
          style={[styles.addButton, !note.trim() && styles.addButtonDisabled]}>
          <Text style={styles.addButtonText}>Add to journal</Text>
        </Pressable>

        <Text style={styles.visibilitySentence}>Journal notes are saved on this device, not synced across devices. Sky visibility is geometric: weather, light pollution and apparent brightness may prevent observation.</Text>
        {journalError ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.visibilitySentence}>{journalError}</Text> : null}
        {observations.length > 0 ? (
          <View style={styles.observationList}>
            {observations.slice(0, 3).map((observation) => (
              <View key={observation.id} style={styles.observationItem}>
                <Text style={styles.observationDate}>{formatShortDate(observation.observedAt)}</Text>
                <Text selectable style={styles.observationNote}>{observation.note}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyJournal}>Your journal is empty. The first note will begin the story of this celestial object.</Text>
        )}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    padding: 17,
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: '#0F131D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.055)',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: '#A996DF', fontSize: 12, fontWeight: '900', letterSpacing: 1.3, marginBottom: 5 },
  sectionTitle: { color: '#EEEAF3', fontSize: 16, fontWeight: '700' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 99 },
  statusPositive: { backgroundColor: 'rgba(116,194,163,0.10)' },
  statusQuiet: { backgroundColor: '#171B27' },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#747B8C' },
  statusDotPositive: { backgroundColor: '#74C2A3' },
  statusText: { color: '#A6B5AF', fontSize: 12, fontWeight: '800' },
  visibilitySentence: { color: '#9695A0', fontSize: 12, lineHeight: 18, marginTop: 13 },
  visibilityMetrics: { flexDirection: 'row', alignItems: 'stretch', marginTop: 15, paddingVertical: 12, borderRadius: 14, backgroundColor: '#0B0F17' },
  visibilityMetric: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 4 },
  metricLabel: { color: '#A1A9BB', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  metricValue: { color: '#DCD7E4', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  metricDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.055)' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  locationCopy: { flex: 1, gap: 3 },
  locationLabel: { color: '#A1A9BB', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  locationValue: { color: '#9695A0', fontSize: 12 },
  locationButton: { minWidth: 86, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 11, backgroundColor: '#1A1E2C' },
  locationButtonText: { color: '#D8CEF2', fontSize: 12, fontWeight: '800' },
  locationMessage: { color: '#827A94', fontSize: 12, lineHeight: 18, marginTop: 9 },
  summaryGrid: { flexDirection: 'row', gap: 7, marginTop: 14 },
  summaryItem: { flex: 1, minHeight: 70, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 5, borderRadius: 13, backgroundColor: '#0B0F17' },
  summaryValue: { color: '#DCD3F2', fontSize: 18, fontWeight: '800' },
  summaryLabel: { color: '#A1A9BB', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  summaryHint: { color: '#868294', fontSize: 12, lineHeight: 18, marginTop: 11, textAlign: 'center' },
  updateDatePill: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10, backgroundColor: '#171B27' },
  updateDateText: { color: '#7E8494', fontSize: 12, fontWeight: '700' },
  updateList: { gap: 12, marginTop: 15 },
  updateItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  updateDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#A996DF', marginTop: 5 },
  updateCopy: { flex: 1 },
  updateSource: { color: '#A1A9BB', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  updateTitle: { color: '#DCD8E3', fontSize: 12, fontWeight: '700', lineHeight: 16 },
  updateSummary: { color: '#858492', fontSize: 12, lineHeight: 18, marginTop: 4 },
  quietNews: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginTop: 14, padding: 12, borderRadius: 13, backgroundColor: '#0B0F17' },
  quietNewsSymbol: { color: '#817697', fontSize: 17 },
  quietNewsTitle: { color: '#B6B1BE', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  quietNewsText: { color: '#A1A9BB', fontSize: 12, lineHeight: 18 },
  noteInput: { minHeight: 88, color: '#E2DEE8', fontSize: 12, lineHeight: 17, textAlignVertical: 'top', padding: 12, marginTop: 14, borderRadius: 14, backgroundColor: '#0B0F17', borderWidth: 1, borderColor: 'rgba(255,255,255,0.055)' },
  addButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 8, borderRadius: 13, backgroundColor: '#E7DFFF' },
  addButtonDisabled: { opacity: 0.38 },
  addButtonText: { color: '#171321', fontSize: 12, fontWeight: '900' },
  observationList: { gap: 8, marginTop: 14 },
  observationItem: { padding: 12, borderRadius: 13, backgroundColor: '#0B0F17' },
  observationDate: { color: '#797185', fontSize: 12, fontWeight: '800', marginBottom: 5 },
  observationNote: { color: '#AAA7B1', fontSize: 12, lineHeight: 16 },
  emptyJournal: { color: '#A1A9BB', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 13, paddingHorizontal: 8 },
});
