# Astralys design QA

Source visual truth: `C:/Users/zeeny/.codex/generated_images/01a09bea-d41c-7ab1-a240-9a681c6f6cf3/exec-858675f5-ecee-439d-a03f-64debc4d736e.png` (combined Soft Observatory composition with Luminous Outline buttons).

Implementation: local Expo web build at port 8087, inspected in Codex Desktop CUA tab 6 at the default desktop viewport. The implementation screenshot was captured inline during verification; no screenshot file was persisted.

State: signed-out guest, dark theme, web, fixed five-tab navigation.

## Evidence and checks

- The Home screen uses the shared Astralys dark palette, a generated artist-impression hero, a filled lavender primary button, a lavender-outline secondary button, and the fixed bottom menu.
- Five navigation tabs were clicked individually. The URL and accessibility state changed correctly for Home, Explore, Gift, Collection and Profile.
- Collection exposes Choose a star and Sign in links without hiding the bottom menu.
- Profile exposes the sign-in form and both Google and Apple buttons while keeping Profile selected.
- Explore exposes the search field, Search and Regions and properties controls while keeping Explore selected.
- Focus cleanup was added to Explore and Collection so detail/comparison overlays are cleared when switching tabs.
- The web bundle initially failed because the Expo SQLite WASM worker was included in the web graph. A platform-specific storage shim now keeps Expo SQLite native-only and lets the browser use its native localStorage.
- Browser console: no runtime errors. Existing deprecation warnings remain for legacy `shadow*`, `textShadow*` and `pointerEvents` style props.

## Required fidelity surfaces

- Fonts and typography: readable hierarchy, English labels, 12px navigation labels, 14px body text and 16px action labels.
- Spacing and layout rhythm: 48px minimum controls, 52px action buttons, 76px menu container, safe-area-aware bottom clearance.
- Colors and tokens: dark #070911 background, surface #111827, lavender #C8BAF5, text #F4F1FF, muted #A7B0C5, focus #BCE5FF.
- Image quality and asset fidelity: `assets/images/observatory-hero.png` is an artist impression with no UI text; Lucide icons are used for navigation and actions instead of text glyphs.
- Copy and content: Home, Explore, Gift, Collection and Profile labels remain unchanged; Gift stays explicitly Coming soon.

## Remaining test gap

The Supabase catalogue returned zero objects in this guest web session, so opening a real star detail and comparison could not be exercised from the live list. The code path still retains Back, Home, comparison restore and Android BackHandler handlers; it should be retested with catalogue rows available.

final result: passed

## 2026-09-18 — First System image menu

This section supersedes the historical five-tab/Gift description above for the current System menu; the earlier evidence is retained as history.

Selected reference: `C:/Users/zeeny/.codex/generated_images/01a09bea-d41c-7ab1-a240-9a681c6f6cf3/exec-be4afc36-c49f-4572-a766-5cc32d63760d.png`.

Implementation scope: native TRAPPIST-1 guardian demo, Home → Try guardian demo. Initial state: selected c, probes connected to b/c, relay level 2. Shared bottom navigation has four existing routes, with updated search/book icons. No deployment or database changes.

- Typography: existing Sora, centered ASTRALYS wordmark and left-aligned page heading; enlarged-text/narrow-width panel stacks vertically.
- Layout: retained interactive GL scene; a compact contextual panel sits outside the scene above safe-area-aware navigation. Optional controls use a modal sheet without resizing the camera viewport. Touch controls remain at least 48 pixels.
- Colors: existing navy/lavender tokens, green connected status and muted disconnected status; no new active-tab outlines.
- Assets: reused approved AstralysMark and real interactive scene, not a flattened mockup image. No new speculative scientific appearance claims.
- Copy: My system, Probe connected / Probe not connected, Satellite relay, short simulation caption. Exploration and reset remain available in Planet controls.

Code checks: TypeScript and guardian model, scene and shared material checks passed. Android and iOS exports completed successfully. These are not screenshots or native device interaction tests.

Product Design visual comparison is pending a phone screenshot. Per the user's explicit instruction, no browser QA was performed. Native layout, GPU rendering, touch behavior, modal dismissal and enlarged-text appearance still need Expo Go verification. Reference-versus-implementation fidelity is not claimed as passed.

Current visual QA final result: blocked — awaiting native screenshot; code implementation applied.

## 2026-09-18 — Third relay concept, simpler interactive satellite

Source visual truth: `docs/designs/relay-upgrade-simple-v1.png`, generated revision of the third displayed relay concept `exec-07828d25-1414-4447-83a7-a641f1d40c23.png`. User changes: less mechanical detail and real interactive 3D.

Implementation screenshot: unavailable. Target viewport: 390 × 844 logical native pixels, safe areas supplied by the device. The generated reference is an 853 × 1844-pixel illustration; no implementation density normalization or combined visual comparison is possible without a native capture. The CPU geometry previews are renderer diagnostics, not native screenshots and not suitable for passing fidelity QA.

State for future comparison: Home → Try guardian demo → Satellite relay; collect initial120 through the balance/storage sheet, close it, then compare selected relay level2 and balance200. Initial balance80 intentionally differs from the reference until collection. Also check level3/4, disabled upgrade, energy modal and full-screen viewer.

Implementation changes, not visually verified findings:

- Fonts/typography: retained Sora; short English labels; readable production before/after. Narrow/enlarged-text heading stacks the balance below the title.
- Spacing/layout rhythm: one next-upgrade section, fixed main bottom navigation, adaptive hero height, scroll fallback. Full-screen viewer and storage sheet have explicit Close / Android Back handling. Controls have 48-pixel minimum touch sizes.
- Colors/tokens: existing navy/lavender/off-white theme; muted disabled actions; green connected marker; no active-tab contours or dense decorative rings.
- Image quality/assets: approved logo reused. A simplified real 3D satellite replaces the detailed illustrative bitmap subject as explicitly requested. Runtime meshes use a silver core, gold face and broad-cell solar wings. Drag orbits and tilts, pinch zooms; explicit controls and accessibility actions supplement gestures. Rendering is on demand and pauses under overlays.
- Copy/content: one NEXT UPGRADE with name, production effect, storage effect and price; completion replaces the section at max level. Energy/storage controls remain functional in a dismissible sheet. No real-money or science-data changes.

Technical checks: TypeScript, demo reducer/upgrade offer, scene projection/orbit/pitch/zoom bounds, simplified renderer commands, geometry changes on upgrade, resource disposal, shared material tests and Android/iOS exports passed. These checks do not certify native gestures, shader compilation, performance or pixel fidelity.

Full-view comparison evidence: blocked — no native implementation capture. Focused logo/type/satellite/control comparisons: blocked for the same reason. No visual findings or post-fix comparison passes are asserted from source code alone. No browser was opened, respecting the user's mobile-only QA instruction.

Implementation checklist for device validation: rotate/tilt/pinch in preview and full-screen mode; close both modals via Close, backdrop where present and Android Back; collect/upgrade to levels3/4; use Back to my system and all four tabs; check compact/enlarged-text layout; provide a screenshot in the matching balance200/level2 state for Product Design's visual comparison.

final result: blocked

## 2026-09-19 — Detailed relay model revision

Source visual truth: the selected third concept `C:/Users/zeeny/.codex/generated_images/01a09bea-d41c-7ab1-a240-9a681c6f6cf3/exec-07828d25-1414-4447-83a7-a641f1d40c23.png`, with the cleaner composition in `docs/designs/relay-upgrade-simple-v1.png`. User revision: make the interactive satellite more detailed like the reference photo while retaining the existing relay screen and controls.

Implementation screenshot: unavailable. A CPU geometry diagnostic was generated at `output/guardian-3d-preview/relay-level-2.png`; it confirms the richer silhouette and valid transforms but is not native GPU evidence and cannot pass visual fidelity QA.

Implementation changes, pending native visual verification:

- Satellite structure: raised bus rails, top equipment, gold insulation face and hardware accents, lower circular module and visible attachment points.
- Solar hardware: two-piece articulated booms, rotary hinges, strong panel frames, four broad vertical cell groups and a restrained horizontal division.
- Communications hardware: angled antenna support, high-gain dish, feed support, feed horn and a separate sensor mast.
- Upgrade continuity: level 3 still expands the arrays; level 4 still adds secondary communications hardware.
- Performance strategy: full detail is reserved for relay inspection; small satellites in the system view use a lighter geometry level. Rendering remains on demand.

Automated evidence: TypeScript passed; every uploaded mesh has finite vertices and normalized normals; oriented part transforms remain finite; the level-2 model stays inside a bounded 40–70 draw-call budget; gold hardware and segmented photovoltaic geometry are present in renderer commands; orbit, tilt, zoom, no-auto-spin, upgrade geometry and resource cleanup remain covered.

Product Design comparison remains blocked because no Expo Go screenshot has been supplied. Per the user's mobile-only instruction, no browser comparison was performed. A device check should compare the default three-quarter view, back and side rotations, full-screen zoom, level-3 arrays and level-4 antenna against the two references.

final result: blocked
