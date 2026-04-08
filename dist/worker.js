/**
 * Web Worker для асинхронной обработки изображений.
 * Запускается в отдельном потоке — не блокирует UI.
 * Принимает ImageData, выполняет ML-анализ + применение улучшений,
 * отправляет прогресс и результат в главный поток.
 */
import { computeHistogram, applyEnhancements, imageDataToBlob } from "./canvas-utils.js";
import { predictEnhancements, mergeWithUserParams } from "./model.js";
// ---------------------------------------------------------------------------
// Обработчик сообщений от главного потока
// ---------------------------------------------------------------------------
self.onmessage = async (event) => {
    const { taskId, imageData, customParams } = event.data;
    try {
        await processImage(taskId, imageData, customParams);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const output = {
            taskId,
            type: "error",
            error: message,
        };
        self.postMessage(output);
    }
};
// ---------------------------------------------------------------------------
// Основной пайплайн обработки
// ---------------------------------------------------------------------------
async function processImage(taskId, imageData, customParams) {
    // --- Этап 1: Анализ гистограммы (0–30%) ---
    sendProgress(taskId, 5);
    // Небольшая пауза — даём браузеру отрисовать прогресс
    await yieldToEventLoop();
    const histogram = computeHistogram(imageData);
    sendProgress(taskId, 20);
    await yieldToEventLoop();
    // --- Этап 2: ML-предсказание параметров (30–50%) ---
    const mlParams = predictEnhancements(histogram);
    const finalParams = customParams
        ? mergeWithUserParams(mlParams, customParams)
        : mlParams;
    sendProgress(taskId, 40);
    await yieldToEventLoop();
    // Сообщаем главному потоку какие параметры будут применены
    const paramsOutput = {
        taskId,
        type: "progress",
        progress: 45,
        params: finalParams,
    };
    self.postMessage(paramsOutput);
    await yieldToEventLoop();
    // --- Этап 3: Применение улучшений (50–85%) ---
    sendProgress(taskId, 55);
    await yieldToEventLoop();
    const enhanced = applyEnhancements(imageData, finalParams.brightness, finalParams.contrast, finalParams.saturation, finalParams.gamma, finalParams.levelLow ?? 0, finalParams.levelHigh ?? 1);
    sendProgress(taskId, 75);
    await yieldToEventLoop();
    // Применяем шарпинг если нужен
    let result = enhanced;
    if (finalParams.sharpness > 0.05) {
        result = applyUnsharpMask(enhanced, finalParams.sharpness);
    }
    sendProgress(taskId, 85);
    await yieldToEventLoop();
    // --- Этап 4: Кодирование в JPEG/PNG (85–100%) ---
    const blob = await imageDataToBlob(result, "image/jpeg", 0.92);
    const arrayBuffer = await blob.arrayBuffer();
    sendProgress(taskId, 98);
    await yieldToEventLoop();
    // Передаём результат через Transferable для zero-copy
    const output = {
        taskId,
        type: "done",
        progress: 100,
        params: finalParams,
        imageData: result,
    };
    // Передаём ArrayBuffer как transferable для скорости
    self.postMessage(output, [result.data.buffer]);
}
// ---------------------------------------------------------------------------
// Unsharp Mask — классический алгоритм повышения резкости
// ---------------------------------------------------------------------------
/**
 * Применяет Unsharp Mask: размываем → вычитаем из оригинала → усиливаем края.
 * Используется 3×3 свёрточное ядро Гаусса для производительности.
 */
function applyUnsharpMask(imageData, strength) {
    const { data, width, height } = imageData;
    const out = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = out.data;
    // 3×3 ядро Гаусса (нормализованное)
    const kernel = [
        1 / 16, 2 / 16, 1 / 16,
        2 / 16, 4 / 16, 2 / 16,
        1 / 16, 2 / 16, 1 / 16,
    ];
    const amount = strength * 0.7; // коэффициент усиления
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            // Свёртка с ядром Гаусса для каждого канала
            let blurR = 0, blurG = 0, blurB = 0;
            let k = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const ni = ((y + dy) * width + (x + dx)) * 4;
                    blurR += data[ni] * kernel[k];
                    blurG += data[ni + 1] * kernel[k];
                    blurB += data[ni + 2] * kernel[k];
                    k++;
                }
            }
            // Unsharp: original + amount * (original - blurred)
            outData[idx] = clamp(data[idx] + amount * (data[idx] - blurR));
            outData[idx + 1] = clamp(data[idx + 1] + amount * (data[idx + 1] - blurG));
            outData[idx + 2] = clamp(data[idx + 2] + amount * (data[idx + 2] - blurB));
            // alpha без изменений
        }
    }
    return out;
}
// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------
function clamp(v) {
    return Math.max(0, Math.min(255, Math.round(v)));
}
/** Отправляет сообщение о прогрессе в главный поток */
function sendProgress(taskId, progress) {
    const output = { taskId, type: "progress", progress };
    self.postMessage(output);
}
/**
 * Отдаёт управление event loop — позволяет browser обработать cancel-сигналы
 * и отрисовать UI между тяжёлыми вычислениями.
 */
function yieldToEventLoop() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
//# sourceMappingURL=worker.js.map