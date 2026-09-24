import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { buildGameHtml } from '@/features/orbital/game-html';
import { LEVELS, PALETTE } from '@/features/orbital/levels';
import type { OrbitalEvent, OrbitalHookHandle, OrbitalHookProps } from '@/features/orbital/orbital-types';

const OrbitalHook = forwardRef<OrbitalHookHandle, OrbitalHookProps>(function OrbitalHook(
  { levels = LEVELS, palette, showHud = true, onEvent, onComplete, onMission, style },
  ref,
) {
  const frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => buildGameHtml(levels, palette ?? {}, showHud), [levels, palette, showHud]);
  const command = useCallback((name: string, index?: number) => {
    frame.current?.contentWindow?.postMessage({ __orbitalCommand: name, index }, '*');
  }, []);

  useImperativeHandle(ref, () => ({
    reset: () => command('reset'),
    goTo: index => command('goTo', Number(index) | 0),
    pause: () => command('pause'),
    resume: () => command('resume'),
    requestState: () => command('state'),
  }), [command]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || !event.data?.__orbital) return;
      const payload = event.data.payload as OrbitalEvent;
      if (payload.type === 'ready') return;
      onEvent?.(payload);
      if (payload.type === 'mission') onMission?.(payload.mission, payload.supply);
      if (payload.type === 'complete') onComplete?.(payload.supply);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onEvent, onMission, onComplete]);

  return <View style={[styles.root, style]}>
    <iframe ref={frame} title="Orbital Hook" srcDoc={html} sandbox="allow-scripts" onLoad={() => onEvent?.({ type: 'ready', missions: levels.length })} style={{ width: '100%', height: '100%', border: 0, backgroundColor: PALETTE.void }} />
  </View>;
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PALETTE.void },
});

export default OrbitalHook;
export { LEVELS, PALETTE };
export type { OrbitalEvent, OrbitalHookHandle, OrbitalHookProps } from '@/features/orbital/orbital-types';
