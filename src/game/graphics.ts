export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityPreset {
  id: QualityLevel;
  label: string;
  shortDesc: string;
  maxDprDesktop: number;
  maxDprTouch: number;
  resScale: number;
  minDrsScale: number;
  postProcess: boolean;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  exposure: number;
  shadows: boolean;
  softShadows: boolean;
  shadowSize: number;
  shadowRange: number;
  samples: number;
  far: number;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  low: {
    id: 'low',
    label: 'Baixo',
    shortDesc: 'Máx. FPS',
    maxDprDesktop: 1.0,
    maxDprTouch: 1.0,
    resScale: 0.85,
    minDrsScale: 0.72,
    postProcess: false,
    bloomStrength: 0,
    bloomRadius: 0,
    bloomThreshold: 1,
    exposure: 1.02,
    shadows: false,
    softShadows: false,
    shadowSize: 512,
    shadowRange: 64,
    samples: 0,
    far: 540,
  },
  medium: {
    id: 'medium',
    label: 'Médio',
    shortDesc: 'Equilibrado',
    maxDprDesktop: 1.4,
    maxDprTouch: 1.2,
    resScale: 1.0,
    minDrsScale: 0.8,
    postProcess: true,
    bloomStrength: 0.22,
    bloomRadius: 0.35,
    bloomThreshold: 0.92,
    exposure: 1.05,
    shadows: true,
    softShadows: false,
    shadowSize: 1024,
    shadowRange: 62,
    samples: 0,
    far: 720,
  },
  high: {
    id: 'high',
    label: 'Alto',
    shortDesc: 'Cinema',
    maxDprDesktop: 1.75,
    maxDprTouch: 1.4,
    resScale: 1.0,
    minDrsScale: 0.85,
    postProcess: true,
    bloomStrength: 0.4,
    bloomRadius: 0.55,
    bloomThreshold: 0.85,
    exposure: 1.08,
    shadows: true,
    softShadows: true,
    shadowSize: 2048,
    shadowRange: 54,
    samples: 4,
    far: 900,
  },
};

export const QUALITY_LIST: QualityPreset[] = [
  QUALITY_PRESETS.low,
  QUALITY_PRESETS.medium,
  QUALITY_PRESETS.high,
];

const QUALITY_KEY = 'chrono-clash-quality-v1';

export function isQualityLevel(v: unknown): v is QualityLevel {
  return v === 'low' || v === 'medium' || v === 'high';
}

export function detectDefaultQuality(touch: boolean): QualityLevel {
  try {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }) : undefined;
    const cores = nav?.hardwareConcurrency ?? 0;
    const mem = nav?.deviceMemory ?? 0;
    if (touch) {
      if ((cores > 0 && cores <= 4) || (mem > 0 && mem <= 3)) return 'low';
      return 'medium';
    }
    if ((cores > 0 && cores <= 2) || (mem > 0 && mem <= 2)) return 'low';
    if ((cores > 0 && cores <= 4) || (mem > 0 && mem <= 4)) return 'medium';
    if (cores >= 6 || mem >= 8) return 'high';
  } catch {
    /* ignore */
  }
  return touch ? 'low' : 'medium';
}

export function hasSavedQuality(): boolean {
  try {
    return isQualityLevel(localStorage.getItem(QUALITY_KEY));
  } catch {
    return false;
  }
}

export function loadQuality(touch: boolean): QualityLevel {
  try {
    const raw = localStorage.getItem(QUALITY_KEY);
    if (isQualityLevel(raw)) return raw;
  } catch {
    /* ignore */
  }
  return detectDefaultQuality(touch);
}

export function saveQuality(q: QualityLevel): void {
  try {
    localStorage.setItem(QUALITY_KEY, q);
  } catch {
    /* ignore */
  }
}
