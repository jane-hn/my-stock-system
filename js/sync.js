/* ============================================================
   云端同步层：电脑关机≠数据关机
   ------------------------------------------------------------
   - 未配置服务器 → 纯本机离线模式（行为与从前完全一致）
   - 配置后：localStorage 作本地缓存，云端为主数据源
     · 启动/回到前台/联网时自动拉取
     · 每次保存后延迟数秒自动推送
     · 两台设备都有离线改动时，按"单条记录最新者优先"合并
   - 同步配置（地址/令牌/游标）单独存放，不随数据导入导出
   ============================================================ */
(function (global) {
  'use strict';

  var CFG_KEY = 'my_stock_system_sync_v1';
  var BAK_KEY = 'my_stock_system_presync_backup_v1'; // 采纳云端前的本地快照（保留最近 3 份）
  var cfg = { url: '', token: '', lastSyncedAt: 0 };
  var busy = false;
  var pushTimer = null;
  var lastForegroundSync = 0;
  var lastOk = true;

  /* ---------- 配置 ---------- */
  function loadCfg() {
    try {
      var raw = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        cfg.url = String(raw.url || '');
        cfg.token = String(raw.token || '');
        cfg.lastSyncedAt = Number(raw.lastSyncedAt) || 0;
      }
    } catch (e) { /* 忽略损坏的配置 */ }
  }

  function saveCfg() {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  function enabled() { return !!cfg.url; }

  /* ---------- 状态徽章 ---------- */
  function timeStr(ts) {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false });
  }

  function setStatus(kind, text) {
    var el = document.getElementById('syncBadge');
    if (!el) return;
    if (!enabled() || kind === 'hidden') { el.hidden = true; return; }
    el.hidden = false;
    el.className = 'save-badge sync-badge ' + kind;
    el.textContent = text;
  }

  /* ---------- 网络请求 ---------- */
  /* 代理/沙箱环境可能使 location.origin / location.href 被污染（含隐藏字符），
     无法可靠做同源比较。策略：先尝试相对路径（同源时直连，穿透代理），
     若失败（TypeError = 网络不可达）再回退到绝对 URL（跨源场景，服务器已设 CORS *）。 */
  function request(method, body, cb) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    var opts = { method: method, headers: { 'X-Auth-Token': cfg.token || '' } };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    if (ctrl) opts.signal = ctrl.signal;

    var base = cfg.url.replace(/\/+$/, '');
    var triedAbs = false;

    function doFetch(url) {
      fetch(url, opts)
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            if (r.status === 401) { var e1 = new Error('unauthorized'); e1.type = 'auth'; throw e1; }
            if (!r.ok) {
              var e2 = new Error((j && j.error) || ('HTTP ' + r.status));
              e2.type = (r.status === 409) ? 'conflict' : 'server';
              throw e2;
            }
            return j;
          });
        })
        .then(function (j) { clearTimeout(timer); cb(null, j); })
        .catch(function (err) {
          if (!triedAbs && base && err.name === 'TypeError') {
            /* 相对路径失败 → 回退绝对 URL（跨源场景，file:// 打开等） */
            triedAbs = true;
            doFetch(base + '/api/data');
            return;
          }
          clearTimeout(timer);
          if (!err.type) err.type = 'network';
          cb(err);
        });
    }

    doFetch('/api/data');
  }

  function pull(cb) { request('GET', null, cb); }

  function push(payload, cb) { request('PUT', payload, cb); }

  /* ---------- 合并策略 ---------- */
  function itemTs(x) { return x.updatedAt || x.ts || x.createdAt || 0; }

  function mergeArr(a, b) {
    var map = {};
    var arr = [];
    (a || []).forEach(function (x) {
      if (x && x.id && !map[x.id]) { map[x.id] = x; arr.push(x); }
    });
    (b || []).forEach(function (x) {
      if (!x || !x.id) return;
      var cur = map[x.id];
      if (!cur) { map[x.id] = x; arr.push(x); }
      else if (itemTs(x) > itemTs(cur)) { arr[arr.indexOf(cur)] = x; map[x.id] = x; }
    });
    return arr;
  }

  function mergeStates(local, remote) {
    return {
      version: 1,
      settings: ((remote.updatedAt || 0) > (local.updatedAt || 0)) ? remote.settings : local.settings,
      prices: Object.assign({}, local.prices || {}, remote.prices || {}),
      materials: mergeArr(local.materials, remote.materials),
      principles: mergeArr(local.principles, remote.principles),
      trades: mergeArr(local.trades, remote.trades),
      reviews: mergeArr(local.reviews, remote.reviews),
      checks: mergeArr(local.checks, remote.checks)
    };
  }

  /* 采纳云端数据前，把本地现状快照留底（防止意外覆盖造成损失） */
  function stashBackup() {
    try {
      var st = global.Store.state;
      if (!st) return;
      var list = [];
      try { list = JSON.parse(localStorage.getItem(BAK_KEY) || '[]'); } catch (e) {}
      list.unshift({ ts: Date.now(), state: st });
      try {
        localStorage.setItem(BAK_KEY, JSON.stringify(list.slice(0, 3)));
      } catch (e2) {
        // 空间不足时只保留一份
        try { localStorage.setItem(BAK_KEY, JSON.stringify(list.slice(0, 1))); } catch (e3) {}
      }
    } catch (e) {}
  }

  /* ---------- 推送 ---------- */
  function doPush(opts, done) {
    opts = opts || {};
    var st = global.Store.state;
    var payload = { updatedAt: st.updatedAt || Date.now(), state: st };
    push(payload, function (err) {
      if (err && err.type === 'conflict') {
        // 云端比本地快（另一台设备先推了）→ 拉取合并后重推一次
        return pull(function (e2, remote) {
          if (e2 || !remote || !remote.state) {
            cfg.lastSyncedAt = 0; saveCfg();
            setStatus('bad', '云端：冲突待重试');
            if (done) done();
            return;
          }
          var merged = mergeStates(global.Store.state, remote.state);
          global.Store.replaceState(merged, Date.now());
          var p2 = { updatedAt: global.Store.state.updatedAt, state: global.Store.state };
          push(p2, function (e3) {
            if (e3) {
              setStatus('bad', e3.type === 'auth' ? '云端：令牌不正确' : '云端：推送失败');
              if (done) done();
              return;
            }
            cfg.lastSyncedAt = global.Store.state.updatedAt; saveCfg();
            setStatus('ok', '云端：已同步 ' + timeStr(Date.now()));
            if (global.App) global.App.rerender();
            if (opts.announce) global.UI.toast('两台设备都有新改动，已按记录自动合并并同步', 'success');
            if (done) done();
          });
        });
      }
      if (err) {
        lastOk = false;
        setStatus('bad', err.type === 'auth' ? '云端：令牌不正确' : '云端：连接失败');
        if (done) done();
        return;
      }
      lastOk = true;
      cfg.lastSyncedAt = payload.updatedAt; saveCfg();
      setStatus('ok', '云端：已同步 ' + timeStr(Date.now()));
      if (done) done();
    });
  }

  /* ---------- 同步主流程 ---------- */
  function syncNow(opts) {
    opts = opts || {};
    if (!enabled()) {
      if (opts.manual) global.UI.toast('请先填写服务器地址并点击保存', 'error');
      return;
    }
    if (busy) return;
    busy = true;
    setStatus('syncing', '云端：同步中…');

    pull(function (err, remote) {
      if (err) {
        busy = false;
        lastOk = false;
        if (err.type === 'auth') {
          setStatus('bad', '云端：令牌不正确');
          if (opts.manual) global.UI.toast('云端拒绝了访问：令牌（密码）不正确', 'error');
        } else {
          setStatus('bad', '云端：连接失败');
          if (opts.manual) global.UI.toast('无法连接云端服务器，本次已按本地数据继续', 'error');
        }
        return;
      }
      lastOk = true;

      var st = global.Store.state;
      var RS = remote && remote.state;
      var localIsDemo = !!(st && st.isDemo);              // 本地仍是未改动过的演示数据
      var remoteIsDemo = !!(RS && RS.isDemo);
      var LU = (st && !localIsDemo && st.updatedAt) || 0; // 演示数据视为"没有本地改动"
      var SU = Number(remote && remote.updatedAt) || 0;
      var LS = cfg.lastSyncedAt || 0;

      if (LU > LS && SU > LS && RS && !remoteIsDemo) {
        /* 双方都有真实改动 → 合并后推送 */
        stashBackup();
        var merged = mergeStates(st, RS);
        global.Store.replaceState(merged, Date.now());
        doPush({ announce: true }, function () {
          busy = false;
          if (global.App) global.App.rerender();
        });
      } else if (SU > LS && RS && !remoteIsDemo) {
        /* 仅云端有新数据 → 采纳（演示数据被真数据替换时不提示） */
        stashBackup();
        global.Store.replaceState(RS, SU);
        cfg.lastSyncedAt = SU; saveCfg();
        setStatus('ok', '云端：已同步 ' + timeStr(Date.now()));
        busy = false;
        if (global.App) global.App.rerender();
        if (!st.isDemo || opts.manual) global.UI.toast('已从云端同步最新数据', 'success');
      } else if (LU > LS) {
        /* 仅本地有新数据 → 推送 */
        doPush({}, function () { busy = false; });
      } else {
        /* 两边一致 */
        cfg.lastSyncedAt = Math.max(SU, LU); saveCfg();
        setStatus('ok', '云端：已同步 ' + timeStr(Date.now()));
        busy = false;
        if (opts.manual) global.UI.toast('云端与本地已一致，无需同步', 'success');
      }
    });
  }

  /* 保存后的延迟自动推送（防抖，避免高频请求） */
  function schedule() {
    if (!enabled()) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      pushTimer = null;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      syncNow({ quiet: true });
    }, 2500);
  }

  /* ---------- 初始化 ---------- */
  function init() {
    loadCfg();
    if (!enabled()) { setStatus('hidden'); return; }
    setStatus('syncing', '云端：同步中…');
    syncNow({ quiet: true });

    /* 首次连接若失败（如网络尚未就绪），15 秒后自动重试一次 */
    setTimeout(function () {
      if (enabled() && !lastOk) syncNow({ quiet: true });
    }, 15000);

    global.addEventListener('online', function () {
      syncNow({ quiet: true });
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      var now = Date.now();
      if (now - lastForegroundSync < 60000) return; // 最多每分钟回前台同步一次
      lastForegroundSync = now;
      syncNow({ quiet: true });
    });
  }

  /* ---------- 对外接口 ---------- */
  global.Sync = {
    init: init,
    enabled: function () { loadCfg(); return !!cfg.url; },
    getConfig: function () {
      loadCfg();
      return { url: cfg.url, token: cfg.token, lastSyncedAt: cfg.lastSyncedAt };
    },
    setConfig: function (url, token) {
      loadCfg();
      cfg.url = String(url || '').trim();
      cfg.token = String(token || '').trim();
      cfg.lastSyncedAt = 0; // 游标清零，强制做一次完整同步
      saveCfg();
      if (cfg.url) {
        setStatus('syncing', '云端：同步中…');
        syncNow({ quiet: true });
      } else {
        setStatus('hidden');
        global.UI.toast('已关闭云端同步，恢复纯本机模式', 'success');
      }
    },
    syncNow: function () { syncNow({ manual: true }); },
    schedule: schedule
  };
})(window);
