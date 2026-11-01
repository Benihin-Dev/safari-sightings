/* Safari Sightings: keeps the page, the PDF tool and the fonts on the phone so the site reopens without signal.
   It never touches the Google script, the Cloudinary photos or the page's own photo cache ("img"). */

const CACHE = 'safari-v4';   /* change to safari-v4 only if you add or remove files in the list below */
const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const FONTS = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Montserrat:wght@500;600;700&display=swap';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled([
      c.add('./index.html'),
      c.add('./pdf-progress.js'),
      c.add(JSPDF),
      (async () => {
        const css = await fetch(FONTS);
        await c.put(FONTS, css.clone());
        const urls = [...(await css.text()).matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
        await Promise.allSettled(urls.map(u => c.add(u)));
      })()
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k.indexOf('safari-') === 0 && k !== CACHE) await caches.delete(k);   /* the photo cache "img" is left alone */
    }
    await self.clients.claim();
  })());
});

/* Page: use the internet when it answers within 3.5 seconds (so updates arrive), otherwise the saved copy. */
async function pageFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const net = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(no, 3500))]);
    if (net && net.ok) c.put('./index.html', net.clone());
    return net;
  } catch (err) {
    return (await c.match('./index.html')) || Response.error();
  }
}

/* PDF tool, fonts and other files of this site: saved copy first. */
async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  try {
    const net = await fetch(req);
    if (net && net.ok) c.put(req, net.clone());
    return net;
  } catch (err) {
    return Response.error();
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                                   /* guest data posts go straight to Google */
  const url = new URL(req.url);
  if (url.pathname.indexOf('generate_204') >= 0) return;              /* the page's signal check must stay live */
  if (/script\.google|googleusercontent|cloudinary/.test(url.hostname)) return;
  if (req.mode === 'navigate') { e.respondWith(pageFirst(req)); return; }
  if (url.origin === location.origin || /cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    e.respondWith(cacheFirst(req));
  }
});
