// Применяет актуальный прайс (tools/prices-data.js) к скачанной копии сайта.
// Всегда работает от чистой копии в .prices-backup, поэтому скрипт можно запускать повторно.
const fs = require('fs');
const path = require('path');
const P = require('./prices-data');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'svisyv.in.ua');
const CHUNKS = path.join(SITE, '_next', 'static', 'chunks');
const BACKUP = path.join(ROOT, '.prices-backup');

const FILES = {
  pricesChunk: path.join(CHUNKS, '2034a6b4e8c4fb0d.js'),
  settingsChunk: path.join(CHUNKS, '9de38ea6871c21d1.js'),
  pricesPage: path.join(SITE, 'prices.html'),
  calcPages: ['index.html', 'prices.html', 'contact.html', 'mobile.html'].map((f) => path.join(SITE, f)),
};

function readClean(file) {
  const b = path.join(BACKUP, path.relative(ROOT, file));
  if (!fs.existsSync(b)) {
    fs.mkdirSync(path.dirname(b), { recursive: true });
    fs.copyFileSync(file, b);
  }
  return fs.readFileSync(b, 'utf8');
}
function mustReplace(src, from, to, label) {
  const out = typeof from === 'string' ? src.split(from).join(to) : src.replace(from, to);
  if (out === src) throw new Error('Не найдено место для замены: ' + label);
  return out;
}

/* ---------------- 1. JS: таблицы шиномонтажа на странице цен ---------------- */
{
  let js = readClean(FILES.pricesChunk);
  const ser = (rows) => '[' + rows.map((o) => '{' + Object.entries(o).map(([k, v]) => `${k}:${typeof v === 'string' ? JSON.stringify(v) : v}`).join(',') + '}').join(',') + ']';
  js = mustReplace(js, /let a=\[\{r:"13-14"[\s\S]*?\],l=\[[\s\S]*?\],n=\[[\s\S]*?\];function d\(\)\{/,
    `let a=${ser(P.cars)},l=${ser(P.suv)},n=${ser(P.bus)};function d(){`, 'mounting tables');
  fs.writeFileSync(FILES.pricesChunk, js);
  console.log('updated', path.basename(FILES.pricesChunk));
}

/* ---------------- 2. JS: DEFAULT_PRICES (калькулятор записи и т.д.) ---------------- */
{
  let js = readClean(FILES.settingsChunk);
  const mount = (rows) => Object.fromEntries(rows.map((r) => [`R${r.r}`, r.t]));
  const st = (i) => Object.fromEntries(P.storage.map((s) => [s.d, { 'Шини': s.tires[i], 'Гума з дисками': s.withDisks[i], 'Окремо диски': s.disks[i] }]));
  const prices = {
    mounting: { 'Легкові': mount(P.cars), 'Кросовери': mount(P.suv), 'Мікроавтобуси': mount(P.bus) },
    storage: { duration1: st(0), duration6: st(1) },
    diskRepair: {
      alloy: Object.fromEntries(P.alloy.map((x) => [x.r, x.p])),
      steel: Object.fromEntries(P.steel.map((x) => [x.r, x.p])),
      install: { 'Легкові': P.install4.cars, 'Кросовери': P.install4.suv },
    },
    extraServices: {
      valves: P.valves,
      patches: [...P.plasters, ...P.patches],
      other: P.other,
    },
  };
  // baseServices оставляем как были в оригинале
  const m = js.match(/baseServices:(\{[^}]*\})\};e\.s\(\["DEFAULT_PRICES"/);
  if (!m) throw new Error('baseServices not found');
  const obj = JSON.stringify(prices).slice(0, -1) + ',baseServices:' + m[1] + '}';
  js = mustReplace(js, /let n=\{mounting:[\s\S]*?\}\};e\.s\(\["DEFAULT_PRICES"/, `let n=${obj};e.s(["DEFAULT_PRICES"`, 'DEFAULT_PRICES');
  js = mustReplace(js,
    '"getStorageCategory",0,e=>["R13-14","R15","R16","R15-16"].includes(e)?"R13-R16":["R17","R18"].includes(e)?"R17-R18":"R19-R23"',
    '"getStorageCategory",0,e=>["R13-14","R15"].includes(e)?"R13-R15":["R16","R17","R15-16"].includes(e)?"R16-R17":["R18","R19"].includes(e)?"R18-R19":"R20-R24"',
    'getStorageCategory');
  fs.writeFileSync(FILES.settingsChunk, js);
  console.log('updated', path.basename(FILES.settingsChunk));
}

/* ---------------- helpers: один и тот же JSX -> HTML и RSC ---------------- */
const h = (tag, props, ...children) => ({ tag, props: props || {}, children: children.flat().filter((c) => c !== null && c !== undefined && c !== false) });
const ATTR = { className: 'class', strokeLinecap: 'stroke-linecap', strokeLinejoin: 'stroke-linejoin', strokeWidth: 'stroke-width' };
const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
function toHtml(n) {
  if (typeof n === 'string' || typeof n === 'number') return escText(n);
  const attrs = Object.entries(n.props).map(([k, v]) => ` ${ATTR[k] || k}="${escText(v)}"`).join('');
  let inner = '';
  n.children.forEach((c, i) => {
    const isText = (x) => typeof x === 'string' || typeof x === 'number';
    if (i > 0 && isText(c) && isText(n.children[i - 1])) inner += '<!-- -->';
    inner += toHtml(c);
  });
  return `<${n.tag}${attrs}>${inner}</${n.tag}>`;
}
function toRsc(n) {
  if (typeof n === 'string' || typeof n === 'number') return n;
  const props = { ...n.props };
  if (n.children.length === 1) props.children = toRsc(n.children[0]);
  else if (n.children.length > 1) props.children = n.children.map(toRsc);
  return ['$', n.tag, null, props];
}

/* ---------------- 3. Разметка: таблица шиномонтажа (SSR клиентского компонента, вкладка «Легкові») ---------------- */
function mountingTable(rows) {
  const desktop = h('div', { className: 'hidden lg:block overflow-x-auto rounded-xl border border-white/10 glass-panel' },
    h('table', { className: 'w-full text-left border-collapse min-w-[700px]' },
      h('thead', null, h('tr', { className: 'bg-white/5 border-b border-white/10 font-display uppercase tracking-wider text-brand text-sm' },
        h('th', { className: 'p-4 sm:p-5' }, 'Радіус'),
        h('th', { className: 'p-4 sm:p-5 text-center' }, 'Зняття/встановлення'),
        h('th', { className: 'p-4 sm:p-5 text-center' }, 'Монтаж/демонтаж'),
        h('th', { className: 'p-4 sm:p-5 text-center' }, 'Балансування'),
        h('th', { className: 'p-4 sm:p-5 text-center' }, '1 колесо (грн)'),
        h('th', { className: 'p-4 sm:p-5 text-center text-brand text-glow font-bold' }, '4 колеса (грн)'))),
      h('tbody', { className: 'divide-y divide-white/5 text-gray-300' }, rows.map((r) =>
        h('tr', { className: 'hover:bg-white/5 transition-colors' },
          h('td', { className: 'p-4 sm:p-5 font-bold text-white border-r border-white/5' }, 'R', r.r),
          h('td', { className: 'p-4 sm:p-5 text-center' }, r.z),
          h('td', { className: 'p-4 sm:p-5 text-center' }, r.m),
          h('td', { className: 'p-4 sm:p-5 text-center' }, r.b),
          h('td', { className: 'p-4 sm:p-5 text-center font-medium text-white/80' }, r.t / 4),
          h('td', { className: 'p-4 sm:p-5 text-center font-bold text-white tracking-widest bg-brand/5 border-l border-white/5' }, r.t))))));
  const line = (label, val, last) => h('div', { className: last ? 'flex justify-between pt-1' : 'flex justify-between border-b border-white/5 pb-2' },
    h('span', { className: 'text-gray-400' }, label), h('span', { className: last ? 'text-brand font-bold' : 'text-white font-medium' }, val, ' ₴'));
  const mobile = h('div', { className: 'lg:hidden flex flex-col gap-4' }, rows.map((r) =>
    h('div', { className: 'bg-dark/50 border border-white/10 rounded-xl p-5 flex flex-col relative overflow-hidden shadow-lg backdrop-blur-sm' },
      h('div', { className: 'absolute top-0 right-0 bg-brand text-dark font-display font-bold px-4 py-1.5 rounded-bl-xl shadow-[0_0_15px_rgba(57,255,20,0.5)] text-sm tracking-wider' }, '4 КОЛЕСА: ', r.t, ' ₴'),
      h('div', { className: 'font-display text-4xl font-black text-white mb-4 tracking-tighter drop-shadow-md' }, 'R', r.r),
      h('div', { className: 'grid grid-cols-1 gap-2 text-sm text-gray-300' },
        line('Зняття / встановлення:', r.z), line('Монтаж / демонтаж:', r.m), line('Балансування:', r.b), line('Ціна за 1 колесо:', r.t / 4, true)))));
  return toHtml(desktop) + toHtml(mobile);
}

/* ---------------- 4. Разметка: зберігання + ремонт дисків ---------------- */
function storageSection() {
  const td = (cls, v) => h('td', { className: cls }, v);
  const table = h('div', { className: 'hidden lg:block overflow-x-auto rounded-xl border border-white/10 glass-panel' },
    h('table', { className: 'w-full text-left border-collapse min-w-[600px]' },
      h('thead', null,
        h('tr', { className: 'bg-white/5 border-b border-white/10 font-display text-xs uppercase tracking-wider text-gray-400' },
          h('th', { className: 'p-4', rowSpan: 2 }, 'Посадковий діаметр'),
          h('th', { className: 'p-2 border-l border-white/5 text-center', colSpan: 2 }, 'Шини'),
          h('th', { className: 'p-2 border-l border-white/5 text-center', colSpan: 2 }, 'Шини з дисками'),
          h('th', { className: 'p-2 border-l border-white/5 text-center', colSpan: 2 }, 'Окремо диски')),
        h('tr', { className: 'bg-white/5 border-b border-white/10 font-display text-[10px] md:text-xs text-brand uppercase tracking-wider' },
          ['1 міс.', '6 міс.', '1 міс.', '6 міс.', '1 міс.', '6 міс.'].map((t) => h('th', { className: 'p-2 border-l border-white/5 text-center' }, t)))),
      h('tbody', { className: 'divide-y divide-white/5 text-gray-300' }, P.storage.map((s) =>
        h('tr', { className: 'hover:bg-white/5 transition-colors text-center' },
          td('p-4 font-bold text-white border-r border-white/5 text-left', s.d),
          td('p-3 border-l border-white/5 text-white/70', s.tires[0]),
          td('p-3 border-l border-white/5 font-bold text-white', s.tires[1]),
          td('p-3 border-l border-white/5 border-l-brand/30 text-white/70', s.withDisks[0]),
          td('p-3 border-l border-white/5 font-bold text-white bg-white/5', s.withDisks[1]),
          td('p-3 border-l border-white/5 border-l-brand/30 text-white/70', s.disks[0]),
          td('p-3 border-l border-white/5 font-bold text-white bg-white/5', s.disks[1]))))));
  const block = (title, [m1, m6]) => h('div', { className: 'bg-white/5 p-4 rounded-xl border border-white/5' },
    h('div', { className: 'text-brand font-bold uppercase tracking-widest text-xs mb-3 flex items-center gap-2' }, h('span', { className: 'w-2 h-2 rounded-full bg-brand' }), ' ' + title),
    h('div', { className: 'flex justify-between text-sm border-b border-white/5 pb-2' }, h('span', { className: 'text-gray-400' }, '1 місяць:'), h('span', { className: 'text-white font-medium' }, m1, ' ₴')),
    h('div', { className: 'flex justify-between text-sm pt-2' }, h('span', { className: 'text-gray-300 font-bold' }, '6 місяців (сезон):'), h('span', { className: 'text-white font-black' }, m6, ' ₴')));
  const cards = h('div', { className: 'lg:hidden flex flex-col gap-4 mt-4' }, P.storage.map((s) =>
    h('div', { className: 'bg-dark/50 border border-white/10 rounded-xl p-5 shadow-lg backdrop-blur-sm relative overflow-hidden' },
      h('div', { className: 'absolute top-0 right-0 bg-brand text-dark font-black px-4 py-1 rounded-bl-xl shadow-[0_0_10px_rgba(57,255,20,0.5)] font-display text-lg tracking-widest' }, s.d),
      h('h3', { className: 'text-xl font-display font-bold text-white mb-6 pr-24 tracking-wider' }, s.d),
      h('div', { className: 'space-y-4' }, block('Тільки Шини', s.tires), block('Шини з дисками', s.withDisks), block('Окремо диски', s.disks)))));
  const note = h('div', { className: 'mt-4 p-4 border border-brand/20 bg-brand/5 rounded-lg text-sm flex gap-3 text-brand text-glow' },
    h('svg', { className: 'w-5 h-5 flex-shrink-0', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
      h('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' })),
    'Низькопрофільні покришки – шини Run Flat +20% від вартості монтажу');
  const contract = h('a', { className: 'mt-4 flex items-center justify-between gap-3 p-4 rounded-lg border border-white/10 bg-white/5 hover:border-brand/50 transition-colors text-sm', href: '/dogovir' },
    h('span', { className: 'text-gray-300' }, 'Умови зберігання шин та коліс'),
    h('span', { className: 'font-bold text-brand uppercase tracking-widest text-xs' }, 'Договір зберігання →'));
  const h2 = (a, b) => h('h2', { className: 'text-2xl md:text-3xl font-display font-bold uppercase text-white mb-6 flex items-center gap-4' }, h('span', { className: 'w-8 h-1 bg-brand rounded-full' }), a, h('span', { className: 'text-brand' }, b));
  const priceLi = (label, p) => h('li', { className: 'flex justify-between items-center border-b border-white/5 pb-2' },
    h('span', { className: 'text-gray-400 text-sm' }, label), h('span', { className: 'font-bold text-white tracking-wider' }, 'від ', p, ' грн'));
  const disks = h('div', null, h2('Ремонт ', 'дисків'),
    h('div', { className: 'grid sm:grid-cols-2 gap-6' },
      h('div', { className: 'glass-panel p-6 rounded-xl border border-white/10 hover:border-brand/30 transition-colors' },
        h('h3', { className: 'font-display uppercase tracking-widest text-brand mb-4 text-glow' }, 'Рихтовка литих'),
        h('ul', { className: 'space-y-3' }, P.alloy.map((x) => priceLi(x.r, x.p)))),
      h('div', { className: 'glass-panel p-6 rounded-xl border border-white/10 hover:border-brand/30 transition-colors' },
        h('h3', { className: 'font-display uppercase tracking-widest text-brand mb-4 text-glow' }, 'Прокатка залізних'),
        h('ul', { className: 'space-y-3' }, P.steel.map((x) => priceLi(x.r, x.p))),
        h('div', { className: 'mt-6 pt-4 border-t border-white/10' },
          h('p', { className: 'text-sm text-gray-400 mb-2 font-display uppercase tracking-widest text-brand' }, 'Встановлення/зняття 4-х коліс'),
          h('div', { className: 'flex justify-between text-sm py-1' }, h('span', null, 'Легкові:'), h('span', { className: 'font-bold text-white' }, P.install4.cars, ' грн')),
          h('div', { className: 'flex justify-between text-sm py-1' }, h('span', null, 'Кросовери:'), h('span', { className: 'font-bold text-white' }, P.install4.suv, ' грн'))))));
  return h('section', { className: 'py-20 bg-dark relative border-y border-white/5' },
    h('div', { className: 'absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand/5 via-dark to-dark opacity-50' }),
    h('div', { className: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10' },
      h('div', { className: 'grid lg:grid-cols-2 gap-12 lg:gap-8' },
        h('div', null, h2('Зберігання ', 'гуми'), table, cards, note, contract), disks)));
}

/* ---------------- 5. Разметка: додаткові послуги ---------------- */
function extrasSection() {
  const h3 = (t, extra = '') => h('h3', { className: 'font-display font-bold uppercase tracking-widest text-white border-b border-white/10 pb-4 mb-4' + extra }, t);
  const li = (name, price, bordered, priceCls = 'font-bold text-brand') => h('li', { className: bordered ? 'flex justify-between border-b border-white/5 pb-2' : 'flex justify-between' },
    h('span', { className: bordered ? 'text-gray-300' : 'text-gray-400' }, name), h('span', { className: priceCls }, price, ' грн'));
  return h('section', { className: 'py-20 bg-[#050505]' },
    h('div', { className: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8' },
      h('h2', { className: 'text-2xl md:text-3xl font-display font-bold uppercase text-white mb-10 text-center' }, 'Додаткові ', h('span', { className: 'text-brand text-glow' }, 'послуги')),
      h('div', { className: 'grid md:grid-cols-2 lg:grid-cols-3 gap-6' },
        h('div', { className: 'glass-panel p-6 rounded-xl border border-white/10' }, h3('Вентилі та датчики'),
          h('ul', { className: 'space-y-4' }, P.valves.map((v) => li(v.name, v.price, false)))),
        h('div', { className: 'glass-panel p-6 rounded-xl border border-brand/20 bg-brand/5' }, h3('Пластир Tip-Top'),
          h('ul', { className: 'space-y-3' }, P.plasters.map((v) => li(v.name, v.price, true))),
          h3('Латка Tip-Top', ' mt-8'),
          h('ul', { className: 'space-y-3' }, P.patches.map((v) => li(v.name, v.price, true)))),
        h('div', { className: 'glass-panel p-6 rounded-xl border border-white/10' }, h3('Інші роботи'),
          h('ul', { className: 'space-y-4' }, P.other.map((v) => h('li', { className: 'flex justify-between gap-4 border-b border-white/5 pb-2' },
            h('span', { className: 'text-gray-400' }, v.name), h('span', { className: 'font-bold text-white text-right whitespace-nowrap' }, v.price))))))));
}

/* ---------------- 6. prices.html: HTML + RSC payload ---------------- */
{
  let html = readClean(FILES.pricesPage);

  // 6a. SSR-таблица шиномонтажа (вкладка «Легкові»)
  const tStart = html.indexOf('<div class="hidden lg:block overflow-x-auto rounded-xl border border-white/10 glass-panel"><table class="w-full text-left border-collapse min-w-[700px]">');
  const secStart = html.indexOf('<section class="py-20 bg-dark relative border-y border-white/5">');
  const tail = '</div></div></div></section>';
  const tEnd = secStart - tail.length;
  if (tStart < 0 || secStart < 0 || html.slice(tEnd, secStart) !== tail) throw new Error('mounting table HTML not found');
  html = html.slice(0, tStart) + mountingTable(P.cars) + html.slice(tEnd);

  // 6b. Зберігання/диски + додаткові послуги
  const s1 = html.indexOf('<section class="py-20 bg-dark relative border-y border-white/5">');
  const s2 = html.indexOf('<section class="py-20 bg-[#050505]"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><h2', s1);
  const s3 = html.indexOf('</section>', s2) + '</section>'.length;
  if (s1 < 0 || s2 < 0) throw new Error('sections not found');
  const storage = storageSection();
  const extras = extrasSection();
  html = html.slice(0, s1) + toHtml(storage) + toHtml(extras) + html.slice(s3);

  // 6c. Калькулятор (R15 легковий по умолчанию)
  html = html.replace(/(Орієнтовна вартість<\/span><span class="[^"]*">)1100(<!-- --> ₴)/, `$1${P.cars.find((r) => r.r === '15').t}$2`);

  // 6d. RSC payload
  const scriptRe = /<script>self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g;
  const pushes = [];
  let m;
  while ((m = scriptRe.exec(html))) pushes.push({ start: m.index, end: m.index + m[0].length, data: JSON.parse(m[1]) });
  if (!pushes.length) throw new Error('RSC scripts not found');
  let payload = pushes.filter((p) => p.data[0] === 1).map((p) => p.data[1]).join('');
  const rows = payload.split('\n');
  const i5 = rows.findIndex((r) => r.startsWith('5:["$","main"'));
  const i18 = rows.findIndex((r) => r.startsWith('18:["$","section"'));
  if (i5 < 0 || i18 < 0) throw new Error('RSC rows not found');
  const main = JSON.parse(rows[i5].slice(2));
  const kids = main[3].children;
  const idx = kids.findIndex((k) => Array.isArray(k) && k[1] === 'section' && k[3].className === 'py-20 bg-dark relative border-y border-white/5');
  if (idx < 0) throw new Error('storage section not in RSC');
  kids[idx] = toRsc(storage);
  rows[i5] = '5:' + JSON.stringify(main);
  rows[i18] = '18:' + JSON.stringify(toRsc(extras));
  payload = rows.join('\n');
  const esc = (s) => JSON.stringify(s).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const newScript = `<script>self.__next_f.push([1,${esc(payload)}])</script>`;
  let out = '';
  let pos = 0;
  pushes.forEach((p, i) => {
    out += html.slice(pos, p.start);
    if (p.data[0] === 1) { if (i === pushes.findIndex((q) => q.data[0] === 1)) out += newScript; }
    else out += html.slice(p.start, p.end);
    pos = p.end;
  });
  out += html.slice(pos);
  fs.writeFileSync(FILES.pricesPage, out);
  console.log('updated prices.html');
}

/* ---------------- 7. Калькулятор на остальных страницах ---------------- */
for (const f of FILES.calcPages) {
  if (f === FILES.pricesPage) continue;
  let html = readClean(f);
  html = html.replace(/(Орієнтовна вартість<\/span><span class="[^"]*">)1100(<!-- --> ₴)/, `$1${P.cars.find((r) => r.r === '15').t}$2`);
  fs.writeFileSync(f, html);
  console.log('updated', path.basename(f));
}
