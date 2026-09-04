/* ============================================================
   数据层：状态管理、localStorage 持久化、领域计算
   ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'my_stock_system_v1';
  var state = null;

  /* ---------- 领域字典：三大方法论模块 ---------- */
  var CATS = {
    market:   { label: '大盘', cls: 'cat-market',
      sub: { trend: '大盘趋势', sentiment: '市场情绪', sector: '板块轮动', flow: '资金流向' } },
    ma:       { label: '三条均线', cls: 'cat-ma',
      sub: { alignment: '均线排列', support: '支撑/压力', cross: '金叉/死叉', slope: '均线斜率' } },
    volprice: { label: '量价关系', cls: 'cat-vp',
      sub: { coordination: '量价配合', divergence: '量价背离', contraction: '缩量/放量', pattern: '量能形态' } }
  };

  /* 旧版本分类 → 新模块迁移映射 */
  var OLD_TO_NEW = {
    buy: 'volprice', sell: 'ma', pos: 'market', risk: 'market', mind: 'market'
  };

  function subLabel(cat, sub) {
    var c = CATS[cat];
    return c && c.sub ? (c.sub[sub] || '') : '';
  }

  var STATUS = { trial: '试验中', verified: '已验证', retired: '已废弃' };

  var EMOTIONS = {
    calm: '冷静', greedy: '贪婪', fearful: '恐惧',
    impulsive: '冲动', hesitant: '犹豫', fomo: '追涨心态'
  };

  var RESULTS = {
    right: '正确 · 赚纪律内的钱',
    lucky: '侥幸 · 赚钱但违纪',
    ok:    '可接受 · 亏钱但守纪',
    wrong: '错误 · 亏钱且违纪',
    open:  '未平仓 · 暂不评价'
  };

  var RESULT_SHORT = { right: '正确', lucky: '侥幸', ok: '可接受', wrong: '错误', open: '未平仓' };

  var RATINGS = {
    A: { label: 'A · 可交易', hint: '主要买入条件满足且未触碰关键风控纪律' },
    B: { label: 'B · 谨慎观望', hint: '部分条件不满足，建议列入观察池等待条件明确' },
    C: { label: 'C · 回避', hint: '多数条件不满足或触碰一票否决，按纪律应回避' }
  };

  /* ---------- 工具函数 ---------- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtMoney(n, sign) {
    if (n == null || isNaN(n)) return '—';
    var v = Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    var pre = n < 0 ? '-' : (sign && n > 0 ? '+' : '');
    return pre + '\u00a5' + v;
  }

  function fmtPct(n, digits) {
    if (n == null || isNaN(n)) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(digits == null ? 1 : digits) + '%';
  }

  function fmtNum(n) {
    if (n == null || isNaN(n)) return '—';
    return n.toLocaleString('zh-CN');
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ---------- 初始状态与演示数据 ---------- */
  function emptyState() {
    return {
      version: 1,
      updatedAt: 0,
      isDemo: false,
      settings: { ollamaUrl: 'http://localhost:11434', ollamaModel: 'qwen2.5:7b' },
      prices: {},
      materials: [],
      principles: [],
      trades: [],
      reviews: [],
      checks: []
    };
  }

  function seedDemo() {
    var now = Date.now();
    return {
      version: 1,
      updatedAt: 0,
      isDemo: true,
      settings: { ollamaUrl: 'http://localhost:11434', ollamaModel: 'qwen2.5:7b' },
      prices: { '600519': 1712.00, '300750': 218.50 },
      materials: [
        {
          id: 'm1', type: 'doc',
          title: '三大模块交易体系：大盘 · 均线 · 量价',
          source: '老师课件 · 核心方法论',
          date: '2026-05-12',
          tags: ['大盘', '均线', '量价', '方法论'],
          content: '交易体系的底层方法论围绕三大模块展开：一、大盘——先判断大盘趋势再决定仓位轻重，趋势走坏时仓位要降；二、三条均线——MA5/MA20/MA60的排列、交叉与斜率是个股择时的核心框架；三、量价关系——成交量是价格的先行指标，量价配合才健康，量价背离是危险信号。三者的优先级：大盘定方向，均线定买点，量价做确认。',
          createdAt: now - 90 * 864e5, updatedAt: now - 90 * 864e5
        },
        {
          id: 'm2', type: 'qa',
          title: '大盘趋势与建仓时机',
          source: '老师答疑',
          date: '2026-06-02',
          tags: ['大盘', '建仓'],
          question: '老师，大盘在20日均线上方但均线还没走平向上，这个时候可以建仓吗？',
          content: '均线走平向上是趋势确认的关键信号。均线还在下行或走平但未拐头时，最多用2-3成仓试错，且必须带止损。等均线明确拐头向上、指数站上均线3个交易日以上，才是正常仓位建仓的时机。记住：大盘趋势不好时，个股再好也要控制仓位。',
          createdAt: now - 60 * 864e5, updatedAt: now - 60 * 864e5
        },
        {
          id: 'm3', type: 'qa',
          title: '均线死叉后的操作纪律',
          source: '老师答疑',
          date: '2026-06-15',
          tags: ['均线', '死叉', '卖出'],
          question: '老师，MA5下穿MA20后股价还在60日线上方，要不要先减仓？',
          content: 'MA5下穿MA20是短线趋势转弱的第一个信号，即使股价还在60日线上方，也应该先减半仓。等MA5再次上穿MA20且放量时再补回来。如果MA5继续下穿MA60，那就不是减仓而是清仓了。三条均线的好处是层次分明：MA5定短线，MA20定中线，MA60定大方向。'
        }
      ],
      principles: [
        {
          id: 'p1', name: '大盘趋势确认', category: 'market', subBranch: 'trend',
          weight: 5, status: 'verified', isVeto: true,
          content: '只在上证指数站上20日均线且均线走平向上时正常建仓；均线下行或走平未拐头时仓位不超过3成。',
          scenario: '所有建仓决策的第一道关口。',
          tags: ['大盘', '趋势'], sourceIds: ['m1', 'm2'],
          createdAt: now - 90 * 864e5, updatedAt: now - 30 * 864e5,
          versions: [
            { ts: now - 90 * 864e5, note: '初始版本', name: '大盘趋势确认', content: '只在大盘站上20日均线时做多。' },
            { ts: now - 30 * 864e5, note: '补充均线形态条件', name: '大盘趋势确认', content: '只在上证站上20日均线且均线走平向上时正常建仓；均线下行或走平未拐头时仓位不超过3成。' }
          ]
        },
        {
          id: 'p2', name: '市场情绪过滤', category: 'market', subBranch: 'sentiment',
          weight: 3, status: 'trial', isVeto: false,
          content: '跌停家数超过涨停家数2倍时，当日不建新仓，已有持仓按止损纪律执行。',
          scenario: '判断市场极端恐慌时降低进攻频率。',
          tags: ['情绪', '跌停'], sourceIds: ['m1'],
          createdAt: now - 80 * 864e5, updatedAt: now - 80 * 864e5, versions: []
        },
        {
          id: 'p3', name: '均线多头排列', category: 'ma', subBranch: 'alignment',
          weight: 4, status: 'verified', isVeto: false,
          content: 'MA5>MA20>MA60三线多头排列时才考虑买入；空头排列时任何抄底都是逆势赌反弹。',
          scenario: '所有中线建仓的均线排列确认。',
          tags: ['均线', '多头排列'], sourceIds: ['m1'],
          createdAt: now - 85 * 864e5, updatedAt: now - 85 * 864e5, versions: []
        },
        {
          id: 'p4', name: '20日均线支撑买入', category: 'ma', subBranch: 'support',
          weight: 4, status: 'verified', isVeto: false,
          content: '回踩20日均线缩量企稳是最佳买点；放量跌破20日均线则止损离场。',
          scenario: '上升趋势中的回调买入。',
          tags: ['均线', '支撑', '买点'], sourceIds: ['m1', 'm3'],
          createdAt: now - 85 * 864e5, updatedAt: now - 50 * 864e5, versions: []
        },
        {
          id: 'p5', name: '均线死叉减仓', category: 'ma', subBranch: 'cross',
          weight: 3, status: 'verified', isVeto: false,
          content: 'MA5下穿MA20先减半仓；MA5下穿MA60清仓离场。',
          scenario: '持仓期间的均线信号监控。',
          tags: ['均线', '死叉', '卖出'], sourceIds: ['m3'],
          createdAt: now - 55 * 864e5, updatedAt: now - 55 * 864e5, versions: []
        },
        {
          id: 'p6', name: '量价配合确认', category: 'volprice', subBranch: 'coordination',
          weight: 4, status: 'verified', isVeto: false,
          content: '温和放量上攻为主升浪特征；缩量上涨需谨慎，可能缺乏买盘支撑。',
          scenario: '买入前的量能确认。',
          tags: ['量价', '放量'], sourceIds: ['m1'],
          createdAt: now - 85 * 864e5, updatedAt: now - 85 * 864e5, versions: []
        },
        {
          id: 'p7', name: '巨量滞涨回避', category: 'volprice', subBranch: 'divergence',
          weight: 5, status: 'verified', isVeto: true,
          content: '放巨量但价格不涨（量价背离）为出货信号，不追入；已有持仓考虑减仓。',
          scenario: '所有买入决策的量价背离检查。',
          tags: ['量价背离', '出货', '铁律'], sourceIds: ['m1'],
          createdAt: now - 75 * 864e5, updatedAt: now - 75 * 864e5, versions: []
        },
        {
          id: 'p8', name: '缩量回调安全买点', category: 'volprice', subBranch: 'contraction',
          weight: 3, status: 'trial', isVeto: false,
          content: '缩量回调至关键支撑位（均线或前低）为安全买点；放量下跌则回避。',
          scenario: '回调买入的量能条件。',
          tags: ['缩量', '回调', '买点'], sourceIds: ['m1'],
          createdAt: now - 70 * 864e5, updatedAt: now - 70 * 864e5, versions: []
        }
      ],
      trades: [
        {
          id: 't1', code: '600519', name: '贵州茅台', direction: 'buy', date: '2026-06-10',
          price: 1680.00, shares: 100, fee: 5,
          reason: '大盘站上20日线且均线走平向上，茅台回踩20日线缩量企稳后放量收复，均线多头排列+量价配合，按纪律建仓。',
          principleIds: ['p1', 'p3', 'p4', 'p6'], emotion: 'calm',
          planStop: 1562.40, planTarget: 1850.00,
          createdAt: now - 82 * 864e5, updatedAt: now - 82 * 864e5
        },
        {
          id: 't2', code: '300750', name: '宁德时代', direction: 'buy', date: '2026-06-18',
          price: 256.30, shares: 300, fee: 5,
          reason: '锂电板块大涨，担心踏空追进，未看大盘趋势也未检查量价。',
          principleIds: ['p7'], emotion: 'fomo',
          planStop: null, planTarget: null,
          createdAt: now - 74 * 864e5, updatedAt: now - 74 * 864e5
        },
        {
          id: 't3', code: '600519', name: '贵州茅台', direction: 'sell', date: '2026-07-08',
          price: 1752.60, shares: 100, fee: 5,
          reason: '接近目标位且出现单日巨量滞涨（量价背离），按均线死叉减仓纪律先落袋。',
          principleIds: ['p5', 'p7'], emotion: 'calm',
          planStop: null, planTarget: null,
          createdAt: now - 54 * 864e5, updatedAt: now - 54 * 864e5
        },
        {
          id: 't5', code: '300750', name: '宁德时代', direction: 'sell', date: '2026-07-30',
          price: 231.00, shares: 300, fee: 5,
          reason: 'MA5下穿MA60清仓离场，亏损扩大。',
          principleIds: ['p5'], emotion: 'fearful',
          planStop: null, planTarget: null,
          createdAt: now - 32 * 864e5, updatedAt: now - 32 * 864e5
        },
        {
          id: 't4', code: '600519', name: '贵州茅台', direction: 'buy', date: '2026-08-12',
          price: 1690.00, shares: 100, fee: 5,
          reason: '大盘趋势确认，茅台回调至20日线缩量企稳，均线多头排列，量价配合，二次进场。',
          principleIds: ['p1', 'p4', 'p6', 'p8'], emotion: 'calm',
          planStop: 1560.00, planTarget: 1860.00,
          createdAt: now - 19 * 864e5, updatedAt: now - 19 * 864e5
        }
      ],
      reviews: [
        {
          id: 'r1', tradeId: 't3', result: 'right',
          checks: [{ principleId: 'p5', verdict: 'yes' }, { principleId: 'p7', verdict: 'yes' }, { principleId: 'p1', verdict: 'yes' }],
          lesson: '巨量滞涨+接近目标位，按均线死叉减仓纪律果断落袋，没有恋战。',
          improvement: '可研究分批减仓间隔，避免一次清仓错过后续惯性上冲。',
          ts: now - 54 * 864e5
        },
        {
          id: 'r2', tradeId: 't5', result: 'wrong',
          checks: [{ principleId: 'p7', verdict: 'no' }, { principleId: 'p1', verdict: 'no' }, { principleId: 'p2', verdict: 'no' }],
          lesson: '典型的追高+无计划交易：未确认大盘趋势就追入，进场时已是巨量滞涨的出货信号，违反多条铁律，扛到MA5下穿MA60才割肉，亏损放大。',
          improvement: '下次情绪上头时，强制先过一遍三大模块检核清单再下单；填不出来就是不能买。',
          ts: now - 31 * 864e5
        }
      ],
      checks: [
        {
          id: 'c1', code: '600519', name: '贵州茅台', date: '2026-08-15',
          answers: { p1: 'yes', p2: 'na', p3: 'yes', p4: 'yes', p5: 'na', p6: 'yes', p7: 'na', p8: 'yes' },
          extra: '大盘站上20日线且均线走平向上；茅台回踩20日线缩量企稳，量能温和放大；均线多头排列。',
          score: 88, rating: 'A', ts: now - 16 * 864e5
        },
        {
          id: 'c2', code: '300750', name: '宁德时代', date: '2026-06-17',
          answers: { p1: 'no', p2: 'no', p3: 'no', p4: 'no', p5: 'na', p6: 'no', p7: 'no', p8: 'na' },
          extra: '大盘均线未走平，个股高位巨量滞涨后开始缩量回落，短线破位。（次日仍冲动追入，即 t2 那笔亏损交易）',
          score: 0, rating: 'C', ts: now - 75 * 864e5
        }
      ]
    };
  }

  /* ---------- 持久化 ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      state = raw ? JSON.parse(raw) : null;
    } catch (e) { state = null; }
    if (!state || !state.version) state = seedDemo();
    var base = emptyState();
    Object.keys(base).forEach(function (k) {
      if (state[k] == null) state[k] = base[k];
    });
    /* 残缺记录归一化（防御旧备份/同步异常数据导致页面崩溃） */
    state.trades = (state.trades || []).map(normalizeTrade).filter(Boolean);
    state.principles = (state.principles || []).map(normalizePrinciple).filter(Boolean);
    if (!state.prices || typeof state.prices !== 'object') state.prices = {};
    if (!state.settings) state.settings = base.settings;
    if (state.isDemo == null) state.isDemo = false;
    if (state.updatedAt == null) state.updatedAt = 0;
    /* 旧版本升级上来的真实数据（无时间戳）：补一个当前时间，
       确保首次配置云端同步时能把数据推上去 */
    if (!state.updatedAt && !state.isDemo) state.updatedAt = Date.now();
    save(true, true);
  }

  function save(silent, noTouch) {
    if (!noTouch) {
      /* 每次真实修改都刷新时间戳（云端同步的"谁更新"依据），
         并解除演示数据标记，随后触发延迟推送 */
      state.updatedAt = Date.now();
      state.isDemo = false;
      if (global.Sync && global.Sync.schedule) global.Sync.schedule();
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      global.__storageError = false;
      var badge = document.getElementById('saveBadge');
      if (badge) {
        badge.textContent = '本地已保存 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false });
      }
    } catch (e) {
      global.__storageError = true;
      if (!silent && global.UI) global.UI.toast('保存失败：浏览器本地存储不可用', 'error');
      var warn = document.getElementById('storageWarn');
      if (warn) warn.hidden = false;
    }
  }

  /* 由同步层调用：整体替换状态（拉取/合并采纳云端数据） */
  function replaceState(data, updatedAt) {
    state = normalize(data);
    state.updatedAt = updatedAt || Date.now();
    state.isDemo = data && !!data.isDemo;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    var badge = document.getElementById('saveBadge');
    if (badge) badge.textContent = '本地已保存 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false });
  }

  function exportJSON() { return JSON.stringify(state, null, 2); }

  function importJSON(text, mode) {
    var data = JSON.parse(text);
    if (!data || !Array.isArray(data.principles) || !Array.isArray(data.trades)) {
      throw new Error('备份文件格式不正确');
    }
    if (mode === 'replace') {
      state = normalize(data);
    } else {
      ['materials', 'principles', 'trades', 'reviews', 'checks'].forEach(function (k) {
        var seen = {};
        state[k].forEach(function (x) { seen[x.id] = 1; });
        (data[k] || []).forEach(function (x) {
          if (x && x.id && !seen[x.id]) { seen[x.id] = 1; state[k].push(x); }
        });
      });
      state.prices = Object.assign({}, data.prices || {}, state.prices);
    }
    save();
  }

  /* 容错归一化：云端同步、旧备份导入的数据可能缺字段或字段类型不对。
     统一补默认值，保证所有视图的数值渲染（.toFixed 等）永不崩溃 */
  function normalizeTrade(t) {
    if (!t || typeof t !== 'object') return null;
    var out = Object.assign({}, t);
    out.id = out.id || uid();
    out.code = String(out.code || '');
    out.name = out.name == null ? '' : String(out.name);
    out.date = out.date == null ? '' : String(out.date);
    out.direction = out.direction === 'sell' ? 'sell' : 'buy';
    out.price = Number(out.price) || 0;
    out.shares = Number(out.shares) || 0;
    out.fee = Number(out.fee) || 0;
    out.planStop = out.planStop == null ? null : Number(out.planStop);
    out.planTarget = out.planTarget == null ? null : Number(out.planTarget);
    out.createdAt = out.createdAt || Date.now();
    out.updatedAt = out.updatedAt || out.createdAt || Date.now();
    return out;
  }

  function normalizePrinciple(p) {
    if (!p || typeof p !== 'object') return null;
    var out = Object.assign({}, p);
    out.id = out.id || uid();
    var w = parseInt(out.weight, 10);
    out.weight = (w >= 1 && w <= 5) ? w : 3;
    if (!Array.isArray(out.versions)) out.versions = [];
    /* 分类迁移：旧版 buy/sell/pos/risk/mind → 三大模块 */
    if (out.category == null || !CATS[out.category]) {
      out.category = OLD_TO_NEW[out.category] || 'volprice';
    }
    /* 子分支：缺失时取该模块第一个子分支做默认 */
    if (!out.subBranch || !CATS[out.category].sub[out.subBranch]) {
      out.subBranch = Object.keys(CATS[out.category].sub)[0];
    }
    /* 一票否决：旧版 risk+weight≥4 迁移为 isVeto 标记 */
    if (out.isVeto == null) out.isVeto = false;
    if (out.status == null || !STATUS[out.status]) out.status = 'trial';
    return out;
  }

  function normalize(d) {
    var base = emptyState();
    return {
      version: 1,
      updatedAt: d.updatedAt || 0,
      isDemo: !!d.isDemo,
      settings: Object.assign(base.settings, d.settings || {}),
      prices: d.prices && typeof d.prices === 'object' ? d.prices : {},
      materials: Array.isArray(d.materials) ? d.materials : [],
      principles: (Array.isArray(d.principles) ? d.principles : []).map(normalizePrinciple).filter(Boolean),
      trades: (Array.isArray(d.trades) ? d.trades : []).map(normalizeTrade).filter(Boolean),
      reviews: Array.isArray(d.reviews) ? d.reviews : [],
      checks: Array.isArray(d.checks) ? d.checks : []
    };
  }

  function reset() { state = emptyState(); save(); }
  function loadDemo() { state = seedDemo(); save(true, true); }

  /* ---------- 查询 ---------- */
  function getPrinciple(id) { return state.principles.find(function (p) { return p.id === id; }) || null; }
  function getMaterial(id) { return state.materials.find(function (m) { return m.id === id; }) || null; }
  function getTrade(id) { return state.trades.find(function (t) { return t.id === id; }) || null; }
  function getReviewByTrade(tid) { return state.reviews.find(function (r) { return r.tradeId === tid; }) || null; }
  function activePrinciples() {
    return state.principles.filter(function (p) { return p.status !== 'retired'; });
  }

  /* ---------- 持仓与盈亏计算 ---------- */
  function computePositions() {
    var trades = state.trades.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1;
    });
    var map = {};
    var realizedTotal = 0;
    var invested = 0;
    var realizedByTrade = {};

    trades.forEach(function (t) {
      var amt = (t.price || 0) * (t.shares || 0);
      var fee = t.fee || 0;
      if (!map[t.code]) map[t.code] = { code: t.code, name: t.name, shares: 0, cost: 0 };
      var p = map[t.code];
      if (t.name) p.name = t.name;
      if (t.direction === 'buy') {
        p.shares += t.shares;
        p.cost += amt + fee;
        invested += amt + fee;
      } else {
        invested -= amt - fee;
        if (p.shares <= 0) return;
        var n = Math.min(t.shares, p.shares);
        var avg = p.cost / p.shares;
        var feeShare = fee * (n / t.shares);
        var realized = t.price * n - feeShare - avg * n;
        realizedByTrade[t.id] = realized;
        realizedTotal += realized;
        p.cost -= avg * n;
        p.shares -= n;
        if (p.shares === 0) p.cost = 0;
      }
    });

    var positions = Object.keys(map).map(function (k) { return map[k]; })
      .filter(function (p) { return p.shares > 0; })
      .map(function (p) {
        return { code: p.code, name: p.name, shares: p.shares, cost: p.cost, avg: p.cost / p.shares };
      });

    return { positions: positions, realizedTotal: realizedTotal, realizedByTrade: realizedByTrade, invested: invested };
  }

  function closedTradeStats() {
    var pos = computePositions();
    var rb = pos.realizedByTrade;
    var sells = state.trades.filter(function (t) {
      return t.direction === 'sell' && rb[t.id] != null;
    });
    var wins = sells.filter(function (t) { return rb[t.id] > 0; });
    return {
      closed: sells.length,
      wins: wins.length,
      winRate: sells.length ? wins.length / sells.length * 100 : null,
      realizedByTrade: rb
    };
  }

  /* ---------- 纪律统计 ---------- */
  function disciplineStats() {
    var realizedByTrade = computePositions().realizedByTrade;
    var yes = 0, no = 0;
    var perRule = {};
    state.reviews.forEach(function (r) {
      var t = getTrade(r.tradeId);
      if (!t) return;
      var closed = t.direction === 'sell' && realizedByTrade[t.id] != null;
      var win = closed && realizedByTrade[t.id] > 0;
      (r.checks || []).forEach(function (c) {
        if (c.verdict !== 'yes' && c.verdict !== 'no') return;
        var st = perRule[c.principleId] = perRule[c.principleId] ||
          { yes: 0, no: 0, closedYes: 0, winYes: 0, closedNo: 0, winNo: 0 };
        if (c.verdict === 'yes') {
          yes++; st.yes++;
          if (closed) { st.closedYes++; if (win) st.winYes++; }
        } else {
          no++; st.no++;
          if (closed) { st.closedNo++; if (win) st.winNo++; }
        }
      });
    });
    var total = yes + no;
    return { yes: yes, no: no, compliance: total ? yes / total * 100 : null, perRule: perRule };
  }

  /* ---------- 个股可交易性评分 ---------- */
  function evaluateCheck(answers) {
    var sumYes = 0, sumNo = 0, sumW = 0, veto = null;
    Object.keys(answers || {}).forEach(function (pid) {
      var v = answers[pid];
      if (v !== 'yes' && v !== 'no') return;
      var p = getPrinciple(pid);
      if (!p) return;
      sumW += p.weight;
      if (v === 'yes') sumYes += p.weight; else sumNo += p.weight;
      if (v === 'no' && p.isVeto) veto = p;
    });
    var score = sumW > 0 ? Math.round(50 + 50 * (sumYes - sumNo) / sumW) : 50;
    var rating = score >= 75 ? 'A' : (score >= 50 ? 'B' : 'C');
    if (veto) rating = 'C';
    return { score: score, rating: rating, veto: veto, answeredWeight: sumW };
  }

  /* ---------- 导出 ---------- */
  global.Store = {
    get state() { return state; },
    CATS: CATS, STATUS: STATUS, EMOTIONS: EMOTIONS,
    RESULTS: RESULTS, RESULT_SHORT: RESULT_SHORT, RATINGS: RATINGS,
    uid: uid, todayStr: todayStr, esc: esc, subLabel: subLabel,
    fmtMoney: fmtMoney, fmtPct: fmtPct, fmtNum: fmtNum, fmtDate: fmtDate,
    load: load, save: save, reset: reset, loadDemo: loadDemo,
    replaceState: replaceState,
    exportJSON: exportJSON, importJSON: importJSON,
    getPrinciple: getPrinciple, getMaterial: getMaterial,
    getTrade: getTrade, getReviewByTrade: getReviewByTrade,
    activePrinciples: activePrinciples,
    computePositions: computePositions,
    closedTradeStats: closedTradeStats,
    disciplineStats: disciplineStats,
    evaluateCheck: evaluateCheck
  };
})(window);
