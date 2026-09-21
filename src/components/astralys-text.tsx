import { forwardRef } from 'react';
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput, type TextProps, type TextInputProps, type StyleProp, type TextStyle } from 'react-native';

function typography(style: StyleProp<TextStyle>): TextStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily) return {};
  const weight = flat.fontWeight === 'bold' ? 700 : Number(flat.fontWeight) || 400;
  const fontFamily = weight >= 800 ? 'Sora_800ExtraBold' : weight >= 700 ? 'Sora_700Bold'
    : weight >= 600 ? 'Sora_600SemiBold' : weight >= 500 ? 'Sora_500Medium' : 'Sora_400Regular';
  // Each bundled face already carries its weight; avoid synthetic bold on native.
  return { fontFamily, fontWeight: 'normal' };
}

export const Text = forwardRef<NativeText, TextProps>(function AstralysText({ style, ...props }, ref) {
  return <NativeText {...props} ref={ref} style={[style, typography(style)]} />;
});
export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function AstralysTextInput({ style, ...props }, ref) {
  return <NativeTextInput {...props} ref={ref} style={[style, typography(style)]} />;
});
