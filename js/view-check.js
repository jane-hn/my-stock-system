/* ============================================================
   个股问询：对照指导思想逐条评估可交易性（规则评分引擎）
   可选接入本机 Ollama 大模型做自然语言深度分析（全程离线）
   ============================================================ */
(function (global) {
  'use strict';
  var S = Store;
  var esc = S.esc;

  function render(el) {
    var active = S.activePrinciples();
    var st = S.state.settings;

    el.innerHTML =
      '<div class="view-title">' +
        '<h2>个股问询</h2>' +
        '<p>输入股票，对照你沉淀的每条指导思想逐条判断当前状态，系统给出可交易性评级（A/B/C）</p>' +
      '</div>' +

      (active.length ? buildForm(active) :
        '<div class="empty">思想库中还没有启用状态的指导规则<br><span class="small">先到「思想库」从课件中提炼规则，这里才能逐条对照评估</span></div>') +

      '<div class="panel ai-panel">' +
        '<div class="panel-head"><h2>本地 AI 深度分析（可选）</h2><span class="sub">' + (st.ollamaModel ? '模型：' + esc(st.ollamaModel) : '未配置，前往「设置」') + '</span></div>' +
        '<p class="small muted">调用<b>本机 Ollama</b> 大模型，把你的全部指导思想与本次勾选结果作为上下文，回答任意问题，完全离线、不上传任何数据。配置方法见 README「接入本地 AI」。</p>' +
        '<label class="field" style="margin-top:10px"><span>想问 AI 的问题</span><textarea id="aiQuestion" rows="3" placeholder="例如：结合我的交易纪律，这只股票现在适合买吗？仓位怎么安排？最需要注意什么？"></textarea></label>' +
        '<div class="form-actions"><button class="btn primary" id="aiBtn" type="button" onclick="CheckView.askAI()">AI 分析</button></div>' +
        '<div id="aiResult"></div>' +
      '</div>' +

      '<div class="panel"><div class="panel-head"><h2>历史问询（' + S.state.checks.length + '）</h2><span class="sub">回看当时对同一只股票的判断，检验规则与眼光的变化</span></div>' +
        (S.state.checks.length ? historyTable() : '<div class="empty">还没有问询记录</div>') +
      '</div>' +

      '<p class="small muted">评级颜色遵循 A 股习惯：红 = 可交易，黄 = 观望，绿 = 回避。评分仅反映"当前状态与你的纪律的匹配度"，不构成任何投资建议。</p>';
  }

  function buildForm(active) {
    /* 按三大模块 → 子分支 两级分组 */
    var groups = Object.keys(S.CATS).map(function (cat) {
      var catItems = active.filter(function (p) { return p.category === cat; });
      if (!catItems.length) return '';
      /* 按子分支再分组 */
      var subGroups = Object.keys(S.CATS[cat].sub).map(function (sub) {
        var subItems = catItems.filter(function (p) { return p.subBranch === sub; });
        if (!subItems.length) return '';
        return '<div class="sub-branch-title">' + S.CATS[cat].sub[sub] + '</div>' +
          subItems.map(ruleRow).join('');
      }).join('');
      return '<div class="cat-group-title">' + S.CATS[cat].label + '</div>' + subGroups;
    }).join('');

    return '<div class="two-col">' +
      '<div class="panel">' +
        '<div class="panel-head"><h2>评估单</h2><span class="sub">逐条如实勾选，不确定就选「不确定」</span></div>' +
        '<div class="form-grid">' +
          '<label class="field"><span class="req">股票代码</span><input type="text" id="ckCode" maxlength="10" placeholder="600519"></label>' +
          '<label class="field"><span>名称</span><input type="text" id="ckName" maxlength="12" placeholder="贵州茅台"></label>' +
          '<label class="field full"><span>评估日期</span><input type="date" id="ckDate" value="' + S.todayStr() + '"></label>' +
        '</div>' +
        groups +
        '<label class="field" style="margin-top:14px"><span>补充说明（走势 / 量能 / 消息面等你观察到的情况）</span><textarea id="ckExtra" rows="3" placeholder="例如：缩量回踩20日线，板块无利空，60日线走平向上"></textarea></label>' +
        '<div class="form-actions">' +
          '<button class="btn primary" type="button" onclick="CheckView.evaluate()">生成评估</button>' +
          '<button class="btn ghost" type="button" onclick="CheckView.save()">保存本次评估</button>' +
          '<button class="btn ghost" type="button" onclick="App.rerender()">重置</button>' +
        '</div>' +
      '</div>' +
      '<div id="checkResult">' +
        '<div class="panel"><div class="panel-head"><h2>评估结果</h2></div>' +
          '<div class="empty">填写左侧评估单并点击「生成评估」<br><span class="small">系统将按规则权重打分，并检查是否触碰风控一票否决</span></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function ruleRow(p) {
    return '<div class="check-row">' +
      '<div class="check-q"><strong>' + esc(p.name) + '</strong><span class="muted">' + esc(p.content) + '</span></div>' +
      '<div class="seg">' +
        '<label class="v-yes"><input type="radio" name="ck_' + p.id + '" value="yes">符合</label>' +
        '<label class="v-no"><input type="radio" name="ck_' + p.id + '" value="no">不符合</label>' +
        '<label><input type="radio" name="ck_' + p.id + '" value="na" checked>不确定</label>' +
      '</div>' +
    '</div>';
  }

  function collectAnswers() {
    var answers = {};
    document.querySelectorAll('#view input[type=radio][name^="ck_"]').forEach(function (r) {
      if (r.checked) answers[r.name.slice(3)] = r.value;
    });
    return answers;
  }

  function evaluate(showToast) {
    var code = document.getElementById('ckCode').value.trim().toUpperCase();
    var name = document.getElementById('ckName').value.trim();
    var answers = collectAnswers();
    var answered = Object.keys(answers).filter(function (pid) {
      return answers[pid] !== 'na' && S.getPrinciple(pid);
    });
    if (!code && !name) {
      if (showToast !== false) UI.toast('请先填写股票代码或名称', 'error');
      return null;
    }
    if (answered.length < 2) {
      if (showToast !== false) UI.toast('至少对 2 条规则做出「符合 / 不符合」的判断（不确定的不计分）', 'error');
      return null;
    }
    var res = S.evaluateCheck(answers);
    res.code = code;
    res.name = name;
    res.answers = answers;
    res.extra = document.getElementById('ckExtra').value.trim();
    res.date = document.getElementById('ckDate').value || S.todayStr();

    var box = document.getElementById('checkResult');
    if (box) box.innerHTML = resultPanelHtml(res, false);
    return res;
  }

  function resultPanelHtml(res, readonly) {
    var ratingCls = 'r-' + res.rating;
    var scoreCls = res.rating === 'A' ? 'c-up' : (res.rating === 'B' ? 'c-amber' : 'c-down');

    var yesList = [], noList = [], naList = [];
    Object.keys(res.answers || {}).forEach(function (pid) {
      var p = S.getPrinciple(pid);
      if (!p) return;
      var v = res.answers[pid];
      if (v === 'yes') yesList.push(p);
      else if (v === 'no') noList.push(p);
      else naList.push(p);
    });
    yesList.sort(function (a, b) { return b.weight - a.weight; });
    noList.sort(function (a, b) { return b.weight - a.weight; });

    function item(p, cls) {
      return '<div class="verdict-item ' + cls + '"><strong>' + esc(p.name) + '</strong>' +
        '<span class="muted small"> ' + esc(p.content) + '</span></div>';
    }

    var lists =
      (noList.length ? '<div class="verdict-list"><h4 class="c-down">不符合的规则（风险）</h4>' + noList.map(function (p) { return item(p, 'risk'); }).join('') + '</div>' : '') +
      (yesList.length ? '<div class="verdict-list"><h4 class="c-up">符合的规则（支持依据）</h4>' + yesList.map(function (p) { return item(p, 'support'); }).join('') + '</div>' : '') +
      (naList.length ? '<div class="verdict-list"><h4 class="muted">待核实（未计分）</h4>' + naList.map(function (p) { return item(p, 'na'); }).join('') + '</div>' : '');

    return '<div class="panel">' +
      '<div class="panel-head"><h2>评估结果</h2><span class="sub">' + esc(res.code || '') + ' ' + esc(res.name || '') + ' · ' + esc(res.date || '') + '</span></div>' +
      '<div class="score-hero">' +
        '<div class="score-num ' + scoreCls + '">' + res.score + '</div>' +
        '<div>' +
          '<span class="rating-badge big ' + ratingCls + '">' + S.RATINGS[res.rating].label + '</span>' +
          '<div class="small muted">' + S.RATINGS[res.rating].hint + '</div>' +
        '</div>' +
      '</div>' +
      (res.veto ? '<div class="veto-note">一票否决：触碰「' + esc(res.veto.name) + '」（风控纪律 · 权重' + res.veto.weight + '）——按你自己的纪律，这笔交易应该放弃。</div>' : '') +
      lists +
      '<div class="advice-box">' + adviceText(res, yesList, noList) + '</div>' +
      (readonly ? '' :
        '<p class="small muted" style="margin-top:10px">认可这次评估的话，点左侧「保存本次评估」留档；也可直接把结论复制到笔记。</p>') +
    '</div>';
  }

  function adviceText(res, yesList, noList) {
    if (res.veto) {
      return '<b>结论：回避。</b>虽然综合评分 ' + res.score + '，但已触发风控一票否决（' + esc(res.veto.name) + '）。纪律的意义在于：宁可错过，不可做错。若认为该规则过严，应先到「思想库」迭代规则，而不是当场破例。';
    }
    if (res.rating === 'A') {
      return '<b>结论：可交易。</b>综合评分 ' + res.score + '，' + yesList.length + ' 条规则符合、' + noList.length + ' 条不符合。建议按仓位规则分批建仓，下单前在「交易台账」写清理由、止损位与目标位（先计划后交易），买入当日设好止损。';
    }
    if (res.rating === 'B') {
      return '<b>结论：谨慎观望。</b>综合评分 ' + res.score + '，条件未完全满足（' + noList.length + ' 条不符合）。建议列入观察池，等「不符合」的规则转为符合后再重新评估；期间可小仓位试探，但必须带止损。';
    }
    return '<b>结论：回避。</b>综合评分 ' + res.score + '，多数关键条件不满足。等待趋势、量价或位置出现明确信号再说——空仓也是一种仓位。';
  }

  function save() {
    var res = evaluate(false);
    if (!res) { evaluate(true); return; }
    var saved = {
      id: S.uid(),
      code: res.code, name: res.name, date: res.date,
      answers: res.answers, extra: res.extra,
      score: res.score, rating: res.rating, ts: Date.now()
    };
    S.state.checks.push(saved);
    S.save();
    render(document.getElementById('view'));
    restoreForm(saved);
    UI.toast('本次评估已存档（历史问询 +1），表单内容已保留可继续调整', 'success');
  }

  /* 保存后把刚评估的内容恢复到表单，避免白填一遍 */
  function restoreForm(c) {
    var codeEl = document.getElementById('ckCode');
    if (!codeEl) return;
    codeEl.value = c.code || '';
    document.getElementById('ckName').value = c.name || '';
    document.getElementById('ckDate').value = c.date || S.todayStr();
    document.getElementById('ckExtra').value = c.extra || '';
    Object.keys(c.answers || {}).forEach(function (pid) {
      var r = document.querySelector('#view input[name="ck_' + pid + '"][value="' + c.answers[pid] + '"]');
      if (r) r.checked = true;
    });
    evaluate(false);
  }

  /* ---------------- 历史 ---------------- */
  function historyTable() {
    var rows = S.state.checks.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); })
      .map(function (c) {
        return '<tr>' +
          '<td>' + esc(c.date || '') + '</td>' +
          '<td><div class="cell-main">' + esc(c.code || '') + '</div><div class="cell-sub">' + esc(c.name || '') + '</div></td>' +
          '<td class="ctr"><span class="' + (c.rating === 'A' ? 'c-up' : (c.rating === 'B' ? 'c-amber' : 'c-down')) + '" style="font-size:16px;font-weight:800">' + c.score + '</span></td>' +
          '<td class="ctr"><span class="rating-badge r-' + c.rating + '">' + S.RATINGS[c.rating].label + '</span></td>' +
          '<td><span class="truncated" title="' + esc(c.extra || '') + '">' + esc(c.extra || '—') + '</span></td>' +
          '<td class="ctr"><div class="ops">' +
            '<button class="btn tiny ghost" type="button" onclick="CheckView.viewHistory(\'' + c.id + '\')">查看</button>' +
            '<button class="btn tiny danger" type="button" onclick="CheckView.removeHistory(\'' + c.id + '\')">删除</button>' +
          '</div></td>' +
          '</tr>';
      }).join('');
    return '<div class="table-wrap"><table><thead><tr><th>日期</th><th>股票</th><th class="ctr">评分</th><th class="ctr">评级</th><th>当时备注</th><th class="ctr">操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function viewHistory(id) {
    var c = S.state.checks.find(function (x) { return x.id === id; });
    if (!c) return;
    var html = resultPanelHtml({
      code: c.code, name: c.name, date: c.date,
      answers: c.answers, extra: c.extra,
      score: c.score, rating: c.rating, veto: findVeto(c.answers)
    }, true);
    UI.openModal({
      title: '历史问询：' + esc(c.code) + ' ' + esc(c.name || '') + '（' + esc(c.date) + '）',
      wide: true,
      body: html + (c.extra ? '<p class="small muted" style="margin-top:10px">当时补充说明：' + esc(c.extra) + '</p>' : '')
    });
  }

  function findVeto(answers) {
    var res = null;
    Object.keys(answers || {}).forEach(function (pid) {
      if (answers[pid] !== 'no') return;
      var p = S.getPrinciple(pid);
      if (p && p.isVeto) res = p;
    });
    return res;
  }

  function removeHistory(id) {
    UI.confirmDialog('删除问询记录', '确定删除这条历史问询？', true).then(function (ok) {
      if (!ok) return;
      S.state.checks = S.state.checks.filter(function (c) { return c.id !== id; });
      S.save();
      render(document.getElementById('view'));
      UI.toast('问询记录已删除', 'success');
    });
  }

  /* ---------------- 本地 AI（Ollama） ---------------- */
  function buildAIContext(answers) {
    var rules = S.activePrinciples().map(function (p, i) {
      var sub = S.subLabel(p.category, p.subBranch);
      return (i + 1) + '. [' + S.CATS[p.category].label + (sub ? '·' + sub : '') +
        '|权重' + p.weight + '/5|' + S.STATUS[p.status] +
        (p.isVeto ? '|一票否决' : '') + '] ' +
        p.name + '：' + p.content + (p.scenario ? '（适用：' + p.scenario + '）' : '');
    }).join('\n');

    var answerLines = Object.keys(answers || {}).map(function (pid) {
      var p = S.getPrinciple(pid);
      if (!p) return '';
      var label = answers[pid] === 'yes' ? '符合' : (answers[pid] === 'no' ? '不符合' : '不确定');
      return '- ' + p.name + '：' + label;
    }).filter(Boolean).join('\n');

    return { rules: rules, answerLines: answerLines };
  }

  function askAI() {
    var st = S.state.settings;
    var out = document.getElementById('aiResult');
    var btn = document.getElementById('aiBtn');
    if (!st.ollamaModel) {
      out.className = 'ai-error';
      out.textContent = '尚未配置本地 AI 模型。请到「设置」页填写 Ollama 地址并选择已拉取的模型（配置步骤见 README）。';
      return;
    }
    var question = document.getElementById('aiQuestion').value.trim();
    if (!question) { UI.toast('请先输入要问 AI 的问题', 'error'); return; }

    var code = document.getElementById('ckCode') ? document.getElementById('ckCode').value.trim() : '';
    var name = document.getElementById('ckName') ? document.getElementById('ckName').value.trim() : '';
    var extra = document.getElementById('ckExtra') ? document.getElementById('ckExtra').value.trim() : '';
    var answers = collectAnswers();
    var ctx = buildAIContext(answers);

    var system =
      '你是一名严格执行既定交易纪律的私人投资顾问。用户的方法论（来自其老师课件沉淀的交易思想）如下：\n' +
      '【指导思想】\n' + ctx.rules + '\n\n' +
      '要求：1) 始终以上述纪律为最高准则，引用规则时写明规则名称；' +
      '2) 不要编造行情与数据，缺少的信息明确请用户补充；' +
      '3) 观点鲜明、可执行，不要和稀泥；4) 用简体中文，分点作答，控制在 500 字以内。';

    var user =
      '股票：' + (code || '未填写') + ' ' + (name || '') + '\n' +
      '我对规则的逐条判断：\n' + (ctx.answerLines || '（未做逐条判断）') + '\n' +
      '补充说明：' + (extra || '无') + '\n\n' +
      '我的问题：' + question;

    btn.disabled = true;
    btn.textContent = 'AI 分析中…';
    out.className = 'ai-result';
    out.textContent = '正在请求本机 Ollama（' + st.ollamaModel + '），最长等待 120 秒……';

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 120000);

    var url = (st.ollamaUrl || 'http://localhost:11434').replace(/\/+$/, '') + '/api/chat';
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: st.ollamaModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        stream: false
      }),
      signal: controller.signal
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (data) {
      clearTimeout(timer);
      var content = data && data.message && data.message.content;
      out.textContent = content || '（模型未返回内容，请确认模型名称正确）';
    }).catch(function (err) {
      clearTimeout(timer);
      out.className = 'ai-error';
      out.textContent =
        '无法连接本地 AI（' + (err && err.message ? err.message : '未知错误') + '）。请依次检查：\n' +
        '1) 已安装并启动 Ollama（终端运行 ollama serve，或桌面版保持运行）；\n' +
        '2) 已拉取模型（如 ollama pull qwen2.5:7b），且「设置」中模型名一致；\n' +
        '3) 本页以本地文件方式打开时，Ollama 需允许跨域：设置环境变量 OLLAMA_ORIGINS=* 后重启 Ollama（方法见 README「接入本地 AI」）；\n' +
        '4) 规则评分引擎不依赖 AI，随时可用。';
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = 'AI 分析';
    });
  }

  global.CheckView = {
    render: render, evaluate: evaluate, save: save,
    viewHistory: viewHistory, removeHistory: removeHistory, askAI: askAI
  };
})(window);
