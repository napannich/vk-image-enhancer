/**
 * Типы данных для системы улучшения изображений VK Image Enhancer
 */
/** Статусы задачи обработки */
export type TaskStatus = "pending" | "analyzing" | "processing" | "done" | "error" | "cancelled";
/** Параметры улучшения изображения */
export interface EnhancementParams {
    brightness: number;
    contrast: number;
    saturation: number;
    sharpness: number;
    gamma: number;
}
/** Задача обработки изображения */
export interface Task {
    id: string;
    status: TaskStatus;
    progress: number;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    error?: string;
    params?: EnhancementParams;
    resultDataUrl?: string;
}
/** Результат постановки задачи */
export interface SubmitResult {
    taskId: string;
}
/** Результат запроса статуса */
export interface StatusResult {
    status: TaskStatus;
    progress: number;
    error?: string;
}
/** Результат отмены задачи */
export interface CancelResult {
    success: boolean;
}
/** Событие изменения статуса задачи */
export interface TaskStatusEvent {
    taskId: string;
    status: TaskStatus;
    progress: number;
}
/** Входные данные для обработки (отправляются в Web Worker) */
export interface WorkerInput {
    taskId: string;
    imageData: ImageData;
    customParams?: Partial<EnhancementParams>;
}
/** Выходные данные из Web Worker */
export interface WorkerOutput {
    taskId: string;
    type: "progress" | "done" | "error";
    progress?: number;
    params?: EnhancementParams;
    imageData?: ImageData;
    error?: string;
}
/** Гистограмма канала изображения */
export interface ChannelHistogram {
    r: Float32Array;
    g: Float32Array;
    b: Float32Array;
    luminance: Float32Array;
    mean: [number, number, number];
    std: [number, number, number];
    percentile5: number;
    percentile95: number;
}
/** Поддерживаемые форматы ввода */
export type SupportedFormat = "image/jpeg" | "image/png" | "image/bmp" | "image/heic" | "image/heif";
/** Опции для метода submit */
export interface SubmitOptions {
    customParams?: Partial<EnhancementParams>;
    outputFormat?: "image/jpeg" | "image/png";
    outputQuality?: number;
}
