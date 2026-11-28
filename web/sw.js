/* خدمة العمل دون اتصال: تخزين ملفات التطبيق مؤقتًا */
const CACHE = "exam-maker-v2";
const FILES = ["./", "index.html", "manifest.webmanifest", "css/style.css", "css/paper.css", "icons/icon.svg", "icons/icon-192.png",
  "js/data.js", "js/format.js", "js/store.js", "js/templates.js", "js/paper.js", "js/editor.js", "js/quran.js", "js/export.js", "js/app.js"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(ch => ch.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
