# VK Image Enhancer

> ML-модель для улучшения изображений в браузере — проект VK Education Practice

## Описание

Веб-приложение для автоматического улучшения качества изображений (яркость, контрастность, цветность) с использованием ML-модели, работающей непосредственно в браузере пользователя.

**Демо:** [https://napannich.github.io/vk-image-enhancer](https://napannich.github.io/vk-image-enhancer)

## Возможности

- Автоматическое улучшение изображений через ML-модель
- Обработка до 15 Мпикс за ~5 секунд
- Работает в браузере (client-side, без сервера)
- Адаптивный интерфейс
- Асинхронная обработка через Web Workers
- Before/After сравнение

## Стек

- **TensorFlow.js** — ML inference в браузере
- **Web Workers** — асинхронная обработка без блокировки UI
- **Canvas API** — манипуляция изображениями
- **TypeScript** — типизация

## Архитектура

```
index.html          — UI: drag&drop, before/after, прогресс-бар
src/
├── types.ts        — TypeScript типы и интерфейсы
├── canvas-utils.ts — утилиты Canvas API (загрузка, сохранение, форматы)
├── model.ts        — TensorFlow.js модель для enhancement
├── worker.ts       — Web Worker для async обработки
└── enhancer.ts     — основной API модуль (TaskManager)
```

## API

```typescript
// Постановка задачи
const taskId = await enhancer.processImage(imageFile);

// Получение статуса
const status = enhancer.getTaskStatus(taskId);
// → { status: 'processing', progress: 0.45 }

// Прерывание задачи
enhancer.cancelTask(taskId);

// Получение результата
const resultBlob = enhancer.getTaskResult(taskId);

// Событие изменения статуса
enhancer.on('statusChange', ({ taskId, status, progress }) => {
  console.log(`Task ${taskId}: ${status} (${progress * 100}%)`);
});
```

## Требования (из ТЗ)

| Параметр | Значение |
|----------|----------|
| Объём кода | ≤ 10 МБ |
| Макс. разрешение | 15 Мпикс |
| Среднее время обработки | ≤ 5 с |
| Макс. время обработки | ≤ 30 с |
| Форматы | JPG, PNG, HEIC, BMP |
| Браузеры | Chrome, Firefox, Safari, Edge |

## Запуск

```bash
# Открыть index.html в браузере
# Или через локальный сервер:
npx http-server . -p 3000 -o
```

## Автор

**Напалков Андрей** — ИТМО, VK Education Practice 2026

## Лицензия

MIT
