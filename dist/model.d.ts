/**
 * Эвристический алгоритм предсказания оптимальных параметров улучшения изображения.
 * Использует статистики гистограммы (auto-levels, saturation) без весов нейросети.
 */
import type { ChannelHistogram, EnhancementParams } from "./types.js";
/**
 * Предсказывает оптимальные параметры улучшения по гистограмме изображения.
 * Возвращает параметры, готовые к передаче в applyEnhancements().
 */
export declare function predictEnhancements(hist: ChannelHistogram): EnhancementParams;
/**
 * Смешивает предсказание с пользовательскими параметрами.
 * Пользовательские значения полностью переопределяют алгоритм там, где заданы.
 */
export declare function mergeWithUserParams(ml: EnhancementParams, user: Partial<EnhancementParams>): EnhancementParams;
