# VK Image Enhancer

> ML-модель для улучшения изображений в браузере — проект VK Education Practice 2026

## Описание

Веб-приложение для автоматического улучшения качества изображений (яркость, контрастность, насыщенность, гамма, резкость) с использованием ML-модели, работающей **полностью в браузере пользователя**. Сервер не требуется.

**Демо:** [https://napannich.github.io/vk-image-enhancer](https://napannich.github.io/vk-image-enhancer)

## Соответствие ТЗ

| Параметр | Требование | Реализация |
|---|---|---|
| Работа в массовых браузерах | Chrome / Firefox / Safari / Edge | Да (HEIC — Chrome 94+/Safari) |
| Объём кода | ≤ 10 МБ | ~5 МБ (модель 4.6 МБ + код) |
| Разрешение входа | до 15 Мпикс | Да, авто-даунскейл при превышении |
| Макс. время обработки | ≤ 30 с | Жёсткий timeout, auto-cancel |
| Среднее время | ~5 с | ~3–7 с (Apple M1 / Intel i5) |
| Форматы | JPG, PNG, HEIC, BMP | Все четыре |
| Async (без блокировки UI) | обязательно | Web Worker + Transferable |

## Архитектура

```
index.html              — UI + TaskManager + Web Worker (inline)
src/
├── types.ts            — типы TypeScript
├── canvas-utils.ts     — утилиты Canvas API, загрузка форматов
├── model.ts            — интерфейс к ML-модели
├── worker.ts           — Web Worker (альтернативная сборка)
└── enhancer.ts         — TaskManager (типизированная версия)
models/
└── realesrgan-x4.onnx  — Real-ESRGAN x4 (4.6 МБ, ONNX)
```

**ML-стек:**
- **Real-ESRGAN x4** (ONNX) — super-resolution модель, запускается в браузере
- **ONNX Runtime Web (WASM)** — inference-движок, загружается с CDN при первом использовании
- **Fallback:** если ONNX недоступен → алгоритмическое улучшение (auto-levels по p5/p95, Unsharp Mask, Lanczos2 апскейл)

## Публичный API

```javascript
// Постановка задачи
const { taskId } = await window.enhancer.submitTask(file, {
  outputFormat: 'image/jpeg',   // или 'image/png'
  outputQuality: 0.92,          // для JPEG
});

// Получение статуса
const { status, progress } = window.enhancer.getStatus(taskId);
// status: 'queued' | 'analyzing' | 'processing' | 'done' | 'error' | 'cancelled'
// progress: 0..100

// Прерывание задачи
const { success } = window.enhancer.cancelTask(taskId);

// Получение результата
const { blob, url } = window.enhancer.getResult(taskId);

// Подписка на событие изменения статуса
const unsubscribe = window.enhancer.on('statusChange', ({ taskId, status, progress, message }) => {
  console.log(`Task ${taskId}: ${status} ${progress}%`);
});
unsubscribe(); // отписка
```

### Соответствие API рекомендациям ТЗ

| Рекомендация ТЗ | Метод в API |
|---|---|
| Метод постановки задачи | `submitTask(file, options)` |
| Метод получения статуса | `getStatus(taskId)` |
| Метод прерывания задачи | `cancelTask(taskId)` |
| Метод получения готового изображения | `getResult(taskId)` |
| Событие изменения статуса | `on('statusChange', handler)` |

## Запуск локально

```bash
# Вариант 1: статический сервер (нужен для Web Worker из file://)
npx http-server . -p 3000 -o

# Вариант 2: сборка TypeScript (если правите src/)
npm install
npm run build
```

## Технические детали

- **Web Worker** создаётся из inline Blob URL — self-contained, работает с любого хостинга
- **Transferable Objects** (ArrayBuffer) для передачи ImageData между потоком UI и Worker без копирования
- **Tile-based processing** (128×128 + padding 8px) для Real-ESRGAN — чтобы не упираться в память при больших изображениях
- **Auto-downscale до 768 px** перед подачей в Real-ESRGAN: 4× апскейл возвращает картинку в целевой размер, сохраняя ~30 с бюджет
- **30 с timeout** на задачу: если обработка не укладывается — задача отменяется, worker пересоздаётся

## Стек

- TypeScript 5
- ONNX Runtime Web (WASM)
- Real-ESRGAN x4 (PyTorch → ONNX)
- Canvas API, Web Workers, OffscreenCanvas

## Автор

**Напалков Андрей** — Университет ИТМО, магистратура, VK Education Practice 2026

Руководитель практики: Фёдоров Д.А. (ИТМО)

## Лицензия

MIT
