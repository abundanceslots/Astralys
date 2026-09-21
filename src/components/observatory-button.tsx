import { forwardRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressMotion } from '@/hooks/use-press-motion';
import { Text } from '@/components/astralys-text';
import type { LucideIcon } from 'lucide-react-native';
import { Observatory as theme } from '@/constants/observatory-theme';

type Variant = 'primary' | 'secondary' | 'quiet';
const oldPrimaryColors = ['#E7DFFF', '#DDF2F8', '#F3DDD6', theme.primary];
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// Normalize legacy short action controls without turning catalogue rows into pills.
export const ObservatoryPressable = forwardRef<View, PressableProps & { variant?: Variant }>(
  function ObservatoryPressable({ style, variant, disabled, onFocus, onBlur, onPressIn, onPressOut, onHoverIn, onHoverOut, ...props }, ref) {
    const [focused, setFocused] = useState(false);
    const [pressed, setPressed] = useState(false);
    const [hovered, setHovered] = useState(false);
    const baseline = StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false, hovered: false }) : style) ?? {};
    const overlay = baseline.position === 'absolute' && baseline.top === 0 && baseline.bottom === 0;
    const animate = !disabled && !overlay && !baseline.transform && (Boolean(variant) || props.accessibilityRole === 'button');
    const motion = usePressMotion(animate, typeof baseline.minHeight === 'number' && baseline.minHeight > 72 ? 0.992 : 0.975);
    return <AnimatedPressable {...props} ref={ref} disabled={disabled}
      onPressIn={event => { setPressed(true); motion.pressIn(); onPressIn?.(event); }}
      onPressOut={event => { setPressed(false); motion.pressOut(); onPressOut?.(event); }}
      onHoverIn={event => { setHovered(true); onHoverIn?.(event); }}
      onHoverOut={event => { setHovered(false); onHoverOut?.(event); }}
      accessibilityState={{ ...props.accessibilityState, disabled: Boolean(disabled) }}
      onFocus={event => { setFocused(true); onFocus?.(event); }}
      onBlur={event => { setFocused(false); onBlur?.(event); }}
      style={(() => {
        const state = { pressed: pressed && !disabled, hovered };
        const original = typeof style === 'function' ? style(state) : style;
        const flat = StyleSheet.flatten(original) ?? {};
        const height = typeof flat.height === 'number' ? flat.height : flat.minHeight;
        const isRow = typeof height === 'number' && height > 72;
        const isOverlay = flat.position === 'absolute' && flat.top === 0 && flat.bottom === 0;
        const isAction = !isRow && !isOverlay && (variant || props.accessibilityRole === 'button');
        const resolved = variant ?? (oldPrimaryColors.includes(String(flat.backgroundColor)) ? 'primary' : flat.backgroundColor ? 'secondary' : 'quiet');
        return [original, isRow && { borderRadius: theme.radius, backgroundColor: state.pressed ? '#1B2031' : theme.surface },
          isAction && { minHeight: 48, ...(typeof flat.height === 'number' ? { height: Math.max(48, flat.height) } : {}),
            ...(typeof flat.width === 'number' && flat.width <= 48 ? { minWidth: 48 } : {}),
            borderRadius: theme.buttonRadius,
            ...(resolved === 'primary' ? { backgroundColor: state.pressed ? theme.pressed : theme.primary, borderWidth: 0 } :
              resolved === 'secondary' ? { backgroundColor: state.pressed ? theme.selected : theme.background, borderWidth: 2, borderColor: theme.primary } : {}),
            ...(disabled ? { backgroundColor: theme.disabled, opacity: 0.65 } : {}),
            ...(focused && Platform.OS === 'web' ? { outlineColor: theme.focus, outlineWidth: 2, outlineOffset: 3 } : {}),
          }, animate && motion.animatedStyle];
      })()} />;
  });
type ButtonProps = Omit<PressableProps, 'children'> & { label: string; icon?: LucideIcon; variant?: Variant; loading?: boolean };
export const ObservatoryButton = forwardRef<View, ButtonProps>(function ObservatoryButton(
  { label, icon: Icon, variant = 'primary', loading, disabled, style, ...props }, ref) {
  const color = disabled ? theme.muted : variant === 'primary' ? theme.onPrimary : theme.primary;
  return <ObservatoryPressable {...props} ref={ref} variant={variant} disabled={disabled || loading}
    accessibilityRole="button" accessibilityLabel={props.accessibilityLabel ?? label}
    accessibilityState={{ ...props.accessibilityState, busy: Boolean(loading) }}
    style={state => [styles.button, typeof style === 'function' ? style(state) : style]}>
    {loading ? <ActivityIndicator color={color} /> : Icon ? <Icon color={color} size={22} strokeWidth={2} /> : null}
    <Text style={[styles.label, { color }]}>{loading ? 'Loading…' : label}</Text>
  </ObservatoryPressable>;
});
const styles = StyleSheet.create({
  button: { minHeight: theme.buttonHeight, paddingVertical: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  label: { fontSize: 16, lineHeight: 22, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
});
