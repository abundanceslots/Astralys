import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ChevronRight, Orbit } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Text } from './astralys-text';
import { ObservatoryPressable } from './observatory-button';
import { CelestialVisual } from './celestial-visual';
import type { StarDetail } from './star-detail-modal';

export function ConfirmedPlanetsPanel({ starId, onSelect }: { starId: string; onSelect: (planet: StarDetail) => void }) {
  const [planets, setPlanets] = useState<StarDetail[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true); setError(false); setCount(null); setPlanets([]); setExpanded(false);
    void Promise.resolve(supabase.from('celestial_objects').select('*', { count: 'exact' })
      .eq('object_type', 'planet').eq('host_object_id', starId)
      .order('orbital_period_days', { ascending: true, nullsFirst: false })
      .order('scientific_name', { ascending: true }).limit(100).abortSignal(controller.signal))
      .then(({ data, count: total, error: queryError }) => {
        if (!active) return;
        if (queryError) setError(true);
        else { setPlanets((data ?? []) as StarDetail[]); setCount(total ?? data?.length ?? 0); }
        setLoading(false);
      }).catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; controller.abort(); };
  }, [starId, retry]);
  return <View style={styles.panel}>
    {loading ? <View style={styles.header}><ActivityIndicator color="#C8BAF5" size="small" /><Text style={styles.title}>Loading planets…</Text></View>
      : error ? <ObservatoryPressable accessibilityRole="button" accessibilityLabel="Retry loading confirmed planets" onPress={() => setRetry(v => v + 1)} style={styles.header}><Text style={styles.title}>Planets unavailable · Retry</Text></ObservatoryPressable>
      : count === 0 ? <View style={styles.empty}><Text style={styles.title}>No confirmed planets listed</Text><Text style={styles.hint}>Other planets may remain undiscovered.</Text></View>
      : <>
        <ObservatoryPressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${count} confirmed planets. ${expanded ? 'Hide' : 'Show'} list`} onPress={() => setExpanded(v => !v)} style={styles.header}>
          <Orbit size={20} color="#C8BAF5" /><Text style={styles.title}>Confirmed planets · {count}</Text><Text style={styles.toggle}>{expanded ? '−' : '+'}</Text>
        </ObservatoryPressable>
        {expanded ? <View style={styles.list}>{planets.map(planet => <ObservatoryPressable key={planet.id} accessibilityRole="button" accessibilityLabel={`View planet ${planet.scientific_name}`} onPress={() => onSelect(planet)} style={styles.planet}>
          <CelestialVisual object={planet} size={40} /><View style={styles.copy}><Text numberOfLines={2} style={styles.name}>{planet.scientific_name}</Text><Text style={styles.hint}>{planet.orbital_period_days ? `${Number(planet.orbital_period_days).toLocaleString('en-US', { maximumFractionDigits: 2 })} days per orbit` : 'Orbital period unknown'}</Text></View><ChevronRight size={18} color="#A7B0C5" />
        </ObservatoryPressable>)}{count !== null && count > planets.length ? <Text style={styles.hint}>Showing {planets.length} of {count} listed planets.</Text> : null}</View> : null}
      </>}
  </View>;
}
const styles = StyleSheet.create({
  panel: { backgroundColor: '#111622', borderRadius: 16, marginTop: 10 },
  header: { minHeight: 52, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: '#F4F1FF', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  toggle: { color: '#C8BAF5', fontSize: 20, marginLeft: 'auto' },
  empty: { padding: 16, gap: 5 }, hint: { color: '#A7B0C5', fontSize: 12, lineHeight: 18 },
  list: { paddingHorizontal: 12, paddingBottom: 12, gap: 4 },
  planet: { minHeight: 56, paddingVertical: 6, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
  copy: { flex: 1, minWidth: 0, gap: 2 }, name: { color: '#F4F1FF', fontSize: 14, fontWeight: '600' },
});
