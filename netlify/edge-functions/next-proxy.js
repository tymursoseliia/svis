// Netlify Edge Function — то же, что делает server.js локально:
//  1) Server Actions Next.js (свободные часы, запись, вакансии из базы) пересылаются на живой сайт;
//  2) /_next/image?w=... отдаёт заранее скачанные картинки.
const LIVE_ORIGIN = 'https://svisyv.in.ua';

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
