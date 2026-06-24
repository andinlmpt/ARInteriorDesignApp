import { Platform } from 'react-native';
import * as Device from 'expo-device';

export type PerformanceTier = 'low' | 'medium' | 'high';

export interface CameraPerformanceProfile {
  tier: PerformanceTier;
  label: string;
  captureQuality: number;
  skipProcessing: boolean;
  frameIntervalMs: number;
}

export const DEFAULT_CAMERA_PROFILE: CameraPerformanceProfile = {
  tier: 'medium',
  label: 'Balanced',
  captureQuality: 0.5,
  skipProcessing: true,
  frameIntervalMs: 2000,
};

const bytesToGigabytes = (bytes?: number | null): number | undefined => {
  if (!bytes || bytes <= 0) {
    return undefined;
  }
  return bytes / (1024 * 1024 * 1024);
};

const inferTier = (
  yearClass?: number | null,
  memoryGb?: number,
  modelName?: string | null,
): PerformanceTier => {
  const normalizedYear = yearClass ?? 2019;
  const effectiveMemory = memoryGb ?? 4;
  const hasLidar =
    Platform.OS === 'ios' &&
    typeof modelName === 'string' &&
    /pro/i.test(modelName);

  if (normalizedYear >= 2021 && effectiveMemory >= 6) {
    return 'high';
  }

  if (hasLidar || effectiveMemory >= 7) {
    return 'high';
  }

  if (normalizedYear <= 2017 || effectiveMemory <= 3) {
    return 'low';
  }

  return 'medium';
};

const profileByTier: Record<PerformanceTier, CameraPerformanceProfile> = {
  high: {
    tier: 'high',
    label: 'High fidelity',
    captureQuality: 0.7,
    skipProcessing: false,
    frameIntervalMs: 1600,
  },
  medium: DEFAULT_CAMERA_PROFILE,
  low: {
    tier: 'low',
    label: 'Battery saver',
    captureQuality: 0.4,
    skipProcessing: true,
    frameIntervalMs: 2600,
  },
};

export async function resolveCameraProfile(): Promise<CameraPerformanceProfile> {
  try {
    const deviceType = await Device.getDeviceTypeAsync();
    const yearClass = Device.deviceYearClass;
    const memoryGb = bytesToGigabytes(Device.totalMemory);
    const inferredTier = inferTier(yearClass, memoryGb, Device.modelName);
    let profile = profileByTier[inferredTier] ?? DEFAULT_CAMERA_PROFILE;

    // Tablets typically have more headroom; bump medium tablets to high
    if (
      profile.tier === 'medium' &&
      deviceType === Device.DeviceType.TABLET &&
      (memoryGb ?? 0) >= 5
    ) {
      profile = profileByTier.high;
    }

    return profile;
  } catch (error) {
    console.warn('[device] Failed to resolve camera profile, using default', error);
    return DEFAULT_CAMERA_PROFILE;
  }
}

