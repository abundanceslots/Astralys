import { forwardRef } from 'react';
import { View, type ViewProps } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRevealMotion } from '@/hooks/use-reveal-motion';

export const MotionSection = forwardRef<View, ViewProps & { delay?: number; replayKey?: string }>(
  function MotionSection({ delay = 0, replayKey, style, ...props }, ref) {
    const motion = useRevealMotion(delay, replayKey);
    return <Animated.View {...props} ref={ref} style={[style, motion]} />;
  });
