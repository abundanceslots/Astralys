import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/astralys-text';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FixedSectionScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
  symbol: string;
  status: string;
};

export function FixedSectionScreen({
  eyebrow,
  title,
  description,
  symbol,
  status,
}: FixedSectionScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      <View style={styles.sky}>
        <View style={styles.starOne} />
        <View style={styles.starTwo} />
        <View style={styles.starThree} />
      </View>
      <View style={styles.shell}>
        <View style={styles.header}>
          <Text selectable style={styles.brand}>ASTRALYS</Text>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text selectable style={styles.liveText}>Celestial catalogue</Text>
          </View>
        </View>

        <Animated.View entering={FadeInDown.duration(450)} style={styles.content}>
          <View style={styles.symbolWrap}>
            <Text style={styles.symbol}>{symbol}</Text>
          </View>
          <Text selectable style={styles.eyebrow}>{eyebrow}</Text>
          <Text selectable style={styles.title}>{title}</Text>
          <Text selectable style={styles.description}>{description}</Text>
          <View style={styles.statusCard}>
            <Text selectable style={styles.status}>{status}</Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#070911', paddingHorizontal: 20, paddingBottom: 14 },
  sky: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none' },
  starOne: { position: 'absolute', top: '18%', left: '12%', width: 2, height: 2, borderRadius: 2, backgroundColor: '#FFF', opacity: 0.5 },
  starTwo: { position: 'absolute', top: '28%', right: '16%', width: 3, height: 3, borderRadius: 2, backgroundColor: '#FFF', opacity: 0.55 },
  starThree: { position: 'absolute', bottom: '21%', left: '24%', width: 2, height: 2, borderRadius: 2, backgroundColor: '#FFF', opacity: 0.3 },
  shell: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: '#F5F3FF', fontSize: 17, fontWeight: '800', letterSpacing: 3.2 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99, backgroundColor: '#101420' },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#A996DF' },
  liveText: { color: '#777E91', fontSize: 10, fontWeight: '600' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 13, paddingBottom: 36 },
  symbolWrap: { width: 92, height: 92, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#131728', borderWidth: 1, borderColor: 'rgba(196,181,253,0.12)', marginBottom: 8 },
  symbol: { color: '#C8BAF5', fontSize: 38 },
  eyebrow: { color: '#A996DF', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  title: { color: '#F5F3FA', fontSize: 34, lineHeight: 40, fontWeight: '600', textAlign: 'center', letterSpacing: -1 },
  description: { maxWidth: 350, color: '#858B9E', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  statusCard: { marginTop: 12, minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 14, backgroundColor: '#10141F', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  status: { color: '#A9A0C2', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
});
