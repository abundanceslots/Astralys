import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

/**
 * Logo « G » officiel de Google. Télécharge-le depuis la page des règles de marque
 * (https://developers.google.com/identity/branding-guidelines), enregistre la
 * version PNG dans assets/images/google-g.png, puis remplace `null` par :
 *   require('../../assets/images/google-g.png')
 */
const GOOGLE_G_LOGO: ImageSourcePropType | null = null;

type Props = {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** 'continue' → « Continue with Google », 'signIn' → « Sign in with Google », 'signUp' → « Sign up with Google ». */
  label?: 'continue' | 'signIn' | 'signUp';
  /** 'dark' pour les fonds sombres d'Astralys, 'light' pour un fond clair. */
  theme?: 'dark' | 'light';
  /** Version plus basse (46 px) pour les formulaires. */
  compact?: boolean;
};

const LABELS = { continue: 'Continue with Google', signIn: 'Sign in with Google', signUp: 'Sign up with Google' } as const;

/* Couleurs imposées par les règles de marque Google (thèmes sombre et clair). */
const THEMES = {
  dark: { fill: '#131314', border: '#8E918F', text: '#E3E3E3', pressed: '#1F1F21' },
  light: { fill: '#FFFFFF', border: '#747775', text: '#1F1F1F', pressed: '#F2F2F2' },
} as const;

export function GoogleSignInButton({ onPress, loading = false, disabled = false, label = 'continue', theme = 'dark', compact = false }: Props) {
  const colors = THEMES[theme];
  const text = LABELS[label];
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={text}
    accessibilityState={{ disabled: disabled || loading, busy: loading }}
    disabled={disabled || loading}
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      compact && styles.compact,
      { backgroundColor: pressed ? colors.pressed : colors.fill, borderColor: colors.border },
      (disabled && !loading) && styles.disabled,
    ]}>
    {loading
      ? <ActivityIndicator color={colors.text} />
      : <View style={styles.row}>
        {GOOGLE_G_LOGO ? <Image source={GOOGLE_G_LOGO} style={styles.logo} accessible={false} /> : null}
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>{text}</Text>
      </View>}
  </Pressable>;
}

const styles = StyleSheet.create({
  // Forme « pilule » autorisée par Google ; hauteur alignée sur les autres boutons d'Astralys.
  button: { minHeight: 54, borderRadius: 27, borderWidth: 1, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  compact: { minHeight: 46, borderRadius: 23 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 20, height: 20 },
  // Google recommande Roboto Medium : c'est la police système sur Android ; ailleurs, police système.
  label: { fontSize: 16, lineHeight: 20, fontWeight: '500', fontFamily: Platform.OS === 'android' ? 'sans-serif-medium' : undefined, letterSpacing: 0.25 },
  disabled: { opacity: 0.38 },
});
