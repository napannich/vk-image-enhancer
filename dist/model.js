/**
 * Эвристический алгоритм предсказания оптимальных параметров улучшения изображения.
 * Использует статистики гистограммы (auto-levels, saturation) без весов нейросети.
 */
/**
 * Предсказывает оптимальные параметры улучшения по гистограмме изображения.
 * Возвращает параметры, готовые к передаче в applyEnhancements().
 */
export function predictEnhancements(hist) {
    const levelLow = hist.percentile5;
    const levelHigh = hist.percentile95;
    const avgStd = (hist.std[0] + hist.std[1] + hist.std[2]) / 3;
    let saturation = 0;
    if (avgStd < 0.10) {
        saturation = 0.12;
    }
    else if (avgStd < 0.15) {
        saturation = 0.06;
    }
    return {
        brightness: 0,
        contrast: 0,
        gamma: 1.0,
        sharpness: 0.12,
        saturation,
        levelLow,
        levelHigh,
    };
}
/**
 * Смешивает предсказание с пользовательскими параметрами.
 * Пользовательские значения полностью переопределяют алгоритм там, где заданы.
 */
export function mergeWithUserParams(ml, user) {
    return {
        brightness: user.brightness ?? ml.brightness,
        contrast: user.contrast ?? ml.contrast,
        saturation: user.saturation ?? ml.saturation,
        gamma: user.gamma ?? ml.gamma,
        sharpness: user.sharpness ?? ml.sharpness,
        levelLow: user.levelLow ?? ml.levelLow,
        levelHigh: user.levelHigh ?? ml.levelHigh,
    };
}
//# sourceMappingURL=model.js.map