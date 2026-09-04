/* ============================================================
   Service Worker：离线缓存应用外壳，让手机"添加到主屏幕"后
   断网也能打开本系统（数据接口 /api/ 永不缓存，直连网络）
   ============================================================ */
'use strict';

var CACHE = 'stock-system-v2';
var ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/store.js',
  './js/sync.js',
  './js/components.js',
  './js/view-dashboard.js',
  './js/view-principles.js',
  './js/view-trades.js',
  './js/view-review.js',
  './js/view-check.js',
  './js/view-settings.js',
  './js/app.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // 逐个缓存，单个失败不影响整体安装
      return Promise.all(ASSETS.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k !== CACHE;
      }).map(function (k) {
        return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;      // 只管同源（本地 Ollama 等请求不缓存）
  if (url.pathname.indexOf('/api/') === 0) return; // 数据接口直连网络，绝不缓存

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        // 离线且未缓存时的兜底：回到首页
        if (req.mode === 'navigate') return caches.match('./index.html');
        throw new Error('offline');
      });
    })
  );
});
