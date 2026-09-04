/* ============================================================
   交易台账：记录每笔买卖（股数、成本、理由、依据规则）
   ============================================================ */
(function (global) {
  'use strict';
  var S = Store;
  var esc = S.esc;

  var filters = { q: '', dir: 'all', review: 'all', from: '', to: '' };

  function render(el) {
    var pos = S.computePositions();

    var list = S.state.trades.filter(function (t) {
      if (filters.q) {
        var hay = (t.code + ' ' + (t.name || '') + ' ' + (t.reason || '')).toLowerCase();
        if (hay.indexOf(filters.q.toLowerCase()) < 0) return false;
      }
      if (filters.dir !== 'all' && t.direction !== filters.dir) return false;
      if (filters.review !== 'all') {
        var has = !!S.getReviewByTrade(t.id);
        if ((filters.review === 'yes') !== has) return false;
      }
      if (filters.from && t.date < filters.from) return false;
      if (filters.to && t.date > filters.to) return false;
      return true;
    }).sort(function (a, b) {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.createdAt || '') > (a.createdAt || '') ? 1 : -1;
    });

    el.innerHTML =
      '<div class="view-title">' +
        '<h2>交易台账</h2>' +
        '<p>每笔交易必须写清买卖理由并勾选所依据的指导思想，复盘时将逐条对照检查</p>' +
      '</div>' +

      '<div class="panel" style="padding:12px 16px">' +
        '<div class="hint-flow"><b>当前持仓：</b>' +
        (pos.positions.length ? pos.positions.map(function (p) {
          return '<span class="pos-chip">' + esc(p.code) + ' ' + esc(p.name || '') + ' · ' + p.shares + '股 · 成本' + S.fmtMoney(p.avg) + '</span>';
        }).join(' ') : '<span class="small">空仓</span>') +
        '</div>' +
      '</div>' +

      '<div class="filter-bar">' +
        '<button class="btn primary" type="button" onclick="TradesView.openForm()">+ 记一笔交易</button>' +
        '<input type="search" placeholder="搜索代码 / 名称 / 理由" value="' + esc(filters.q) + '" onchange="TradesView.setFilter(\'q\', this.value)">' +
        '<select onchange="TradesView.setFilter(\'dir\', this.value)">' +
          '<option value="all">全部方向</option>' +
          '<option value="buy" ' + (filters.dir === 'buy' ? 'selected' : '') + '>仅买入</option>' +
          '<option value="sell" ' + (filters.dir === 'sell' ? 'selected' : '') + '>仅卖出</option>' +
        '</select>' +
        '<select onchange="TradesView.setFilter(\'review\', this.value)">' +
          '<option value="all">全部复盘状态</option>' +
          '<option value="yes" ' + (filters.review === 'yes' ? 'selected' : '') + '>已复盘</option>' +
          '<option value="no" ' + (filters.review === 'no' ? 'selected' : '') + '>待复盘</option>' +
        '</select>' +
        '<label class="small muted">从 <input type="date" style="width:auto" value="' + filters.from + '" onchange="TradesView.setFilter(\'from\', this.value)"></label>' +
        '<label class="small muted">至 <input type="date" style="width:auto" value="' + filters.to + '" onchange="TradesView.setFilter(\'to\', this.value)"></label>' +
      '</div>' +

      (list.length ? tableHtml(list, pos) :
        '<div class="empty">没有符合条件的交易<br><span class="small">点「+ 记一笔交易」开始记录</span></div>');
  }

  function tableHtml(list, pos) {
    var rb = pos.realizedByTrade;
    var rows = list.map(function (t) {
      var r = S.getReviewByTrade(t.id);
      var realized = t.direction === 'sell' && rb[t.id] != null ? rb[t.id] : null;
      var rules = (t.principleIds || []).map(function (pid) {
        var p = S.getPrinciple(pid);
        return p ? p.name : null;
      }).filter(Boolean);
      var emo = t.emotion ? S.EMOTIONS[t.emotion] : '';
      return '<tr>' +
        '<td>' + t.date + '</td>' +
        '<td><div class="cell-main">' + esc(t.code) + '</div><div class="cell-sub">' + esc(t.name || '') + '</div></td>' +
        '<td><span class="' + (t.direction === 'buy' ? 'dir-buy' : 'dir-sell') + '">' + (t.direction === 'buy' ? '买入' : '卖出') + '</span></td>' +
        '<td class="num">' + t.price.toFixed(2) + '<div class="cell-sub">× ' + t.shares + ' 股</div></td>' +
        '<td class="num">' + S.fmtMoney(t.price * t.shares) + '</td>' +
        '<td><span class="truncated" title="' + esc(t.reason) + '">' + esc(t.reason) + '</span>' +
          (rules.length ? '<div class="cell-sub">依据：' + esc(rules.join('、')) + '</div>' : '<div class="cell-sub c-amber">未勾选任何规则</div>') +
        '</td>' +
        '<td>' + (emo ? '<span class="small">' + emo + '</span>' : '—') + '</td>' +
        '<td class="num">' + (realized == null ? '—' : '<span class="' + (realized > 0 ? 'c-up' : 'c-down') + '">' + S.fmtMoney(realized, true) + '</span>') + '</td>' +
        '<td class="ctr">' + (r
          ? '<span class="result-badge res-' + r.result + '">' + S.RESULT_SHORT[r.result] + '</span>'
          : '<button class="btn tiny primary" type="button" onclick="ReviewView.openForm(\'' + t.id + '\')">复盘</button>') + '</td>' +
        '<td class="ctr"><div class="ops">' +
          '<button class="btn tiny ghost" type="button" onclick="TradesView.openForm(\'' + t.id + '\')">编辑</button>' +
          '<button class="btn tiny danger" type="button" onclick="TradesView.remove(\'' + t.id + '\')">删除</button>' +
        '</div></td>' +
        '</tr>';
    }).join('');

    return '<div class="table-wrap"><table><thead><tr>' +
      '<th>日期</th><th>股票</th><th>方向</th><th class="num">价格/股数</th><th class="num">金额</th>' +
      '<th>买卖理由与依据</th><th>情绪</th><th class="num">该笔盈亏</th><th class="ctr">复盘</th><th class="ctr">操作</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  /* ---------------- 交易表单 ---------------- */
  function openForm(id) {
    var t = id ? S.getTrade(id) : null;
    var active = S.activePrinciples();
    var checked = {};
    if (t) (t.principleIds || []).forEach(function (p) { checked[p] = true; });

    var ruleBoxes = active.length ? Object.keys(S.CATS).map(function (cat) {
      var items = active.filter(function (p) { return p.category === cat; });
      if (!items.length) return '';
      /* 按子分支再分组 */
      var subGroups = Object.keys(S.CATS[cat].sub).map(function (sub) {
        var subItems = items.filter(function (p) { return p.subBranch === sub; });
        if (!subItems.length) return '';
        return '<div class="sub-branch-title small">' + S.CATS[cat].sub[sub] + '</div>' +
          subItems.map(function (p) {
            return '<label class="small" style="display:block;margin:3px 0;cursor:pointer" title="' + esc(p.content) + '">' +
              '<input type="checkbox" name="tfRules" value="' + p.id + '" ' + (checked[p.id] ? 'checked' : '') + '> ' +
              esc(p.name) + (p.isVeto ? ' <span class="veto-badge tiny">否决</span>' : '') + '<span class="muted">（' + esc(p.content) + '）</span></label>';
          }).join('');
      }).join('');
      return '<div class="cat-group-title">' + S.CATS[cat].label + '</div>' + subGroups;
    }).join('') : '<span class="small c-amber">思想库中暂无启用状态的规则，建议先去「思想库」沉淀规则</span>';

    UI.openModal({
      title: t ? '编辑交易：' + esc(t.code) + ' ' + esc(t.name || '') : '记一笔交易',
      wide: true,
      body:
        '<div class="form-grid">' +
          '<label class="field"><span class="req">股票代码（字母数字）</span><input type="text" id="tfCode" maxlength="10" placeholder="600519" value="' + esc(t ? t.code : '') + '"></label>' +
          '<label class="field"><span>名称</span><input type="text" id="tfName" maxlength="12" placeholder="贵州茅台" value="' + esc(t ? t.name || '' : '') + '"></label>' +
          '<label class="field"><span class="req">方向</span><select id="tfDir">' +
            '<option value="buy" ' + (!t || t.direction === 'buy' ? 'selected' : '') + '>买入</option>' +
            '<option value="sell" ' + (t && t.direction === 'sell' ? 'selected' : '') + '>卖出</option>' +
          '</select></label>' +
          '<label class="field"><span class="req">日期</span><input type="date" id="tfDate" value="' + esc(t ? t.date : S.todayStr()) + '"></label>' +
          '<label class="field"><span class="req">成交价</span><input type="number" id="tfPrice" step="0.01" min="0.01" placeholder="1680.00" value="' + (t ? t.price : '') + '"></label>' +
          '<label class="field"><span class="req">股数</span><input type="number" id="tfShares" step="100" min="1" placeholder="100" value="' + (t ? t.shares : '') + '"></label>' +
          '<label class="field"><span>手续费（元，可 0）</span><input type="number" id="tfFee" step="0.01" min="0" value="' + (t ? (t.fee || 0) : 5) + '"></label>' +
          '<label class="field"><span>下单时情绪</span><select id="tfEmotion">' +
            '<option value="">未记录</option>' +
            Object.keys(S.EMOTIONS).map(function (k) {
              return '<option value="' + k + '" ' + (t && t.emotion === k ? 'selected' : '') + '>' + S.EMOTIONS[k] + '</option>';
            }).join('') +
          '</select></label>' +
          '<label class="field"><span>计划止损价</span><input type="number" id="tfStop" step="0.01" min="0" placeholder="买入时必填" value="' + (t && t.planStop ? t.planStop : '') + '"></label>' +
          '<label class="field"><span>计划目标价</span><input type="number" id="tfTarget" step="0.01" min="0" placeholder="1850.00" value="' + (t && t.planTarget ? t.planTarget : '') + '"></label>' +
          '<label class="field full"><span class="req">买卖理由（为什么做这笔交易）</span><textarea id="tfReason" rows="3" placeholder="例如：回踩20日线缩量企稳，趋势与量价同时满足，分批建仓">' + esc(t ? t.reason || '' : '') + '</textarea></label>' +
        '</div>' +
        '<div class="field"><span>本笔交易所依据的指导思想（复盘时逐条对照）</span>' + ruleBoxes + '</div>' +
        '<div class="form-actions">' +
          '<button class="btn ghost" type="button" onclick="UI.closeTop()">取消</button>' +
          '<button class="btn primary" type="button" onclick="TradesView.save(\'' + (t ? t.id : '') + '\')">保存交易</button>' +
        '</div>'
    });
  }

  function readForm() {
    var code = document.getElementById('tfCode').value.trim().toUpperCase();
    var price = parseFloat(document.getElementById('tfPrice').value);
    var shares = parseInt(document.getElementById('tfShares').value, 10);
    if (!/^[A-Z0-9]{1,10}$/.test(code)) { UI.toast('股票代码需为字母或数字（如 600519）', 'error'); return null; }
    if (!(price > 0)) { UI.toast('请填写有效的成交价', 'error'); return null; }
    if (!(shares > 0)) { UI.toast('请填写有效的股数', 'error'); return null; }
    var stop = parseFloat(document.getElementById('tfStop').value);
    var target = parseFloat(document.getElementById('tfTarget').value);
    return {
      code: code,
      name: document.getElementById('tfName').value.trim(),
      direction: document.getElementById('tfDir').value,
      date: document.getElementById('tfDate').value || S.todayStr(),
      price: price,
      shares: shares,
      fee: parseFloat(document.getElementById('tfFee').value) || 0,
      reason: document.getElementById('tfReason').value.trim(),
      emotion: document.getElementById('tfEmotion').value || null,
      planStop: isNaN(stop) ? null : stop,
      planTarget: isNaN(target) ? null : target,
      principleIds: Array.prototype.map.call(
        document.querySelectorAll('input[name="tfRules"]:checked'),
        function (c) { return c.value; })
    };
  }

  function save(id) {
    var data = readForm();
    if (!data) return;
    if (!data.reason) { UI.toast('买卖理由为必填项——写不出理由就不该下单', 'error'); return; }

    if (data.direction === 'sell') {
      var posMap = {};
      S.computePositions().positions.forEach(function (p) { posMap[p.code] = p; });
      var cur = id ? positionAfterRemoving(id, data.code) : posMap[data.code];
      var held = cur ? cur.shares : 0;
      if (held < data.shares) {
        UI.toast('卖出数量超过当前持仓（' + data.code + ' 仅持有 ' + held + ' 股）', 'error');
        return;
      }
    }

    if (id) {
      var t = S.getTrade(id);
      Object.assign(t, data, { updatedAt: Date.now() });
    } else {
      S.state.trades.push(Object.assign(
        { id: S.uid(), createdAt: Date.now(), updatedAt: Date.now() }, data));
    }
    S.save();
    UI.closeTop();
    render(document.getElementById('view'));
    UI.toast(id ? '交易已更新' : '交易已记录，持仓与统计已自动刷新', 'success');
  }

  function positionAfterRemoving(tradeId, code) {
    var trades = S.state.trades.filter(function (t) { return t.id !== tradeId; });
    var shares = 0;
    trades.forEach(function (t) {
      if (t.code !== code) return;
      shares += t.direction === 'buy' ? t.shares : -t.shares;
    });
    return { code: code, shares: Math.max(0, shares) };
  }

  function remove(id) {
    var t = S.getTrade(id);
    if (!t) return;
    UI.confirmDialog('删除交易', '确定删除 ' + t.date + ' ' + S.esc(t.code) + ' 的这笔交易？<br><span class="small muted">持仓、盈亏统计会随之重算；对应复盘记录也会一并删除。</span>', true)
      .then(function (ok) {
        if (!ok) return;
        S.state.trades = S.state.trades.filter(function (x) { return x.id !== id; });
        S.state.reviews = S.state.reviews.filter(function (r) { return r.tradeId !== id; });
        S.save();
        render(document.getElementById('view'));
        UI.toast('交易已删除', 'success');
      });
  }

  function setFilter(k, v) {
    filters[k] = v;
    render(document.getElementById('view'));
  }

  global.TradesView = {
    render: render, openForm: openForm, save: save,
    remove: remove, setFilter: setFilter
  };
})(window);
