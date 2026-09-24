// Point d'entrée : l'app (expo-router) puis, sur Android, le gestionnaire du widget « Mon étoile »
// qui le met à jour en arrière-plan. Sans module natif (Expo Go), le widget est simplement ignoré.
import 'expo-router/entry';
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  try {
    const { registerWidgetTaskHandler } = require('react-native-android-widget') as typeof import('react-native-android-widget');
    const { widgetTaskHandler } = require('./src/widgets/android-task-handler') as typeof import('./src/widgets/android-task-handler');
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch {
    // Expo Go : pas de widget.
  }
}
