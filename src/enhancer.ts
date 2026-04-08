/**
 * Основной API модуль VK Image Enhancer.
 * Реализует TaskManager с 4 методами и событийной моделью согласно ТЗ VK.
 *
 * API:
 *   submit(file, options?)   → Promise<SubmitResult>
 *   getStatus(taskId)        → StatusResult
 *   cancel(taskId)           → Promise<CancelResult>
 *   getResult(taskId)        → string | null  (data URL)
 *
 * Событие: addEventListener("taskStatusChanged", handler)
 */

import { loadImageFromFile, imageDataToDataUrl } from "./canvas-utils.js";
import type {
  Task,
  TaskStatus,
  TaskStatusEvent,
  SubmitResult,
  StatusResult,
  CancelResult,
  SubmitOptions,
  WorkerInput,
  WorkerOutput,
  EnhancementParams,
} from "./types.js";

// ---------------------------------------------------------------------------
// Внутренние структуры
// ---------------------------------------------------------------------------

/** Активная запись о воркере для задачи */
interface WorkerEntry {
  worker: Worker;
  taskId: string;
  cancelled: boolean;
}

// ---------------------------------------------------------------------------
// TaskManager
// ---------------------------------------------------------------------------

export class TaskManager extends EventTarget {
  private readonly tasks = new Map<string, Task>();
  private readonly workers = new Map<string, WorkerEntry>();

  /** Путь к скомпилированному воркеру */
  private readonly workerUrl: string;

  constructor(workerUrl = "./dist/worker.js") {
    super();
    this.workerUrl = workerUrl;
  }

  // -------------------------------------------------------------------------
  // Публичный API (4 обязательных метода по ТЗ)
  // -------------------------------------------------------------------------

  /**
   * Метод постановки задачи.
   * Принимает File с изображением, возвращает { taskId }.
   */
  async submit(file: File, options: SubmitOptions = {}): Promise<SubmitResult> {
    validateFile(file);

    const taskId = generateId();
    const task: Task = {
      id: taskId,
      status: "pending",
      progress: 0,
      createdAt: Date.now(),
    };
    this.tasks.set(taskId, task);
    this.emitStatus(taskId, "pending", 0);

    // Загружаем изображение в ImageData (декодирование)
    let imageData: ImageData;
    try {
      this.updateTask(taskId, { status: "analyzing", progress: 5 });
      imageData = await loadImageFromFile(file);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.updateTask(taskId, { status: "error", error: message });
      throw err;
    }

    // Запускаем Web Worker
    this.spawnWorker(taskId, imageData, options);

    return { taskId };
  }

  /**
   * Метод получения статуса задачи.
   * taskId → { status, progress }
   */
  getStatus(taskId: string): StatusResult {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { status: "error", progress: 0, error: "Задача не найдена" };
    }
    return {
      status: task.status,
      progress: task.progress,
      error: task.error,
    };
  }

  /**
   * Метод прерывания задачи.
   * taskId → { success }
   */
  async cancel(taskId: string): Promise<CancelResult> {
    const task = this.tasks.get(taskId);
    if (!task) return { success: false };

    const terminal: TaskStatus[] = ["done", "error", "cancelled"];
    if (terminal.includes(task.status)) return { success: false };

    // Помечаем как cancelled до завершения воркера
    const entry = this.workers.get(taskId);
    if (entry) {
      entry.cancelled = true;
      entry.worker.terminate();
      this.workers.delete(taskId);
    }

    this.updateTask(taskId, { status: "cancelled", progress: task.progress });
    return { success: true };
  }

  /**
   * Метод получения готового изображения.
   * taskId → data URL строка или null если не готово.
   */
  getResult(taskId: string): string | null {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== "done") return null;
    return task.resultDataUrl ?? null;
  }

  /**
   * Возвращает предсказанные ML-параметры улучшения для задачи.
   * Доступны после завершения этапа анализа (progress >= 45).
   */
  getParams(taskId: string): EnhancementParams | null {
    const task = this.tasks.get(taskId);
    if (!task || !task.params) return null;
    return task.params;
  }

  /** Удаляет задачу и освобождает память */
  dispose(taskId: string): void {
    this.cancel(taskId).catch(() => undefined);
    this.tasks.delete(taskId);
  }

  /** Возвращает список всех задач */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  // -------------------------------------------------------------------------
  // Внутренние методы
  // -------------------------------------------------------------------------

  /** Создаёт Web Worker и подписывается на его сообщения */
  private spawnWorker(
    taskId: string,
    imageData: ImageData,
    options: SubmitOptions,
  ): void {
    const worker = new Worker(this.workerUrl, { type: "module" });

    const entry: WorkerEntry = { worker, taskId, cancelled: false };
    this.workers.set(taskId, entry);

    worker.onmessage = (event: MessageEvent<WorkerOutput>) => {
      // Если успели отменить до получения сообщения — игнорируем
      if (entry.cancelled) return;
      this.handleWorkerMessage(entry, event.data, options);
    };

    worker.onerror = (event: ErrorEvent) => {
      if (entry.cancelled) return;
      this.updateTask(taskId, {
        status: "error",
        error: event.message || "Ошибка в Web Worker",
      });
      this.workers.delete(taskId);
    };

    // Отправляем задачу воркеру (ImageData передаётся как Transferable)
    const input: WorkerInput = {
      taskId,
      imageData,
      customParams: options.customParams,
    };

    worker.postMessage(input, [imageData.data.buffer]);
    this.updateTask(taskId, { status: "processing", progress: 10 });
  }

  /** Обрабатывает входящее сообщение от Web Worker */
  private handleWorkerMessage(
    entry: WorkerEntry,
    msg: WorkerOutput,
    options: SubmitOptions,
  ): void {
    const { taskId } = entry;

    if (msg.type === "progress") {
      const update: Partial<Task> = { progress: msg.progress ?? 0 };
      if (msg.params) update.params = msg.params;
      this.updateTask(taskId, update);
      return;
    }

    if (msg.type === "done" && msg.imageData) {
      // Конвертируем ImageData в data URL в главном потоке
      const fmt = options.outputFormat ?? "image/jpeg";
      const quality = options.outputQuality ?? 0.92;
      const dataUrl = imageDataToDataUrl(msg.imageData, fmt, quality);

      this.updateTask(taskId, {
        status: "done",
        progress: 100,
        completedAt: Date.now(),
        params: msg.params,
        resultDataUrl: dataUrl,
      });
      entry.worker.terminate();
      this.workers.delete(taskId);
      return;
    }

    if (msg.type === "error") {
      this.updateTask(taskId, {
        status: "error",
        error: msg.error ?? "Неизвестная ошибка",
      });
      entry.worker.terminate();
      this.workers.delete(taskId);
    }
  }

  /** Обновляет задачу и испускает событие изменения статуса */
  private updateTask(taskId: string, patch: Partial<Task>): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const prevStatus = task.status;
    Object.assign(task, patch);

    // Испускаем событие только при смене статуса или прогресса
    if (patch.status !== undefined || patch.progress !== undefined) {
      this.emitStatus(taskId, task.status, task.progress);
    }

    // Устанавливаем startedAt при первом переходе в processing
    if (prevStatus === "pending" && task.status === "processing") {
      task.startedAt = Date.now();
    }
  }

  /** Испускает CustomEvent с данными о смене статуса задачи */
  private emitStatus(taskId: string, status: TaskStatus, progress: number): void {
    const detail: TaskStatusEvent = { taskId, status, progress };
    this.dispatchEvent(new CustomEvent<TaskStatusEvent>("taskStatusChanged", { detail }));
  }
}

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

/** Генерирует уникальный ID задачи */
function generateId(): string {
  return `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Валидирует файл перед постановкой задачи */
function validateFile(file: File): void {
  const supported = [
    "image/jpeg", "image/png", "image/bmp",
    "image/heic", "image/heif",
    // HEIC иногда приходит без mime-type — проверяем расширение ниже
  ];

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const heicExts = ["heic", "heif"];

  if (!supported.includes(file.type) && !heicExts.includes(ext)) {
    throw new Error(
      `Неподдерживаемый формат: ${file.type || ext}. ` +
      "Поддерживаются: JPG, PNG, BMP, HEIC.",
    );
  }

  const MAX_SIZE_MB = 10;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`Файл слишком большой (максимум ${MAX_SIZE_MB} МБ).`);
  }
}

// ---------------------------------------------------------------------------
// Синглтон для использования в index.html без import
// ---------------------------------------------------------------------------

/** Глобальный экземпляр TaskManager (создаётся лениво) */
let _instance: TaskManager | null = null;

export function getTaskManager(workerUrl?: string): TaskManager {
  if (!_instance) {
    _instance = new TaskManager(workerUrl);
  }
  return _instance;
}
