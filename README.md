# SVIS.YV — шиномонтаж та зберігання шин

Копія сайту [svisyv.in.ua](https://svisyv.in.ua) з правками (актуальні ціни, договір зберігання, вакансії).

## Запуск

```bash
npm start
```

Сайт відкриється на http://localhost:3000. Залежності не потрібні, лише Node.js 18+.

Запити форми запису (вільні години, створення запису) сервер пересилає на робочий сайт `svisyv.in.ua`.

## Як змінювати контент

| Що | Файл з даними | Команда |
|---|---|---|
| Ціни | `tools/prices-data.js` | `npm run update:prices` |
| Вакансії | `tools/vacancies-data.js` | `npm run update:vacancies` |
| Договір зберігання (PDF + сторінка `/dogovir`) | `tools/dogovir-content.js` | `npm run build:dogovir` (потрібен Google Chrome) |

Скрипти беруть вихідні файли з папок `.prices-backup` / `.vacancies-backup`, тому їх можна запускати повторно — не видаляйте ці папки.

## Структура

- `svisyv.in.ua/` — файли сайту (сторінки, `_next/static` — скрипти та стилі, `docs/` — PDF договору)
- `server.js` — локальний сервер
- `tools/` — скрипти оновлення контенту
- `.httrack-backup/` — оригінальні файли до виправлення шляхів HTTrack
