# Astralys — typography and mobile navigation

Sora is bundled locally in five weights (400, 500, 600, 700 and 800) and loaded before the splash screen is hidden. Shared Text and TextInput components choose the appropriate face from each existing style. Screens, forms, star profiles, comparison, journal and sky finder now use the same family.

## Display adjustments

- Home sizes the hero illustration according to available screen height. The catalogue footer is hidden on compact screens. Very short screens or enlarged text can scroll within the content area while the bottom navigation stays fixed.
- Gift keeps its header fixed and allows its content to scroll when necessary. Its caption is constrained to the scene width.
- Collection, Profile and Explore reserve bottom space based on the device safe area.
- Search and profile fields use larger text, with flexible widths to prevent horizontal overflow.
- Detail and comparison headers use shorter labels and constrained secondary text.

## Navigation

- Five persistent tabs: Home, Explore, Gift, Collection and Profile.
- The active tab has a distinct background, icon and text treatment.
- Tab history makes native Back return to the previously visited tab. Detail and comparison retain their own Back handlers.
- The bottom menu hides while the native keyboard is open. Search dismisses the keyboard on submission and the result list dismisses it while scrolling.
- Icon actions have minimum 48-point touch targets. Full-screen modal backdrops are excluded from ordinary button styling.
- Visitor-facing messages use simple English rather than configuration or database terminology.

## Verification

TypeScript passed after the code changes. Android and iOS bundles were exported successfully to `dist-mobile` (Expo Router entry: 3,984 Android modules and 3,889 iOS modules). Browser inspection stopped when the user requested a mobile-only verification workflow. No physical-phone interaction was performed by the agent.
