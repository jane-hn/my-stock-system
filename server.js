#!/usr/bin/env node
/* ============================================================
   个人炒股交易系统 · 同步服务器（零依赖，Node.js 14+）
   ------------------------------------------------------------
   作用：
   1. 托管整个系统页面（手机/电脑浏览器直接访问本地址）
   2. 提供 /api/data 数据接口：电脑关机≠数据关机——把本程序部署在
      云端免费主机上即可 24 小时在线；手机与电脑自动双向同步
   3. 也可只在家里电脑运行，手机连同一 WiFi 访问（局域网模式）

   启动：
     node server.js                     # 端口 8000，数据存 cloud-data.json
     PORT=9000 node server.js           # 自定义端口
     TOKEN=我的密码 node server.js      # 启用访问令牌（公网部署务必设置！）
   ============================================================ */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');

var ROOT = __dirname;
var PORT = parseInt(process.env.PORT || '8000', 10) || 8000;
var TOKEN = process.env.TOKEN || process.env.ACCESS_TOKEN || '';
var DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'cloud-data.json');
var MAX_BODY = 20 * 1024 * 1024; // 20MB 上限（localStorage 本身约 5MB）

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function json(res, code, obj) {
  var body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function authorized(req) {
  if (!TOKEN) return true; // 未设令牌 = 局域网自用模式
  return req.headers['x-auth-token'] === TOKEN;
}

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return null;
  }
}

function writeData(obj) {
  // 先写临时文件再改名，避免写入中途断电损坏数据
  var tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, DATA_FILE);
}

function readBody(req, cb) {
  var done = false;
  var chunks = [];
  var size = 0;
  req.on('data', function (c) {
    if (done) return;
    size += c.length;
    if (size > MAX_BODY) {
      done = true;
      cb(new Error('payload too large'));
      req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on('end', function () {
    if (done) return;
    done = true;
    cb(null, Buffer.concat(chunks));
  });
  req.on('error', function (err) {
    if (done) return;
    done = true;
    cb(err);
  });
}

var server = http.createServer(function (req, res) {
  // 允许跨域：页面即使以 file:// 打开或部署在别处，也能同步到本服务
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  var urlPath;
  try {
    urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch (e) {
    urlPath = '/';
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  /* ---------- 健康检查 ---------- */
  if (urlPath === '/api/ping') {
    if (!authorized(req)) return json(res, 401, { ok: false, error: 'unauthorized' });
    return json(res, 200, {
      ok: true,
      name: 'stock-system-server',
      hasToken: !!TOKEN,
      updatedAt: (readData() || {}).updatedAt || 0
    });
  }

  /* ---------- 数据接口 ---------- */
  if (urlPath === '/api/data') {
    if (!authorized(req)) return json(res, 401, { ok: false, error: 'unauthorized' });

    if (req.method === 'GET') {
      var d = readData();
      return json(res, 200, d || { updatedAt: 0, state: null });
    }

    if (req.method === 'PUT') {
      return readBody(req, function (err, buf) {
        if (err) return json(res, 413, { ok: false, error: 'payload too large' });
        var body;
        try {
          body = JSON.parse(buf.toString('utf8'));
        } catch (e) {
          return json(res, 400, { ok: false, error: 'invalid json' });
        }
        if (!body || typeof body !== 'object' || !body.state ||
            !body.state.version || !Array.isArray(body.state.trades)) {
          return json(res, 400, { ok: false, error: 'invalid data' });
        }
        var incoming = Number(body.updatedAt) || Date.now();
        var cur = readData();
        // 时间戳更旧的数据不允许覆盖云端（防止旧设备倒灌）
        if (cur && cur.updatedAt && incoming < cur.updatedAt) {
          return json(res, 409, {
            ok: false,
            error: 'stale',
            updatedAt: cur.updatedAt,
            message: '云端存在更新的数据，客户端应先拉取合并'
          });
        }
        try {
          writeData({ updatedAt: incoming, state: body.state });
        } catch (e) {
          return json(res, 500, { ok: false, error: 'write failed: ' + e.message });
        }
        return json(res, 200, { ok: true, updatedAt: incoming });
      });
    }

    return json(res, 405, { ok: false, error: 'method not allowed' });
  }

  /* ---------- 静态文件 ---------- */
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return json(res, 405, { ok: false, error: 'method not allowed' });
  }
  var rel = (urlPath === '/' || urlPath === '.') ? '/index.html' : urlPath;
  var file = path.normalize(path.join(ROOT, rel));
  if (file !== ROOT && file.indexOf(ROOT + path.sep) !== 0) {
    return json(res, 403, { ok: false, error: 'forbidden' });
  }
  fs.readFile(file, function (err, buf) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
    var ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': buf.length,
      'Cache-Control': 'no-cache'
    });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
});

server.listen(PORT, '0.0.0.0', function () {
  var os = require('os');
  var nets = os.networkInterfaces();
  var lan = [];
  Object.keys(nets).forEach(function (k) {
    (nets[k] || []).forEach(function (n) {
      if (n.family === 'IPv4' && !n.internal) lan.push(n.address);
    });
  });
  console.log('======================================================');
  console.log('  个人炒股交易系统 · 同步服务器已启动');
  console.log('======================================================');
  console.log('  本机访问:  http://localhost:' + PORT);
  lan.forEach(function (ip) {
    console.log('  局域网访问: http://' + ip + ':' + PORT + '   （手机连同一 WiFi 打开此地址）');
  });
  console.log('  数据文件:  ' + DATA_FILE);
  console.log('  访问令牌:  ' + (TOKEN ? '已启用（写操作需携带令牌）' : '未设置（建议公网部署前用 TOKEN=密码 启动）'));
  console.log('  停止服务:  在本窗口按 Ctrl+C');
  console.log('======================================================');
});

server.on('error', function (e) {
  if (e.code === 'EADDRINUSE') {
    console.error('端口 ' + PORT + ' 已被占用。换一个端口试试：PORT=' + (PORT + 1) + ' node server.js');
  } else {
    console.error('服务器错误：', e.message);
  }
  process.exit(1);
});
