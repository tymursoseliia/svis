// Ставит ссылку кнопки «Оцінити в Google» (страница /contact).
// Запуск: node tools/set-google-review-link.js
const fs = require('fs');
const path = require('path');

const REVIEW_URL = 'https://www.google.com/maps/place/%D0%A8%D0%B8%D0%BD%D0%BE%D0%BC%D0%BE%D0%BD%D1%82%D0%B0%D0%B6+%D1%81%D0%B5%D1%80%D0%B2%D1%96%D1%81%D0%BD%D0%B8%D0%B9+%D1%86%D0%B5%D0%BD%D1%82%D1%80+Svis.YV/@50.5550284,30.2577658,18z/data=!4m8!3m7!1s0x472b31fa4860ed2b:0x71cd2347e3a32aff!8m2!3d50.5550284!4d30.2577658!9m1!1b1!16s%2Fg%2F11dxs3wbpp?entry=ttu&g_ep=EgoyMDI2MTAyOC4wIKXMDSoASAFQAw%3D%3D';

const SITE = path.join(__dirname, '..', 'svisyv.in.ua');
const files = [
  path.join(SITE, 'contact.html'),
  path.join(SITE, '_next', 'static', 'chunks', '7808ed02c4ccc83e.js'),
];

// В HTML «&» в атрибуте экранируется как &amp; (так же делает React при SSR)
const htmlUrl = REVIEW_URL.replace(/&/g, '&amp;');
const placeholder = 'https://www.google.com/maps/place/...';
const anyMapsHref = /https:\/\/www\.google\.com\/maps\/place\/[^"\\]*/g;

for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  const isHtml = f.endsWith('.html');
  const before = c;
  // заменяем и заглушку, и ранее поставленную ссылку (скрипт можно запускать повторно)
  c = c.split(placeholder).join(isHtml ? htmlUrl : REVIEW_URL);
  c = c.replace(anyMapsHref, (m) => (m.startsWith('https://www.google.com/maps/place/%D0%A8') ? (isHtml ? htmlUrl : REVIEW_URL) : m));
  if (c !== before) { fs.writeFileSync(f, c); console.log('updated', path.basename(f)); } else console.log('no change', path.basename(f));
}
