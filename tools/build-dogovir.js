// Генерирует договор хранения:
//   1) PDF  -> svisyv.in.ua/docs/dogovir-zberigannya-shyn.pdf (печать через headless Chrome)
//   2) страницу svisyv.in.ua/dogovir.html, где PDF показан прямо на странице
// Текст договора — tools/dogovir-content.js. Шапка и подвал берутся с prices.html.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const C = require('./dogovir-content');

const SITE = path.join(__dirname, '..', 'svisyv.in.ua');
const OUT = path.join(__dirname, 'out');
const PDF_NAME = 'dogovir-zberigannya-shyn.pdf';
const PDF_PATH = path.join(SITE, 'docs', PDF_NAME);
const PDF_URL = '/docs/' + PDF_NAME;
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const A = C.act;
const lines = (arr) => arr.map((l) => `<div>${esc(l)}</div>`).join('');
const actRows = Array.from({ length: A.rows }, (_, i) => `<tr><td>${i + 1}</td>${'<td></td>'.repeat(A.columns.length - 1)}</tr>`).join('');

// Общая разметка договора (используется и в PDF, и в мобильной версии страницы)
function contractBody() {
  return `
  <h1 class="dg-title">${esc(C.title)}</h1>
  <div class="dg-meta">${esc(C.meta)}</div>
  <p class="dg-p">${esc(C.intro)}</p>
  ${C.sections.map((s) => `
  <section class="dg-section">
    <h2 class="dg-h2">${s.n}. ${esc(s.title)}</h2>
    ${s.items.map(([n, t]) => `<p class="dg-p"><b>${n}</b> ${esc(t)}</p>`).join('\n    ')}
  </section>`).join('')}
  <div class="dg-parties">
    <div class="dg-party"><h3 class="dg-h3">${esc(C.keeper.title)}</h3>${lines(C.keeper.lines)}</div>
    <div class="dg-party"><h3 class="dg-h3">${esc(C.depositor.title)}</h3>${lines(C.depositor.lines)}</div>
  </div>
  <div class="dg-sign">${lines(C.signature)}</div>

  <section class="dg-act">
    <h1 class="dg-title">${esc(A.title)}</h1>
    <div class="dg-meta">${esc(A.subtitle)}</div>
    <div class="dg-lines">${lines(A.head)}</div>
    <div class="dg-scroll"><table class="dg-table"><thead><tr>${A.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${actRows}</tbody></table></div>
    <div class="dg-lines">${lines(A.totals)}</div>
    <div class="dg-lines dg-gap">${lines(A.payment)}</div>
    <div class="dg-warn">${esc(A.warning)}</div>
    <div class="dg-lines">${lines(A.handover)}</div>
    <h2 class="dg-h2 dg-gap">${esc(A.returnTitle)}</h2>
    <div class="dg-lines">${lines(A.returnLines)}</div>
  </section>`;
}

/* ---------------- 1. PDF ---------------- */
const printHtml = `<!DOCTYPE html><html lang="uk"><head><meta charset="utf-8"><title>${esc(C.title)}</title>
<style>
  @page{size:A4;margin:16mm 15mm 16mm 18mm}
  body{font-family:"Times New Roman",Times,serif;font-size:11.5pt;line-height:1.42;color:#000;margin:0}
  .dg-title{font-size:15pt;text-align:center;text-transform:uppercase;margin:0 0 4pt;letter-spacing:.5pt}
  .dg-meta{text-align:center;margin-bottom:12pt}
  .dg-section{margin-top:9pt}
  .dg-h2{font-size:12pt;margin:10pt 0 4pt;text-transform:uppercase;break-after:avoid}
  .dg-h3{font-size:11pt;margin:0 0 4pt;text-transform:uppercase}
  .dg-p{margin:3pt 0;text-align:justify;orphans:3;widows:3}
  .dg-parties{display:grid;grid-template-columns:1fr 1fr;gap:14pt;margin-top:14pt;break-inside:avoid}
  .dg-party{border:1px solid #888;padding:8pt;line-height:1.55}
  .dg-sign{display:flex;justify-content:space-between;margin-top:22pt;font-weight:bold}
  .dg-act{break-before:page}
  .dg-lines div{line-height:1.9}
  .dg-gap{margin-top:8pt}
  .dg-table{width:100%;border-collapse:collapse;margin:10pt 0}
  .dg-table th,.dg-table td{border:1px solid #000;padding:4pt;vertical-align:top;font-size:10pt}
  .dg-table th{background:#eee}
  .dg-table td{height:30pt}.dg-table td:first-child{width:22pt;text-align:center}
  .dg-warn{border:1px solid #000;padding:7pt 9pt;margin:10pt 0;font-style:italic}
</style></head><body>${contractBody()}</body></html>`;

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.dirname(PDF_PATH), { recursive: true });
const printFile = path.join(OUT, 'dogovir-print.html');
fs.writeFileSync(printFile, printHtml);
if (!CHROME) throw new Error('Не найден Chrome/Edge для генерации PDF');
execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer',
  `--user-data-dir=${path.join(OUT, 'chrome-profile')}`,
  `--print-to-pdf=${PDF_PATH}`, pathToFileURL(printFile).href,
], { stdio: 'ignore' });
if (!fs.existsSync(PDF_PATH)) throw new Error('PDF не создан');
console.log('built docs/' + PDF_NAME, Math.round(fs.statSync(PDF_PATH).size / 1024) + ' KB');

// старый .docx больше не публикуем
const oldDocx = path.join(SITE, 'docs', 'dogovir-zberigannya-shyn.docx');
if (fs.existsSync(oldDocx)) fs.unlinkSync(oldDocx);

/* ---------------- 2. Страница сайта ---------------- */
const src = fs.readFileSync(path.join(SITE, 'prices.html'), 'utf8');
let nav = src.slice(src.indexOf('<nav'), src.indexOf('</nav>') + 6);
nav = nav.replace(/(class="[^"]*?) text-brand text-glow(" href="prices\.html")/g, '$1 text-gray-300 hover:text-brand$2')
  .replace(/(class="[^"]*?)text-brand text-glow(" href="prices\.html")/g, '$1text-white hover:text-brand$2');
const footer = src.slice(src.indexOf('<footer'), src.indexOf('</footer>') + 9);
const bodyClass = (src.match(/<body class="([^"]+)"/) || [])[1] || '';
const ver = fs.statSync(PDF_PATH).mtimeMs.toFixed(0);

const icon = {
  open: '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 3h7v7m0-7L10 14M5 5h4M5 5v14h14v-4"/></svg>',
  down: '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/></svg>',
};

const html = `<!DOCTYPE html><html lang="uk" class="scroll-smooth"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="/_next/static/chunks/6d75f01423fbd040.css"/>
<title>Договір зберігання шин та коліс | SVIS.YV Шиномонтаж</title>
<meta name="description" content="Договір зберігання шин та коліс SVIS.YV (ФОП Харченко Ю. В.), селище Гостомель. Перегляд та завантаження у PDF."/>
<link rel="icon" href="/iconca57.svg" type="image/svg+xml"/>
<style>
  .dg-wrap{max-width:64rem;margin:0 auto;padding:0 1rem}
  .dg-actions{display:flex;flex-wrap:wrap;gap:.75rem;justify-content:center;margin-bottom:1.5rem}
  .dg-btn{display:inline-flex;align-items:center;gap:.5rem;padding:.8rem 1.5rem;border-radius:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:.85rem;transition:all .2s}
  .dg-btn-main{background:#39FF14;color:#0a0a0a;box-shadow:0 0 15px rgba(57,255,20,.3)}.dg-btn-main:hover{background:#fff}
  .dg-btn-ghost{border:1px solid rgba(255,255,255,.2);color:#fff;background:rgba(255,255,255,.05)}.dg-btn-ghost:hover{border-color:rgba(57,255,20,.5);color:#39FF14}
  .dg-viewer{border:1px solid rgba(57,255,20,.25);border-radius:1rem;overflow:hidden;background:#525659;box-shadow:0 0 40px rgba(57,255,20,.08)}
  .dg-viewer iframe{display:block;width:100%;height:calc(100vh - 9rem);min-height:640px;border:0}
  /* На телефонах встроенный PDF часто не показывается — там выводим текст договора */
  .dg-mobile{display:none}
  @media (max-width:767px){
    .dg-viewer{display:none}
    .dg-mobile{display:block;background:rgba(17,17,17,.75);border:1px solid rgba(255,255,255,.1);border-radius:1rem;padding:1.4rem 1.1rem;color:#d1d5db}
    .dg-mobile .dg-title{color:#fff;font-weight:800;text-transform:uppercase;text-align:center;font-size:1.25rem;line-height:1.25}
    .dg-mobile .dg-meta{text-align:center;color:#9ca3af;margin:.5rem 0 1.25rem;font-size:.85rem}
    .dg-mobile .dg-h2{color:#39FF14;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:1.5rem 0 .6rem;font-size:.95rem}
    .dg-mobile .dg-h3{color:#39FF14;font-weight:700;text-transform:uppercase;font-size:.8rem;margin-bottom:.4rem}
    .dg-mobile .dg-p{line-height:1.7;margin:.5rem 0}
    .dg-mobile .dg-p b{color:#39FF14}
    .dg-mobile .dg-parties{display:grid;gap:1rem;margin-top:1.5rem}
    .dg-mobile .dg-party{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:.75rem;padding:1rem;line-height:1.7;word-break:break-word}
    .dg-mobile .dg-sign{margin-top:1.5rem;font-weight:600;line-height:2}
    .dg-mobile .dg-act{margin-top:2.5rem;padding-top:2rem;border-top:1px dashed rgba(255,255,255,.15)}
    .dg-mobile .dg-lines div{line-height:1.9;word-break:break-word}
    .dg-mobile .dg-gap{margin-top:1rem}
    .dg-mobile .dg-scroll{overflow-x:auto}
    .dg-mobile .dg-table{width:100%;min-width:520px;border-collapse:collapse;margin:1rem 0;font-size:.8rem}
    .dg-mobile .dg-table th,.dg-mobile .dg-table td{border:1px solid rgba(255,255,255,.15);padding:.45rem}
    .dg-mobile .dg-table th{color:#39FF14;background:rgba(57,255,20,.08)}
    .dg-mobile .dg-table td{height:2.5rem}
    .dg-mobile .dg-warn{margin:1rem 0;padding:.9rem;border:1px solid rgba(57,255,20,.25);background:rgba(57,255,20,.06);border-radius:.75rem}
  }
</style></head>
<body class="${bodyClass}">
${nav}
<main class="bg-dark min-h-screen text-gray-300 pt-32 pb-20">
  <section class="relative text-center" style="padding-bottom:2rem">
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
      <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand/30 bg-brand/5 backdrop-blur-sm text-sm font-bold uppercase tracking-widest text-brand mb-6">Документи</div>
      <h1 class="text-3xl sm:text-5xl md:text-6xl font-display font-black tracking-tight uppercase text-white drop-shadow-lg mb-6">Договір <span class="text-brand text-glow">зберігання</span></h1>
      <p class="max-w-2xl mx-auto text-lg text-gray-400">Договір зберігання шин, дисків та коліс у зборі з актом приймання та повернення.</p>
    </div>
  </section>
  <div class="dg-wrap">
    <div class="dg-actions">
      <a class="dg-btn dg-btn-main" href="${PDF_URL}" download>${icon.down}Завантажити PDF</a>
      <a class="dg-btn dg-btn-ghost" href="${PDF_URL}" target="_blank" rel="noopener">${icon.open}Відкрити на весь екран</a>
    </div>
    <div class="dg-viewer"><iframe src="${PDF_URL}?v=${ver}#view=FitH" title="${esc(C.title)}"></iframe></div>
    <article class="dg-mobile">${contractBody()}</article>
  </div>
</main>
${footer}
<script>
  // Мобильное меню (страница статическая, без React)
  (function(){
    var btn=document.querySelector('nav button[aria-label="Toggle menu"]');
    var panel=document.querySelector('nav .xl\\\\:hidden.grid');
    if(!btn||!panel)return;
    btn.addEventListener('click',function(){
      var open=panel.classList.contains('grid-rows-[1fr]');
      ['grid-rows-[1fr]','opacity-100','shadow-2xl'].forEach(function(c){panel.classList.toggle(c,!open)});
      ['grid-rows-[0fr]','opacity-0','border-transparent','shadow-none'].forEach(function(c){panel.classList.toggle(c,open)});
    });
  })();
</script>
</body></html>`;

fs.writeFileSync(path.join(SITE, 'dogovir.html'), html);
console.log('built dogovir.html');
