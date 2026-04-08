/**
 * Утилиты для работы с Canvas API: загрузка, конвертация форматов, сохранение
 */
import type { ChannelHistogram } from "./types.js";
/** Загружает File/Blob в ImageData через OffscreenCanvas или обычный Canvas */
export declare function loadImageFromFile(file: File): Promise<ImageData>;
/** Вычисляет гистограмму по каналам для ImageData */
export declare function computeHistogram(imageData: ImageData): ChannelHistogram;
/**
 * Применяет параметры улучшения к ImageData.
 * Все операции выполняются in-place через LUT (lookup table) для скорости.
 */
export declare function applyEnhancements(imageData: ImageData, brightness: number, contrast: number, saturation: number, gamma: number, levelLow?: number, levelHigh?: number): ImageData;
/** Конвертирует ImageData в data URL заданного формата (только main thread) */
export declare function imageDataToDataUrl(imageData: ImageData, format?: "image/jpeg" | "image/png", quality?: number): string;
/** Конвертирует ImageData в Blob (для Web Worker через OffscreenCanvas) */
export declare function imageDataToBlob(imageData: ImageData, format?: "image/jpeg" | "image/png", quality?: number): Promise<Blob>;
