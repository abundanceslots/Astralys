export const Observatory = {
  background: '#070911', surface: '#111827', primary: '#C8BAF5', pressed: '#303750',
  buttonPrimary: '#22283B', buttonSecondary: '#151A28', buttonQuietPressed: '#1A2030',
  onPrimary: '#F4F1FF', text: '#F4F1FF', muted: '#A7B0C5', border: '#2A3448',
  interactiveBorder: '#7E89A3', focus: '#BCE5FF', selected: '#272139', sky: '#99D8E8',
  disabled: '#222736', radius: 12, buttonRadius: 12, buttonHeight: 44,
} as const;
export const navigationClearance = (bottom: number) => 72 + bottom;
