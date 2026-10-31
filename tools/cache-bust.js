// Даёт изменённым JS-чанкам новые имена файлов (по хешу содержимого) и обновляет ссылки на них.
// Зачем: браузеры посетителей закэшировали оригинальные чанки svisyv.in.ua «навсегда» (immutable),
// и с теми же именами файлов продолжают показывать старые цены/вакансии.
// Запуск: node tools/cache-bust.js (вызывается автоматически из скриптов обновления).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SITE = path.join(__dirname, '..', 'svisyv.in.ua');
const CHUNKS = path.join(SITE, '_next', 'static', 'chunks');

// Чанки, которые мы меняли (оригинальные имена без расширения)
const KEYS = [
  '2034a6b4e8c4fb0d', // страница цен + форма записи
  '2242a4228a036b0e', // главная + форма записи
  '9de38ea6871c21d1', // DEFAULT_PRICES, меню
  '2c363c4f05538b98', // вакансии
  '7808ed02c4ccc83e', // контакты (кнопка «Оцінити в Google»)
  '5877ed32a2e45ff5', // исправления путей HTTrack
  'aee6c7720838f8a2',
  'turbopack-96eabc2a03d240d8',
];

const fileRe = (key) => new RegExp(key.replace(/[-]/g, '\\-') + '(?:\\.v[0-9a-f]{8})?\\.js', 'g');

// 1. новые имена
const map = {};
for (const key of KEYS) {
  const src = path.join(CHUNKS, key + '.js');
  if (!fs.existsSync(src)) { console.warn('нет файла', key); continue; }
  const buf = fs.readFileSync(src);
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
  map[key] = `${key}.v${hash}.js`;
}

// 2. ссылки в HTML и JS (кроме самих исходных чанков-ключей, которые остаются как «исходники» для скриптов)
function walk(d) { return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]); }
const targets = walk(SITE).filter((f) => f.endsWith('.html') || (f.startsWith(CHUNKS) && /\.js$/.test(f) && !/\.v[0-9a-f]{8}\.js$/.test(f)));
const rewrite = (text) => { for (const [key, name] of Object.entries(map)) text = text.replace(fileRe(key), name); return text; };

let changed = 0;
for (const f of targets) {
  if (f.startsWith(CHUNKS)) continue; // JS-исходники перепишем при копировании
  const c = fs.readFileSync(f, 'utf8');
  const out = rewrite(c);
  if (out !== c) { fs.writeFileSync(f, out); changed++; }
}

// 3. удаляем старые версии и пишем новые копии чанков (со ссылками на новые имена внутри)
for (const f of fs.readdirSync(CHUNKS)) if (/\.v[0-9a-f]{8}\.js$/.test(f)) fs.unlinkSync(path.join(CHUNKS, f));
for (const f of fs.readdirSync(CHUNKS)) {
  if (!f.endsWith('.js')) continue;
  const p = path.join(CHUNKS, f);
  const key = f.slice(0, -3);
  const c = fs.readFileSync(p, 'utf8');
  const out = rewrite(c);
  if (map[key]) fs.writeFileSync(path.join(CHUNKS, map[key]), out);
  else if (out !== c) fs.writeFileSync(p, out); // другие чанки, ссылающиеся на изменённые
}
console.log('cache-bust:', Object.values(map).join(', '), `| HTML обновлено: ${changed}`);
