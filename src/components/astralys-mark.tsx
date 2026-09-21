import Svg, { Circle, Path } from 'react-native-svg';
import { Observatory as theme } from '@/constants/observatory-theme';

export function AstralysMark({ size = 108 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 128 128" accessible={false}>
    <Path d="M21 83C6 68 37 37 67 25C97 13 120 19 106 43C93 66 48 96 21 83Z"
      fill="none" stroke={theme.primary} strokeWidth={1.5} opacity={0.5} />
    <Path d="M64 34C68 54 72 60 92 64C72 68 68 74 64 94C60 74 56 68 36 64C56 60 60 54 64 34Z"
      fill={theme.primary} />
    <Circle cx={106} cy={26} r={3} fill={theme.primary} />
  </Svg>;
}
