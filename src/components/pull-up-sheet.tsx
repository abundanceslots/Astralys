/**
 * Section « Next step » repliable, dans le flux de la page (elle ne recouvre rien).
 * Repliée : une seule ligne (étape + titre). Un tap ouvre / ferme ; glisser vers le haut ouvre,
 * vers le bas ferme. Gestes gérés avec les évènements tactiles simples de React Native :
 * toujours l'état à jour, pas de conflit avec la scène 3D.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { ChevronUp } from 'lucide-react-native';
import { useMotionPreferences } from '@/context/motion-context';
import { haptic } from '@/features/orbital/haptics';

type Props = {
  peek: ReactNode;
  children: ReactNode;
  /** Ouvre la section (ex. : aide de démarrage affichée). */
  forceOpen?: boolean;
  /** Fait respirer la poignée : une action attend le joueur. */
  highlight?: boolean;
};

export function StepDrawer({ peek, children, forceOpen = false, highlight = false }: Props) {
  const { reducedMotion } = useMotionPreferences();
  const [open, setOpen] = useState(forceOpen);
  const touchStartY = useRef<number | null>(null);
  const turn = useSharedValue(forceOpen ? 1 : 0);
  const glow = useSharedValue(0);

  useEffect(() => {
    turn.value = reducedMotion ? (open ? 1 : 0) : withSpring(open ? 1 : 0, { damping: 16, stiffness: 200 });
  }, [open, reducedMotion, turn]);
  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);
  useEffect(() => {
    if (!highlight || open || reducedMotion) { glow.value = withTiming(0, { duration: 200 }); return; }
    glow.value = withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 900 })), -1, false);
  }, [highlight, open, reducedMotion, glow]);

  const setTo = (next: boolean) => {
    setOpen(current => {
      if (current !== next) haptic('tick');
      return next;
    });
  };

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  const handleStyle = useAnimatedStyle(() => ({ width: 32 + glow.value * 14, opacity: 0.4 + glow.value * 0.6 }));

  return <View style={styles.wrap}>
    <View accessible accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={open ? 'Hide next step' : 'Show next step'}
      onAccessibilityTap={() => setTo(!open)}
      onStartShouldSetResponder={() => true}
      onResponderGrant={event => { touchStartY.current = event.nativeEvent.pageY; }}
      onResponderRelease={event => {
        const dy = touchStartY.current === null ? 0 : event.nativeEvent.pageY - touchStartY.current;
        touchStartY.current = null;
        if (dy < -18) setTo(true);
        else if (dy > 18) setTo(false);
        else setTo(!open);
      }}
      onResponderTerminate={() => { touchStartY.current = null; }}
      style={styles.grip}>
      <Animated.View style={[styles.handle, handleStyle]} />
      <View style={styles.peekRow}>
        <View style={styles.peekContent}>{peek}</View>
        <Animated.View style={chevronStyle}><ChevronUp size={18} color="#8C94AA" /></Animated.View>
      </View>
    </View>
    {open ? <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(180)} style={styles.body}>
      {children}
    </Animated.View> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 2 },
  grip: { paddingTop: 6, paddingBottom: 4 },
  handle: { alignSelf: 'center', height: 4, borderRadius: 2, backgroundColor: '#C8BAF5', marginBottom: 8 },
  peekRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  peekContent: { flex: 1, minWidth: 0 },
  body: { overflow: 'hidden' },
});
