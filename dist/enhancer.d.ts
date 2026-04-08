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
import type { Task, SubmitResult, StatusResult, CancelResult, SubmitOptions, EnhancementParams } from "./types.js";
export declare class TaskManager extends EventTarget {
    private readonly tasks;
    private readonly workers;
    /** Путь к скомпилированному воркеру */
    private readonly workerUrl;
    constructor(workerUrl?: string);
    /**
     * Метод постановки задачи.
     * Принимает File с изображением, возвращает { taskId }.
     */
    submit(file: File, options?: SubmitOptions): Promise<SubmitResult>;
    /**
     * Метод получения статуса задачи.
     * taskId → { status, progress }
     */
    getStatus(taskId: string): StatusResult;
    /**
     * Метод прерывания задачи.
     * taskId → { success }
     */
    cancel(taskId: string): Promise<CancelResult>;
    /**
     * Метод получения готового изображения.
     * taskId → data URL строка или null если не готово.
     */
    getResult(taskId: string): string | null;
    /**
     * Возвращает предсказанные ML-параметры улучшения для задачи.
     * Доступны после завершения этапа анализа (progress >= 45).
     */
    getParams(taskId: string): EnhancementParams | null;
    /** Удаляет задачу и освобождает память */
    dispose(taskId: string): void;
    /** Возвращает список всех задач */
    getAllTasks(): Task[];
    /** Создаёт Web Worker и подписывается на его сообщения */
    private spawnWorker;
    /** Обрабатывает входящее сообщение от Web Worker */
    private handleWorkerMessage;
    /** Обновляет задачу и испускает событие изменения статуса */
    private updateTask;
    /** Испускает CustomEvent с данными о смене статуса задачи */
    private emitStatus;
}
export declare function getTaskManager(workerUrl?: string): TaskManager;
