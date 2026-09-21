export type SensorVector = [number, number, number];

export type SkyOrientationFrame = {
  east: SensorVector;
  north: SensorVector;
  up: SensorVector;
  cameraAzimuth: number;
  cameraAltitude: number;
};

export type SkyProjection = {
  left: number;
  top: number;
  horizontalAngle: number;
  verticalAngle: number;
  depth: number;
  visible: boolean;
  inside: boolean;
};

const DEG = Math.PI / 180;

const dot = (a: SensorVector, b: SensorVector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: SensorVector, b: SensorVector): SensorVector => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const scale = (vector: SensorVector, amount: number): SensorVector => vector.map((value) => value * amount) as SensorVector;
const subtract = (a: SensorVector, b: SensorVector): SensorVector => a.map((value, index) => value - b[index]) as SensorVector;

export function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

export function normalizeSignedDegrees(value: number) {
  return ((value + 540) % 360) - 180;
}

export function normalizeSensorVector(vector: SensorVector): SensorVector | null {
  const length = Math.hypot(...vector);
  if (!Number.isFinite(length) || length < 0.000001) return null;
  return vector.map((value) => value / length) as SensorVector;
}

export function lowPassSensorVector(previous: SensorVector | null, next: SensorVector, amount = 0.24): SensorVector {
  if (!previous) return [...next];
  const weight = Math.max(0, Math.min(1, amount));
  return previous.map((value, index) => value + (next[index] - value) * weight) as SensorVector;
}

export function adaptiveSensorWeight(angularSpeed: number) {
  const speed = Math.max(0, angularSpeed);
  if (speed <= 0.8) return 0.035;
  if (speed >= 8) return 0.3;
  return 0.035 + (speed - 0.8) / 7.2 * 0.265;
}

function vectorAngle(left: SensorVector, right: SensorVector) {
  const cosine = Math.max(-1, Math.min(1, dot(left, right)));
  return Math.acos(cosine) / DEG;
}

export function skyOrientationDistance(left: SkyOrientationFrame, right: SkyOrientationFrame) {
  return Math.max(
    Math.abs(normalizeSignedDegrees(right.cameraAzimuth - left.cameraAzimuth)),
    Math.abs(right.cameraAltitude - left.cameraAltitude),
    vectorAngle(left.east, right.east),
    vectorAngle(left.up, right.up),
  );
}

export function isolateGravityVector(totalAcceleration: SensorVector, movement: SensorVector | null): SensorVector {
  return movement
    ? totalAcceleration.map((value, index) => value - movement[index]) as SensorVector
    : [...totalAcceleration];
}

export function createSkyOrientationFrame(
  gravity: SensorVector,
  magneticField: SensorVector,
  trueNorthCorrection = 0,
): SkyOrientationFrame | null {
  // Expo reports gravity pointing down in device coordinates. Device +Z runs
  // from the rear camera towards the screen, so the rear-camera ray is -Z.
  const down = normalizeSensorVector(gravity);
  if (!down) return null;
  const up = scale(down, -1);
  const horizontalMagnetic = subtract(magneticField, scale(up, dot(magneticField, up)));
  const magneticNorth = normalizeSensorVector(horizontalMagnetic);
  if (!magneticNorth) return null;
  const magneticEast = normalizeSensorVector(cross(magneticNorth, up));
  if (!magneticEast) return null;

  // Location.trueHeading - magHeading is the local declination correction.
  // Rotate magnetic north west/east around the local vertical to obtain true north.
  const correction = normalizeSignedDegrees(trueNorthCorrection) * DEG;
  const north = normalizeSensorVector([
    magneticNorth[0] * Math.cos(correction) - magneticEast[0] * Math.sin(correction),
    magneticNorth[1] * Math.cos(correction) - magneticEast[1] * Math.sin(correction),
    magneticNorth[2] * Math.cos(correction) - magneticEast[2] * Math.sin(correction),
  ]);
  if (!north) return null;
  const east = normalizeSensorVector(cross(north, up));
  if (!east) return null;

  const cameraForward: SensorVector = [0, 0, -1];
  const cameraEast = dot(cameraForward, east);
  const cameraNorth = dot(cameraForward, north);
  const cameraUp = Math.max(-1, Math.min(1, dot(cameraForward, up)));
  return {
    east,
    north,
    up,
    cameraAzimuth: normalizeDegrees(Math.atan2(cameraEast, cameraNorth) / DEG),
    cameraAltitude: Math.asin(cameraUp) / DEG,
  };
}

export function projectHorizontalPosition(
  azimuth: number,
  altitude: number,
  frame: SkyOrientationFrame,
  horizontalFieldOfView = 62,
  verticalFieldOfView = 44,
  verticalCorrection = 0,
): SkyProjection {
  const azimuthRad = azimuth * DEG;
  const altitudeRad = altitude * DEG;
  const horizontal = Math.cos(altitudeRad);
  const worldEast = horizontal * Math.sin(azimuthRad);
  const worldNorth = horizontal * Math.cos(azimuthRad);
  const worldUp = Math.sin(altitudeRad);
  const device: SensorVector = [0, 1, 2].map((index) => (
    worldEast * frame.east[index]
    + worldNorth * frame.north[index]
    + worldUp * frame.up[index]
  )) as SensorVector;

  const depth = -device[2];
  const horizontalAngle = Math.atan2(device[0], depth) / DEG;
  const rawVerticalAngle = Math.atan2(device[1], depth) / DEG;
  const verticalAngle = normalizeSignedDegrees(rawVerticalAngle + verticalCorrection);
  const horizontalTangent = Math.tan(horizontalFieldOfView * DEG / 2);
  const verticalTangent = Math.tan(verticalFieldOfView * DEG / 2);
  const left = 50 + device[0] / Math.max(depth, 0.000001) / horizontalTangent * 50;
  const top = 50 - Math.tan(verticalAngle * DEG) / verticalTangent * 50;
  const visible = depth > 0;
  return {
    left,
    top,
    horizontalAngle,
    verticalAngle,
    depth,
    visible,
    inside: visible && left >= 0 && left <= 100 && top >= 0 && top <= 100,
  };
}
