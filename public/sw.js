// ollaya-lab service worker — 설치 가능성만 충족, 캐시 없음(에지 캐시 사용)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));
self.addEventListener('fetch', (e) => {/* pass-through */});
