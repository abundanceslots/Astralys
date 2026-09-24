import { CelestialVisual } from '@/components/celestial-visual';
import { Text } from '@/components/astralys-text';
import { Orbit } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

function seedFor(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return Math.abs(hash);
}

export function ImaginedPlanetsPanel({ starId }: { starId: string }) {
  const seed = seedFor(starId);
  const count = 2 + seed % 4;
  const worlds = Array.from({ length: count }, (_, index) => ({
    id: `${starId}-imagined-${index + 1}`,
    object_type: 'planet' as const,
    radius_earth: 0.8 + ((seed >> (index * 3)) % 90) / 10,
    equilibrium_temperature_k: 130 + ((seed >> (index * 4)) % 850),
  }));

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Orbit size={18} color="#C7A6D8" />
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Imagined system · {count} worlds</Text>
          <Text style={styles.hint}>Artistic simulation based around a real catalogued star</Text>
        </View>
        <Text style={styles.badge}>FICTION</Text>
      </View>
      <View style={styles.worlds}>
        {worlds.map((world, index) => (
          <View key={world.id} style={styles.world}>
            <CelestialVisual animated object={world} size={48} />
            <Text style={styles.worldName}>{String.fromCharCode(98 + index)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 10, padding: 14, borderRadius: 16, backgroundColor: '#17121D' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  headerCopy: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: '#F2EAF6', fontSize: 13, fontWeight: '700' },
  hint: { color: '#96899E', fontSize: 10, lineHeight: 14 },
  badge: { color: '#C7A6D8', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  worlds: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  world: { alignItems: 'center', gap: 1 },
  worldName: { color: '#817687', fontSize: 9, fontWeight: '700' },
});
