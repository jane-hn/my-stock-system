/* ============================================================
   设置：数据备份 / 恢复 / 导入导出、本地 AI（Ollama）配置
   ============================================================ */
(function (global) {
  'use strict';
  var S = Store;
  var esc = S.esc;

  function render(el) {
    var st = S.state;
    var size = 0;
    try { size = (localStorage.getItem('my_stock_system_v1') || '').length / 1024; } catch (e) { size = 0; }
    var sync = global.Sync ? global.Sync.getConfig() : { url: '', token: '', lastSyncedAt: 0 };
    var syncInfo = sync.url
      ? '当前已连接：<code>' + esc(sync.url) + '</code>' + (sync.lastSyncedAt ? ' · 上次同步 ' + new Date(sync.lastSyncedAt).toLocaleString('zh-CN', { hour12: false }) : ' · 尚未完成首次同步')
      : '尚未配置。不配置则保持纯本机离线模式，功能不受影响。';

    el.innerHTML =
      '<div class="view-title"><h2>设置</h2><p>数据管理、备份恢复、云端同步与本地 AI 配置</p></div>' +

      '<div class="panel"><div class="panel-head"><h2>数据概况</h2></div>' +
        '<div class="stat-grid" style="margin-bottom:0">' +
          '<div class="stat-card"><div class="stat-label">原始素材</div><div class="stat-value">' + st.materials.length + ' 条</div></div>' +
          '<div class="stat-card"><div class="stat-label">指导规则</div><div class="stat-value">' + st.principles.length + ' 条</div></div>' +
          '<div class="stat-card"><div class="stat-label">交易记录</div><div class="stat-value">' + st.trades.length + ' 笔</div></div>' +
          '<div class="stat-card"><div class="stat-label">复盘 / 问询</div><div class="stat-value">' + st.reviews.length + ' / ' + st.checks.length + '</div></div>' +
          '<div class="stat-card"><div class="stat-label">占用空间</div><div class="stat-value">' + (size < 1024 ? size.toFixed(1) + ' KB' : (size / 1024).toFixed(2) + ' MB') + '</div><div class="stat-sub">浏览器本地存储</div></div>' +
        '</div>' +
        '<div class="notice" style="margin-top:14px"><b>数据在哪里？</b>默认全部保存在当前浏览器（本机）本地存储中：不上传、断网可用。换浏览器 / 换电脑 / 清理浏览器数据会丢失，请养成导出备份的习惯；或配置下方「云端同步」，让数据自动在多设备间同步并常驻云端。</div>' +
      '</div>' +

      '<div class="panel"><div class="panel-head"><h2>云端同步（多设备 · 24 小时在线）</h2><span class="sub">配置后电脑关机也能用手机记账复盘</span></div>' +
        '<div class="form-grid">' +
          '<label class="field"><span>服务器地址</span><input type="text" id="setSyncUrl" inputmode="url" placeholder="例如 https://my-stock.onrender.com" value="' + esc(sync.url) + '"></label>' +
          '<label class="field"><span>访问令牌（服务端启动时设置的 TOKEN 密码）</span><input type="text" id="setSyncToken" placeholder="服务端未设令牌则留空" value="' + esc(sync.token) + '"></label>' +
        '</div>' +
        '<div class="form-actions left">' +
          '<button class="btn primary" type="button" onclick="SettingsView.saveSync()">保存并立即同步</button>' +
          '<button class="btn ghost" type="button" onclick="SettingsView.testSync()">测试连接</button>' +
          (sync.url ? '<button class="btn danger" type="button" onclick="SettingsView.clearSync()">停止同步</button>' : '') +
        '</div>' +
        '<div id="syncTestResult" class="small muted" style="margin-top:10px">' + syncInfo + '</div>' +
        '<div class="notice" style="margin-top:12px"><b>怎么让系统 24 小时在线？</b>把本文件夹部署到云端免费主机（Render 等，步骤见「部署指南.md」），得到一个网址后填到上面即可。此后手机与电脑打开同一网址，数据自动双向同步：联网时秒级同步，离线时先记在本机、恢复联网自动补传；两台设备都离线改过时，按"每条记录最新者优先"自动合并。同步只传输你自己的数据文件，服务器不看内容、不分析。</div>' +
      '</div>' +

      '<div class="panel"><div class="panel-head"><h2>备份与恢复</h2><span class="sub">建议每周导出一次，重要节点（大改规则后）再导一次</span></div>' +
        '<div class="form-actions left">' +
          '<button class="btn primary" type="button" onclick="SettingsView.exportData()">导出全部数据（JSON）</button>' +
          '<button class="btn ghost" type="button" onclick="document.getElementById(\'importFile\').click()">导入备份文件</button>' +
          '<input type="file" id="importFile" accept=".json,application/json" style="display:none" onchange="SettingsView.importData(this)">' +
        '</div>' +
        '<div class="filter-bar" style="margin-top:12px;margin-bottom:0">' +
          '<span class="small muted">导入方式：</span>' +
          '<label class="small"><input type="radio" name="importMode" value="replace" checked> 替换（清空现有数据，完全还原备份）</label>' +
          '<label class="small"><input type="radio" name="importMode" value="merge"> 合并（把备份中不存在的内容追加进来）</label>' +
        '</div>' +
      '</div>' +

      '<div class="panel"><div class="panel-head"><h2>本地 AI（Ollama）配置</h2><span class="sub">可选功能：接入后"个股问询"页可用 AI 深度分析，全程离线</span></div>' +
        '<div class="form-grid">' +
          '<label class="field"><span>Ollama 服务地址</span><input type="text" id="setUrl" placeholder="http://localhost:11434" value="' + esc(st.settings.ollamaUrl) + '"></label>' +
          '<label class="field"><span>模型名称</span><input type="text" id="setModel" placeholder="qwen2.5:7b" value="' + esc(st.settings.ollamaModel) + '"></label>' +
        '</div>' +
        '<div class="form-actions left">' +
          '<button class="btn primary" type="button" onclick="SettingsView.saveAI()">保存 AI 设置</button>' +
          '<button class="btn ghost" type="button" onclick="SettingsView.testAI()">测试连接并列出模型</button>' +
        '</div>' +
        '<div id="aiTestResult" class="small muted" style="margin-top:10px"></div>' +
        '<div class="notice" style="margin-top:12px"><b>三步接入</b>：1) 到 ollama.com 下载安装并运行；2) 终端执行 ollama pull qwen2.5:7b（模型任选，7B 级别即可流畅回答）；3) 因本页以本地文件打开，需允许跨域——Windows 在「系统环境变量」新增 OLLAMA_ORIGINS 值为 * 后重启 Ollama；macOS/Linux 执行 launchctl setenv OLLAMA_ORIGINS "*"（或 OLLAMA_ORIGINS="*" ollama serve）后重启。详细步骤见 README。</div>' +
      '</div>' +

      '<div class="panel"><div class="panel-head"><h2>演示数据与重置</h2><span class="sub">当前数据中包含一套示例（贵州茅台 / 宁德时代的演示交易与规则）</span></div>' +
        '<div class="form-actions left">' +
          '<button class="btn ghost" type="button" onclick="SettingsView.loadDemo()">载入演示数据（覆盖现有）</button>' +
          '<button class="btn danger" type="button" onclick="SettingsView.clearAll()">清空全部数据</button>' +
        '</div>' +
      '</div>' +

      '<div class="panel"><div class="panel-head"><h2>使用提示</h2></div>' +
        '<div class="notice">' +
          '<b>电脑离线使用</b>：双击 index.html 即可，无需联网、无需安装任何软件。<br>' +
          '<b>手机使用</b>：浏览器打开系统网址后，选「添加到主屏幕」，即可像 App 一样全屏使用，断网也能打开（需通过 http/https 访问）。<br>' +
          '<b>电脑关机还想用</b>：配置上方「云端同步」——把系统部署到云端免费主机（见「部署指南.md」），网址随时可访问，与电脑数据自动同步。<br>' +
          '<b>推荐浏览器</b>：电脑 Chrome / Edge；手机 Safari / Chrome。<br>' +
          '<b>换电脑 / 换浏览器</b>：配置了云端同步则自动同步；否则先导出 JSON，再到新环境导入（替换模式）。<br>' +
          '<b>本系统不提供行情数据</b>：现价请在「总览」持仓表手动更新；个股问询的逐条判断基于你的观察，这本身也是训练盘感的过程。' +
        '</div>' +
      '</div>';
  }

  function exportData() {
    try {
      var blob = new Blob([S.exportJSON()], { type: 'application/json' });
      var a = document.createElement('a');
      var d = new Date();
      var pad = function (n) { return String(n).padStart(2, '0'); };
      a.href = URL.createObjectURL(blob);
      a.download = '我的交易系统备份_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
      UI.toast('备份文件已生成并开始下载，请妥善保存', 'success');
    } catch (e) {
      UI.toast('导出失败：' + e.message, 'error');
    }
  }

  function importData(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var mode = 'replace';
    var sel = document.querySelector('input[name="importMode"]:checked');
    if (sel) mode = sel.value;

    var reader = new FileReader();
    reader.onload = function () {
      try {
        S.importJSON(String(reader.result), mode);
        render(document.getElementById('view'));
        UI.toast('导入成功（' + (mode === 'replace' ? '替换' : '合并') + '模式）', 'success');
      } catch (e) {
        UI.toast('导入失败：' + e.message, 'error');
      }
    };
    reader.onerror = function () { UI.toast('读取文件失败', 'error'); };
    reader.readAsText(file);
    input.value = '';
  }

  function saveAI() {
    S.state.settings.ollamaUrl = document.getElementById('setUrl').value.trim() || 'http://localhost:11434';
    S.state.settings.ollamaModel = document.getElementById('setModel').value.trim();
    S.save();
    UI.toast('AI 设置已保存，可到「个股问询」使用 AI 分析', 'success');
  }

  function testAI() {
    var url = (document.getElementById('setUrl').value.trim() || 'http://localhost:11434').replace(/\/+$/, '');
    var box = document.getElementById('aiTestResult');
    box.textContent = '正在连接 ' + url + ' …';
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 8000);
    fetch(url + '/api/tags', { signal: controller.signal })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        clearTimeout(timer);
        var models = (data.models || []).map(function (m) { return m.name; });
        if (!models.length) {
          box.innerHTML = '连接成功，但本机还没有模型。请先执行 <b>ollama pull qwen2.5:7b</b> 拉取一个模型。';
          return;
        }
        var cur = document.getElementById('setModel').value.trim();
        if (!cur) document.getElementById('setModel').value = models[0];
        box.innerHTML = '连接成功。本机可用模型：' + models.map(function (m) { return '<span class="tag-chip">' + esc(m) + '</span>'; }).join(' ') +
          '<br>已自动填入' + (cur ? '当前' : '第一个') + '模型，点击「保存 AI 设置」生效。';
      })
      .catch(function (err) {
        clearTimeout(timer);
        box.innerHTML = '连接失败（' + esc(err.message || '未知错误') + '）。请确认 Ollama 已安装并正在运行；若本页为本地文件打开，还需设置环境变量 OLLAMA_ORIGINS=* 并重启 Ollama（详见 README）。';
      });
  }

  /* ---------- 云端同步 ---------- */
  function saveSync() {
    if (!global.Sync) { UI.toast('同步组件未加载，请刷新页面', 'error'); return; }
    var url = document.getElementById('setSyncUrl').value.trim();
    var token = document.getElementById('setSyncToken').value.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      UI.toast('地址需以 http:// 或 https:// 开头', 'error');
      return;
    }
    global.Sync.setConfig(url, token);
    UI.toast(url ? '已保存，正在与云端同步…' : '已清空服务器地址，恢复纯本机模式', 'success');
    render(document.getElementById('view'));
  }

  function clearSync() {
    UI.confirmDialog('停止云端同步', '停止后本机数据保留，但不再与云端互相同步。确定停止？')
      .then(function (ok) {
        if (!ok) return;
        global.Sync.setConfig('', '');
        render(document.getElementById('view'));
      });
  }

  function testSync() {
    var url = document.getElementById('setSyncUrl').value.trim();
    var token = document.getElementById('setSyncToken').value.trim();
    var box = document.getElementById('syncTestResult');
    if (!url) { box.innerHTML = '<span class="danger-text">请先填写服务器地址</span>'; return; }
    if (!/^https?:\/\//i.test(url)) { box.innerHTML = '<span class="danger-text">地址需以 http:// 或 https:// 开头</span>'; return; }
    box.textContent = '正在连接 ' + url + ' …';
    /* 代理/沙箱环境可能使 location 被污染，无法可靠做同源比较。
       策略：先尝试相对路径（同源时穿透代理），失败时回退绝对 URL。 */
    var base = url.replace(/\/+$/, '');
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 10000);
    var triedAbs = false;

    function doPing(pingUrl) {
      fetch(pingUrl, { headers: { 'X-Auth-Token': token }, signal: ctrl.signal })
        .then(function (r) {
          clearTimeout(timer);
          if (r.status === 401) throw new Error('令牌不正确：服务器要求的密码与本页填写的不一致');
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (j) {
          if (!j.ok) throw new Error('服务器响应异常');
          var needToken = j.hasToken && !token;
          box.innerHTML = '<span class="c-up">✓ 连接成功</span>。'
            + (j.updatedAt ? '云端已有数据（最后更新 ' + new Date(j.updatedAt).toLocaleString('zh-CN', { hour12: false }) + '）。' : '云端暂无数据，点「保存并立即同步」把本机数据推上去。')
            + (needToken ? '<br><span class="danger-text">注意：服务器已启用令牌，请填写令牌后再保存。</span>' : '');
        })
        .catch(function (err) {
          if (!triedAbs && err.name === 'TypeError') {
            /* 相对路径失败 → 回退绝对 URL */
            triedAbs = true;
            doPing(base + '/api/ping');
            return;
          }
          clearTimeout(timer);
          var msg = err.name === 'AbortError' ? '连接超时' : (err.message || '网络错误');
          box.innerHTML = '<span class="danger-text">✗ ' + esc(msg) + '</span>。请核对地址是否正确、服务是否在线（详见「部署指南.md」）。';
        });
    }

    doPing('/api/ping');
  }

  function loadDemo() {
    UI.confirmDialog('载入演示数据', '将用一套示例数据（含示例规则、交易与复盘）<b>覆盖当前全部数据</b>，确定？', true)
      .then(function (ok) {
        if (!ok) return;
        S.loadDemo();
        App.rerender();
        UI.toast('演示数据已载入', 'success');
      });
  }

  function clearAll() {
    UI.confirmDialog('清空全部数据', '将删除思想库、交易、复盘与问询的全部记录，且无法恢复（除非先导出了备份）。确定继续？', true)
      .then(function (ok) {
        if (!ok) return;
        return UI.confirmDialog('最后确认', '真的要清空吗？建议先「导出全部数据」留底。');
      })
      .then(function (ok) {
        if (!ok) return;
        S.reset();
        App.rerender();
        UI.toast('数据已清空，可以开始沉淀自己的体系了', 'success');
      });
  }

  global.SettingsView = {
    render: render, exportData: exportData, importData: importData,
    saveAI: saveAI, testAI: testAI, loadDemo: loadDemo, clearAll: clearAll,
    saveSync: saveSync, clearSync: clearSync, testSync: testSync
  };
})(window);
