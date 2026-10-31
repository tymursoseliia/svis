// Добавляет вакансии из tools/vacancies-data.js на страницу /vacancies:
//  - в клиентский компонент (JS-чанк), чтобы они показывались всегда, даже если в базе вакансий нет;
//  - в серверный HTML vacancies.html, чтобы разметка совпадала при гидрации.
// Работает от чистой копии в .vacancies-backup, можно запускать повторно.
const fs = require('fs');
const path = require('path');
const VAC = require('./vacancies-data');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'svisyv.in.ua');
const CHUNK = path.join(SITE, '_next', 'static', 'chunks', '2c363c4f05538b98.js');
const PAGE = path.join(SITE, 'vacancies.html');
const BACKUP = path.join(ROOT, '.vacancies-backup');

function readClean(file) {
  const b = path.join(BACKUP, path.relative(ROOT, file));
  if (!fs.existsSync(b)) { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(file, b); }
  return fs.readFileSync(b, 'utf8');
}

/* ---------- мини-JSX: одно дерево -> HTML и -> код React ---------- */
const h = (tag, props, ...children) => ({ tag, props: props || {}, children: children.flat().filter((c) => c !== null && c !== undefined && c !== false) });
const ATTR = { className: 'class' };
const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const isText = (x) => typeof x === 'string' || typeof x === 'number';
function toHtml(n) {
  if (isText(n)) return escText(n);
  const attrs = Object.entries(n.props).filter(([k]) => k !== 'key').map(([k, v]) => ` ${ATTR[k] || k}="${escText(v)}"`).join('');
  let inner = '';
  n.children.forEach((c, i) => { if (i > 0 && isText(c) && isText(n.children[i - 1])) inner += '<!-- -->'; inner += toHtml(c); });
  return `<${n.tag}${attrs}>${inner}</${n.tag}>`;
}
function toJs(n) {
  if (isText(n)) return JSON.stringify(n);
  const { key, ...props } = n.props;
  const parts = Object.entries(props).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`);
  const kids = n.children.map((c, i) => (isText(c) || c.props.key !== undefined || n.children.length === 1 ? toJs(c) : toJs({ ...c, props: { ...c.props, key: String(i) } })));
  if (kids.length === 1) parts.push(`children:${kids[0]}`);
  else if (kids.length > 1) parts.push(`children:[${kids.join(',')}]`);
  const fn = kids.length > 1 ? 'jsxs' : 'jsx';
  return `(0,t.${fn})(${JSON.stringify(n.tag)},{${parts.join(',')}}${key !== undefined ? ',' + JSON.stringify(String(key)) : ''})`;
}

/* ---------- разметка ---------- */
const header = h('div', { className: 'text-center mb-12 reveal' },
  h('h2', { className: 'text-sm font-bold text-brand uppercase tracking-widest mb-2' }, 'Стань частиною команди'),
  h('h3', { className: 'text-3xl md:text-5xl font-display font-black text-white uppercase tracking-tight' }, 'Відкриті ', h('span', { className: 'text-brand text-glow' }, 'Вакансії')));

const tel = (p) => 'tel:' + p.replace(/\D/g, '');
function card(v) {
  return h('div', { key: v.id, className: 'glass-panel p-6 md:p-10 rounded-2xl border border-brand/30 hover:border-brand/50 transition-all reveal' },
    h('div', { className: 'flex flex-col md:flex-row justify-between items-start md:items-center gap-6' },
      h('div', { className: 'max-w-2xl' },
        h('div', { className: 'inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand/30 bg-brand/5 text-xs font-bold uppercase tracking-widest text-brand mb-4' },
          h('span', { className: 'w-2 h-2 rounded-full bg-brand animate-pulse' }), v.location),
        h('h4', { className: 'text-2xl md:text-3xl font-bold text-white mb-4 uppercase tracking-wider text-brand' }, v.title),
        h('div', { className: 'text-base font-display font-bold text-white bg-white/5 inline-block px-3 py-1 rounded-lg border border-white/10' }, v.highlight)),
      h('a', { href: tel(v.phone), className: 'px-8 py-4 border border-brand text-dark bg-brand font-bold uppercase tracking-widest rounded-xl hover:bg-transparent hover:text-brand transition-all whitespace-nowrap btn-glow shadow-[0_0_15px_rgba(57,255,20,0.2)]' }, 'Дзвонити')),
    h('p', { className: 'text-gray-300 text-base leading-relaxed mt-6' }, v.intro),
    h('div', { className: 'grid md:grid-cols-3 gap-8 mt-8 pt-6 border-t border-white/10' },
      v.groups.map((g, gi) => h('div', { key: String(gi) },
        h('h5', { className: 'text-xs font-bold text-brand uppercase tracking-widest mb-3' }, g.title),
        h('ul', { className: 'flex flex-col gap-2' }, g.items.map((it, ii) => h('li', { key: String(ii), className: 'flex items-start gap-3 text-sm text-gray-300 leading-relaxed' },
          h('span', { className: 'w-2 h-2 mt-2 rounded-full bg-brand flex-shrink-0' }), h('span', null, it))))))),
    h('div', { className: 'flex flex-wrap items-center gap-3 mt-8 pt-6 border-t border-white/10 text-sm' },
      h('span', { className: 'px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300' }, '📍 ', v.location),
      h('a', { href: tel(v.phone), className: 'px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-bold hover:border-brand/50 hover:text-brand transition-colors' }, '📞 ', v.phone, ' — ', v.contact)));
}
const staticCards = VAC.map(card);

/* ---------- 1. JS-чанк ---------- */
{
  let js = readClean(CHUNK);
  const start = js.indexOf('function l(){let[e,a]=(0,r.useState)([])');
  const end = js.indexOf('e.s(["default",()=>l],33389)');
  if (start < 0 || end < 0) throw new Error('компонент вакансий не найден в чанке');
  // карточка вакансии из базы (как в оригинале, но без "reveal", т.к. появляется после загрузки)
  const dbCard = '(0,t.jsxs)("div",{className:"glass-panel p-6 md:p-8 rounded-2xl border border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:border-brand/30 transition-all",children:[(0,t.jsxs)("div",{className:"max-w-2xl",children:[(0,t.jsx)("h4",{className:"text-2xl font-bold text-white mb-2 uppercase tracking-wider text-brand",children:e.title}),(0,t.jsx)("div",{className:"text-xl font-display font-bold text-white mb-4 bg-white/5 inline-block px-3 py-1 rounded-lg border border-white/10",children:e.salary}),(0,t.jsx)("p",{className:"text-gray-400 text-sm leading-relaxed",children:e.description})]}),(0,t.jsx)("a",{href:"tel:0672454455",className:"px-8 py-4 border border-brand text-dark bg-brand font-bold uppercase tracking-widest rounded-xl hover:bg-transparent hover:text-brand transition-all whitespace-nowrap btn-glow shadow-[0_0_15px_rgba(57,255,20,0.2)]",children:"Дзвонити"})]},e.id)';
  const comp = 'function l(){let[e,a]=(0,r.useState)([]);(0,r.useEffect)(()=>{s().then(e=>{e&&e.data&&a(e.data)}).catch(()=>{})},[]);'
    + 'return(0,t.jsx)("section",{className:"py-20 bg-[#151a0c] relative z-10 border-t border-brand/10",children:(0,t.jsxs)("div",{className:"max-w-5xl mx-auto px-4 sm:px-6 lg:px-8",children:['
    + toJs(header) + ',(0,t.jsxs)("div",{className:"flex flex-col gap-6",children:[' + staticCards.map(toJs).join(',') + ',e.map(e=>' + dbCard + ')]})]})})}';
  js = js.slice(0, start) + comp + js.slice(end);
  fs.writeFileSync(CHUNK, js);
  console.log('updated', path.basename(CHUNK));
}

/* ---------- 2. Серверный HTML ---------- */
{
  let html = readClean(PAGE);
  const i = html.indexOf('</main>');
  if (i < 0) throw new Error('</main> не найден');
  const section = h('section', { className: 'py-20 bg-[#151a0c] relative z-10 border-t border-brand/10' },
    h('div', { className: 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8' }, header, h('div', { className: 'flex flex-col gap-6' }, staticCards)));
  html = html.slice(0, i) + toHtml(section) + html.slice(i);
  fs.writeFileSync(PAGE, html);
  console.log('updated vacancies.html');
}
