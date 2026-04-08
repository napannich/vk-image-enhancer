/**
 * ML-модель для предсказания оптимальных параметров улучшения изображения.
 * Использует лёгкую нейросеть (без TF.js) с весами, обученными на датасете
 * фото с Flickr/RAISE. Вес модели: ~8KB (полностью inline).
 *
 * Архитектура: MLP 13→32→16→5
 * Входы: статистики гистограммы (mean R/G/B, std R/G/B, p5, p95, skew, entropy×4)
 * Выходы: [brightness, contrast, saturation, gamma, sharpness]
 */
import type { ChannelHistogram, EnhancementParams } from "./types.js";
/**
 * Предсказывает оптимальные параметры улучшения по гистограмме изображения.
 * Возвращает параметры, готовые к передаче в applyEnhancements().
 */
export declare function predictEnhancements(hist: ChannelHistogram): EnhancementParams;
/**
 * Смешивает ML-предсказание с пользовательскими параметрами.
 * Пользовательские значения полностью переопределяют ML там, где заданы.
 */
export declare function mergeWithUserParams(ml: EnhancementParams, user: Partial<EnhancementParams>): EnhancementParams;
