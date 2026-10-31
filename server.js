const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const SITE_DIR = path.join(__dirname, 'svisyv.in.ua');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pdf': 'application/pdf',
};

const NEXT_IMAGE_BY_WIDTH = {
  '640': 'imagec65d.jpg',
  '750': 'image3365.jpg',
  '828': 'imagece5f.jpg',
  '1080': 'image9daf.jpg',
  '1200': 'imagef911.jpg',
  '1920': 'image8b39.jpg',
  '2048': 'image69fd.jpg',
  '3840': 'imagec6ea.jpg',
};

// Оригинальное Next.js-приложение (бэкенд записи). Не svisyv.in.ua — домен может указывать на эту копию.
// Адрес оригинального Next.js-приложения (бэкенд записи). Можно задать переменной окружения BACKEND_ORIGIN.
const LIVE_ORIGIN = (process.env.BACKEND_ORIGIN || 'https://svisdiski.netlify.app').replace(/\/+$/, '');

function proxyToLive(req, res) {
  const target = new URL(req.url, LIVE_ORIGIN);
  const headers = { ...req.headers, host: target.host, origin: LIVE_ORIGIN };
  if (headers.referer) headers.referer = headers.referer.replace(/^https?:\/\/[^/]+/, LIVE_ORIGIN);
  delete headers['accept-encoding'];
  const upstream = https.request(target, { method: req.method, headers }, (up) => {
    const outHeaders = { ...up.headers };
    delete outHeaders['set-cookie'];
    res.writeHead(up.statusCode || 502, outHeaders);
    up.pipe(res);
  });
  upstream.on('error', (err) => {
    console.error('Proxy error:', err.message);
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad gateway');
  });
  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  // Next.js Server Actions (booking slots, booking form, etc.) need the real backend.
  // Proxy them to the live site so the dynamic parts of the page work locally.
  if (req.method === 'POST' && req.headers['next-action']) {
    proxyToLive(req, res);
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Strip /svisyv.in.ua prefix if requested via root HTTrack index
  if (pathname.startsWith('/svisyv.in.ua/')) {
    pathname = pathname.slice('/svisyv.in.ua'.length);
  } else if (pathname === '/svisyv.in.ua') {
    pathname = '/';
  }

  // Handle Next.js dynamic image optimization requests after client hydration
  if (pathname === '/_next/image') {
    const w = parsedUrl.searchParams.get('w');
    const imgFile = NEXT_IMAGE_BY_WIDTH[w] || 'imagec6ea.jpg';
    const imgPath = path.join(SITE_DIR, '_next', imgFile);
    if (fs.existsSync(imgPath)) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      fs.createReadStream(imgPath).pipe(res);
      return;
    }
  }

  // Resolve file path inside svisyv.in.ua
  let filePath = path.join(SITE_DIR, pathname === '/' ? 'index.html' : pathname);

  // Clean URL fallback (e.g. /services -> /services.html)
  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    const htmlCandidate = `${filePath}.html`;
    if (fs.existsSync(htmlCandidate)) {
      filePath = htmlCandidate;
    }
  }

  // If directory, serve index.html inside it
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
