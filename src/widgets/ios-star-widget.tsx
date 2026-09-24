/**
 * Widget iOS « Mon étoile » (écran d'accueil, petit et moyen format), avec expo-widgets.
 * La fonction marquée 'widget' est envoyée telle quelle à l'extension iOS : elle ne doit utiliser
 * que ses props et les composants @expo/ui (aucune variable ou fonction définie ailleurs dans ce fichier).
 * Les textes sont préparés par l'app (src/features/star-widget-data.ts).
 */
import { HStack, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { background, clipShape, containerBackground, font, foregroundStyle, frame, lineLimit, minimumScaleFactor, padding, shadow, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { StarWidgetProps } from '@/features/star-widget-data';

const StarWidget = (props: StarWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const small = environment.widgetFamily === 'systemSmall';
  const glowSize = small ? 58 : 76;
  const coreSize = small ? 26 : 34;
  const dim = '#8C93B8';
  const bright = '#F2F3FF';

  const star = (
    <ZStack modifiers={[frame({ width: glowSize, height: glowSize })]}>
      <Text modifiers={[
        frame({ width: glowSize, height: glowSize }),
        background({ type: 'radialGradient', colors: [props.colorHex, '#00000000'], center: { x: 0.5, y: 0.5 }, startRadius: coreSize * 0.3, endRadius: glowSize / 2 }),
        clipShape('circle'),
      ]}> </Text>
      <Text modifiers={[
        frame({ width: coreSize, height: coreSize }),
        background({ type: 'radialGradient', colors: ['#FFFFFF', props.colorHex], center: { x: 0.4, y: 0.4 }, startRadius: 1, endRadius: coreSize * 0.6 }),
        clipShape('circle'),
        shadow({ color: props.colorHex, radius: 10 }),
      ]}> </Text>
    </ZStack>
  );

  const row = (label: string, value: string, detail: string, accent: string) => (
    <VStack alignment="leading" spacing={1}>
      <Text modifiers={[font({ size: 9, weight: 'semibold' }), foregroundStyle(accent)]}>{label}</Text>
      <Text modifiers={[font({ size: 13, weight: 'semibold', design: 'rounded' }), foregroundStyle(bright), lineLimit(1), minimumScaleFactor(0.7)]}>{value}</Text>
      <Text modifiers={[font({ size: 10 }), foregroundStyle(dim), lineLimit(1), minimumScaleFactor(0.7)]}>{detail}</Text>
    </VStack>
  );

  if (small) {
    return (
      <VStack alignment="leading" spacing={4} modifiers={[containerBackground('#070911', 'widget'), widgetURL('astrelys://collection')]}>
        <HStack>
          {star}
          <Spacer />
        </HStack>
        <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(bright), lineLimit(1), minimumScaleFactor(0.6)]}>{props.name}</Text>
        <Text modifiers={[font({ size: 12, weight: 'semibold', design: 'rounded' }), foregroundStyle('#FFD66B'), lineLimit(1)]}>{props.energyPerHour}</Text>
        <Text modifiers={[font({ size: 10 }), foregroundStyle(props.visibleNow ? '#7CF0B6' : dim), lineLimit(1), minimumScaleFactor(0.7)]}>{props.visibility}</Text>
      </VStack>
    );
  }

  return (
    <HStack spacing={14} modifiers={[containerBackground('#070911', 'widget'), widgetURL('astrelys://collection')]}>
      <VStack spacing={6} modifiers={[frame({ width: 92 })]}>
        {star}
        <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(bright), lineLimit(2), minimumScaleFactor(0.6)]}>{props.name}</Text>
        <Text modifiers={[font({ size: 9 }), foregroundStyle(dim), lineLimit(1)]}>{props.planets}</Text>
      </VStack>
      <VStack alignment="leading" spacing={7} modifiers={[padding({ vertical: 2 })]}>
        {row('ENERGY', props.energyPerHour, props.energy + ' stored', '#FFD66B')}
        {row('TONIGHT', props.visibility, props.visibilityDetail, props.visibleNow ? '#7CF0B6' : '#9AA8FF')}
        {row('LIGHT LEFT IN', props.lightYear, props.lightDetail, '#C9A7FF')}
      </VStack>
      <Spacer />
    </HStack>
  );
};

export const starWidget = createWidget<StarWidgetProps>('AstralysStar', StarWidget);
