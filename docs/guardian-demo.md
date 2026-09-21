# Guardian demonstration

Open **Home → Try guardian demo**. No account, purchase or database migration is needed. The four bottom navigation buttons remain available. Use the upper-left arrow (or Android Back) to leave. Tap the planet's name or the panel handle to open **Planet controls → Reset demo** and replay the initial scenario.

## What is real?

TRAPPIST-1 and its seven known planets, b through h, are real. Source: [NASA — TRAPPIST-1](https://science.nasa.gov/exoplanets/trappist1/). The 3D scene is illustrative, not to scale; colors and orbital positions do not represent measured appearances or current sky positions. Exploration refers to the guardian's fictional progression, not a new scientific discovery.

Guardianship, relay, probes, observation records and energy production are fictional gameplay. No real ownership is implied. The screen labels the experience as a demo.

## Replayable scenario

- Start with 80 energy, 120 energy stored, a level-2 relay and probes connected to b and c.
- Open **Satellite relay**, tap the energy balance in the upper-right, then press **Collect · 120** in **Energy & storage**: the balance becomes 200 and storage becomes zero. Close the sheet.
- Press **Solar arrays → Upgrade · 90**: the relay becomes level 3, its solar arrays expand, the balance becomes 110 and production increases from 20 to 30 energy per simulated hour. The same section now presents the next upgrade, **Deep-space antenna**.
- Return to **My system**, tap the planet's name to open **Planet controls**, then use the right arrow to select D: exploration costs **600** and is initially disabled. The controls display the missing energy. Close the controls to see the camera approach the selected planet.
- In **Satellite relay → energy balance → Energy & storage**, press **+6 demo hours** then collect, three times: at level 3 each cycle adds 180 energy, bringing the balance from 110 to 650. Close the sheet, return to **My system**, then open Planet controls; sending the probe costs 600, leaves 50, and adds 10 observation records. Planet e becomes the next explorable frontier.

Energy is the only spendable resource. Observation records are a progress indicator, not a second currency. The demonstration deliberately has no purchases, real timers, combat or competitive ownership.

## Rules and isolation

Production = relay level × 10 energy/hour. Storage capacity = relay level × 120. Upgrade 2→3 costs 90; upgrade 3→4 costs 160; level 4 is the maximum. Exploration prices are now progressive:

| Planet | Energy cost |
| --- | ---: |
| b, c | Already explored in the starter scenario |
| d | 600 |
| e | 1,200 |
| f | 2,400 |
| g | 4,800 |
| h | 9,600 |

These are fictional energy costs, not real-money prices or a new credits currency. They are provisional demo balancing values, configured centrally in `explorationCosts`. At the maximum production of 40/hour, the five new connections represent 15, 30, 60, 120 and 240 simulated hours of production respectively, ignoring existing balance and upgrade spending. The demo does not run production while closed, and +6h still skips simulated time without waiting. Real economy and monetization remain outside this change.

Explore sequentially, b→c→d→e→f→g→h. The scene shows explored planets plus the next frontier, which appears dark until a probe connects. Later planets do not appear until their predecessor is explored. Buttons show each planet's price, missing energy and affordability; the reducer independently enforces the same per-planet price, repeated collection taps and attempts to skip planets.

The demo only uses component state. It neither reads nor writes Supabase, authentication, real guardian systems or persistent local storage. Ordinary app providers remain unchanged. State survives switching bottom tabs while Home stays mounted, but exiting the demo or reloading discards it. Reset restores the entire initial scenario. No permanent user account is created.

## Native 3D navigation

The scene uses Expo GL, actual sphere and satellite meshes, perspective projection, lighting, depth testing and a camera tilted 20 degrees from overhead. Drag to pan, pinch to zoom, tap an available planet to focus on it. Dragging moves the scene in the direction of the finger on both axes, including diagonal motions. Ground-plane ray projection keeps the grabbed point under the finger rather than estimating movement independently on each axis. Pinch zoom shares this anchor; direct gestures bypass camera easing, which remains enabled for button-driven camera flights. The floating arrow navigator offers the same selection access without gestures; +/− zoom and the overview button provide accessible camera controls. Camera limits avoid infinite zoom/panning. Planet selection uses the same perspective matrix as rendering, not arbitrary screen coordinates.

The selected first System mockup is now the menu reference: the approved Astralys logo and wordmark at the top, left-aligned TRAPPIST-1 / My system heading, and a compact dark contextual panel above the four-tab navigation. The panel shows the selected planet, a green **Probe connected** status only for connected planets, and a lavender **Satellite relay →** button. The frontier instead shows **Probe not connected** in muted gray. The sidebar provides separate + / − / overview controls without colored selection outlines. An **Illustrative view · Simulation** caption distinguishes the scene from scientific imagery.

Tap the panel handle or planet identity to open the dismissible **Planet controls** sheet: energy, progress, horizontal planet selector, previous/next arrows, missing energy, **Send probe**, and **Reset demo**. Opening the sheet does not resize the scene or reset the camera. Touching any part of a visible planet still approaches it; its sphere fits approximately 42% of the shorter scene dimension. On narrow screens or with enlarged text, the main panel's identity and relay button stack vertically. The system page itself does not scroll; the controls sheet and relay interface may scroll. The bottom menu retains Home, Explore, Collection and Profile, with house/search/book/profile icons and no colored active-tab outline.

The relay now follows the selected third mockup and its more detailed photographic reference: a satin-silver structural bus, raised corner rails, gold insulation panel and collars, articulated side booms, framed and segmented indigo photovoltaic wings, lower circular module, equipment housings, upper sensor mast, angled high-gain dish and feed horn. The level-3 wing extension and level-4 secondary antenna remain visible upgrades. This is real Expo GL geometry, not a rotating bitmap. Drag inside the preview to orbit horizontally and tilt above/below the satellite; pinch to zoom. +/−, reset-view and expand buttons offer explicit controls. **Expand** opens a full-screen interactive viewer; Close or Android Back returns to the relay menu. Screen-reader custom actions provide rotation, tilt, zoom and reset. Pitch is limited away from the poles and zoom has bounds. The inspection view stays centered on the satellite and does not auto-spin.

One **NEXT UPGRADE** section shows the next available improvement, its production before/after, cost and storage effect. Initially **Upgrade · 90** is disabled until energy is collected; a short hint says **Collect energy first**. At level 3 the section changes to **Deep-space antenna · 160**; at level 4 it shows completion instead of a phantom upgrade. Existing costs, effects and reducer safeguards are unchanged. Level 3 expands the solar wings; level 4 adds an antenna. Tap the energy balance to open **Energy & storage**, which preserves collection, available/stored balance, production, the storage meter, six simulated hours and action feedback. **Back to my system** and the header back arrow restore the system menu. No Supabase or real-purchase behavior was added.

Relay rendering is on demand (touch, controls, upgrades, resume), avoiding a continuous animation loop when inspecting a static model. The detailed inspection model stays within a bounded draw-call budget. Satellites seen from the system map automatically use a lighter geometry level so the extra hero detail does not multiply across the scene. The underlying preview pauses while an energy sheet or full-screen viewer is open. Camera orientation survives energy collection and upgrades. Full-screen GL resources are released when the viewer closes. The relay layout allows scrolling on compact or enlarged-text screens; the bottom navigation stays fixed outside the scrolling content. Native phone layout and gestures still require verification.

Back is contextual: relay → My system, close-up/manual view → overview, overview → Home. **Overview** is always available to restore full-system framing. **Tap a planet to approach** introduces the direct interaction. Selecting a planet never purchases it or sends a probe automatically. These changes apply to the TRAPPIST-1 demonstration, not yet to every catalogue system.

Motion respects reduced-motion settings and rendering pauses when the app or Home is inactive. Reduced motion renders on demand, preserving all camera controls. GPU buffers/programs and animation frames are released on scene exit. No browser preview is required. Expo GL must run on-device; remote JavaScript debugging is not supported for its rendering context.

Checks: `node scripts/check-guardian-demo.cjs`, `node scripts/check-guardian-scene.cjs`, `npx.cmd tsc --noEmit`, and native Android/iOS exports. The scene checks cover geometry, projection, picking, camera bounds, progressive selection, upgrade meshes and renderer disposal. `--preview` optionally produces CPU-rasterized geometry previews in `output/guardian-3d-preview`; these are not phone screenshots and shader compilation is mocked in the command tests. Native GPU shader compilation, phone layout and multitouch behavior still need a check in Expo Go.

## Procedural celestial materials

The guardian system now uses stable, seeded sphere-space surfaces: subdued rocky terrain, compact craters and icy/fissured variants. Close-up lighting uses a finite-difference surface gradient to simulate relief without separate large normal-map downloads. The stellar surface has slowly evolving granulation, limb darkening and a subtle brightness variation. One camera-facing, transparent falloff halo replaces the previous concentric glow rings.

Planets receive directional day/night lighting from the central star and restrained roughness-dependent reflections. Some connected art profiles add light, independently rotating cloud patterns and a thin illuminated atmospheric rim. These are illustrative appearances, not measured atmospheres, habitability claims or photographs of exoplanets. The demo's planetary profiles do not use the shader's optional gas-giant bands. Undiscovered frontier bodies remain muted without surface details, clouds or atmospheric overlays.

Projected body radius selects three shared sphere meshes (12×18, 24×36, 36×56): below 14 pixels, below 40 pixels, then close-up. Small bodies skip fine noise, cloud layers and relief gradients. Meshes are uploaded once, reused and disposed with the scene. Existing reduced-motion/background pausing remains in place. Navigation, exploration costs, account data and satellite upgrades are unchanged.

`node scripts/check-guardian-materials.cjs` compiles a SkSL adapter of the shared fragment math in headless CanvasKit and checks stable identities, animated rotation/plasma, surface variants, detail levels and transparent halo/rim behavior. `--preview` saves material samples in `output/guardian-material-preview`. These validate material math without a browser; they are not native GL compilation or on-phone frame-rate measurements. The renderer command tests additionally check sphere winding, zoom detail selection, frontier concealment, atmospheric availability and the single halo quad.
