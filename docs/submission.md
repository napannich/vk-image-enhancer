# Пакет для сдачи практики (15.04.2026)

## Куда сдаём

**Google Form (раздел 6. Проектно-технологическая практика):**
https://forms.gle/r72K4nDXnrvLdWju7

**Таблица со статусом:**
https://docs.google.com/spreadsheets/d/1fOA7vkcNxqDfcP3zTZVg5aX4Qg6ziFSBROKK-IujgzI/

**Руководитель практики:** Фёдоров Д.А. — `Dafedorov@itmo.ru`, TG `@dmitriy_a_fedorov`

## Что сдаём

| Артефакт | Файл / ссылка |
|---|---|
| Отчёт о практике | `docs/report.md` (экспортировать в PDF через Typora / Pandoc) |
| Презентация | `docs/presentation.md` (перенести в Google Slides / Keynote) |
| Отзыв куратора | `docs/curator_feedback.md` (подписать куратором VK Education) |
| Репозиторий проекта | https://github.com/napannich/vk-image-enhancer |
| Деплой проекта | https://napannich.github.io/vk-image-enhancer |

## Чек-лист перед отправкой формы

- [ ] В VK Education пройден курс «ML-модель для улучшения изображений» (Уч_П95-11, преподаватель Егор Глуховченко)
- [ ] На платформе VK Education загружено решение задания 1 (ссылка на репозиторий)
- [ ] Куратор VK Education выдал отзыв по драфту из `curator_feedback.md`
- [ ] Отчёт экспортирован в PDF
- [ ] Презентация загружена в Google Slides / Keynote, получена публичная ссылка
- [ ] Вся информация сохранена как PDF-архив локально

## Порядок действий на сегодня

1. Зайти на VK Education → пройти финальный урок, отправить решение (ссылка на GitHub-репо)
2. Написать куратору VK (Егор Глуховченко / представитель VK Education): «Прошу выдать отзыв по прохождению практики. Прикрепляю шаблон.» → приложить `curator_feedback.md`
3. Экспортировать `docs/report.md` в PDF: `pandoc docs/report.md -o docs/report.pdf --pdf-engine=xelatex` (или через Typora/Marked)
4. Перенести `docs/presentation.md` в Google Slides (12 слайдов по разделителям `---`)
5. Заполнить Google Form: https://forms.gle/r72K4nDXnrvLdWju7
   - ФИО, группа, ОП
   - Ссылка на репозиторий: https://github.com/napannich/vk-image-enhancer
   - Ссылка на деплой: https://napannich.github.io/vk-image-enhancer
   - Ссылка на отчёт (PDF в Google Drive)
   - Ссылка на презентацию (Google Slides)
   - Ссылка на отзыв куратора
6. Написать Фёдорову Д.А. в TG: «Отправил практику в форму. Сдача: проект `vk-image-enhancer`, ссылка на деплой и репозиторий в форме. Готов к защите/докладу.»
7. Проверить статус в таблице через 24 часа

## Если куратор не успевает выдать отзыв сегодня

- Написать Фёдорову Д.А. заранее, предупредить: отзыв придёт позднее
- Сдать всё остальное в срок
- Отзыв дозаливается в ту же форму позже
