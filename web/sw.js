// Service worker mínimo: só existe para o navegador oferecer a instalação. Sem cache.
self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
