import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { LEGAL_URLS, SUPPORT_EMAIL } from '@/constants/legal';

export function openLegal(page: keyof typeof LEGAL_URLS) {
  void WebBrowser.openBrowserAsync(LEGAL_URLS[page]).catch(() => { void Linking.openURL(LEGAL_URLS[page]); });
}

export function contactSupport(subject = 'Astralys support') {
  void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`).catch(() => {});
}
