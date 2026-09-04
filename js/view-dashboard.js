/* ============================================================
   总览：资产概览、当前持仓、待办提醒、最近交易
   ============================================================ */
(function (global) {
  'use strict';
  var S = Store;
  var H = { esc: S.esc, fmtMoney: S.fmtMoney, fmtPct: S.fmtPct, fmtNum: S.fmtNum };

  function cls(v) { return v > 0 ? 'c-up' : (v < 0 ? 'c-down' : 'c-ink'); }

  function render(el) {
    var st = S.state;
    var pos = S.computePositions();
    var closed = S.closedTradeStats();
    var disc = S.disciplineStats();

    var market = 0, hasPrice = true;
    pos.positions.forEach(function (p) {
      var px = st.prices[p.code];
      if (px > 0) market += px * p.shares; else hasPrice = false;
    });
    var floatPnl = 0;
    pos.positions.forEach(function (p) {
      var px = st.prices[p.code];
      if (px > 0) floatPnl += (px - p.avg) * p.shares;
    });
    var floatPct = market > 0 ? floatPnl / (market - floatPnl) * 100 : null;

    var pending = st.trades.filter(function (t) { return !S.getReviewByTrade(t.id); })
      .sort(function (a, b) { return b.date.localeCompare(a.date); });

    var recent = st.trades.slice().sort(function (a, b) {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.createdAt || '') > (a.createdAt || '') ? 1 : -1;
    }).slice(0, 6);

    var rules = st.principles;
    var verified = rules.filter(function (p) { return p.status === 'verified'; }).length;

    el.innerHTML =
      '<div class="view-title">' +
        '<h2>总览</h2>' +
        '<p>沉淀闭环：录入素材 <span class="arrow">→</span> 提炼规则 <span class="arrow">→</span> 记交易勾规则 <span class="arrow">→</span> 复盘对照 <span class="arrow">→</span> 迭代规则</p>' +
      '</div>' +

      '<div class="stat-grid">' +
        '<div class="stat-card"><div class="stat-label">净投入现金</div><div class="stat-value">' + H.fmtMoney(pos.invested) + '</div><div class="stat-sub">买入总额 - 卖出回笼</div></div>' +
        '<div class="stat-card"><div class="stat-label">持仓市值' + (hasPrice ? '' : '（待填现价）') + '</div><div class="stat-value">' + H.fmtMoney(market) + '</div><div class="stat-sub">持仓 ' + pos.positions.length + ' 只 · 现价需手动更新</div></div>' +
        '<div class="stat-card"><div class="stat-label">浮动盈亏</div><div class="stat-value ' + cls(floatPnl) + '">' + (hasPrice || !pos.positions.length ? H.fmtMoney(floatPnl, true) : '—') + '</div><div class="stat-sub">' + (floatPct != null ? H.fmtPct(floatPct) : '填入现价后计算') + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">已实现盈亏</div><div class="stat-value ' + cls(pos.realizedTotal) + '">' + H.fmtMoney(pos.realizedTotal, true) + '</div><div class="stat-sub">已平仓 ' + closed.closed + ' 笔 · 胜率 ' + (closed.winRate == null ? '—' : closed.winRate.toFixed(0) + '%') + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">纪律执行度</div><div class="stat-value ' + (disc.compliance == null ? 'c-ink' : (disc.compliance >= 80 ? 'c-up' : 'c-down')) + '">' + (disc.compliance == null ? '—' : disc.compliance.toFixed(0) + '%') + '</div><div class="stat-sub">复盘 ' + st.reviews.length + ' 次 · 遵守 ' + disc.yes + ' / 违反 ' + disc.no + '</div></div>' +
        '<div class="stat-card' + (pending.length ? ' warn' : '') + '"><div class="stat-label">待复盘交易</div><div class="stat-value">' + pending.length + '</div><div class="stat-sub">' + (pending.length ? '有交易等待对照纪律复盘' : '全部交易已复盘') + '</div></div>' +
      '</div>' +

      '<div class="two-col">' +
        '<div class="panel"><div class="panel-head"><h2>当前持仓</h2><span class="sub">在"现价"列输入最新价，立即计算市值与浮盈亏</span></div>' + positionsHtml(pos) + '</div>' +
        '<div>' +
          '<div class="panel"><div class="panel-head"><h2>待复盘提醒</h2><span class="sub">' + pending.length + ' 笔未复盘</span></div>' + pendingHtml(pending) + '</div>' +
          '<div class="panel"><div class="panel-head"><h2>思想库概况</h2><button class="btn link" type="button" onclick="App.go(\'principles\')">进入思想库 →</button></div>' +
            '<p class="small muted">原始素材 ' + st.materials.length + ' 条 · 指导规则 ' + rules.length + ' 条（已验证 ' + verified + ' · 试验中 ' + rules.filter(function (p) { return p.status === 'trial'; }).length + ' · 已废弃 ' + rules.filter(function (p) { return p.status === 'retired'; }).length + '）</p>' +
            '<p class="small muted" style="margin-top:6px">个股问询 ' + st.checks.length + ' 次 · 交易记录 ' + st.trades.length + ' 笔</p>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="panel"><div class="panel-head"><h2>最近交易</h2><button class="btn link" type="button" onclick="App.go(\'trades\')">查看全部 →</button></div>' + recentHtml(recent, closed.realizedByTrade) + '</div>' +

      '<p class="small muted">配色遵循 A 股习惯：红色 = 盈利 / 看多，绿色 = 亏损 / 看空。本页所有数据仅保存在本机浏览器。</p>';
  }

  function positionsHtml(pos) {
    if (!pos.positions.length) {
      return '<div class="empty">暂无持仓<br><span class="small">到「交易台账」记一笔买入后，这里会自动汇总成本与股数</span></div>';
    }
    var rows = pos.positions.map(function (p) {
      var px = S.state.prices[p.code] || '';
      var mv = px ? px * p.shares : null;
      var pnl = px ? (px - p.avg) * p.shares : null;
      var pnlPct = px ? (px - p.avg) / p.avg * 100 : null;
      return '<tr>' +
        '<td><div class="cell-main">' + H.esc(p.code) + '</div><div class="cell-sub">' + H.esc(p.name || '') + '</div></td>' +
        '<td class="num">' + H.fmtNum(p.shares) + ' 股</td>' +
        '<td class="num">' + H.fmtMoney(p.avg) + '</td>' +
        '<td class="num"><input class="price-input" type="number" step="0.01" min="0" value="' + (px || '') + '" placeholder="填现价" onchange="DashboardView.setPrice(\'' + H.esc(p.code) + '\', this.value)"></td>' +
        '<td class="num">' + (mv == null ? '—' : H.fmtMoney(mv)) + '</td>' +
        '<td class="num ' + (pnl == null ? '' : cls(pnl)) + '">' + (pnl == null ? '—' : H.fmtMoney(pnl, true) + ' (' + H.fmtPct(pnlPct) + ')') + '</td>' +
        '</tr>';
    }).join('');
    return '<div class="table-wrap"><table><thead><tr><th>股票</th><th class="num">持股</th><th class="num">摊薄成本</th><th class="num">现价</th><th class="num">市值</th><th class="num">浮动盈亏</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function pendingHtml(pending) {
    if (!pending.length) return '<div class="empty">没有待复盘的交易</div>';
    var rows = pending.slice(0, 5).map(function (t) {
      return '<tr>' +
        '<td>' + t.date + '</td>' +
        '<td><div class="cell-main">' + H.esc(t.code) + ' ' + H.esc(t.name || '') + '</div></td>' +
        '<td class="' + (t.direction === 'buy' ? 'dir-buy' : 'dir-sell') + '">' + (t.direction === 'buy' ? '买入' : '卖出') + '</td>' +
        '<td class="ctr"><button class="btn tiny primary" type="button" onclick="ReviewView.openForm(\'' + t.id + '\')">开始复盘</button></td>' +
        '</tr>';
    }).join('');
    return '<div class="table-wrap"><table><thead><tr><th>日期</th><th>股票</th><th>方向</th><th class="ctr">操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      (pending.length > 5 ? '<p class="small muted" style="margin-top:8px">仅显示最近 5 笔，其余请到「复盘中心」处理</p>' : '');
  }

  function recentHtml(recent, rb) {
    if (!recent.length) return '<div class="empty">暂无交易记录</div>';
    var rows = recent.map(function (t) {
      var r = S.getReviewByTrade(t.id);
      var realized = t.direction === 'sell' && rb[t.id] != null ? rb[t.id] : null;
      return '<tr>' +
        '<td>' + t.date + '</td>' +
        '<td><div class="cell-main">' + H.esc(t.code) + '</div><div class="cell-sub">' + H.esc(t.name || '') + '</div></td>' +
        '<td class="' + (t.direction === 'buy' ? 'dir-buy' : 'dir-sell') + '">' + (t.direction === 'buy' ? '买' : '卖') + '</td>' +
        '<td class="num">' + t.price.toFixed(2) + ' × ' + t.shares + '</td>' +
        '<td class="num">' + (realized == null ? '—' : '<span class="' + cls(realized) + '">' + H.fmtMoney(realized, true) + '</span>') + '</td>' +
        '<td>' + (r ? '<span class="result-badge res-' + r.result + '">' + S.RESULT_SHORT[r.result] + '</span>' : '<span class="small muted">待复盘</span>') + '</td>' +
        '</tr>';
    }).join('');
    return '<div class="table-wrap"><table><thead><tr><th>日期</th><th>股票</th><th>方向</th><th class="num">价格 × 股数</th><th class="num">该笔盈亏</th><th>复盘</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function setPrice(code, v) {
    var n = parseFloat(v);
    if (isNaN(n) || n <= 0) { UI.toast('请输入有效的现价', 'error'); return; }
    S.state.prices[code] = n;
    S.save();
    render(document.getElementById('view'));
    UI.toast('现价已更新：' + code + ' = ' + n.toFixed(2), 'success');
  }

  global.DashboardView = { render: render, setPrice: setPrice };
})(window);
