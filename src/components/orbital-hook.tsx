import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { buildGameHtml } from '@/features/orbital/game-html';
import { LEVELS, PALETTE, type Level, type Palette } from '@/features/orbital/levels';
import type { OrbitalEvent, OrbitalHookHandle, OrbitalHookProps } from '@/features/orbital/orbital-types';

// Types partagés avec la version native (`orbital-hook.native.tsx`) et web.
// Ce fichier reste le repli WebView ; iOS et Android utilisent désormais la version native.
export type { OrbitalEvent, OrbitalHookHandle, OrbitalHookProps } from '@/features/orbital/orbital-types';

/* ------------------------------------------------------------------ */

const OrbitalHook = forwardRef<OrbitalHookHandle, OrbitalHookProps>(function OrbitalHook(
  { levels = LEVELS, palette, showHud = true, onEvent, onComplete, onMission, style },
  ref,
) {
  const webRef = useRef<WebView>(null);

  // L'URI source est mémoïsée : si elle change d'identité à chaque rendu,
  // la WebView se recharge et la partie repart de zéro.
  const source = useMemo(
    () => ({ html: buildGameHtml(levels, palette ?? {}, showHud) }),
    [levels, palette, showHud],
  );

  const run = useCallback((expression: string) => {
    webRef.current?.injectJavaScript(`${expression}; true;`);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      reset: () => run('window.__orbital && window.__orbital.reset()'),
      goTo: (i: number) => run(`window.__orbital && window.__orbital.goTo(${Number(i) | 0})`),
      pause: () => run('window.__orbital && window.__orbital.pause()'),
      resume: () => run('window.__orbital && window.__orbital.resume()'),
      requestState: () => run('window.__orbital && window.__orbital.state()'),
    }),
    [run],
  );

  const handleMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let event: OrbitalEvent;
      try {
        event = JSON.parse(e.nativeEvent.data) as OrbitalEvent;
      } catch {
        return;
      }
      onEvent?.(event);
      if (event.type === 'mission') onMission?.(event.mission, event.supply);
      if (event.type === 'complete') onComplete?.(event.supply);
    },
    [onEvent, onMission, onComplete],
  );

  return (
    <View style={[styles.root, style]}>
      <WebView
        ref={webRef}
        source={source}
        originWhitelist={['*']}
        onMessage={handleMessage}
        style={styles.web}
        containerStyle={styles.web}
        // Le jeu occupe tout le cadre : aucun défilement, aucun rebond.
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        // Perf canvas : couche matérielle sur Android, pas de nouvelles fenêtres.
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
        javaScriptEnabled
        // Pas de réseau : tout est dans la chaîne HTML.
        cacheEnabled={false}
        incognito
        allowsBackForwardNavigationGestures={false}
        textZoom={Platform.OS === 'android' ? 100 : undefined}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PALETTE.void },
  web: { flex: 1, backgroundColor: PALETTE.void },
});

export default OrbitalHook;
export { LEVELS, PALETTE };
export type { Level, Palette };
