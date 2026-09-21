export const Observatory = {
  background: '#070911', surface: '#111827', primary: '#C8BAF5', pressed: '#B4A2EA',
  onPrimary: '#171321', text: '#F4F1FF', muted: '#A7B0C5', border: '#2A3448',
  interactiveBorder: '#7E89A3', focus: '#BCE5FF', selected: '#272139', sky: '#99D8E8',
  disabled: '#252D3E', radius: 12, buttonRadius: 26, buttonHeight: 52,
} as const;
export const navigationClearance = (bottom: number) => 76 + Math.max(bottom, 16) + 12;
