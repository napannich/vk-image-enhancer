/**
 * Утилиты для работы с Canvas API: загрузка, конвертация форматов, сохранение
 */

import type { ChannelHistogram, SupportedFormat } from "./types.js";

/** Максимальный размер изображения в пикселях (15 Мпикс) */
const MAX_PIXELS = 15_000_000;

/** Загружает File/Blob в ImageData через OffscreenCanvas или обычный Canvas */
export async function loadImageFromFile(file: File): Promise<ImageData> {
  const format = file.type as SupportedFormat;

  // HEIC/HEIF требует предварительной конвертации через нативный декодер браузера
  if (format === "image/heic" || format === "image/heif") {
    return loadHeicImage(file);
  }

  return loadStandardImage(file);
}

/** Загружает стандартные форматы (JPEG, PNG, BMP) */
async function loadStandardImage(file: File): Promise<ImageData> {
  const url = URL.createObjectURL(file);
  try {
    return await decodeImageUrl(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Загружает HEIC через createImageBitmap (поддерживается в Chrome 94+, Safari) */
async function loadHeicImage(file: File): Promise<ImageData> {
  // Пробуем нативный createImageBitmap
  try {
    const bitmap = await createImageBitmap(file);
    return bitmapToImageData(bitmap);
  } catch {
    // Фолбэк: перекодирование через URL
    const url = URL.createObjectURL(file);
    try {
      return await decodeImageUrl(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Декодирует изображение по URL в ImageData */
async function decodeImageUrl(url: string): Promise<ImageData> {
  // Предпочитаем createImageBitmap — быстрее и не требует DOM
  if (typeof createImageBitmap !== "undefined") {
    const response = await fetch(url);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    return bitmapToImageData(bitmap);
  }

  // Фолбэк для браузеров без createImageBitmap
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    img.onerror = () => reject(new Error("Не удалось загрузить изображение"));
    img.src = url;
  });
}

/** Конвертирует ImageBitmap в ImageData через OffscreenCanvas */
function bitmapToImageData(bitmap: ImageBitmap): ImageData {
  const { width, height } = bitmap;
  const pixels = width * height;

  if (pixels > MAX_PIXELS) {
    // Масштабируем до допустимого размера с сохранением пропорций
    const scale = Math.sqrt(MAX_PIXELS / pixels);
    const newW = Math.floor(width * scale);
    const newH = Math.floor(height * scale);

    const canvas = new OffscreenCanvas(newW, newH);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, newW, newH);
    bitmap.close();
    return ctx.getImageData(0, 0, newW, newH);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, width, height);
}

/** Вычисляет гистограмму по каналам для ImageData */
export function computeHistogram(imageData: ImageData): ChannelHistogram {
  const { data, width, height } = imageData;
  const len = width * height;

  const r = new Float32Array(256);
  const g = new Float32Array(256);
  const b = new Float32Array(256);
  const luminance = new Float32Array(256);

  let sumR = 0, sumG = 0, sumB = 0;
  let sumR2 = 0, sumG2 = 0, sumB2 = 0;

  for (let i = 0; i < len; i++) {
    const ri = data[i * 4];
    const gi = data[i * 4 + 1];
    const bi = data[i * 4 + 2];
    // Яркость по формуле BT.601
    const lum = Math.round(0.299 * ri + 0.587 * gi + 0.114 * bi);

    r[ri]++;
    g[gi]++;
    b[bi]++;
    luminance[lum]++;

    sumR += ri; sumG += gi; sumB += bi;
    sumR2 += ri * ri; sumG2 += gi * gi; sumB2 += bi * bi;
  }

  // Нормализуем гистограммы
  for (let i = 0; i < 256; i++) {
    r[i] /= len;
    g[i] /= len;
    b[i] /= len;
    luminance[i] /= len;
  }

  const meanR = sumR / len / 255;
  const meanG = sumG / len / 255;
  const meanB = sumB / len / 255;

  const stdR = Math.sqrt(sumR2 / len / (255 * 255) - meanR * meanR);
  const stdG = Math.sqrt(sumG2 / len / (255 * 255) - meanG * meanG);
  const stdB = Math.sqrt(sumB2 / len / (255 * 255) - meanB * meanB);

  // Перцентили по яркости
  const { p5, p95 } = computePercentiles(luminance);

  return {
    r, g, b, luminance,
    mean: [meanR, meanG, meanB],
    std: [stdR, stdG, stdB],
    percentile5: p5,
    percentile95: p95,
  };
}

/** Вычисляет 5-й и 95-й перцентили из нормализованной гистограммы */
function computePercentiles(hist: Float32Array): { p5: number; p95: number } {
  let cumsum = 0;
  let p5 = 0;
  let p95 = 255;

  for (let i = 0; i < 256; i++) {
    cumsum += hist[i];
    if (cumsum >= 0.05 && p5 === 0) p5 = i;
    if (cumsum >= 0.95) { p95 = i; break; }
  }

  return { p5: p5 / 255, p95: p95 / 255 };
}

/**
 * Применяет параметры улучшения к ImageData.
 * Все операции выполняются in-place через LUT (lookup table) для скорости.
 */
export function applyEnhancements(
  imageData: ImageData,
  brightness: number,
  contrast: number,
  saturation: number,
  gamma: number,
): ImageData {
  const { data, width, height } = imageData;
  const out = new ImageData(new Uint8ClampedArray(data), width, height);
  const outData = out.data;
  const len = width * height;

  // Предварительно строим LUT для яркости/контраста/гаммы (только для luma)
  const lut = buildLUT(brightness, contrast, gamma);

  for (let i = 0; i < len; i++) {
    const idx = i * 4;
    let r = outData[idx];
    let g = outData[idx + 1];
    let bl = outData[idx + 2];

    // Применяем насыщенность через HSL
    if (saturation !== 0) {
      [r, g, bl] = applySaturation(r, g, bl, saturation);
    }

    // Применяем LUT (яркость + контраст + гамма)
    outData[idx] = lut[r];
    outData[idx + 1] = lut[g];
    outData[idx + 2] = lut[bl];
    // alpha без изменений
  }

  return out;
}

/** Строит таблицу соответствия (LUT) 256 значений для brightness/contrast/gamma */
function buildLUT(brightness: number, contrast: number, gamma: number): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  const contrastFactor = (259 * (contrast * 127 + 128)) / (128 * (259 - contrast * 127));

  for (let i = 0; i < 256; i++) {
    let v = i / 255;

    // Яркость (аддитивно)
    v = v + brightness;

    // Контраст (относительно средней точки 0.5)
    v = contrastFactor * (v - 0.5) + 0.5;

    // Гамма-коррекция
    if (gamma !== 1.0 && v > 0) {
      v = Math.pow(v, 1.0 / gamma);
    }

    lut[i] = Math.round(Math.min(1, Math.max(0, v)) * 255);
  }

  return lut;
}

/** Применяет насыщенность к пикселю RGB через преобразование в HSL */
function applySaturation(r: number, g: number, b: number, saturation: number): [number, number, number] {
  // RGB -> HSL
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return [r, g, b]; // оттенок серого — насыщенность неприменима

  const d = max - min;
  let s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  s = Math.min(1, Math.max(0, s + saturation));

  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;

  // HSL -> RGB
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return [
    Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, h) * 255),
    Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  ];
}

function hueToRgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/** Конвертирует ImageData в data URL заданного формата */
export function imageDataToDataUrl(
  imageData: ImageData,
  format: "image/jpeg" | "image/png" = "image/jpeg",
  quality = 0.92,
): string {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(imageData, 0, 0);

  // OffscreenCanvas не поддерживает toDataURL — конвертируем через Blob
  // Этот путь используется только в main thread; в worker — через transferable
  const regularCanvas = document.createElement("canvas");
  regularCanvas.width = imageData.width;
  regularCanvas.height = imageData.height;
  const rCtx = regularCanvas.getContext("2d")!;
  rCtx.putImageData(imageData, 0, 0);
  return regularCanvas.toDataURL(format, quality);
}

/** Конвертирует ImageData в Blob (для Web Worker через OffscreenCanvas) */
export async function imageDataToBlob(
  imageData: ImageData,
  format: "image/jpeg" | "image/png" = "image/jpeg",
  quality = 0.92,
): Promise<Blob> {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(imageData, 0, 0);
  return canvas.convertToBlob({ type: format, quality });
}
