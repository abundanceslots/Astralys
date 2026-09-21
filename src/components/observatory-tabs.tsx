import { Tabs, TabList, TabSlot, TabTrigger, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';
import { Text } from '@/components/astralys-text';
import { BookOpen, House, Search, UserRound, type LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Observatory as theme } from '@/constants/observatory-theme';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useMotionPreferences } from '@/context/motion-context';
import { usePressMotion } from '@/hooks/use-press-motion';
import { LaunchIntro } from '@/components/launch-intro';
export default function ObservatoryTabs() {
  const pathname = usePathname();
  const { reducedMotion, foreground, launching, launchRevealing } = useMotionPreferences();
  const awaitingLaunch = launching && !launchRevealing;
  const reveal = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion || !foreground || awaitingLaunch) { reveal.value = 1; return; }
    reveal.value = 0;
    reveal.value = withTiming(1, { duration: 220, reduceMotion: ReduceMotion.System });
  }, [pathname, reducedMotion, foreground, awaitingLaunch, reveal]);
  const screenStyle = useAnimatedStyle(() => ({ opacity: 0.9 + 0.1 * reveal.value }));
  useEffect(() => {
    if (Platform.OS === 'web') {
      const names: Record<string, string> = { '/': 'Home', '/explore': 'Explore', '/collection': 'Collection', '/profile': 'Profile' };
      document.title = `${names[pathname] ?? 'Explore'} · Astralys`;
    }
  }, [pathname]);
  return <Tabs style={styles.root} options={{ backBehavior: 'history' }}><Animated.View accessibilityElementsHidden={launching} importantForAccessibility={launching ? 'no-hide-descendants' : 'auto'} style={[styles.slot, screenStyle]}><TabSlot style={styles.slot} /></Animated.View><TabList asChild><FixedList>
    <TabTrigger name="home" href="/" asChild><TabButton icon={House}>Home</TabButton></TabTrigger>
    <TabTrigger name="explore" href="/explore" asChild><TabButton icon={Search}>Explore</TabButton></TabTrigger>
    <TabTrigger name="collection" href="/collection" asChild><TabButton icon={BookOpen}>Collection</TabButton></TabTrigger>
    <TabTrigger name="profile" href="/profile" asChild><TabButton icon={UserRound}>Profile</TabButton></TabTrigger>
  </FixedList></TabList>{launching ? <LaunchIntro /> : null}</Tabs>;
}
function TabButton({ children, icon: Icon, isFocused, ...props }: TabTriggerSlotProps & { icon: LucideIcon }) {
  const [hovered, setHovered] = useState(false);
  const motion = usePressMotion(!props.disabled);
  return <Pressable {...props}
    onPressIn={event => { motion.pressIn(); props.onPressIn?.(event); }}
    onPressOut={event => { motion.pressOut(); props.onPressOut?.(event); }}
    onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} accessibilityRole="tab" aria-selected={Boolean(isFocused)} accessibilityLabel={String(children)} accessibilityState={{ selected: Boolean(isFocused) }} style={({ pressed }) => [styles.tab, hovered && !isFocused && styles.tabHovered, pressed && { opacity: 0.85 }]}>
    <Animated.View style={[styles.iconBox, motion.animatedStyle]}><Icon size={24} strokeWidth={isFocused ? 2 : 1.7} color={isFocused ? theme.primary : theme.muted} fill={isFocused && Icon === House ? theme.primary : 'none'} /></Animated.View>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9} maxFontSizeMultiplier={1.2} style={[styles.label, isFocused && styles.labelSelected]}>{children}</Text>
  </Pressable>;
}
function FixedList(props: TabListProps) {
  const insets = useSafeAreaInsets();
  const { launching } = useMotionPreferences();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return <View {...props} accessibilityElementsHidden={launching} importantForAccessibility={launching ? 'no-hide-descendants' : 'auto'} style={[styles.footer, { bottom: Math.max(insets.bottom, 16) }, keyboardVisible && { display: 'none' }]}><View style={styles.menu}>{props.children}</View></View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  slot: { flex: 1 }, footer: { position: 'absolute', left: 0, right: 0, zIndex: 100, alignItems: 'center', paddingHorizontal: 14 },
  menu: { width: '100%', maxWidth: 520, minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 3, borderRadius: 24, backgroundColor: '#0F131D' },
  tab: { flex: 1, minWidth: 0, minHeight: 62, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: theme.radius },
  tabHovered: { backgroundColor: '#1A2030' },
  iconBox: { width: 34, height: 34, borderRadius: theme.radius, alignItems: 'center', justifyContent: 'center' },
  label: { color: theme.muted, fontSize: 11, lineHeight: 16, fontWeight: '500' }, labelSelected: { color: theme.text },
});
