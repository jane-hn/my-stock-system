/* ============================================================
   思想库：原始素材（课件/观点）沉淀 + 指导规则（可版本迭代）
   ============================================================ */
(function (global) {
  'use strict';
  var S = Store;
  var esc = S.esc;

  var sub = 'rules';
  var ruleQ = '', ruleCat = 'all', ruleStatus = 'all';
  var matQ = '';

  function render(el) {
    var st = S.state;
    var rules = st.principles;
    var counts = {
      trial: rules.filter(function (p) { return p.status === 'trial'; }).length,
      verified: rules.filter(function (p) { return p.status === 'verified'; }).length,
      retired: rules.filter(function (p) { return p.status === 'retired'; }).length
    };

    el.innerHTML =
      '<div class="view-title">' +
        '<h2>思想库</h2>' +
        '<p>把老师的课件与观点先存为素材，再提炼成一条条可执行的指导规则；规则每次修改都会保留版本，供长期迭代</p>' +
      '</div>' +

      '<div class="subtabs">' +
        '<button class="subtab ' + (sub === 'rules' ? 'active' : '') + '" type="button" onclick="PrinciplesView.show(\'rules\')">指导规则（' + rules.length + '）</button>' +
        '<button class="subtab ' + (sub === 'materials' ? 'active' : '') + '" type="button" onclick="PrinciplesView.show(\'materials\')">原始素材（' + st.materials.length + '）</button>' +
      '</div>' +

      (sub === 'rules' ? rulesView(counts) : materialsView());
  }

  function show(tab) { sub = tab; render(document.getElementById('view')); }

  /* ---------------- 规则列表 ---------------- */
  function rulesView(counts) {
    var list = S.state.principles.filter(function (p) {
      if (ruleCat !== 'all' && p.category !== ruleCat) return false;
      if (ruleStatus !== 'all' && p.status !== ruleStatus) return false;
      if (ruleQ) {
        var hay = (p.name + ' ' + p.content + ' ' + (p.scenario || '') + ' ' + (p.tags || []).join(' ')).toLowerCase();
        if (hay.indexOf(ruleQ.toLowerCase()) < 0) return false;
      }
      return true;
    }).sort(function (a, b) { return b.weight - a.weight; });

    return '<div class="filter-bar">' +
        '<button class="btn primary" type="button" onclick="PrinciplesView.openRuleForm()">+ 新增规则</button>' +
        '<input type="search" placeholder="搜索规则名称 / 内容 / 标签" value="' + esc(ruleQ) + '" onchange="PrinciplesView.setRuleQ(this.value)">' +
        '<select onchange="PrinciplesView.setRuleCat(this.value)">' +
          '<option value="all">全部类别</option>' +
          Object.keys(S.CATS).map(function (k) {
            return '<option value="' + k + '" ' + (ruleCat === k ? 'selected' : '') + '>' + S.CATS[k].label + '</option>';
          }).join('') +
        '</select>' +
        '<select onchange="PrinciplesView.setRuleStatus(this.value)">' +
          '<option value="all">全部状态</option>' +
          '<option value="trial" ' + (ruleStatus === 'trial' ? 'selected' : '') + '>试验中</option>' +
          '<option value="verified" ' + (ruleStatus === 'verified' ? 'selected' : '') + '>已验证</option>' +
          '<option value="retired" ' + (ruleStatus === 'retired' ? 'selected' : '') + '>已废弃</option>' +
        '</select>' +
        '<span class="small muted">试验中 ' + counts.trial + ' · 已验证 ' + counts.verified + ' · 已废弃 ' + counts.retired + '</span>' +
      '</div>' +
      (list.length ? list.map(ruleCard).join('') :
        '<div class="empty">没有符合条件的规则<br><span class="small">点击「+ 新增规则」，或先到「原始素材」从课件中提炼</span></div>');
  }

  function ruleCard(p) {
    var stars = '★'.repeat(p.weight) + '☆'.repeat(5 - p.weight);
    var sources = (p.sourceIds || []).map(function (sid) {
      var m = S.getMaterial(sid);
      return m ? '<span class="tag-chip" title="' + esc(m.title) + '">' + esc(m.title) + '</span>' : '';
    }).join('');
    var subText = S.subLabel(p.category, p.subBranch);
    return '<div class="card' + (p.status === 'retired' ? ' retired' : '') + '">' +
      '<div class="rule-head">' +
        '<span class="cat-badge ' + S.CATS[p.category].cls + '">' + S.CATS[p.category].label + (subText ? ' · ' + esc(subText) : '') + '</span>' +
        (p.isVeto ? '<span class="veto-badge" title="该规则不符合时直接判C级回避">一票否决</span>' : '') +
        '<strong>' + esc(p.name) + '</strong>' +
        '<span class="weight-stars" title="权重 ' + p.weight + '/5">' + stars + '</span>' +
        '<span class="status-badge st-' + p.status + '">' + S.STATUS[p.status] + '</span>' +
      '</div>' +
      '<p class="rule-content">' + esc(p.content) + '</p>' +
      (p.scenario ? '<p class="rule-scenario">适用场景：' + esc(p.scenario) + '</p>' : '') +
      '<div class="card-foot">' +
        '<span>' + sources + ((p.versions || []).length ? ' · 历史版本 ' + p.versions.length + ' 个' : '') + '</span>' +
        '<div class="ops">' +
          '<button class="btn tiny ghost" type="button" onclick="PrinciplesView.openRuleForm(\'' + p.id + '\')">编辑</button>' +
          '<button class="btn tiny ghost" type="button" onclick="PrinciplesView.history(\'' + p.id + '\')">版本历史</button>' +
          '<button class="btn tiny ghost" type="button" onclick="PrinciplesView.toggleRetire(\'' + p.id + '\')">' + (p.status === 'retired' ? '重新启用' : '废弃') + '</button>' +
          '<button class="btn tiny danger" type="button" onclick="PrinciplesView.removeRule(\'' + p.id + '\')">删除</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---------------- 素材列表 ---------------- */
  function materialsView() {
    var list = S.state.materials.filter(function (m) {
      if (!matQ) return true;
      var hay = (m.title + ' ' + (m.source || '') + ' ' + (m.content || '') + ' ' + (m.tags || []).join(' ')).toLowerCase();
      return hay.indexOf(matQ.toLowerCase()) >= 0;
    }).sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });

    return '<div class="filter-bar">' +
        '<button class="btn primary" type="button" onclick="PrinciplesView.openMaterialForm()">+ 录入素材</button>' +
        '<input type="search" placeholder="搜索素材标题 / 内容 / 来源" value="' + esc(matQ) + '" onchange="PrinciplesView.setMatQ(this.value)">' +
      '</div>' +
      '<div class="notice" style="margin-bottom:14px"><b>沉淀方法</b>：把课件要点、群内观点原文存进素材（尽量保原话），再点「提炼为规则」变成一条可勾选、可评分、可复盘对照的纪律。素材是"老师说的"，规则是"我执行的"。</div>' +
      (list.length ? list.map(materialCard).join('') :
        '<div class="empty">还没有素材<br><span class="small">点「+ 录入素材」，把课件里的关键段落或老师观点贴进来</span></div>');
  }

  function materialCard(m) {
    var tags = (m.tags || []).map(function (t) { return '<span class="tag-chip">#' + esc(t) + '</span>'; }).join('');
    var extracted = S.state.principles.filter(function (p) {
      return (p.sourceIds || []).indexOf(m.id) >= 0;
    });
    var isQA = m.type === 'qa';
    var typeBadge = '<span class="mat-type-badge ' + (isQA ? 'qa' : 'doc') + '">' + (isQA ? '问答' : '文档') + '</span>';
    var contentHtml = isQA && m.question ?
      '<div class="qa-block"><div class="qa-q"><b>问：</b>' + esc(m.question) + '</div><div class="qa-a"><b>答：</b>' + esc(m.content) + '</div></div>'
      : '<p class="mat-content">' + esc(m.content) + '</p>';
    return '<div class="card">' +
      '<div class="rule-head">' +
        typeBadge +
        '<strong>' + esc(m.title) + '</strong>' +
        '<span class="small muted">' + esc(m.date || '') + ' · ' + esc(m.source || '未注明来源') + '</span>' +
      '</div>' +
      contentHtml +
      '<div class="card-foot">' +
        '<span>' + tags + (extracted.length ? ' · 已提炼 ' + extracted.length + ' 条规则：' + extracted.map(function (p) { return esc(p.name); }).join('、') : ' · 尚未提炼规则') + '</span>' +
        '<div class="ops">' +
          '<button class="btn tiny primary" type="button" onclick="PrinciplesView.extractToRule(\'' + m.id + '\')">提炼为规则</button>' +
          '<button class="btn tiny ghost" type="button" onclick="PrinciplesView.openMaterialForm(\'' + m.id + '\')">编辑</button>' +
          '<button class="btn tiny danger" type="button" onclick="PrinciplesView.removeMaterial(\'' + m.id + '\')">删除</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---------------- 规则表单 ---------------- */
  function openRuleForm(id, presetSourceId) {
    var p = id ? S.getPrinciple(id) : null;
    var srcChecked = {};
    if (p) (p.sourceIds || []).forEach(function (s) { srcChecked[s] = true; });
    if (presetSourceId) srcChecked[presetSourceId] = true;

    var matOptions = S.state.materials.map(function (m) {
      return '<label class="small" style="display:inline-flex;align-items:center;margin:2px 10px 2px 0;">' +
        '<input type="checkbox" name="rfSrc" value="' + m.id + '" ' + (srcChecked[m.id] ? 'checked' : '') + '> ' + esc(m.title) + '</label>';
    }).join('') || '<span class="small muted">（还没有素材，可先到「原始素材」录入）</span>';

    UI.openModal({
      title: p ? '编辑规则：' + esc(p.name) : '新增指导规则',
      wide: true,
      body:
        '<div class="form-grid">' +
          '<label class="field"><span class="req">规则名称</span><input type="text" id="rfName" maxlength="30" placeholder="例如：均线多头排列 / 巨量滞涨回避" value="' + esc(p ? p.name : '') + '"></label>' +
          '<label class="field"><span class="req">方法论模块</span><select id="rfCat" onchange="PrinciplesView.updateSubOptions(this.value)">' +
            Object.keys(S.CATS).map(function (k) {
              return '<option value="' + k + '" ' + (p && p.category === k ? 'selected' : '') + '>' + S.CATS[k].label + '</option>';
            }).join('') +
          '</select></label>' +
          '<label class="field"><span class="req">子分支</span><select id="rfSub"></select></label>' +
          '<label class="field"><span>权重（1-5，影响个股问询评分）</span><select id="rfWeight">' +
            [1, 2, 3, 4, 5].map(function (w) {
              return '<option value="' + w + '" ' + ((p ? p.weight : 3) === w ? 'selected' : '') + '>' + w + '</option>';
            }).join('') +
          '</select></label>' +
          '<label class="field"><span>状态</span><select id="rfStatus">' +
            ['trial', 'verified', 'retired'].map(function (s) {
              return '<option value="' + s + '" ' + ((p ? p.status : 'trial') === s ? 'selected' : '') + '>' + S.STATUS[s] + '</option>';
            }).join('') +
          '</select></label>' +
          '<label class="field" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="rfVeto" ' + (p && p.isVeto ? 'checked' : '') + ' style="width:auto"><span class="small">一票否决（不符合时直接判C级·回避）</span></label>' +
          '<label class="field full"><span class="req">规则内容（写成可执行的判断句）</span><textarea id="rfContent" rows="4" placeholder="例如：MA5>MA20>MA60三线多头排列时才考虑买入">' + esc(p ? p.content : '') + '</textarea></label>' +
          '<label class="field full"><span>适用场景</span><textarea id="rfScenario" rows="2" placeholder="例如：所有中线建仓的均线排列确认">' + esc(p ? p.scenario || '' : '') + '</textarea></label>' +
          '<label class="field full"><span>标签（逗号分隔）</span><input type="text" id="rfTags" placeholder="均线, 多头排列, 买点" value="' + esc(p ? (p.tags || []).join(', ') : '') + '"></label>' +
          '<div class="field full"><span>关联素材（该规则从哪些课件/观点提炼而来）</span>' + matOptions + '</div>' +
        '</div>' +
        '<p class="small muted">提示：勾选「一票否决」的规则在个股问询中"不符合"时直接判为C级（回避），无论其他规则得分多高。已废弃的规则不再出现在交易勾选与问询中。</p>' +
        '<div class="form-actions">' +
          '<button class="btn ghost" type="button" onclick="UI.closeTop()">取消</button>' +
          '<button class="btn primary" type="button" onclick="PrinciplesView.saveRule(\'' + (p ? p.id : '') + '\')">保存规则</button>' +
        '</div>'
    });
    /* 打开表单后填充子分支选项 */
    var cat = p ? p.category : Object.keys(S.CATS)[0];
    updateSubOptions(cat, p ? p.subBranch : null);
  }

  function updateSubOptions(cat, selected) {
    var sel = document.getElementById('rfSub');
    if (!sel) return;
    var subs = S.CATS[cat] && S.CATS[cat].sub ? S.CATS[cat].sub : {};
    sel.innerHTML = Object.keys(subs).map(function (k) {
      return '<option value="' + k + '" ' + (selected === k ? 'selected' : '') + '>' + subs[k] + '</option>';
    }).join('');
  }

  function saveRule(id) {
    var name = document.getElementById('rfName').value.trim();
    var content = document.getElementById('rfContent').value.trim();
    if (!name) { UI.toast('请填写规则名称', 'error'); return; }
    if (!content) { UI.toast('请填写规则内容', 'error'); return; }

    var srcIds = Array.prototype.map.call(
      document.querySelectorAll('input[name="rfSrc"]:checked'),
      function (c) { return c.value; }
    );
    var tags = document.getElementById('rfTags').value.split(/[,，]/)
      .map(function (t) { return t.trim(); }).filter(Boolean);

    if (id) {
      var p = S.getPrinciple(id);
      p.versions = p.versions || [];
      p.versions.push({ ts: Date.now(), note: '修改前快照', name: p.name, content: p.content });
      if (p.versions.length > 20) p.versions = p.versions.slice(-20);
      p.name = name;
      p.category = document.getElementById('rfCat').value;
      p.subBranch = document.getElementById('rfSub').value;
      p.weight = parseInt(document.getElementById('rfWeight').value, 10);
      p.isVeto = document.getElementById('rfVeto').checked;
      p.status = document.getElementById('rfStatus').value;
      p.content = content;
      p.scenario = document.getElementById('rfScenario').value.trim();
      p.tags = tags;
      p.sourceIds = srcIds;
      p.updatedAt = Date.now();
    } else {
      S.state.principles.push({
        id: S.uid(), name: name,
        category: document.getElementById('rfCat').value,
        subBranch: document.getElementById('rfSub').value,
        weight: parseInt(document.getElementById('rfWeight').value, 10),
        isVeto: document.getElementById('rfVeto').checked,
        status: document.getElementById('rfStatus').value,
        content: content,
        scenario: document.getElementById('rfScenario').value.trim(),
        tags: tags, sourceIds: srcIds,
        createdAt: Date.now(), updatedAt: Date.now(), versions: []
      });
    }
    S.save();
    UI.closeTop();
    render(document.getElementById('view'));
    UI.toast(id ? '规则已更新（旧版本已存档）' : '新规则已加入思想库', 'success');
  }

  function history(id) {
    var p = S.getPrinciple(id);
    if (!p) return;
    var vs = (p.versions || []).slice().reverse();
    var html = vs.length ? vs.map(function (v, i) {
      return '<div class="verdict-item" style="border-left-color:var(--accent)">' +
        '<div class="small muted">第 ' + (vs.length - i) + ' 版 · ' + new Date(v.ts).toLocaleString('zh-CN', { hour12: false }) + ' · ' + esc(v.note || '') + '</div>' +
        '<strong>' + esc(v.name) + '</strong>' +
        '<div class="small">' + esc(v.content) + '</div>' +
      '</div>';
    }).join('') : '<div class="empty">该规则自创建后从未修改</div>';
    UI.openModal({
      title: '版本历史：' + esc(p.name),
      wide: true,
      body: '<p class="small muted" style="margin-bottom:10px">创建于 ' + S.fmtDate(p.createdAt) + ' · 最近修改 ' + S.fmtDate(p.updatedAt) + ' · 当前为第 ' + (vs.length + 1) + ' 版</p>' + html
    });
  }

  function toggleRetire(id) {
    var p = S.getPrinciple(id);
    if (!p) return;
    p.status = p.status === 'retired' ? 'trial' : 'retired';
    p.updatedAt = Date.now();
    S.save();
    render(document.getElementById('view'));
    UI.toast(p.status === 'retired' ? '规则已废弃（历史交易记录仍保留引用）' : '规则已重新启用', 'success');
  }

  function removeRule(id) {
    var p = S.getPrinciple(id);
    if (!p) return;
    UI.confirmDialog('删除规则', '确定删除「' + S.esc(p.name) + '」？<br><span class="small muted">历史交易与复盘中对该规则的引用将失效，建议改用「废弃」以保留完整轨迹。</span>', true)
      .then(function (ok) {
        if (!ok) return;
        S.state.principles = S.state.principles.filter(function (x) { return x.id !== id; });
        S.state.trades.forEach(function (t) {
          t.principleIds = (t.principleIds || []).filter(function (pid) { return pid !== id; });
        });
        S.state.reviews.forEach(function (r) {
          r.checks = (r.checks || []).filter(function (c) { return c.principleId !== id; });
        });
        S.save();
        render(document.getElementById('view'));
        UI.toast('规则已删除', 'success');
      });
  }

  /* ---------------- 素材表单 ---------------- */
  function openMaterialForm(id) {
    var m = id ? S.getMaterial(id) : null;
    var mtype = m ? (m.type || 'doc') : 'doc';
    UI.openModal({
      title: m ? '编辑素材：' + esc(m.title) : '录入原始素材',
      wide: true,
      body:
        '<div class="form-grid">' +
          '<label class="field"><span class="req">素材类型</span><select id="mfType" onchange="PrinciplesView.toggleMatType(this.value)">' +
            '<option value="doc" ' + (mtype === 'doc' ? 'selected' : '') + '>课件文档（整段粘贴）</option>' +
            '<option value="qa" ' + (mtype === 'qa' ? 'selected' : '') + '>问答观点（提问+老师解答）</option>' +
          '</select></label>' +
          '<label class="field full"><span class="req">标题</span><input type="text" id="mfTitle" maxlength="60" placeholder="例如：大盘趋势与建仓时机" value="' + esc(m ? m.title : '') + '"></label>' +
          '<label class="field"><span>来源（课件第几讲 / 答疑 / 直播）</span><input type="text" id="mfSource" placeholder="老师答疑 / 课件第3讲" value="' + esc(m ? m.source || '' : '') + '"></label>' +
          '<label class="field"><span>日期</span><input type="date" id="mfDate" value="' + esc(m ? m.date || S.todayStr() : S.todayStr()) + '"></label>' +
          '<label class="field full"><span>标签（逗号分隔）</span><input type="text" id="mfTags" placeholder="大盘, 均线, 量价" value="' + esc(m ? (m.tags || []).join(', ') : '') + '"></label>' +
          '<label class="field full" id="mfQuestionWrap" ' + (mtype === 'qa' ? '' : 'style="display:none"') + '><span class="req">提问内容</span><textarea id="mfQuestion" rows="3" placeholder="你的问题，例如：老师，大盘在20日均线上方但均线还没走平向上，可以建仓吗？">' + esc(m ? m.question || '' : '') + '</textarea></label>' +
          '<label class="field full"><span class="req" id="mfContentLabel">' + (mtype === 'qa' ? '老师解答' : '内容原文（尽量保留老师原话）') + '</span><textarea id="mfContent" rows="9" placeholder="' + (mtype === 'qa' ? '老师解答原文……' : '粘贴课件段落、聊天记录或听课笔记……') + '">' + esc(m ? m.content : '') + '</textarea></label>' +
        '</div>' +
        '<div class="form-actions">' +
          '<button class="btn ghost" type="button" onclick="UI.closeTop()">取消</button>' +
          '<button class="btn primary" type="button" onclick="PrinciplesView.saveMaterial(\'' + (m ? m.id : '') + '\')">保存素材</button>' +
        '</div>'
    });
  }

  function toggleMatType(t) {
    var qw = document.getElementById('mfQuestionWrap');
    var cl = document.getElementById('mfContentLabel');
    var ct = document.getElementById('mfContent');
    if (t === 'qa') {
      if (qw) qw.style.display = '';
      if (cl) cl.textContent = '老师解答';
      if (ct) ct.placeholder = '老师解答原文……';
    } else {
      if (qw) qw.style.display = 'none';
      if (cl) cl.textContent = '内容原文（尽量保留老师原话）';
      if (ct) ct.placeholder = '粘贴课件段落、聊天记录或听课笔记……';
    }
  }

  function saveMaterial(id) {
    var title = document.getElementById('mfTitle').value.trim();
    var content = document.getElementById('mfContent').value.trim();
    if (!title) { UI.toast('请填写素材标题', 'error'); return; }
    if (!content) { UI.toast('请填写内容', 'error'); return; }
    var mtype = document.getElementById('mfType').value;
    var tags = document.getElementById('mfTags').value.split(/[,，]/)
      .map(function (t) { return t.trim(); }).filter(Boolean);
    var payload = {
      type: mtype,
      title: title,
      source: document.getElementById('mfSource').value.trim(),
      date: document.getElementById('mfDate').value || S.todayStr(),
      tags: tags,
      content: content
    };
    if (mtype === 'qa') {
      var q = document.getElementById('mfQuestion');
      if (q) payload.question = q.value.trim();
    }
    if (id) {
      var m = S.getMaterial(id);
      Object.assign(m, payload, { updatedAt: Date.now() });
    } else {
      S.state.materials.push(Object.assign(
        { id: S.uid(), createdAt: Date.now(), updatedAt: Date.now() }, payload));
    }
    S.save();
    UI.closeTop();
    if (sub !== 'materials') sub = 'materials';
    render(document.getElementById('view'));
    UI.toast(id ? '素材已更新' : '素材已存入思想库，可继续「提炼为规则」', 'success');
  }

  function removeMaterial(id) {
    UI.confirmDialog('删除素材', '确定删除该素材？<br><span class="small muted">由它提炼出的规则会保留，仅失去关联。</span>', true).then(function (ok) {
      if (!ok) return;
      S.state.materials = S.state.materials.filter(function (m) { return m.id !== id; });
      S.state.principles.forEach(function (p) {
        p.sourceIds = (p.sourceIds || []).filter(function (sid) { return sid !== id; });
      });
      S.save();
      render(document.getElementById('view'));
      UI.toast('素材已删除', 'success');
    });
  }

  function extractToRule(mid) {
    sub = 'rules';
    openRuleForm(null, mid);
  }

  /* ---------------- 过滤器 ---------------- */
  function setRuleQ(v) { ruleQ = v; render(document.getElementById('view')); }
  function setRuleCat(v) { ruleCat = v; render(document.getElementById('view')); }
  function setRuleStatus(v) { ruleStatus = v; render(document.getElementById('view')); }
  function setMatQ(v) { matQ = v; render(document.getElementById('view')); }

  global.PrinciplesView = {
    render: render, show: show,
    openRuleForm: openRuleForm, saveRule: saveRule, history: history,
    updateSubOptions: updateSubOptions,
    toggleRetire: toggleRetire, removeRule: removeRule,
    openMaterialForm: openMaterialForm, saveMaterial: saveMaterial,
    toggleMatType: toggleMatType,
    removeMaterial: removeMaterial, extractToRule: extractToRule,
    setRuleQ: setRuleQ, setRuleCat: setRuleCat,
    setRuleStatus: setRuleStatus, setMatQ: setMatQ
  };
})(window);
