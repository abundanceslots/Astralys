import type { StarDetail } from '@/components/star-detail-modal';
import { getCelestialDisplayName } from '@/utils/celestial-display-name';
import {
  calculateHorizontalPosition,
  type ObserverLocation,
} from '@/utils/astronomy';
import {
  adaptiveSensorWeight,
  createSkyOrientationFrame,
  isolateGravityVector,
  lowPassSensorVector,
  normalizeSignedDegrees,
  projectHorizontalPosition,
  skyOrientationDistance,
  type SensorVector,
  type SkyOrientationFrame,
} from '@/features/sky-orientation';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { DeviceMotion, Magnetometer } from 'expo-sensors';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Text } from '@/components/astralys-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SkyLocatorModalProps = {
  star: StarDetail;
  visible: boolean;
  onClose: () => void;
};

type LocatorPhase = 'intro' | 'requesting' | 'active' | 'error';

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatAngle(value: number | null) {
  return value === null ? '—' : `${Math.round(value)}°`;
}

function directionLabel(azimuth: number) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(((azimuth % 360) + 360) % 360 / 45) % 8];
}

export function SkyLocatorModal({ star, visible, onClose }: SkyLocatorModalProps) {
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<LocatorPhase>('intro');
  const [error, setError] = useState<string | null>(null);
  const [observer, setObserver] = useState<ObserverLocation | null>(null);
  const [orientationFrame, setOrientationFrame] = useState<SkyOrientationFrame | null>(null);
  const [headingAccuracy, setHeadingAccuracy] = useState(0);
  const [calibrationOffset, setCalibrationOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!visible || phase !== 'active') return;

    let mounted = true;
    let headingSubscription: Location.LocationSubscription | null = null;
    let gravity: SensorVector | null = null;
    let magneticField: SensorVector | null = null;
    let trueNorthCorrection = 0;
    let lastPublishedAt = 0;
    let angularSpeed = 0;
    let stableFrame: SkyOrientationFrame | null = null;
    DeviceMotion.setUpdateInterval(50);
    Magnetometer.setUpdateInterval(50);

    const publishOrientation = () => {
      if (!mounted || !gravity || !magneticField) return;
      const frame = createSkyOrientationFrame(gravity, magneticField, trueNorthCorrection);
      const currentTime = Date.now();
      if (!frame || currentTime - lastPublishedAt < 45) return;
      if (stableFrame && angularSpeed < 1.2 && skyOrientationDistance(stableFrame, frame) < 0.35) return;
      lastPublishedAt = currentTime;
      stableFrame = frame;
      setOrientationFrame(frame);
    };

    const motionSubscription = DeviceMotion.addListener((measurement) => {
      if (!mounted || !measurement.accelerationIncludingGravity) return;
      const combined = measurement.accelerationIncludingGravity;
      const movement = measurement.acceleration;
      const sample = isolateGravityVector(
        [combined.x, combined.y, combined.z],
        movement ? [movement.x, movement.y, movement.z] : null,
      );
      const rotationRate = measurement.rotationRate;
      angularSpeed = rotationRate
        ? Math.hypot(rotationRate.alpha, rotationRate.beta, rotationRate.gamma)
        : 0;
      gravity = lowPassSensorVector(gravity, sample, adaptiveSensorWeight(angularSpeed));
      publishOrientation();
    });

    const magnetometerSubscription = Magnetometer.addListener((measurement) => {
      if (!mounted) return;
      magneticField = lowPassSensorVector(
        magneticField,
        [measurement.x, measurement.y, measurement.z],
        adaptiveSensorWeight(angularSpeed),
      );
      publishOrientation();
    });

    void Location.watchHeadingAsync((measurement) => {
      if (!mounted) return;
      trueNorthCorrection = measurement.trueHeading >= 0
        ? normalizeSignedDegrees(measurement.trueHeading - measurement.magHeading)
        : 0;
      setHeadingAccuracy(measurement.accuracy);
      publishOrientation();
    }).then((subscription) => {
      if (mounted) headingSubscription = subscription;
      else subscription.remove();
    }).catch(() => {
      if (mounted) setError('The phone compass is unavailable.');
    });

    const clock = setInterval(() => setNow(Date.now()), 10_000);

    return () => {
      mounted = false;
      motionSubscription.remove();
      magnetometerSubscription.remove();
      headingSubscription?.remove();
      clearInterval(clock);
    };
  }, [phase, visible]);

  const target = useMemo(() => {
    if (!observer || star.ra_deg === null || star.dec_deg === null) return null;
    return calculateHorizontalPosition(star.ra_deg, star.dec_deg, new Date(now), observer);
  }, [now, observer, star.dec_deg, star.ra_deg]);

  const adjustedAltitude = orientationFrame === null
    ? null
    : clamp(orientationFrame.cameraAltitude - calibrationOffset, -90, 90);
  const targetProjection = target && orientationFrame
    ? projectHorizontalPosition(target.azimuth, target.altitude, orientationFrame, 62, 44, calibrationOffset)
    : null;
  const horizontalDifference = targetProjection?.horizontalAngle ?? null;
  const verticalDifference = targetProjection?.verticalAngle ?? null;
  const aboveHorizon = Boolean(target && target.altitude >= 0);
  const aligned = Boolean(
    aboveHorizon
    && horizontalDifference !== null
    && verticalDifference !== null
    && Math.abs(horizontalDifference) <= 5
    && Math.abs(verticalDifference) <= 5,
  );
  const insideFrame = Boolean(
    aboveHorizon
    && targetProjection?.visible
    && targetProjection.left >= 7
    && targetProjection.left <= 93
    && targetProjection.top >= 12
    && targetProjection.top <= 84,
  );
  const reticleLeft = clamp(targetProjection?.left ?? 50, 7, 93);
  const reticleTop = clamp(targetProjection?.top ?? 50, 12, 84);
  const arrowRotation = horizontalDifference === null || verticalDifference === null
    ? 0
    : Math.atan2(horizontalDifference, verticalDifference) * 180 / Math.PI;

  const guidance = useMemo(() => {
    if (!target) return 'Calculating the star position…';
    if (target.altitude < 0) return 'This star is currently below the horizon.';
    if (!orientationFrame || adjustedAltitude === null) return 'Stabilizing the sky lock…';
    if (aligned) return 'Target locked — hold steady.';
    if (Math.abs(horizontalDifference ?? 0) > 6) {
      return `Turn ${Math.round(Math.abs(horizontalDifference!))}° to the ${horizontalDifference! > 0 ? 'right' : 'left'}.`;
    }
    return `Tilt the phone ${Math.round(Math.abs(verticalDifference!))}° ${verticalDifference! > 0 ? 'up' : 'down'}.`;
  }, [adjustedAltitude, aligned, horizontalDifference, orientationFrame, target, verticalDifference]);

  const startLocator = async () => {
    if (star.ra_deg === null || star.dec_deg === null) {
      setError('The celestial coordinates for this object are incomplete.');
      setPhase('error');
      return;
    }

    setPhase('requesting');
    setError(null);

    try {
      const nextCameraPermission = cameraPermission?.granted
        ? cameraPermission
        : await requestCameraPermission();
      if (!nextCameraPermission.granted) {
        throw new Error('Allow camera access to display the sky finder.');
      }

      const locationPermission = await Location.requestForegroundPermissionsAsync();
      if (locationPermission.status !== 'granted') {
        throw new Error('Allow location access to calculate the sky visible from your area.');
      }

      const motionAvailable = await DeviceMotion.isAvailableAsync();
      if (!motionAvailable) {
        throw new Error('Motion sensors are not available on this device.');
      }
      const magnetometerAvailable = await Magnetometer.isAvailableAsync();
      if (!magnetometerAvailable) {
        throw new Error('A compass sensor is required for stable sky guidance.');
      }

      const motionPermission = await DeviceMotion.requestPermissionsAsync();
      if (motionPermission.status !== 'granted') {
        throw new Error('Allow motion access to orient the sky finder.');
      }

      const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 });
      const location = lastKnown ?? await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setObserver({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        label: 'Current location',
      });
      setNow(Date.now());
      setPhase('active');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Sky guidance could not start.');
      setPhase('error');
    }
  };

  const closeLocator = () => {
    setPhase('intro');
    setObserver(null);
    setOrientationFrame(null);
    setCalibrationOffset(0);
    setError(null);
    onClose();
  };

  const calibrateHorizon = () => {
    if (orientationFrame) setCalibrationOffset(orientationFrame.cameraAltitude);
  };

  return (
    <Modal animationType="fade" onRequestClose={closeLocator} presentationStyle="fullScreen" visible={visible}>
      <View style={styles.screen}>
        {phase === 'active' ? <CameraView active facing="back" mode="picture" style={StyleSheet.absoluteFill} /> : null}
        <View pointerEvents="none" style={styles.cameraShade} />

        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <Pressable accessibilityLabel="Close sky guidance" onPress={closeLocator} style={styles.closeButton}>
            <Text style={styles.closeIcon}>×</Text>
          </Pressable>
          <View style={styles.topIdentity}>
            <Text numberOfLines={1} style={styles.starName}>{getCelestialDisplayName(star)}</Text>
            <Text style={styles.modeLabel}>SKY FINDER</Text>
          </View>
          <View style={[styles.sensorPill, phase === 'active' && styles.sensorPillActive]}>
            <View style={[styles.sensorDot, phase === 'active' && styles.sensorDotActive]} />
            <Text style={styles.sensorText}>{phase === 'active' ? 'Live' : 'Off'}</Text>
          </View>
        </View>

        {phase === 'active' ? (
          <View style={styles.trackingLayer}>
            <View pointerEvents="none" style={styles.horizonLine} />

            {insideFrame ? (
              <Animated.View
                entering={ZoomIn.duration(260)}
                pointerEvents="none"
                style={[
                  styles.reticle,
                  aligned && styles.reticleAligned,
                  { left: `${reticleLeft}%`, top: `${reticleTop}%` },
                ]}>
                <View style={[styles.selectedGlow, aligned && styles.selectedGlowAligned]} />
                <View style={styles.selectedRingInner} />
                <View style={[styles.reticleCore, aligned && styles.reticleCoreAligned]} />
                <Text style={[styles.targetLabel, aligned && styles.targetLabelAligned]}>TARGET STAR</Text>
                <Text numberOfLines={1} style={styles.reticleName}>{getCelestialDisplayName(star)}</Text>
              </Animated.View>
            ) : aboveHorizon ? (
              <Animated.View entering={FadeIn.duration(240)} pointerEvents="none" style={styles.guideArrowWrap}>
                <View style={styles.edgeTargetGlow} />
                <View style={styles.edgeTargetCore} />
                <Text style={[styles.guideArrow, { transform: [{ rotate: `${arrowRotation}deg` }] }]}>↑</Text>
                <Text style={styles.edgeTargetLabel}>TARGET OUT OF FRAME</Text>
              </Animated.View>
            ) : null}

            <View style={[styles.bottomPanel, { paddingBottom: Math.max(insets.bottom, 14) + 10 }]}>
              <View style={styles.overlayNotice}>
                <Text style={styles.overlayNoticeText}>✦ Precision lock · selected target only</Text>
              </View>
              <Animated.View entering={FadeInDown.duration(320)} style={[styles.guidanceCard, aligned && styles.guidanceCardAligned]}>
                <Text style={[styles.guidanceText, aligned && styles.guidanceTextAligned]}>{guidance}</Text>
                <View style={styles.metricsRow}>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>TARGET</Text>
                    <Text style={styles.metricValue}>{target ? directionLabel(target.azimuth) : '—'} · {formatAngle(target?.azimuth ?? null)}</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>ALTITUDE</Text>
                    <Text style={styles.metricValue}>{formatAngle(target?.altitude ?? null)}</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>COMPASS</Text>
                    <Text style={styles.metricValue}>{headingAccuracy >= 2 ? 'Accurate' : 'Calibrate'}</Text>
                  </View>
                </View>
              </Animated.View>

              <View style={styles.actionRow}>
                <Pressable onPress={calibrateHorizon} style={styles.calibrateButton}>
                  <Text style={styles.calibrateText}>Calibrate horizon</Text>
                </Pressable>
                <Text style={styles.calibrationHint}>Hold the phone upright and aim at the horizon before calibrating.</Text>
              </View>
              {headingAccuracy < 2 ? <Text style={styles.compassHint}>Move the phone in a figure eight to improve compass accuracy.</Text> : null}
            </View>
          </View>
        ) : (
          <View style={styles.introContent}>
            <Animated.View entering={ZoomIn.duration(420)} style={styles.locatorSymbol}>
              <View style={styles.locatorRing} />
              <View style={styles.locatorCore} />
            </Animated.View>
            <Animated.View entering={FadeInDown.duration(420).delay(70)} style={styles.introCopy}>
              <Text style={styles.introEyebrow}>ASSISTED SKY GUIDANCE</Text>
              <Text style={styles.introTitle}>Find this star in the night sky</Text>
              <Text style={styles.introText}>
                Astralys locks only the selected target onto the camera using your location and phone sensors.
              </Text>
              <View style={styles.privacyCard}>
                <Text style={styles.privacyIcon}>◇</Text>
                <Text style={styles.privacyText}>No image or video is recorded. The microphone is never used.</Text>
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Pressable disabled={phase === 'requesting'} onPress={startLocator} style={styles.startButton}>
                {phase === 'requesting' ? (
                  <ActivityIndicator color="#171321" />
                ) : (
                  <>
                    <Text style={styles.startButtonText}>{phase === 'error' ? 'Try again' : 'Start sky guidance'}</Text>
                    <Text style={styles.startArrow}>→</Text>
                  </>
                )}
              </Pressable>
              <Text style={styles.accuracyNotice}>The marker is approximate and depends on compass accuracy.</Text>
            </Animated.View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#05070C' },
  cameraShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(2,4,9,0.24)' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17, paddingBottom: 10, backgroundColor: 'rgba(5,7,12,0.72)' },
  closeButton: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(20,24,36,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  closeIcon: { color: '#F0ECF6', fontSize: 25, lineHeight: 27 },
  topIdentity: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  starName: { maxWidth: 230, color: '#F6F3FA', fontSize: 13, fontWeight: '800' },
  modeLabel: { color: '#9387AA', fontSize: 7, fontWeight: '900', letterSpacing: 1.3, marginTop: 4 },
  sensorPill: { minWidth: 58, height: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 15, backgroundColor: 'rgba(20,24,36,0.88)' },
  sensorPillActive: { backgroundColor: 'rgba(35,79,65,0.84)' },
  sensorDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#6F7585' },
  sensorDotActive: { backgroundColor: '#7FE0B6' },
  sensorText: { color: '#D6D2DC', fontSize: 8, fontWeight: '800' },
  introContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 76 },
  locatorSymbol: { width: 124, height: 124, alignItems: 'center', justifyContent: 'center', marginBottom: 27 },
  locatorRing: { position: 'absolute', width: 112, height: 112, borderRadius: 56, borderWidth: 1, borderColor: 'rgba(196,181,253,0.28)' },
  locatorCore: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#D7CBF6', shadowColor: '#BCAAEF', shadowOpacity: 0.8, shadowRadius: 20, shadowOffset: { width: 0, height: 0 }, elevation: 12 },
  introCopy: { width: '100%', maxWidth: 420, alignItems: 'center' },
  introEyebrow: { color: '#A996DF', fontSize: 9, fontWeight: '900', letterSpacing: 1.8, marginBottom: 9 },
  introTitle: { color: '#F5F2F9', fontSize: 27, lineHeight: 33, fontWeight: '700', textAlign: 'center', letterSpacing: -0.6 },
  introText: { color: '#8B909E', fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 12, maxWidth: 350 },
  privacyCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, marginTop: 20, borderRadius: 14, backgroundColor: '#0E121B', borderWidth: 1, borderColor: 'rgba(255,255,255,0.055)' },
  privacyIcon: { color: '#A996DF', fontSize: 17 },
  privacyText: { flex: 1, color: '#777E8F', fontSize: 9, lineHeight: 14 },
  errorText: { color: '#E2A7B2', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 15 },
  startButton: { width: '100%', height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 16, borderRadius: 17, backgroundColor: '#E7DFFF' },
  startButtonText: { color: '#171321', fontSize: 13, fontWeight: '900' },
  startArrow: { color: '#171321', fontSize: 20 },
  accuracyNotice: { color: '#5E6575', fontSize: 8, lineHeight: 13, textAlign: 'center', marginTop: 11 },
  trackingLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, paddingTop: 80 },
  horizonLine: { position: 'absolute', left: '8%', right: '8%', top: '50%', height: 1, backgroundColor: 'rgba(255,255,255,0.14)' },
  reticle: { position: 'absolute', width: 122, height: 122, marginLeft: -61, marginTop: -61, alignItems: 'center', justifyContent: 'center', borderRadius: 61, borderWidth: 2, borderColor: '#F0E8FF', backgroundColor: 'rgba(83,60,125,0.18)', shadowColor: '#D9C6FF', shadowOpacity: 0.9, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 14 },
  reticleAligned: { borderColor: '#7FE0B6', backgroundColor: 'rgba(54,135,101,0.18)' },
  selectedGlow: { position: 'absolute', width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(217,198,255,0.26)' },
  selectedGlowAligned: { backgroundColor: 'rgba(127,224,182,0.30)' },
  selectedRingInner: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: 'rgba(255,255,255,0.52)' },
  reticleCore: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#D9C6FF', shadowColor: '#FFFFFF', shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 12 },
  reticleCoreAligned: { backgroundColor: '#8DF0C5' },
  targetLabel: { position: 'absolute', top: 128, color: '#D7C9F5', fontSize: 7, fontWeight: '900', letterSpacing: 1.3, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 5 },
  targetLabelAligned: { color: '#8DF0C5' },
  reticleName: { position: 'absolute', top: 143, width: 210, color: '#FFFFFF', fontSize: 11, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 6 },
  guideArrowWrap: { position: 'absolute', top: '35%', left: '50%', width: 126, height: 126, marginLeft: -63, alignItems: 'center', justifyContent: 'center', borderRadius: 63, backgroundColor: 'rgba(7,9,17,0.58)', borderWidth: 1, borderColor: 'rgba(217,198,255,0.26)' },
  edgeTargetGlow: { position: 'absolute', width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(217,198,255,0.26)' },
  edgeTargetCore: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF', shadowColor: '#FFFFFF', shadowOpacity: 1, shadowRadius: 15, shadowOffset: { width: 0, height: 0 } },
  guideArrow: { position: 'absolute', color: '#E7DFFF', fontSize: 57, lineHeight: 63, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 7 },
  edgeTargetLabel: { position: 'absolute', top: 133, width: 160, color: '#E9DFFF', fontSize: 8, fontWeight: '900', letterSpacing: 1, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 5 },
  bottomPanel: { position: 'absolute', left: 14, right: 14, bottom: 0 },
  overlayNotice: { alignSelf: 'center', paddingHorizontal: 11, paddingVertical: 6, marginBottom: 7, borderRadius: 99, backgroundColor: 'rgba(8,11,18,0.76)' },
  overlayNoticeText: { color: '#E5DCF7', fontSize: 8, fontWeight: '800' },
  guidanceCard: { padding: 15, borderRadius: 19, backgroundColor: 'rgba(8,11,18,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  guidanceCardAligned: { borderColor: 'rgba(127,224,182,0.48)', backgroundColor: 'rgba(12,40,31,0.91)' },
  guidanceText: { color: '#F0ECF6', fontSize: 13, lineHeight: 19, fontWeight: '800', textAlign: 'center' },
  guidanceTextAligned: { color: '#A9F1D1' },
  metricsRow: { flexDirection: 'row', marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  metric: { flex: 1, alignItems: 'center', gap: 5 },
  metricLabel: { color: '#7D8493', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  metricValue: { color: '#DDD8E6', fontSize: 10, fontWeight: '800' },
  metricDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  calibrateButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(20,24,36,0.90)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  calibrateText: { color: '#D7D1E1', fontSize: 9, fontWeight: '800' },
  calibrationHint: { flex: 1, color: '#D4D1DA', fontSize: 8, lineHeight: 12, textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 4 },
  compassHint: { color: '#E1D9F4', fontSize: 8, lineHeight: 12, textAlign: 'center', marginTop: 7, textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 4 },
});
