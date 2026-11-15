/* Firebase Messaging service worker - served at /firebase-messaging-sw.js */
importScripts('./firebase-config-sw.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');

const CACHE = 'farid-kebab-fcm-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './ali-kebabbaro-logo.png',
  './icon-192.png',
  './icon-512.png',
  './firebase-config.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(function(){})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  try {
    const url = new URL(e.request.url);
    if (url.origin !== location.origin) return;
    if (e.request.mode === 'navigate') {
      e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(cache => cache.put('./index.html', c)); return r; }).catch(() => caches.match('./index.html')));
      return;
    }
    e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(cache => cache.put(e.request, c)); return r; })));
  } catch (err) {}
});

try {
  firebase.initializeApp({
    apiKey: self.FIREBASE_API_KEY || '',
    authDomain: self.FIREBASE_AUTH_DOMAIN || '',
    projectId: self.FIREBASE_PROJECT_ID || '',
    storageBucket: self.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: self.FIREBASE_APP_ID || ''
  });
  var messaging = firebase.messaging();
  messaging.onBackgroundMessage(function (payload) {
    var n = (payload && payload.notification) || {};
    var d = (payload && payload.data) || {};
    var title = n.title || d.title || 'Aggiornamento ordine';
    var options = {
      body: n.body || d.body || '',
      icon: d.icon || './icon-192.png',
      badge: d.badge || './icon-192.png',
      tag: d.tag || ('order-' + (d.order_number || 'status')),
      renotify: true,
      data: { url: d.click_action || d.url || './index.html' }
    };
    self.registration.showNotification(title, options);
  });
} catch (e) {
  // config not set or messaging unsupported - ignore
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = (event.notification && event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if ('focus' in c) return c.focus();
    }
    if (clients.openWindow) return clients.openWindow(target);
  }));
});
