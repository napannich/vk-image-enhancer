/**
 * ImageAnalyzer — чистые функции анализа гистограммы и предсказания
 * параметров улучшения (яркость, контрастность, насыщенность, гамма, резкость).
 *
 * Это референсная реализация, идентичная той, что встроена в Web Worker
 * внутри index.html. Вынесено в отдельный модуль для юнит-тестов.
 *
 * Соответствие ТЗ VK Education Practice:
 *   «ИИ подбирает оптимальные параметры коррекции яркости, контрастности
 *   и цветности. Вспомогательный алгоритм применяет эти параметры».
 */

export interface HistogramFeatures {
  avgBrightness: number;  // [0..255]
  avgSaturation: number;  // [0..255]
  avgContrast: number;    // p98 − p2
  p2: number;
  p98: number;
}

export interface EnhancementParams {
  brightness: number;  // [-1..1]
  contrast: number;    // [-1..1]
  saturation: number;  // [-1..1]
  gamma: number;       // [0.5..2.0]
  sharpness: number;   // [0..1]
  levelLow: number;    // [0..255]
  levelHigh: number;   // [0..255]
}

/**
 * Анализ гистограммы: вычисляет avg brightness/saturation/contrast и
 * перцентили p2/p98 для auto-levels.
 */
export function analyzeHistogram(imageData: ImageData): HistogramFeatures {
  const data = imageData.data;
  const len = data.length;
  const hist = new Uint32Array(256);
  let sumBright = 0;
  let sumSat = 0;
  let count = 0;

  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const bright = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    hist[bright]++;
    sumBright += bright;

    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const l = (mx + mn) / 2;
    const sat = mx === mn ? 0 : (mx - mn) / (1 - Math.abs((2 * l) / 255 - 1));
    sumSat += Math.min(255, sat * 255);
    count++;
  }

  let cumsum = 0;
  let p2 = 0;
  let p98 = 255;
  for (let i = 0; i < 256; i++) {
    cumsum += hist[i];
    if (p2 === 0 && cumsum / count >= 0.02) p2 = i;
    if (cumsum / count >= 0.98) {
      p98 = i;
      break;
    }
  }
  if (p98 - p2 < 20) {
    p2 = 0;
    p98 = 255;
  }

  return {
    avgBrightness: count > 0 ? sumBright / count : 128,
    avgSaturation: count > 0 ? sumSat / count : 128,
    avgContrast: p98 - p2,
    p2,
    p98,
  };
}

/**
 * Предсказывает параметры улучшения по фичам гистограммы.
 * Простой регрессор на основе перцентилей и средних значений.
 */
export function predictParams(features: HistogramFeatures): EnhancementParams {
  const satNorm = features.avgSaturation / 255;
  let saturation = 0;
  if (satNorm < 0.15) saturation = 0.35;
  else if (satNorm < 0.25) saturation = 0.2;
  else if (satNorm < 0.35) saturation = 0.1;

  return {
    brightness: 0,
    contrast: 0,
    saturation,
    gamma: 1.0,
    sharpness: 0.3,
    levelLow: features.p2,
    levelHigh: features.p98,
  };
}

/**
 * Ограничивает параметры безопасным диапазоном — защита от бредовых значений
 * из ручной коррекции/кастомного API.
 */
export function clampParams(p: Partial<EnhancementParams>): EnhancementParams {
  const clamp = (v: number, lo: number, hi: number): number =>
    Math.max(lo, Math.min(hi, v));
  return {
    brightness: clamp(p.brightness ?? 0, -1, 1),
    contrast: clamp(p.contrast ?? 0, -1, 1),
    saturation: clamp(p.saturation ?? 0, -1, 1),
    gamma: clamp(p.gamma ?? 1.0, 0.5, 2.0),
    sharpness: clamp(p.sharpness ?? 0, 0, 1),
    levelLow: clamp(p.levelLow ?? 0, 0, 255),
    levelHigh: clamp(p.levelHigh ?? 255, 0, 255),
  };
}

/**
 * Ядро Lanczos3 — для unit-теста фильтра апскейла.
 */
export function lanczos3Kernel(x: number): number {
  if (x === 0) return 1.0;
  if (Math.abs(x) >= 3) return 0.0;
  const px = Math.PI * x;
  return (3.0 * Math.sin(px) * Math.sin(px / 3.0)) / (px * px);
}
