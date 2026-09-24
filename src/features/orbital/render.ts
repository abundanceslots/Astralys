/**
 * Rendu Skia d'Orbital Hook — portage fidèle du canvas 2D de `game-html.ts`.
 * Toutes les fonctions sont des worklets appelées depuis `createPicture`
 * sur le thread UI, à chaque image.
 */
import {
  ClipOp,
  PaintStyle,
  Skia,
  StrokeCap,
  TileMode,
  type SkCanvas,
  type SkPaint,
  type SkPicture,
  createPicture,
} from '@shopify/react-native-skia';

import { CANCEL_RADIUS, allTargets, asteroidAt, flarePhase, positionsAt, previewPath, targetRadius, type GameState } from './engine';
import type { Level, Palette } from './levels';

/** Cadrage du monde virtuel 100 × 100 dans la zone de jeu. */
export type View = { W: number; H: number; SC: number; OX: number; OY: number };

export function makeView(W: number, H: number): View {
  'worklet';
  const SC = Math.min(W, H) / 100;
  return { W, H, SC, OX: (W - 100 * SC) / 2, OY: (H - 100 * SC) / 2 };
}

/** Champ d'étoiles de fond : tableau plat [x, y, taille, alpha, phase, …]. */
export function makeStarfield(W: number, H: number): number[] {
  const n = Math.round((W * H) / 9000);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(Math.random() * W, Math.random() * H, Math.random() * 1.15 + 0.25, Math.random() * 0.42 + 0.1, Math.random() * Math.PI * 2);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Aides                                                               */
/* ------------------------------------------------------------------ */

function fill(color: string, alpha = 1): SkPaint {
  'worklet';
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  if (alpha < 1) p.setAlphaf(Math.max(0, alpha));
  return p;
}

function stroke(color: string, width: number, alpha = 1): SkPaint {
  'worklet';
  const p = fill(color, alpha);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  return p;
}

function radial(x: number, y: number, r: number, colors: string[], pos: number[] | null): SkPaint {
  'worklet';
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setShader(Skia.Shader.MakeRadialGradient({ x, y }, Math.max(0.01, r), colors.map(c => Skia.Color(c)), pos, TileMode.Clamp));
  return p;
}

/** Équivalent de createRadialGradient(x0, y0, r0, x1, y1, r1) du canvas 2D. */
function conical(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, colors: string[], pos: number[] | null): SkPaint {
  'worklet';
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setShader(
    Skia.Shader.MakeTwoPointConicalGradient({ x: x0, y: y0 }, Math.max(0, r0), { x: x1, y: y1 }, Math.max(0.01, r1), colors.map(c => Skia.Color(c)), pos, TileMode.Clamp),
  );
  return p;
}

function circlePath(x: number, y: number, r: number) {
  'worklet';
  const path = Skia.Path.Make();
  path.addCircle(x, y, r);
  return path;
}

/** Tracé d'une polyligne à opacité croissante (traînée) ou décroissante (prévision). */
function drawFadingLine(
  canvas: SkCanvas,
  view: View,
  pts: number[],
  color: string,
  maxAlpha: number,
  fadeIn: boolean,
  baseWidth: number,
  growWidth: number,
): void {
  'worklet';
  const n = pts.length / 2;
  if (n < 2) return;
  // Regroupe les segments par paquets pour limiter les appels de dessin.
  const buckets = 12;
  const per = Math.max(1, Math.ceil((n - 1) / buckets));
  for (let start = 1; start < n; start += per) {
    const end = Math.min(n - 1, start + per - 1);
    const k = (start + end) / 2 / n;
    const alpha = maxAlpha * (fadeIn ? k : 1 - k);
    const p = stroke(color, baseWidth + growWidth * k, alpha);
    p.setStrokeCap(StrokeCap.Round);
    const path = Skia.Path.Make();
    path.moveTo(view.OX + pts[(start - 1) * 2] * view.SC, view.OY + pts[(start - 1) * 2 + 1] * view.SC);
    for (let i = start; i <= end; i++) path.lineTo(view.OX + pts[i * 2] * view.SC, view.OY + pts[i * 2 + 1] * view.SC);
    canvas.drawPath(path, p);
  }
}

/* ------------------------------------------------------------------ */
/* Fond                                                                */
/* ------------------------------------------------------------------ */

/** Nébuleuse de chaque chapitre (O2 « cinématique ») : deux nuages colorés + une bande diffuse. */
const CHAPTER_SKIES: readonly [string, string, string][] = [
  ['rgba(126,84,196,0.30)', 'rgba(61,125,164,0.16)', 'rgba(150,120,220,0.07)'], // 1 · First Light : violet
  ['rgba(196,150,70,0.24)', 'rgba(110,84,170,0.16)', 'rgba(242,200,121,0.07)'], // 2 · Constellation : or
  ['rgba(210,80,60,0.26)', 'rgba(120,50,90,0.18)', 'rgba(255,140,90,0.07)'],   // 3 · Solar Storm : rouge
  ['rgba(150,110,80,0.24)', 'rgba(70,80,110,0.18)', 'rgba(200,160,120,0.06)'],  // 4 · Asteroid Drift : brun
  ['rgba(60,170,190,0.24)', 'rgba(70,90,190,0.18)', 'rgba(143,227,255,0.08)'],  // 5 · Ion Winds : aurore cyan
  ['rgba(150,80,190,0.24)', 'rgba(60,150,170,0.18)', 'rgba(255,150,120,0.06)'], // 6 · Deep Frontier : mélange
];

/** Fond pré-rendu une fois par chapitre : aucun coût par image. */
export function makeSkyPicture(W: number, H: number, chapter = 1): SkPicture {
  'worklet';
  const tint = CHAPTER_SKIES[Math.max(0, Math.min(CHAPTER_SKIES.length - 1, chapter - 1))];
  return createPicture(canvas => {
    const rect = Skia.XYWHRect(0, 0, W, H);
    canvas.drawRect(rect, conical(W * 0.52, H * 0.44, 10, W * 0.5, H * 0.5, Math.max(W, H) * 0.8, ['#141A33', '#0A0F20', '#04060E'], [0, 0.55, 1]));
    canvas.drawRect(rect, radial(W * 0.18, H * 0.24, W * 0.85, [tint[0], 'rgba(0,0,0,0)'], null));
    canvas.drawRect(rect, radial(W * 0.86, H * 0.76, W * 0.75, [tint[1], 'rgba(0,0,0,0)'], null));
    // Bande diffuse en diagonale (voie lactée stylisée).
    canvas.save();
    canvas.translate(W / 2, H / 2);
    canvas.rotate(-28, 0, 0);
    canvas.drawOval(Skia.XYWHRect(-W, -H * 0.09, W * 2, H * 0.18), radial(0, 0, W, [tint[2], 'rgba(0,0,0,0)'], null));
    canvas.restore();
    // Vignettage (équivalent du box-shadow inset de la version HTML).
    const vig = Math.max(W, H) * 0.75;
    canvas.drawRect(rect, radial(W / 2, H / 2, vig, ['rgba(3,5,13,0)', 'rgba(3,5,13,0)', 'rgba(3,5,13,0.6)'], [0, 0.6, 1]));
  }, { width: W, height: H });
}

export const CHAPTER_COUNT = CHAPTER_SKIES.length;

/* ------------------------------------------------------------------ */
/* Corps célestes                                                      */
/* ------------------------------------------------------------------ */

function drawStar(canvas: SkCanvas, X: number, Y: number, R: number, now: number, reduce: boolean): void {
  'worklet';
  const pulse = reduce ? 1 : 1 + 0.045 * Math.sin(now / 900);
  canvas.drawCircle(X, Y, R * 3.8 * pulse, conical(X, Y, R * 0.3, X, Y, R * 3.8 * pulse, ['rgba(255,213,164,0.36)', 'rgba(236,147,99,0.20)', 'rgba(236,147,99,0)'], [0, 0.35, 1]));

  canvas.save();
  canvas.translate(X, Y);
  canvas.rotate(reduce ? 0 : ((now / 42000) * 180) / Math.PI, 0, 0);
  for (let ray = 0; ray < 16; ray++) {
    const angle = (ray * Math.PI) / 8;
    const inner = R * 1.18;
    const outer = R * (ray % 4 === 0 ? 2.25 : 1.72);
    const p = ray % 4 === 0 ? stroke('rgb(255,207,157)', 1.5, 0.21) : stroke('rgb(255,175,126)', 1, 0.12);
    canvas.drawLine(Math.cos(angle) * inner, Math.sin(angle) * inner, Math.cos(angle) * outer, Math.sin(angle) * outer, p);
  }
  canvas.restore();

  canvas.drawCircle(X, Y, R, conical(X - R * 0.32, Y - R * 0.3, R * 0.04, X + R * 0.14, Y + R * 0.15, R * 1.18, ['#FFF2D8', '#FFD4A3', '#F5A66E', '#B85259'], [0, 0.34, 0.72, 1]));

  canvas.save();
  canvas.clipPath(circlePath(X, Y, R), ClipOp.Intersect, true);
  const band = stroke('rgb(255,243,216)', Math.max(1, R * 0.065), 0.16);
  const startDeg = 0.12 * 180;
  const sweepDeg = (0.89 - 0.12) * 180;
  for (let b = -2; b <= 2; b++) {
    const cx = X + R * 0.15;
    const cy = Y + b * R * 0.45;
    const rr = R * 0.74;
    canvas.drawArc(Skia.XYWHRect(cx - rr, cy - rr, rr * 2, rr * 2), startDeg, sweepDeg, false, band);
  }
  canvas.restore();
  canvas.drawCircle(X, Y, R * 1.04, stroke('rgb(255,230,194)', 1, 0.44));
}

/** Petite lune rocheuse (obstacle qui attire) : sphère grise ombrée, cratères et liseré de lumière. */
function drawSatellite(canvas: SkCanvas, X: number, Y: number, R: number, now: number, reduce: boolean): void {
  'worklet';
  canvas.drawCircle(X, Y, R * 2.2, radial(X, Y, R * 2.2, ['rgba(190,190,210,0.14)', 'rgba(190,190,210,0)'], null));
  canvas.drawCircle(X, Y, R, conical(X - R * 0.35, Y - R * 0.4, R * 0.05, X + R * 0.2, Y + R * 0.25, R * 1.25, ['#E4E2EA', '#9A97A6', '#3A3845', '#15141C'], [0, 0.3, 0.8, 1]));
  canvas.save();
  canvas.clipPath(circlePath(X, Y, R), ClipOp.Intersect, true);
  // Cratères : cuvette sombre + bord éclairé, tournant très lentement avec la lune.
  const spin = reduce ? 0 : now / 9000;
  const craters = [[0.35, 0.2, 0.28], [-0.3, 0.35, 0.2], [0.05, -0.4, 0.16], [-0.45, -0.1, 0.12]];
  for (let k = 0; k < craters.length; k++) {
    const c = craters[k];
    const ca = Math.cos(spin), sa = Math.sin(spin);
    const cx = X + (c[0] * ca - c[1] * sa) * R, cy = Y + (c[0] * sa + c[1] * ca) * R;
    canvas.drawCircle(cx, cy, c[2] * R, fill('#2A2833', 0.55));
    canvas.drawCircle(cx - c[2] * R * 0.25, cy - c[2] * R * 0.25, c[2] * R * 0.8, stroke('rgb(220,218,230)', Math.max(0.5, R * 0.05), 0.25));
  }
  canvas.restore();
  canvas.drawCircle(X, Y, R, stroke('rgb(230,228,240)', 0.8, 0.35));
}

function drawPlanet(canvas: SkCanvas, X: number, Y: number, R: number, hue: string): void {
  'worklet';
  canvas.drawCircle(X, Y, R * 1.8, conical(X, Y, R * 0.7, X, Y, R * 1.8, ['rgba(140,173,233,0.15)', 'rgba(140,173,233,0)'], null));
  canvas.drawCircle(X, Y, R, conical(X - R * 0.4, Y - R * 0.43, R * 0.04, X + R * 0.4, Y + R * 0.35, R * 1.45, ['#F3E9FF', hue, '#11182A'], [0, 0.16, 1]));
  canvas.save();
  canvas.clipPath(circlePath(X, Y, R), ClipOp.Intersect, true);
  const stripe = stroke('rgb(230,236,255)', Math.max(1, R * 0.09), 0.11);
  for (let s = -2; s <= 2; s++) {
    canvas.save();
    canvas.translate(X, Y + s * R * 0.32);
    canvas.rotate((-0.15 * 180) / Math.PI, 0, 0);
    canvas.drawOval(Skia.XYWHRect(-R * 1.15, -R * 0.12, R * 2.3, R * 0.24), stripe);
    canvas.restore();
  }
  const shade = Skia.Paint();
  shade.setShader(
    Skia.Shader.MakeLinearGradient({ x: X - R, y: Y }, { x: X + R, y: Y }, [Skia.Color('rgba(5,8,18,0)'), Skia.Color('rgba(5,8,18,0.1)'), Skia.Color('rgba(5,8,18,0.74)')], [0, 0.58, 1], TileMode.Clamp),
  );
  canvas.drawRect(Skia.XYWHRect(X - R, Y - R, R * 2, R * 2), shade);
  canvas.restore();
  canvas.drawCircle(X, Y, R, stroke('rgb(200,216,244)', 1, 0.38));
}

function drawTarget(canvas: SkCanvas, view: View, level: Level, attempts: number, now: number, reduce: boolean, index: number, reached: boolean, colony: string): void {
  'worklet';
  const t = allTargets(level)[index];
  const X = view.OX + t.x * view.SC;
  const Y = view.OY + t.y * view.SC;
  const R = targetRadius(level, attempts, index) * view.SC;
  if (reached) {
    // Balise atteinte : disque plein et coche, elle ne compte plus.
    canvas.drawCircle(X, Y, R, fill(colony, 0.28));
    canvas.drawCircle(X, Y, R, stroke(colony, 1.6, 0.9));
    const check = Skia.Path.Make();
    check.moveTo(X - R * 0.38, Y + R * 0.02);
    check.lineTo(X - R * 0.08, Y + R * 0.32);
    check.lineTo(X + R * 0.42, Y - R * 0.3);
    const p = stroke(colony, 2.2, 1);
    p.setStrokeCap(StrokeCap.Round);
    canvas.drawPath(check, p);
    return;
  }
  // Portail lumineux (O2) : halo, anneau épais, deux arcs qui tournent et un cœur brillant.
  const pulse = reduce ? 0.5 : Math.sin(now / 620 + index) * 0.5 + 0.5;
  canvas.drawCircle(X, Y, R * 2.6, radial(X, Y, R * 2.6, ['rgba(158,215,229,0.26)', 'rgba(158,215,229,0.08)', 'rgba(158,215,229,0)'], [0, 0.45, 1]));
  canvas.drawCircle(X, Y, R, fill('#9FD2FF', 0.06 + 0.06 * pulse));
  canvas.drawCircle(X, Y, R, stroke('rgb(170,220,255)', Math.max(2, R * 0.16), 0.55 + 0.25 * pulse));
  const spin = reduce ? 0 : (now / 1800) * 180 / Math.PI;
  const arc = stroke('rgb(220,240,255)', 1.4, 0.7);
  arc.setStrokeCap(StrokeCap.Round);
  const rr = R * 1.32;
  canvas.drawArc(Skia.XYWHRect(X - rr, Y - rr, rr * 2, rr * 2), spin, 70, false, arc);
  canvas.drawArc(Skia.XYWHRect(X - rr, Y - rr, rr * 2, rr * 2), spin + 180, 70, false, arc);
  canvas.drawCircle(X, Y, Math.max(2.2, R * 0.2), fill('#FFFFFF', 0.9));
}

/** Vent ionique : fines traînées qui défilent dans le sens du vent. */
function drawWind(canvas: SkCanvas, view: View, level: Level, now: number, reduce: boolean): void {
  'worklet';
  const w = level.wind;
  if (!w) return;
  const mag = Math.hypot(w.ax, w.ay) || 1;
  const ux = w.ax / mag, uy = w.ay / mag;
  const paint = stroke('rgb(158,215,229)', 1, 0.16);
  paint.setStrokeCap(StrokeCap.Round);
  const shift = reduce ? 0 : (now / 1000) * (10 + mag * 3);
  for (let i = 0; i < 18; i++) {
    const lane = (i * 37.3) % 100, start = (i * 61.7) % 124;
    const along = ((start + shift) % 124) - 12;
    // Position le long du vent, décalée perpendiculairement par la « voie ».
    const x = 50 + ux * (along - 50) - uy * (lane - 50);
    const y = 50 + uy * (along - 50) + ux * (lane - 50);
    const len = 5 + (i % 3) * 2;
    canvas.drawLine(view.OX + x * view.SC, view.OY + y * view.SC, view.OX + (x + ux * len) * view.SC, view.OY + (y + uy * len) * view.SC, paint);
  }
}

/** Astéroïde : roche irrégulière ombrée, cratères et traînée de poussière derrière lui. */
function drawAsteroid(canvas: SkCanvas, X: number, Y: number, R: number, now: number, seed: number, dirX: number, dirY: number): void {
  'worklet';
  // Poussière : quelques grains qui s'estompent à l'opposé du mouvement.
  const mag = Math.hypot(dirX, dirY) || 1;
  const bx = -dirX / mag, by = -dirY / mag;
  for (let k = 1; k <= 5; k++) {
    const d = R * (0.9 + k * 0.75);
    canvas.drawCircle(X + bx * d + by * Math.sin(seed + k) * R * 0.25, Y + by * d - bx * Math.sin(seed + k) * R * 0.25, R * (0.22 - k * 0.03), fill('#A89E96', 0.28 - k * 0.045));
  }
  const rock = Skia.Path.Make();
  const n = 11;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + now / 2600 + seed;
    const rr = R * (0.72 + 0.18 * Math.sin(seed * 3.1 + k * 1.7) + 0.1 * Math.sin(seed * 5.3 + k * 2.9));
    if (k === 0) rock.moveTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr);
    else rock.lineTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr);
  }
  rock.close();
  canvas.drawPath(rock, conical(X - R * 0.4, Y - R * 0.45, R * 0.05, X + R * 0.2, Y + R * 0.25, R * 1.2, ['#B5AA9E', '#7A6F68', '#3B3532', '#1C1918'], [0, 0.35, 0.8, 1]));
  canvas.save();
  canvas.clipPath(rock, ClipOp.Intersect, true);
  const t = now / 2600 + seed;
  canvas.drawCircle(X + Math.cos(t) * R * 0.3, Y + Math.sin(t) * R * 0.3, R * 0.22, fill('#2E2926', 0.6));
  canvas.drawCircle(X + Math.cos(t + 2.4) * R * 0.35, Y + Math.sin(t + 2.4) * R * 0.35, R * 0.14, fill('#2E2926', 0.5));
  canvas.restore();
  canvas.drawPath(rock, stroke('rgb(210,196,180)', 0.8, 0.35));
}

/** Base orbitale de lancement : anneau d'habitat, moyeu, bras de lancement qui pivote avec la visée et satellite prêt à partir. */
function drawStation(canvas: SkCanvas, view: View, level: Level, aimA: number, aiming: boolean, cancelArmed: boolean, danger: string): void {
  'worklet';
  const X = view.OX + level.station.x * view.SC;
  const Y = view.OY + level.station.y * view.SC;
  const R = Math.max(5, 2.6 * view.SC);
  canvas.drawCircle(X, Y, R * 2.4, radial(X, Y, R * 2.4, ['rgba(200,186,245,0.2)', 'rgba(200,186,245,0)'], null));
  if (aiming) {
    // Zone d'annulation : relâcher dedans annule le tir.
    const zone = stroke(cancelArmed ? danger : 'rgb(200,186,245)', 1, cancelArmed ? 0.8 : 0.22);
    zone.setPathEffect(Skia.PathEffect.MakeDash([3, 4], 0));
    canvas.drawCircle(X, Y, CANCEL_RADIUS * view.SC, zone);
  }
  // Anneau d'habitat avec ses modules.
  canvas.drawCircle(X, Y, R, stroke('rgb(120,128,160)', Math.max(1.6, R * 0.22), 0.9));
  canvas.drawCircle(X, Y, R, stroke('rgb(220,215,245)', 0.8, 0.5));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.26;
    canvas.drawCircle(X + Math.cos(a) * R, Y + Math.sin(a) * R, Math.max(1, R * 0.14), fill(k % 2 ? '#C8BAF5' : '#8E96B4', 0.9));
  }
  canvas.save();
  canvas.translate(X, Y);
  canvas.rotate((aimA * 180) / Math.PI, 0, 0);
  // Bras de lancement (rail) et satellite en attente au bout.
  canvas.drawRect(Skia.XYWHRect(0, -R * 0.12, R * 1.55, R * 0.24), fill('#5C6484'));
  canvas.drawLine(0, 0, R * 1.55, 0, stroke('rgb(200,186,245)', 1, 0.7));
  canvas.drawRect(Skia.XYWHRect(R * 1.45, -R * 0.35, R * 0.12, R * 0.7), fill('#C8BAF5', 0.9));
  canvas.drawRect(Skia.XYWHRect(R * 1.62, -R * 0.52, R * 0.3, R * 0.3), fill('#6B7FD6'));
  canvas.drawRect(Skia.XYWHRect(R * 1.62, R * 0.22, R * 0.3, R * 0.3), fill('#6B7FD6'));
  canvas.drawRect(Skia.XYWHRect(R * 1.62, -R * 0.2, R * 0.3, R * 0.4), fill('#E8C77A'));
  canvas.restore();
  // Moyeu central.
  canvas.drawCircle(X, Y, R * 0.42, fill('#1C2036'));
  canvas.drawCircle(X, Y, R * 0.42, stroke('rgb(200,186,245)', 1, 0.8));
  canvas.drawCircle(X, Y, R * 0.14, fill('#C8BAF5'));
}

const GRAVITY_LEVELS = [55, 24, 10] as const;

/** Courbes de gravité (O1), affichées comme aide après un échec : plus serrées près des masses. */
function drawGravityContours(canvas: SkCanvas, view: View, level: Level, pos: number[], alpha: number): void {
  'worklet';
  const paint = stroke('rgb(110,185,255)', 1, 0.3 * alpha);
  paint.setPathEffect(Skia.PathEffect.MakeDash([2, 5], 0));
  for (let i = 0; i < level.bodies.length; i++) {
    const b = level.bodies[i];
    if (b.type === 'satellite') continue;
    const X = view.OX + pos[i * 2] * view.SC, Y = view.OY + pos[i * 2 + 1] * view.SC;
    // Lignes d'égale attraction (a = m / d²) : trois niveaux, du plus fort au plus faible.
    for (let k = 0; k < GRAVITY_LEVELS.length; k++) {
      const d = Math.sqrt(Math.max(0, b.m) / GRAVITY_LEVELS[k]);
      if (d < b.r * 1.15) continue;
      paint.setAlphaf((0.3 - k * 0.07) * alpha);
      canvas.drawCircle(X, Y, d * view.SC, paint);
    }
  }
}

/** Satellite en vol (O2) : même silhouette que dans le système — corps doré, deux ailes, halo. */
function drawProbe(canvas: SkCanvas, X: number, Y: number, angle: number, color: string): void {
  'worklet';
  canvas.drawCircle(X, Y, 16, radial(X, Y, 16, ['rgba(200,186,245,0.45)', 'rgba(200,186,245,0)'], null));
  canvas.save();
  canvas.translate(X, Y);
  canvas.rotate((angle * 180) / Math.PI, 0, 0);
  canvas.scale(1.35, 1.35);
  canvas.drawRect(Skia.XYWHRect(-9, -1.6, 5.2, 3.2), fill('#6B7FD6'));
  canvas.drawRect(Skia.XYWHRect(3.8, -1.6, 5.2, 3.2), fill('#6B7FD6'));
  canvas.drawLine(-9, 0, 9, 0, stroke('rgb(200,210,255)', 0.6, 0.6));
  canvas.drawRect(Skia.XYWHRect(-2.6, -2.6, 5.2, 5.2), fill('#E8C77A'));
  canvas.drawCircle(3.4, 0, 1.2, fill(color));
  canvas.restore();
}

export type SceneInput = {
  s: GameState;
  level: Level;
  view: View;
  stars: number[];
  /** Un fond pré-rendu par chapitre (index = chapitre − 1). */
  sky: SkPicture[] | null;
  P: Palette;
  now: number;
  reduce: boolean;
  /** vrai quand le doigt est dans la zone d'annulation */
  cancelArmed: boolean;
};

export function drawScene(canvas: SkCanvas, input: SceneInput): void {
  'worklet';
  const { s, level, view, stars, sky, P, now, reduce, cancelArmed } = input;
  const { SC, OX, OY } = view;

  const skyPicture = sky ? sky[Math.max(0, Math.min(sky.length - 1, (level.chapter ?? 1) - 1))] : null;
  if (skyPicture) canvas.drawPicture(skyPicture);
  else canvas.drawColor(Skia.Color(P.void));

  // Étoiles de fond scintillantes.
  const starPaint = fill('#CBD7EE');
  for (let i = 0; i < stars.length; i += 5) {
    const tw = reduce ? 1 : 0.72 + 0.28 * Math.sin(now / 1400 + stars[i + 4]);
    starPaint.setAlphaf(stars[i + 3] * tw);
    canvas.drawRect(Skia.XYWHRect(stars[i], stars[i + 1], stars[i + 2], stars[i + 2]), starPaint);
  }

  // Orbites en pointillés.
  const orbitPaint = stroke('rgb(184,173,220)', 1, 0.2);
  orbitPaint.setPathEffect(Skia.PathEffect.MakeDash([2, 5], 0));
  for (let i = 0; i < level.bodies.length; i++) {
    const o = level.bodies[i].orbit;
    if (o) canvas.drawCircle(OX + 50 * SC, OY + 50 * SC, o.r * SC, orbitPaint);
  }

  drawWind(canvas, view, level, now, reduce);
  const targetCount = allTargets(level).length;
  for (let k = 0; k < targetCount; k++) drawTarget(canvas, view, level, s.attempts, now, reduce, k, !!s.reached[k], P.colony);

  // Anneau de réussite.
  if (s.burstAt >= 0) {
    const k = Math.min(1, (now - s.burstAt) / 650);
    if (k < 1) {
      const X = OX + s.burstX * SC;
      const Y = OY + s.burstY * SC;
      const R = targetRadius(level, s.attempts) * SC;
      canvas.drawCircle(X, Y, R * (1 + k * 3.2), stroke(P.colony, 2.2 * (1 - k) + 0.5, 0.9 * (1 - k)));
      canvas.drawCircle(X, Y, R * (1 + k * 1.6), fill(P.colony, 0.25 * (1 - k)));
    }
  }

  const pos: number[] = [];
  positionsAt(level, s.t, pos);
  // Aide après un échec : la gravité devient visible (apparition en fondu sur 0,6 s).
  const aimingNow = !s.probe && !s.done && !s.outcome;
  if (s.attempts >= 2 && aimingNow) drawGravityContours(canvas, view, level, pos, 1);
  for (let i = 0; i < level.bodies.length; i++) {
    const b = level.bodies[i];
    const X = OX + pos[i * 2] * SC;
    const Y = OY + pos[i * 2 + 1] * SC;
    const R = b.r * SC;
    if (b.type === 'star') {
      // Éruption solaire : anneau d'alerte, puis zone mortelle rouge.
      const phase = flarePhase(level, s.t);
      if (level.flare && phase > 0) {
        const lethal = R * level.flare.scale;
        if (phase === 2) {
          canvas.drawCircle(X, Y, lethal, radial(X, Y, lethal, ['rgba(255,150,90,0.55)', 'rgba(255,110,80,0.28)', 'rgba(255,90,80,0.05)'], [0, 0.7, 1]));
          canvas.drawCircle(X, Y, lethal, stroke(P.danger, 1.6, 0.8));
        } else {
          const blink = reduce ? 0.6 : 0.35 + 0.35 * Math.sin(now / 90);
          const ring = stroke(P.danger, 1.2, blink);
          ring.setPathEffect(Skia.PathEffect.MakeDash([5, 5], 0));
          canvas.drawCircle(X, Y, lethal, ring);
        }
      }
      drawStar(canvas, X, Y, R, now, reduce);
    }
    else if (b.type === 'satellite') drawSatellite(canvas, X, Y, R, now, reduce);
    else drawPlanet(canvas, X, Y, R, b.hue ?? '#7E9BC4');
  }

  if (level.asteroids) {
    for (let i = 0; i < level.asteroids.length; i++) {
      const a = level.asteroids[i];
      const p = asteroidAt(a, s.t);
      drawAsteroid(canvas, OX + p.x * SC, OY + p.y * SC, a.r * SC, reduce ? 0 : now, i * 1.37, a.vx, a.vy);
    }
  }

  const aiming = !s.probe && !s.done && !s.outcome;
  drawStation(canvas, view, level, s.aimA, aiming && s.dragging, cancelArmed, P.danger);

  // Fantôme du dernier tir raté : aide à corriger la visée.
  if (aiming && s.ghost.length >= 4) {
    const ghostPaint = stroke(P.danger, 1.2, 0.28);
    ghostPaint.setPathEffect(Skia.PathEffect.MakeDash([4, 5], 0));
    const path = Skia.Path.Make();
    path.moveTo(OX + s.ghost[0] * SC, OY + s.ghost[1] * SC);
    for (let i = 2; i < s.ghost.length; i += 2) path.lineTo(OX + s.ghost[i] * SC, OY + s.ghost[i + 1] * SC);
    canvas.drawPath(path, ghostPaint);
  }

  if (aiming) {
    drawFadingLine(canvas, view, previewPath(level, s), P.trace, 0.55, false, 1.6, 0);
    const len = s.aimP * 13;
    const ex = level.station.x + Math.cos(s.aimA) * len;
    const ey = level.station.y + Math.sin(s.aimA) * len;
    const armColor = cancelArmed ? P.danger : P.trace;
    canvas.drawLine(OX + level.station.x * SC, OY + level.station.y * SC, OX + ex * SC, OY + ey * SC, stroke(armColor, 2, 0.9));
    canvas.drawCircle(OX + ex * SC, OY + ey * SC, 3, fill(armColor));
  }

  if (s.probe) {
    const tr = s.probe.trail;
    drawFadingLine(canvas, view, tr, s.outcome === 'ko' ? P.danger : P.trace, s.outcome === 'ko' ? 0.52 : 0.75, true, 1, 1.6);
    if (!s.outcome) {
      const X = OX + s.probe.x * SC;
      const Y = OY + s.probe.y * SC;
      drawProbe(canvas, X, Y, Math.atan2(s.probe.vy, s.probe.vx), P.trace);
    }
  }

  // Éclats de crash.
  for (let i = 0; i < s.particles.length; i++) {
    const p = s.particles[i];
    canvas.drawCircle(OX + p.x * SC, OY + p.y * SC, 1.2 + p.life * 1.6, fill(p.hue, Math.min(1, p.life * 1.6)));
  }
}
