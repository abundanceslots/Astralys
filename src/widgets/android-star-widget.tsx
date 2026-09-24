/**
 * Widget Android « Mon étoile » (react-native-android-widget).
 * Rendu par l'app (mise à jour immédiate) et par le gestionnaire en arrière-plan
 * (src/widgets/android-task-handler.tsx), toutes les 30 min, même app fermée.
 */
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { StarWidgetProps } from '@/features/star-widget-data';

type Hex = `#${string}`;
const BG: Hex = '#070911';
const DIM: Hex = '#8C93B8';
const BRIGHT: Hex = '#F2F3FF';

function starSvg(color: string, size: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.85"/>
      <stop offset="45%" stop-color="${color}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="core" cx="42%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="55%" stop-color="${color}"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.9"/>
    </radialGradient>
  </defs>
  <circle cx="50" cy="50" r="50" fill="url(#glow)"/>
  <circle cx="50" cy="50" r="22" fill="url(#core)"/>
</svg>`;
}

function Row({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: Hex }) {
  return (
    <FlexWidget style={{ flexDirection: 'column', marginBottom: 6 }}>
      <TextWidget text={label} style={{ fontSize: 9, color: accent, fontWeight: '600' }} />
      <TextWidget text={value} maxLines={1} truncate="END" style={{ fontSize: 14, color: BRIGHT, fontWeight: '600' }} />
      <TextWidget text={detail} maxLines={1} truncate="END" style={{ fontSize: 10, color: DIM }} />
    </FlexWidget>
  );
}

export function AndroidStarWidget({ props }: { props: StarWidgetProps | null }) {
  if (!props) {
    return (
      <FlexWidget clickAction="OPEN_APP" style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG, borderRadius: 22, padding: 16, justifyContent: 'center', alignItems: 'center' }}>
        <TextWidget text="Astralys" style={{ fontSize: 15, color: BRIGHT, fontWeight: '700' }} />
        <TextWidget text="Claim a star to see it here" style={{ fontSize: 11, color: DIM, marginTop: 4 }} />
      </FlexWidget>
    );
  }
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'astrelys://collection' }}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}
    >
      <FlexWidget style={{ width: 96, flexDirection: 'column', alignItems: 'center', marginRight: 12 }}>
        <SvgWidget svg={starSvg(props.colorHex, 76)} style={{ width: 76, height: 76 }} />
        <TextWidget text={props.name} maxLines={2} truncate="END" style={{ fontSize: 13, color: BRIGHT, fontWeight: '700', textAlign: 'center' }} />
        <TextWidget text={props.planets} maxLines={1} style={{ fontSize: 9, color: DIM, marginTop: 2 }} />
      </FlexWidget>
      <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
        <Row label="ENERGY" value={props.energyPerHour} detail={`${props.energy} stored`} accent="#FFD66B" />
        <Row label="TONIGHT" value={props.visibility} detail={props.visibilityDetail} accent={props.visibleNow ? '#7CF0B6' : '#9AA8FF'} />
        <Row label="LIGHT LEFT IN" value={props.lightYear} detail={props.lightDetail} accent="#C9A7FF" />
      </FlexWidget>
    </FlexWidget>
  );
}
