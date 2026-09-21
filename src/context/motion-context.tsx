import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

const MotionContext = createContext({ reducedMotion: true, foreground: true, launching: false,
  launchRevealing: false, revealLaunchContent: () => {}, finishLaunch: () => {} });

export function MotionProvider({ children }: PropsWithChildren) {
  const initialReducedMotion = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [launching, setLaunching] = useState(true);
  const [launchRevealing, setLaunchRevealing] = useState(false);
  const revealLaunchContent = useCallback(() => setLaunchRevealing(true), []);
  const finishLaunch = useCallback(() => {
    setLaunchRevealing(true);
    setLaunching(false);
  }, []);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReducedMotion(value);
    }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const app = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => { mounted = false; motion.remove(); app.remove(); };
  }, []);
  return <MotionContext.Provider value={{ reducedMotion, foreground, launching, launchRevealing,
    revealLaunchContent, finishLaunch }}>{children}</MotionContext.Provider>;
}

export function useMotionPreferences() { return useContext(MotionContext); }
