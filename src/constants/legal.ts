/**
 * Liens légaux exigés par Google Play et l'App Store.
 * Les pages sont dans docs/legal/ : publie-les sur un site (ou change LEGAL_BASE_URL),
 * puis colle les mêmes adresses dans la Play Console et App Store Connect.
 */
export const LEGAL_BASE_URL = 'https://abundanceslots.com/astralys';

export const LEGAL_URLS = {
  privacy: `${LEGAL_BASE_URL}/privacy`,
  terms: `${LEGAL_BASE_URL}/terms`,
  deleteAccount: `${LEGAL_BASE_URL}/delete-account`,
} as const;

export const SUPPORT_EMAIL = 'contact@abundanceslots.com';
