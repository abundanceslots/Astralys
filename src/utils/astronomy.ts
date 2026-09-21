export type ObserverLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

export type VisibilityForecast = {
  visibleNow: boolean;
  observableTonight: boolean;
  currentAltitude: number;
  bestAltitude: number | null;
  bestTime: Date | null;
  firstVisibleTime: Date | null;
  direction: string;
};

export type WeeklyVisibility = {
  visibleNights: number;
  bestNight: Date | null;
  bestAltitude: number | null;
};

export type HorizontalPosition = {
  altitude: number;
  azimuth: number;
};

const DEG = Math.PI / 180;
const TEN_MINUTES = 10 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function julianDate(date: Date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function greenwichSiderealTime(date: Date) {
  const days = julianDate(date) - 2451545.0;
  return normalizeDegrees(280.46061837 + 360.98564736629 * days);
}

export function calculateHorizontalPosition(
  raDeg: number,
  decDeg: number,
  date: Date,
  observer: ObserverLocation,
): HorizontalPosition {
  const localSiderealTime = normalizeDegrees(greenwichSiderealTime(date) + observer.longitude);
  let hourAngle = normalizeDegrees(localSiderealTime - raDeg);
  if (hourAngle > 180) hourAngle -= 360;

  const hourAngleRad = hourAngle * DEG;
  const decRad = decDeg * DEG;
  const latRad = observer.latitude * DEG;
  const sinAltitude = Math.sin(decRad) * Math.sin(latRad)
    + Math.cos(decRad) * Math.cos(latRad) * Math.cos(hourAngleRad);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAltitude))) / DEG;
  const azimuth = normalizeDegrees(
    Math.atan2(
      Math.sin(hourAngleRad),
      Math.cos(hourAngleRad) * Math.sin(latRad) - Math.tan(decRad) * Math.cos(latRad),
    ) / DEG + 180,
  );

  return { altitude, azimuth };
}

function sunEquatorialCoordinates(date: Date) {
  const days = julianDate(date) - 2451545.0;
  const meanLongitude = normalizeDegrees(280.460 + 0.9856474 * days);
  const meanAnomaly = normalizeDegrees(357.528 + 0.9856003 * days) * DEG;
  const eclipticLongitude = normalizeDegrees(
    meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.020 * Math.sin(2 * meanAnomaly),
  ) * DEG;
  const obliquity = (23.439 - 0.0000004 * days) * DEG;
  const ra = normalizeDegrees(
    Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude)) / DEG,
  );
  const dec = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude)) / DEG;

  return { ra, dec };
}

function sunAltitude(date: Date, observer: ObserverLocation) {
  const sun = sunEquatorialCoordinates(date);
  return calculateHorizontalPosition(sun.ra, sun.dec, date, observer).altitude;
}

function compassDirection(azimuth: number) {
  const directions = ['North', 'North-east', 'East', 'South-east', 'South', 'South-west', 'West', 'North-west'];
  return directions[Math.round(normalizeDegrees(azimuth) / 45) % 8];
}

function observableSamples(
  raDeg: number,
  decDeg: number,
  observer: ObserverLocation,
  start: Date,
) {
  const samples = [];

  for (let offset = 0; offset <= DAY; offset += TEN_MINUTES) {
    const date = new Date(start.getTime() + offset);
    const position = calculateHorizontalPosition(raDeg, decDeg, date, observer);
    const darkEnough = sunAltitude(date, observer) <= -6;

    if (position.altitude >= 20 && darkEnough) {
      samples.push({ date, ...position });
    }
  }

  return samples;
}

export function calculateVisibility(
  raDeg: number | null,
  decDeg: number | null,
  observer: ObserverLocation,
  now = new Date(),
): VisibilityForecast | null {
  if (raDeg === null || decDeg === null) return null;

  const currentPosition = calculateHorizontalPosition(raDeg, decDeg, now, observer);
  const visibleNow = currentPosition.altitude >= 20 && sunAltitude(now, observer) <= -6;
  const samples = observableSamples(raDeg, decDeg, observer, now);
  const best = samples.reduce<(typeof samples)[number] | null>(
    (current, sample) => (!current || sample.altitude > current.altitude ? sample : current),
    null,
  );

  return {
    visibleNow,
    observableTonight: samples.length > 0,
    currentAltitude: currentPosition.altitude,
    bestAltitude: best?.altitude ?? null,
    bestTime: best?.date ?? null,
    firstVisibleTime: samples[0]?.date ?? null,
    direction: compassDirection((best ?? currentPosition).azimuth),
  };
}

export function calculateWeeklyVisibility(
  raDeg: number | null,
  decDeg: number | null,
  observer: ObserverLocation,
  now = new Date(),
): WeeklyVisibility | null {
  if (raDeg === null || decDeg === null) return null;

  const firstNight = new Date(now);
  if (firstNight.getHours() < 12) firstNight.setDate(firstNight.getDate() - 1);
  firstNight.setHours(12, 0, 0, 0);

  let visibleNights = 0;
  let bestNight: Date | null = null;
  let bestAltitude: number | null = null;

  for (let day = 0; day < 7; day += 1) {
    const start = new Date(firstNight.getTime() + day * DAY);
    const samples = observableSamples(raDeg, decDeg, observer, start);
    if (samples.length === 0) continue;

    visibleNights += 1;
    const nightlyBest = samples.reduce((current, sample) => (
      sample.altitude > current.altitude ? sample : current
    ));

    if (bestAltitude === null || nightlyBest.altitude > bestAltitude) {
      bestAltitude = nightlyBest.altitude;
      bestNight = nightlyBest.date;
    }
  }

  return { visibleNights, bestNight, bestAltitude };
}
