/**
 * Mises à jour du widget Android en arrière-plan (ajout, toutes les 30 min, redimensionnement),
 * sans ouvrir l'app : relit la dernière fiche enregistrée par l'app et recalcule
 * l'énergie et la visibilité pour l'heure actuelle.
 */
import '@/lib/native-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { buildWidgetProps, WIDGET_NAME, WIDGET_STORAGE_KEY, type StarWidgetInput } from '@/features/star-widget-data';
import { AndroidStarWidget } from '@/widgets/android-star-widget';

export function readWidgetInput(): StarWidgetInput | null {
  try {
    const raw = JSON.parse(localStorage.getItem(WIDGET_STORAGE_KEY) ?? 'null') as StarWidgetInput | null;
    return raw && typeof raw.name === 'string' ? raw : null;
  } catch {
    return null;
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetInfo.widgetName !== WIDGET_NAME) return;
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const input = readWidgetInput();
      props.renderWidget(<AndroidStarWidget props={input ? buildWidgetProps(input, new Date()) : null} />);
      break;
    }
    default:
      break;
  }
}
