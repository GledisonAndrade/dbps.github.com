// Service Worker para DiabetesCare - PWA
const CACHE_NAME = 'diabetescare-v5';
const BASE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const STATIC_FILES = [
  'index.html',
  'css/app-design.css',
  'css/graficos.css',
  'css/style.css',
  'css/temas.css',
  'css/profissional.css',
  'css/aprimoramentos.css',
  'js/config.js',
  'js/utils.js',
  'js/notificacoes.js',
  'js/armazenamento.js',
  'js/temas.js',
  'js/script.js',
  'js/graficos.js',
  'js/pizza.js',
  'js/relatorios.js',
  'js/indice.js',
  'js/alimentos.js',
  'js/testes.js',
  'js/debug.js',
  'imagens/diabetes.png'
];

const URLS_CACHE = [
  `${BASE_PATH}/`,
  ...STATIC_FILES.map(file => `${BASE_PATH}/${file}`)
];

// Instalar o Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('📦 Cache instalado');
      return cache.addAll(URLS_CACHE).catch(err => {
        console.log('⚠️ Alguns arquivos não puderam ser cacheados:', err);
      });
    })
  );
  self.skipWaiting();
});

// Ativar o Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estratégia de cache: Network first, fallback to cache
self.addEventListener('fetch', event => {
  // Ignorar requisições não-GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clonar a response
        const clonedResponse = response.clone();
        
        // Cache o novo response
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clonedResponse);
        });
        
        return response;
      })
      .catch(() => {
        // Se a requisição falhar, tenta do cache
        return caches.match(event.request).then(cached => {
          if (cached) {
            return cached;
          }
          
          // Se não estiver em cache, retorna página offline
          if (event.request.destination === 'document') {
            return caches.match(`${BASE_PATH}/index.html`);
          }
        });
      })
  );
});

// Sincronização de background (para dados offline)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-registros') {
    event.waitUntil(sincronizarRegistros());
  }
});

function sincronizarRegistros() {
  return new Promise(resolve => {
    console.log('🔄 Sincronizando registros...');
    // Aqui você implementaria a lógica de sincronização com o servidor
    resolve();
  });
}

// Notificações push
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Nova notificação do DiabetesCare',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%234361ee" width="192" height="192"/><text x="96" y="96" font-size="80" fill="white" text-anchor="middle" dominant-baseline="middle">❤️</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect fill="%234361ee" width="96" height="96"/></svg>',
    vibrate: [200, 100, 200],
    tag: 'diabetescare-notification',
    requireInteraction: false
  };
  
  self.registration.showNotification('DiabetesCare', options);
});

// Clique em notificação push
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(self.registration.scope);
      }
    })
  );
});

console.log('✅ Service Worker registrado e ativo');
