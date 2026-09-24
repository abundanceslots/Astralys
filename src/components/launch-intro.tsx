import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useMotionPreferences } from '@/context/motion-context';
import { Observatory as theme } from '@/constants/observatory-theme';

/**
 * Écran de lancement « allumage d'étoile » (L1) : vidéo de 3,5 s lue à 0,85× (assets/videos/launch-star.mp4),
 * puis les lettres ASTRALYS apparaissent une à une sous l'étoile, et fondu vers l'app.
 * Le mot est dessiné par l'app (net sur tous les écrans). Sans vidéo (erreur) ou avec « réduire
 * les animations », le lancement ne bloque jamais : des minuteurs de secours ferment l'écran.
 */
const LAUNCH_VIDEO = require('../../assets/videos/launch-star.mp4');
/** Même noir que le fond de la vidéo : aucun bord visible autour. */
const VIDEO_BACKGROUND = '#050610';
const LETTERS = 'ASTRALYS'.split('');
const WORD_START = 1800; // ms : quand l'étoile est allumée (vidéo ralentie)
const LETTER_STEP = 110;
const FADE_AT = 4600; // ms : début du fondu vers l'app (≈ 5,3 s au total)
const FADE_DURATION = 700;
/** La vidéo (3,5 s) est lue un peu plus lentement pour un allumage plus majestueux (≈ 4,1 s). */
const PLAYBACK_RATE = 0.85;

function Letter({ char, index, show }: { char: string; index: number; show: ReturnType<typeof useSharedValue<number>> }) {
  const style = useAnimatedStyle(() => {
    const k = Math.max(0, Math.min(1, (show.value - index * LETTER_STEP) / 520));
    return { opacity: k, transform: [{ translateY: 6 * (1 - k) }] };
  });
  return <Animated.Text style={[styles.letter, style]}>{char}</Animated.Text>;
}

export function LaunchIntro() {
  const { reducedMotion, foreground, finishLaunch, revealLaunchContent } = useMotionPreferences();
  const opacity = useSharedValue(1);
  const word = useSharedValue(0);
  const player = useVideoPlayer(LAUNCH_VIDEO, p => {
    p.muted = true;
    p.loop = false;
    p.playbackRate = PLAYBACK_RATE;
  });

  useEffect(() => {
    if (reducedMotion || !foreground) { finishLaunch(); return; }
    player.play();
    // Lettres : chacune apparaît 110 ms après la précédente, dès que l'étoile est allumée.
    word.value = withDelay(WORD_START, withTiming(LETTERS.length * LETTER_STEP + 520, { duration: LETTERS.length * LETTER_STEP + 520, easing: Easing.linear, reduceMotion: ReduceMotion.System }));
    opacity.value = withDelay(FADE_AT, withTiming(0, { duration: FADE_DURATION, reduceMotion: ReduceMotion.System }, finished => {
      if (finished) runOnJS(finishLaunch)();
    }), ReduceMotion.System);
    // Les écrans commencent à apparaître sous le fondu ; le lancement ne dépend jamais du réseau ni de la vidéo.
    const reveal = setTimeout(revealLaunchContent, FADE_AT);
    const fallback = setTimeout(finishLaunch, FADE_AT + FADE_DURATION + 700);
    return () => { clearTimeout(reveal); clearTimeout(fallback); cancelAnimation(opacity); cancelAnimation(word); };
  }, [reducedMotion, foreground, finishLaunch, revealLaunchContent, opacity, word, player]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View accessibilityViewIsModal style={[styles.overlay, overlayStyle]}>
    <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} pointerEvents="none" />
    <View pointerEvents="none" style={styles.wordRow} accessible accessibilityRole="header" accessibilityLabel="Astralys">
      {LETTERS.map((char, index) => <Letter key={index} char={char} index={index} show={word} />)}
    </View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, backgroundColor: VIDEO_BACKGROUND, justifyContent: 'center', alignItems: 'center' },
  // L'étoile est à 44 % de la hauteur dans la vidéo : le nom se place juste en dessous.
  wordRow: { position: 'absolute', top: '58%', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' },
  letter: { color: theme.text, fontSize: 22, fontWeight: 'normal', letterSpacing: 7, fontFamily: 'Sora_600SemiBold' },
});
