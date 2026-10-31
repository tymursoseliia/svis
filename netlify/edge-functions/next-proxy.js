// Netlify Edge Function вЂ” С‚Рѕ Р¶Рµ, С‡С‚Рѕ РґРµР»Р°РµС‚ server.js Р»РѕРєР°Р»СЊРЅРѕ:
//  1) Server Actions Next.js (СЃРІРѕР±РѕРґРЅС‹Рµ С‡Р°СЃС‹, Р·Р°РїРёСЃСЊ, РІР°РєР°РЅСЃРёРё РёР· Р±Р°Р·С‹) РїРµСЂРµСЃС‹Р»Р°СЋС‚СЃСЏ РЅР° Р¶РёРІРѕР№ СЃР°Р№С‚;
//  2) /_next/image?w=... РѕС‚РґР°С‘С‚ Р·Р°СЂР°РЅРµРµ СЃРєР°С‡Р°РЅРЅС‹Рµ РєР°СЂС‚РёРЅРєРё.
// Адрес оригинального Next.js-приложения (бэкенд записи/кабинета/вакансий из базы).
// Задаётся в Netlify: Site configuration → Environment variables → BACKEND_ORIGIN
// (например, постоянная ссылка на последний деплой оригинального сайта: https://<id>--svisdiski.netlify.app).
const envGet = (k) => { try { return globalThis.Netlify?.env?.get(k); } catch { return undefined; } };

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

export default async (request, context) => {
  const url = new URL(request.url);

  if (url.pathname === '/_next/image') {
    const file = NEXT_IMAGE_BY_WIDTH[url.searchParams.get('w')] || 'imagec6ea.jpg';
    return new URL('/_next/' + file, request.url);
  }

  if (request.method === 'POST' && request.headers.get('next-action')) {
    const LIVE_ORIGIN = (envGet('BACKEND_ORIGIN') || '').replace(/\/+$/, '');
    if (!LIVE_ORIGIN || new URL(LIVE_ORIGIN).host === url.host) {
      // бэкенд не настроен (или указывает сам на себя) — не зацикливаемся
      return new Response('Backend is not configured (BACKEND_ORIGIN)', { status: 503 });
    }
    const target = new URL(url.pathname + url.search, LIVE_ORIGIN);
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('content-length');
    headers.set('origin', LIVE_ORIGIN);
    const ref = headers.get('referer');
    if (ref) headers.set('referer', ref.replace(/^https?:\/\/[^/]+/, LIVE_ORIGIN));
    for (const k of [...headers.keys()]) if (k.startsWith('x-nf-') || k.startsWith('x-forwarded-')) headers.delete(k);

    const upstream = await fetch(target, { method: 'POST', headers, body: await request.arrayBuffer(), redirect: 'manual' });
    const out = new Headers(upstream.headers);
    out.delete('set-cookie');
    out.delete('content-encoding');
    out.delete('content-length');
    return new Response(upstream.body, { status: upstream.status, headers: out });
  }

  return context.next();
};

export const config = {
  path: '/*',
  excludedPath: ['/_next/static/*', '/docs/*'],
};
