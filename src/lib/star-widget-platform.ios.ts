/**
 * iOS : envoie au widget une frise de 12 h (une entrée toutes les 30 min) pour que l'énergie
 * et la visibilité restent justes sans ouvrir l'app.
 * Chargé à la demande : dans Expo Go, le module natif n'existe pas et le widget est simplement ignoré.
 */
import { buildWidgetTimeline, type StarWidgetInput, type StarWidgetProps } from '@/features/star-widget-data';

type WidgetModule = typeof import('@/widgets/ios-star-widget');
let widget: WidgetModule['starWidget'] | null | undefined;

function load() {
  if (widget !== undefined) return widget;
  try {
    widget = (require('@/widgets/ios-star-widget') as WidgetModule).starWidget;
  } catch {
    widget = null;
  }
  return widget;
}

const EMPTY: StarWidgetProps = {
  name: 'Astralys', colorHex: '#FFD9A0', energyPerHour: 'Claim a star', energy: '—',
  visibility: 'Open Astralys', visibilityDetail: 'Your star will appear here', visibleNow: false,
  lightYear: '—', lightDetail: '', planets: '',
};

export function pushStarWidget(input: StarWidgetInput | null) {
  const target = load();
  if (!target) return;
  try {
    if (input) target.updateTimeline(buildWidgetTimeline(input));
    else target.updateSnapshot(EMPTY);
  } catch {
    // Widget absent de cette version de l'app (build sans l'extension) : on ignore.
  }
}
