/**
 * Écran de test des systèmes (développement) : parcourir les ~10 000 étoiles du catalogue,
 * voir le système 3D construit pour chacune et le résultat des règles de vérification.
 * Accès : Profil → « System lab » (visible seulement en mode développement).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronLeft, ChevronRight, Shuffle } from 'lucide-react-native';
import { Text } from '@/components/astralys-text';
import { GuardianScene3D } from '@/components/guardian-scene-3d';
import { demoPlanets, type DemoPlanet } from '@/features/guardian-demo-model';
import { validateSystemDefinition, type StarRecord } from '@/features/system-definition';
import { STAR_FIELDS, useSystemDefinition } from '@/lib/system-catalogue';
import { supabase } from '@/lib/supabase';

const PAGE = 40;
const VIOLET = '#C8BAF5', GREEN = '#9CCCB7', RED = '#F3A6A6', MUTED = '#8C94AA';
type Filter = 'all' | 'planets';

function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.7 }]}>
    <Text style={[styles.chipText, active && { color: VIOLET }]}>{label}</Text>
  </Pressable>;
}

export default function SystemLab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [stars, setStars] = useState<StarRecord[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DemoPlanet>('b');

  const query = useCallback((from: number) => {
    let request = supabase.from('celestial_objects')
      .select(filter === 'planets' ? `${STAR_FIELDS}, planetary_systems!inner(confirmed_planet_count)` : STAR_FIELDS, { count: 'exact' })
      .eq('object_type', 'star');
    if (filter === 'planets') request = request.gt('planetary_systems.confirmed_planet_count', 0);
    const term = search.trim();
    if (term) request = request.or(`scientific_name.ilike.%${term}%,common_name.ilike.%${term}%`);
    return request.order('scientific_name').range(from, from + PAGE - 1);
  }, [filter, search]);

  const loadPage = useCallback(async (from: number, pick: 'first' | 'last' | number = 'first') => {
    setLoading(true); setError(null);
    const { data, count, error: requestError } = await query(from);
    setLoading(false);
    if (requestError) { setError(requestError.message); return; }
    const rows = (data ?? []) as unknown as StarRecord[];
    setStars(rows); setOffset(from); setTotal(count ?? null);
    setIndex(pick === 'first' ? 0 : pick === 'last' ? Math.max(0, rows.length - 1) : Math.min(rows.length - 1, pick));
    setSelected('b');
  }, [query]);

  useEffect(() => { void loadPage(0); }, [filter]);

  const star = stars[index] ?? null;
  const { system, loading: systemLoading, error: systemError } = useSystemDefinition(star);
  const issues = useMemo(() => (system ? validateSystemDefinition(system) : []), [system]);
  const position = offset + index;

  const next = () => { if (index < stars.length - 1) { setIndex(index + 1); setSelected('b'); } else if (total === null || offset + PAGE < total) void loadPage(offset + PAGE); };
  const previous = () => { if (index > 0) { setIndex(index - 1); setSelected('b'); } else if (offset > 0) void loadPage(Math.max(0, offset - PAGE), 'last'); };
  const random = () => {
    if (!total) return;
    const target = Math.floor(Math.random() * total);
    const pageStart = Math.floor(target / PAGE) * PAGE;
    void loadPage(pageStart, target - pageStart);
  };
  const body = system?.bodies.find(b => b.id === selected);
  const swatch = system ? `rgb(${system.star.color.map(c => Math.round(c * 255)).join(',')})` : '#333';

  return <View style={[styles.screen, { paddingTop: insets.top + 4 }]}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}><ArrowLeft size={21} color="#F4F1FF" /></Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>System lab</Text>
        <Text style={styles.subtitle}>{total === null ? 'Loading catalogue…' : `Star ${position + 1} of ${total.toLocaleString('en-US')}`}</Text>
      </View>
      <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
      <Chip label="With planets" active={filter === 'planets'} onPress={() => setFilter('planets')} />
    </View>
    <View style={styles.searchRow}>
      <TextInput value={search} onChangeText={setSearch} onSubmitEditing={() => void loadPage(0)} placeholder="Search a star (name)…" placeholderTextColor="#5A6378" returnKeyType="search" style={styles.search} />
      <Pressable accessibilityRole="button" accessibilityLabel="Previous star" onPress={previous} style={styles.navButton}><ChevronLeft size={20} color="#F4F1FF" /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Random star" onPress={random} style={styles.navButton}><Shuffle size={18} color={VIOLET} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Next star" onPress={next} style={styles.navButton}><ChevronRight size={20} color="#F4F1FF" /></Pressable>
    </View>

    <View style={styles.scene}>
      {system ? <GuardianScene3D mode="system" selected={selected} connected={demoPlanets} relayLevel={6} resetKey={position} onSelect={setSelected} system={system} /> : null}
      {loading || systemLoading ? <View pointerEvents="none" style={styles.sceneBadge}><ActivityIndicator color={VIOLET} size="small" /><Text style={styles.sceneBadgeText}>{loading ? 'Loading stars…' : 'Loading planets & profile…'}</Text></View> : null}
      {error ? <Text style={[styles.sceneBadgeText, styles.errorText]}>{error}</Text> : null}
    </View>

    <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
      {system ? <>
        <View style={styles.row}>
          <View style={[styles.swatch, { backgroundColor: swatch }]} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.starName}>{system.starName}</Text>
            <Text style={styles.meta}>{Math.round(system.star.temperatureK).toLocaleString('en-US')} K · star size {system.star.size.toFixed(2)} · {system.realPlanetCount} confirmed planet{system.realPlanetCount === 1 ? '' : 's'}</Text>
          </View>
        </View>
        <View style={[styles.verdict, { borderColor: issues.length ? RED : GREEN }]}>
          <Text style={[styles.verdictText, { color: issues.length ? RED : GREEN }]}>{issues.length ? `✗ ${issues.length} rule${issues.length > 1 ? 's' : ''} broken` : '✓ All layout rules pass'}</Text>
          {issues.slice(0, 4).map(issue => <Text key={issue} style={styles.issue}>{issue}</Text>)}
          {systemError ? <Text style={styles.issue}>Database unreachable: showing the version built from the star only.</Text> : null}
        </View>
        <View style={styles.grid}>
          <Text style={styles.cell}><Text style={styles.label}>Architecture </Text>{system.profile.systemArchitecture} <Text style={styles.label}>({system.sources.architecture})</Text></Text>
          <Text style={styles.cell}><Text style={styles.label}>Mood </Text>{system.profile.visualMood} <Text style={styles.label}>({system.sources.mood})</Text></Text>
          <Text style={styles.cell}><Text style={styles.label}>Planet style </Text>{system.profile.planetVisualStyle} <Text style={styles.label}>({system.sources.style})</Text></Text>
          <Text style={styles.cell}><Text style={styles.label}>Seed </Text>{system.profile.visualSeed}</Text>
        </View>
        <View style={styles.planets}>
          {system.bodies.map(b => <Pressable key={b.id} onPress={() => setSelected(b.id)} style={[styles.planetRow, selected === b.id && styles.planetRowActive]}>
            <View style={[styles.dot, { backgroundColor: `rgb(${b.color.map(c => Math.round(c * 255)).join(',')})` }]} />
            <Text style={styles.planetId}>{b.id}</Text>
            <Text numberOfLines={1} style={[styles.planetName, !b.real && { color: MUTED }]}>{b.real ? b.name : 'simulated'}</Text>
            <Text style={styles.planetNums}>orbit {b.orbit.toFixed(2)} · size {b.size.toFixed(2)} · {['rock', 'ocean', 'ice', 'gas'][b.surfaceStyle]}</Text>
          </Pressable>)}
        </View>
        {body ? <Text style={styles.meta}>Tap a planet in the 3D view or in the list to focus it. Selected: {body.real ? body.name : `${system.starName} ${body.id} (simulated)`}.</Text> : null}
      </> : <Text style={styles.meta}>{loading ? 'Loading…' : 'No star found.'}</Text>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#070911' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingRight: 12, minHeight: 50 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#F4F1FF', fontSize: 17, fontWeight: '700' },
  subtitle: { color: MUTED, fontSize: 11 },
  chip: { paddingHorizontal: 10, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#2A3048', justifyContent: 'center' },
  chipActive: { borderColor: VIOLET, backgroundColor: 'rgba(200,186,245,0.12)' },
  chipText: { color: MUTED, fontSize: 11, fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  search: { flex: 1, height: 40, borderRadius: 12, paddingHorizontal: 12, color: '#F4F1FF', backgroundColor: '#10141F', borderWidth: 1, borderColor: '#22283B' },
  navButton: { width: 44, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#10141F', borderWidth: 1, borderColor: '#22283B' },
  scene: { flex: 1, minHeight: 280 },
  sceneBadge: { position: 'absolute', top: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: 'rgba(15,19,29,0.9)' },
  sceneBadgeText: { color: MUTED, fontSize: 12 },
  errorText: { position: 'absolute', top: 10, alignSelf: 'center', color: RED },
  panel: { maxHeight: '42%', borderTopWidth: 1, borderTopColor: '#1B2033' },
  panelContent: { padding: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  starName: { color: '#F4F1FF', fontSize: 16, fontWeight: '700' },
  meta: { color: MUTED, fontSize: 12, lineHeight: 17 },
  verdict: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 3 },
  verdictText: { fontSize: 13, fontWeight: '700' },
  issue: { color: '#D6C0C4', fontSize: 11 },
  grid: { gap: 3 },
  cell: { color: '#E4E0EE', fontSize: 12 },
  label: { color: MUTED, fontSize: 12 },
  planets: { gap: 2 },
  planetRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 8 },
  planetRowActive: { backgroundColor: 'rgba(200,186,245,0.1)' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  planetId: { color: VIOLET, fontSize: 12, fontWeight: '700', width: 12 },
  planetName: { color: '#F4F1FF', fontSize: 12, width: 110 },
  planetNums: { color: MUTED, fontSize: 11, flex: 1 },
});
