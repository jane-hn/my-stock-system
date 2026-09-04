/* ============================================================
   应用入口：导航与视图路由
   ============================================================ */
(function (global) {
  'use strict';

  var VIEWS = [
    { id: 'dashboard', label: '总览', mod: 'DashboardView', icon: '<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>' },
    { id: 'principles', label: '思想库', mod: 'PrinciplesView', icon: '<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' },
    { id: 'trades', label: '交易台账', mod: 'TradesView', icon: '<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>' },
    { id: 'review', label: '复盘中心', mod: 'ReviewView', icon: '<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/></svg>' },
    { id: 'check', label: '个股问询', mod: 'CheckView', icon: '<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>' },
    { id: 'settings', label: '设置', mod: 'SettingsView', icon: '<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/></svg>' }
  ];

  var current = 'dashboard';

  function renderNav() {
    var nav = document.getElementById('nav');
    nav.innerHTML = VIEWS.map(function (v) {
      return '<button class="tab ' + (v.id === current ? 'active' : '') + '" type="button" ' +
        'onclick="App.go(\'' + v.id + '\')">' + v.icon + '<span>' + v.label + '</span></button>';
    }).join('');
  }

  function route() {
    var hash = (location.hash || '').replace('#', '');
    var target = VIEWS.some(function (v) { return v.id === hash; }) ? hash : 'dashboard';
    current = target;
    renderNav();
    var view = VIEWS.reduce(function (acc, v) { return v.id === target ? v : acc; }, null);
    var el = document.getElementById('view');
    try {
      global[view.mod].render(el);
    } catch (e) {
      el.innerHTML = '<div class="panel"><div class="empty">页面渲染出现问题：' +
        String(e && e.message ? e.message : e) + '<br><span class="small">请刷新页面重试；若持续出现请重新导入最近一次备份</span></div></div>';
    }
    global.scrollTo(0, 0);
  }

  function go(id) {
    if (('#' + id) === location.hash) { route(); return; }
    location.hash = id;
  }

  global.App = { go: go, rerender: route };

  Store.load();
  renderNav();
  global.addEventListener('hashchange', route);
  route();

  /* 云端同步初始化（未配置服务器时自动跳过，行为与本机离线版完全一致） */
  if (global.Sync) global.Sync.init();

  /* 注册 Service Worker：手机"添加到主屏幕"后断网也能打开（仅 http/https 可用） */
  if ('serviceWorker' in navigator && global.isSecureContext) {
    navigator.serviceWorker.register('./service-worker.js').catch(function () { /* 静默失败，不影响使用 */ });
  }
})(window);
