/* =====================================================================
   Service Worker — כדי שעדכונים יגיעו בלי למחוק ולהתקין מחדש.
   האסטרטגיה היא "רשת קודם": כשיש אינטרנט תמיד מגיעה הגרסה החדשה,
   וכשאין — נופלים למטמון והמשחק ממשיך לעבוד לגמרי לא מקוון.
   ===================================================================== */
const CACHE = 'ben10-v2';

const ASSETS = [
  './',
  './index.html',
  './english.html',
  './manifest.json',
  './icons/favicon-128.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => {}))))
      .catch(() => {})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if(e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;

  let url;
  try{ url = new URL(req.url); }catch(err){ return; }
  if(url.origin !== self.location.origin) return;   // גופנים מהרשת — לא מתערבים

  // דפי HTML נמשכים תמיד עוקפים את מטמון הדפדפן, אחרת תקוע גרסה ישנה
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('.html');

  e.respondWith((async () => {
    try{
      const fresh = await fetch(isPage ? new Request(url.href, { cache:'reload' }) : req);
      if(fresh && fresh.ok){
        const c = await caches.open(CACHE);
        c.put(req, fresh.clone()).catch(() => {});
      }
      return fresh;
    }catch(err){
      const cached = await caches.match(req, { ignoreSearch:true });
      if(cached) return cached;
      if(req.mode === 'navigate'){
        const idx = await caches.match('./index.html');
        if(idx) return idx;
      }
      throw err;
    }
  })());
});
