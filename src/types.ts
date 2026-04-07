/**
 * Типы данных для системы улучшения изображений VK Image Enhancer
 */

/** Статусы задачи обработки */
export type TaskStatus =
  | "pending"    // задача создана, ожидает обработки
  | "analyzing"  // анализ гистограммы и ML-предсказание
  | "processing" // применение улучшений
  | "done"       // обработка завершена
  | "error"      // ошибка обработки
  | "cancelled"; // задача отменена

/** Параметры улучшения изображения */
export interface EnhancementParams {
  brightness: number;   // -1.0 .. +1.0 (0 = без изменений)
  contrast: number;     // -1.0 .. +1.0 (0 = без изменений)
  saturation: number;   // -1.0 .. +1.0 (0 = без изменений)
  sharpness: number;    // 0.0 .. 1.0
  gamma: number;        // 0.5 .. 2.0 (1.0 = без изменений)
}

/** Задача обработки изображения */
export interface Task {
  id: string;
  status: TaskStatus;
  progress: number;       // 0..100
  createdAt: number;      // timestamp
  startedAt?: number;
  completedAt?: number;
  error?: string;
  params?: EnhancementParams;
  resultDataUrl?: string; // результирующее изображение в base64
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
  customParams?: Partial<EnhancementParams>; // пользовательские переопределения
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
  r: Float32Array; // 256 значений
  g: Float32Array;
  b: Float32Array;
  luminance: Float32Array;
  mean: [number, number, number];    // средние R, G, B
  std: [number, number, number];     // стандартные отклонения
  percentile5: number;               // 5-й перцентиль яркости
  percentile95: number;              // 95-й перцентиль яркости
}

/** Поддерживаемые форматы ввода */
export type SupportedFormat = "image/jpeg" | "image/png" | "image/bmp" | "image/heic" | "image/heif";

/** Опции для метода submit */
export interface SubmitOptions {
  customParams?: Partial<EnhancementParams>;
  outputFormat?: "image/jpeg" | "image/png";
  outputQuality?: number; // 0..1, для JPEG
}
