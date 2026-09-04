/* ============================================================
   复盘中心：结合指导思想逐条对照检查每笔交易
   ============================================================ */
(function (global) {
  'use strict';
  var S = Store;
  var esc = S.esc;

  function render(el) {
    var disc = S.disciplineStats();
    var rb = S.computePositions().realizedByTrade;

    var quad = { right: 0, lucky: 0, ok: 0, wrong: 0, open: 0 };
    S.state.reviews.forEach(function (r) {
      if (quad[r.result] != null) quad[r.result]++;
    });

    var pending = S.state.trades.filter(function (t) { return !S.getReviewByTrade(t.id); })
      .sort(function (a, b) { return b.date.localeCompare(a.date); });

    el.innerHTML =
      '<div class="view-title">' +
        '<h2>复盘中心</h2>' +
        '<p>每笔交易对照当时勾选的指导思想逐条检查：是否真的遵守？赚钱靠纪律还是靠运气？</p>' +
      '</div>' +

      '<div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">' +
        '<div class="stat-card"><div class="stat-label">平均纪律执行度</div><div class="stat-value ' + (disc.compliance == null ? '' : (disc.compliance >= 80 ? 'c-up' : 'c-down')) + '">' + (disc.compliance == null ? '—' : disc.compliance.toFixed(0) + '%') + '</div><div class="compliance-bar"><i style="width:' + (disc.compliance || 0) + '%"></i></div><div class="stat-sub">遵守 ' + disc.yes + ' 次 · 违反 ' + disc.no + ' 次</div></div>' +
        '<div class="quad-card"><div class="stat-label c-up">正确 · 赚纪律内的钱</div><div class="num c-up">' + quad.right + '</div></div>' +
        '<div class="quad-card"><div class="stat-label c-amber">侥幸 · 赚钱但违纪</div><div class="num c-amber">' + quad.lucky + '</div></div>' +
        '<div class="quad-card"><div class="stat-label c-accent">可接受 · 亏钱但守纪</div><div class="num c-accent">' + quad.ok + '</div></div>' +
        '<div class="quad-card"><div class="stat-label c-down">错误 · 亏钱且违纪</div><div class="num c-down">' + quad.wrong + '</div></div>' +
      '</div>' +

      (Object.keys(disc.perRule).length ? ruleTableHtml(disc) : '') +

      '<div class="panel"><div class="panel-head"><h2>待复盘交易（' + pending.length + '）</h2><span class="sub">卖出交易优先复盘</span></div>' +
        (pending.length ? pendingTableHtml(pending) : '<div class="empty">全部交易都已复盘，保持这个习惯</div>') +
      '</div>' +

      '<div class="panel"><div class="panel-head"><h2>复盘记录（' + S.state.reviews.length + '）</h2></div>' +
        (S.state.reviews.length ? reviewListHtml(rb) : '<div class="empty">还没有复盘记录</div>') +
      '</div>' +

      '<div class="notice"><b>复盘四象限</b>：赚纪律内的钱 = 正确（重复做）；赚钱但违纪 = 侥幸（警惕，运气不可复制）；亏钱但守纪 = 可接受（成本，检查规则本身是否需要迭代）；亏钱且违纪 = 错误（立刻写改进动作）。未平仓的交易先记录执行检查，平仓后再补结果评价。</div>';
  }

  function ruleTableHtml(disc) {
    var rows = Object.keys(disc.perRule).map(function (pid) {
      var p = S.getPrinciple(pid);
      if (!p) return '';
      var st = disc.perRule[pid];
      var checked = st.yes + st.no;
      var violation = checked ? st.no / checked * 100 : 0;
      var sub = S.subLabel(p.category, p.subBranch);
      return '<tr>' +
        '<td><span class="cat-badge ' + S.CATS[p.category].cls + '">' + S.CATS[p.category].label + (sub ? ' · ' + esc(sub) : '') + '</span> ' + esc(p.name) + '</td>' +
        '<td class="ctr">' + checked + '</td>' +
        '<td class="ctr c-up">' + st.yes + '</td>' +
        '<td class="ctr c-down">' + st.no + '</td>' +
        '<td class="ctr">' + violation.toFixed(0) + '%</td>' +
        '<td class="ctr">' + (st.closedYes ? (st.winYes / st.closedYes * 100).toFixed(0) + '% (' + st.closedYes + ')' : '—') + '</td>' +
        '<td class="ctr">' + (st.closedNo ? (st.winNo / st.closedNo * 100).toFixed(0) + '% (' + st.closedNo + ')' : '—') + '</td>' +
        '</tr>';
    }).join('');
    return '<div class="panel"><div class="panel-head"><h2>规则维度统计</h2><span class="sub">哪条纪律最常被违反？守纪与违纪的胜率差多少？</span></div>' +
      '<div class="table-wrap"><table><thead><tr><th>规则</th><th class="ctr">被检查</th><th class="ctr">遵守</th><th class="ctr">违反</th><th class="ctr">违反率</th><th class="ctr">守纪时胜率</th><th class="ctr">违纪时胜率</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="small muted" style="margin-top:8px">胜率仅统计已平仓（卖出）交易。若"守纪时胜率"明显高于"违纪时胜率"，说明该规则值得升为"已验证"；反之考虑迭代或废弃。</p></div>';
  }

  function pendingTableHtml(pending) {
    var rows = pending.map(function (t) {
      return '<tr>' +
        '<td>' + t.date + '</td>' +
        '<td><div class="cell-main">' + esc(t.code) + ' ' + esc(t.name || '') + '</div></td>' +
        '<td><span class="' + (t.direction === 'buy' ? 'dir-buy' : 'dir-sell') + '">' + (t.direction === 'buy' ? '买入' : '卖出') + '</span></td>' +
        '<td class="num">' + t.price.toFixed(2) + ' × ' + t.shares + '</td>' +
        '<td><span class="truncated" title="' + esc(t.reason) + '">' + esc(t.reason) + '</span></td>' +
        '<td class="ctr"><button class="btn tiny primary" type="button" onclick="ReviewView.openForm(\'' + t.id + '\')">开始复盘</button></td>' +
        '</tr>';
    }).join('');
    return '<div class="table-wrap"><table><thead><tr><th>日期</th><th>股票</th><th>方向</th><th class="num">价格 × 股数</th><th>当时的理由</th><th class="ctr">操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function reviewListHtml(rb) {
    var rows = S.state.reviews.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); })
      .map(function (r) {
        var t = S.getTrade(r.tradeId);
        if (!t) return '';
        var realized = t.direction === 'sell' && rb[t.id] != null ? rb[t.id] : null;
        var yes = (r.checks || []).filter(function (c) { return c.verdict === 'yes'; }).length;
        var no = (r.checks || []).filter(function (c) { return c.verdict === 'no'; }).length;
        var comp = yes + no ? Math.round(yes / (yes + no) * 100) : null;
        return '<tr>' +
          '<td>' + t.date + '</td>' +
          '<td><div class="cell-main">' + esc(t.code) + ' ' + esc(t.name || '') + '</div><div class="cell-sub">' + (t.direction === 'buy' ? '买入' : '卖出') + ' ' + t.price.toFixed(2) + '×' + t.shares + '</div></td>' +
          '<td class="ctr"><span class="result-badge res-' + r.result + '">' + S.RESULT_SHORT[r.result] + '</span></td>' +
          '<td class="ctr">' + (comp == null ? '—' : comp + '%') + '<div class="cell-sub">遵守' + yes + ' / 违反' + no + '</div></td>' +
          '<td class="num">' + (realized == null ? '—' : '<span class="' + (realized > 0 ? 'c-up' : 'c-down') + '">' + S.fmtMoney(realized, true) + '</span>') + '</td>' +
          '<td><span class="truncated" title="' + esc(r.lesson || '') + '">' + esc(r.lesson || '') + '</span></td>' +
          '<td class="ctr"><div class="ops">' +
            '<button class="btn tiny ghost" type="button" onclick="ReviewView.openForm(\'' + t.id + '\')">查看/修改</button>' +
            '<button class="btn tiny danger" type="button" onclick="ReviewView.removeReview(\'' + r.id + '\')">删除</button>' +
          '</div></td>' +
          '</tr>';
      }).join('');
    return '<div class="table-wrap"><table><thead><tr><th>日期</th><th>交易</th><th class="ctr">结果</th><th class="ctr">纪律执行</th><th class="num">该笔盈亏</th><th>教训</th><th class="ctr">操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  /* ---------------- 复盘表单 ---------------- */
  function checkRowHtml(pid, verdict) {
    var p = S.getPrinciple(pid);
    if (!p) return '';
    return '<div class="review-check-row" id="row_' + pid + '">' +
      '<div class="check-q"><strong>' + esc(p.name) + '</strong><span class="muted">' + esc(p.content) + '</span></div>' +
      '<div class="seg">' +
        '<label class="v-yes"><input type="radio" name="rv_' + pid + '" value="yes" ' + (verdict === 'yes' ? 'checked' : '') + '>符合</label>' +
        '<label class="v-no"><input type="radio" name="rv_' + pid + '" value="no" ' + (verdict === 'no' ? 'checked' : '') + '>违反</label>' +
        '<label><input type="radio" name="rv_' + pid + '" value="na" ' + (verdict !== 'yes' && verdict !== 'no' ? 'checked' : '') + '>不适用</label>' +
      '</div>' +
    '</div>';
  }

  function openForm(tradeId) {
    var t = S.getTrade(tradeId);
    if (!t) return;
    var rv = S.getReviewByTrade(tradeId);
    var rb = S.computePositions().realizedByTrade;
    var realized = t.direction === 'sell' && rb[t.id] != null ? rb[t.id] : null;

    var pids = [];
    (t.principleIds || []).forEach(function (pid) { pids.push(pid); });
    if (rv) (rv.checks || []).forEach(function (c) {
      if (pids.indexOf(c.principleId) < 0) pids.push(c.principleId);
    });

    var rows = pids.map(function (pid) {
      var verdict = 'na';
      if (rv) {
        var c = (rv.checks || []).find(function (x) { return x.principleId === pid; });
        if (c) verdict = c.verdict;
      }
      return checkRowHtml(pid, verdict);
    }).join('') || '<p class="small c-amber">这笔交易当时没有勾选任何指导思想，可从下方补充要对照的规则。</p>';

    var addOptions = S.activePrinciples().filter(function (p) { return pids.indexOf(p.id) < 0; })
      .map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('');

    var rulesText = (t.principleIds || []).map(function (pid) {
      var p = S.getPrinciple(pid);
      return p ? esc(p.name) : null;
    }).filter(Boolean).join('、') || '未勾选';

    var suggest = rv ? rv.result : suggestResult(t, []);

    UI.openModal({
      title: '复盘：' + esc(t.code) + ' ' + esc(t.name || '') + '（' + t.date + '）',
      wide: true,
      body:
        '<div class="trade-summary">' +
          '<dl>' +
            '<div><dt>方向 / 数量</dt><dd><span class="' + (t.direction === 'buy' ? 'dir-buy' : 'dir-sell') + '">' + (t.direction === 'buy' ? '买入' : '卖出') + '</span> ' + t.price.toFixed(2) + ' × ' + t.shares + ' 股</dd></div>' +
            '<div><dt>该笔盈亏</dt><dd>' + (realized == null ? '未平仓' : '<span class="' + (realized > 0 ? 'c-up' : 'c-down') + '">' + S.fmtMoney(realized, true) + '</span>') + '</dd></div>' +
            '<div><dt>手续费</dt><dd>' + S.fmtMoney(t.fee || 0) + '</dd></div>' +
            '<div><dt>下单情绪</dt><dd>' + (t.emotion ? S.EMOTIONS[t.emotion] : '未记录') + '</dd></div>' +
            '<div><dt>计划止损 / 目标</dt><dd>' + (t.planStop ? S.fmtMoney(t.planStop) : '未设') + ' / ' + (t.planTarget ? S.fmtMoney(t.planTarget) : '未设') + '</dd></div>' +
            '<div><dt>依据的规则</dt><dd>' + rulesText + '</dd></div>' +
          '</dl>' +
          '<div class="reason-block">' + esc(t.reason || '（未填写理由）') + '</div>' +
        '</div>' +

        '<h4 style="font-size:13.5px;margin-bottom:4px">逐条对照：这笔交易实际执行时，是否遵守了这些规则？</h4>' +
        '<div id="rvRuleRows">' + rows + '</div>' +
        (addOptions ? '<div class="filter-bar" style="margin-top:10px">' +
          '<select id="rvAddRule" style="flex:1">' + addOptions + '</select>' +
          '<button class="btn ghost" type="button" onclick="ReviewView.addCheckRow()">补充对照规则</button>' +
        '</div>' : '') +

        '<div class="form-grid" style="margin-top:14px">' +
          '<label class="field full"><span>结果评价</span><select id="rvResult">' +
            Object.keys(S.RESULTS).map(function (k) {
              return '<option value="' + k + '" ' + (suggest === k ? 'selected' : '') + '>' + S.RESULTS[k] + '</option>';
            }).join('') +
          '</select></label>' +
          '<label class="field full"><span>教训与反思（这笔交易学到了什么）</span><textarea id="rvLesson" rows="3">' + esc(rv ? rv.lesson || '' : '') + '</textarea></label>' +
          '<label class="field full"><span>改进动作（下一次具体怎么做）</span><textarea id="rvImprovement" rows="3">' + esc(rv ? rv.improvement || '' : '') + '</textarea></label>' +
        '</div>' +
        '<div class="form-actions">' +
          '<button class="btn ghost" type="button" onclick="UI.closeTop()">取消</button>' +
          '<button class="btn primary" type="button" onclick="ReviewView.saveReview(\'' + t.id + '\')">保存复盘</button>' +
        '</div>'
    });
  }

  function addCheckRow() {
    var sel = document.getElementById('rvAddRule');
    if (!sel || !sel.value) return;
    var container = document.getElementById('rvRuleRows');
    if (document.getElementById('row_' + sel.value)) { UI.toast('该规则已在列表中', 'error'); return; }
    container.insertAdjacentHTML('beforeend', checkRowHtml(sel.value, 'na'));
    sel.value = '';
  }

  function collectChecks() {
    var checks = [];
    document.querySelectorAll('#rvRuleRows input[type=radio]:checked').forEach(function (r) {
      var pid = r.name.slice(3);
      if (r.value === 'yes' || r.value === 'no' || r.value === 'na') {
        checks.push({ principleId: pid, verdict: r.value });
      }
    });
    return checks;
  }

  function suggestResult(t, checks) {
    var yes = 0, no = 0;
    checks.forEach(function (c) {
      if (c.verdict === 'yes') yes++;
      else if (c.verdict === 'no') no++;
    });
    var comp = yes + no ? yes / (yes + no) : null;
    var rb = S.computePositions().realizedByTrade;
    if (t.direction === 'buy' || rb[t.id] == null) return 'open';
    var profit = rb[t.id] > 0;
    if (comp == null) return profit ? 'lucky' : 'wrong';
    if (comp >= 0.8) return profit ? 'right' : 'ok';
    return profit ? 'lucky' : 'wrong';
  }

  function saveReview(tradeId) {
    var t = S.getTrade(tradeId);
    if (!t) return;
    var checks = collectChecks();
    var meaningful = checks.filter(function (c) { return c.verdict !== 'na'; });
    if (!meaningful.length) {
      UI.toast('请至少对一条规则做出「符合 / 违反」的判断', 'error');
      return;
    }
    var result = document.getElementById('rvResult').value;
    var lesson = document.getElementById('rvLesson').value.trim();
    var improvement = document.getElementById('rvImprovement').value.trim();

    var rv = S.getReviewByTrade(tradeId);
    if (rv) {
      rv.checks = checks;
      rv.result = result;
      rv.lesson = lesson;
      rv.improvement = improvement;
      rv.ts = Date.now();
    } else {
      S.state.reviews.push({
        id: S.uid(), tradeId: tradeId, result: result,
        checks: checks, lesson: lesson, improvement: improvement, ts: Date.now()
      });
    }
    // 同步交易上勾选的规则（以复盘时实际对照的规则为准）
    t.principleIds = checks.filter(function (c) { return c.verdict !== 'na'; })
      .map(function (c) { return c.principleId; });
    t.updatedAt = Date.now();

    S.save();
    UI.closeTop();
    render(document.getElementById('view'));
    UI.toast('复盘已保存，纪律统计已更新', 'success');
  }

  function removeReview(id) {
    UI.confirmDialog('删除复盘', '确定删除这条复盘记录？交易本身会保留。', true).then(function (ok) {
      if (!ok) return;
      S.state.reviews = S.state.reviews.filter(function (r) { return r.id !== id; });
      S.save();
      render(document.getElementById('view'));
      UI.toast('复盘已删除', 'success');
    });
  }

  global.ReviewView = {
    render: render, openForm: openForm, addCheckRow: addCheckRow,
    saveReview: saveReview, removeReview: removeReview
  };
})(window);
