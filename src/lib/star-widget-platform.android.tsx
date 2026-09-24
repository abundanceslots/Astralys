/**
 * Android : redessine tout de suite le widget posé sur l'écran d'accueil.
 * Ensuite, le gestionnaire en arrière-plan le met à jour toutes les 30 min.
 * Chargé à la demande : dans Expo Go, le module natif n'existe pas et le widget est simplement ignoré.
 */
import { buildWidgetProps, WIDGET_NAME, type StarWidgetInput } from '@/features/star-widget-data';

export function pushStarWidget(input: StarWidgetInput | null) {
  try {
    const { requestWidgetUpdate } = require('react-native-android-widget') as typeof import('react-native-android-widget');
    const { AndroidStarWidget } = require('@/widgets/android-star-widget') as typeof import('@/widgets/android-star-widget');
    void requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: () => <AndroidStarWidget props={input ? buildWidgetProps(input, new Date()) : null} />,
      widgetNotFound: () => {},
    }).catch(() => {});
  } catch {
    // Module natif absent (Expo Go) : pas de widget.
  }
}
