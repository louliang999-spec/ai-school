#!/usr/bin/env node
/**
 * ============================================================
 *  本地静态服务器（零依赖，Node 18+）
 *
 *  为什么不用 `python -m http.server`？
 *  ------------------------------------------------------------
 *  Python 自带的 http.server **不发送任何 Cache-Control 头**。
 *  浏览器于是对这些响应启用"启发式缓存"(heuristic caching)：
 *  只要你动过文件，之后再打开页面，浏览器可能**根本不发请求**，
 *  直接拿磁盘缓存里的旧 JS 用 —— 表现就是：
 *
 *      "我明明改了代码，刷新了还是报旧错！"
 *
 *  更坑的是 ESM 子模块：`import './route.js'` 的 URL 里没有查询串，
 *  所以你在地址栏写 `?v=2` **完全传不进子模块**，破不了缓存。
 *
 *  本服务器对**每一个响应**都打上 no-store，
 *  从此改完代码刷新即生效，不会再出现"改了没生效"。
 *
 *  用法:
 *     node server.mjs [根目录] [端口]
 *     node server.mjs . 8123
 * ============================================================
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';

const ROOT = path.resolve(process.argv[2] || '.');
let PORT = Number(process.argv[3] || process.env.PORT || 8123);
const PORT_BASE = PORT;
const HOST = '127.0.0.1';
const OPEN_BROWSER = process.env.NO_OPEN !== '1';

/** MIME 表 —— 必须给 .js / .mjs 正确的 text/javascript，
 *  否则浏览器会以 "strict MIME checking" 拒绝执行 ES 模块 */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.mp4': 'video/mp4',
};

/** 禁止缓存的响应头 —— 本服务器的核心价值 */
const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

const server = http.createServer((req, res) => {
  let pathname = '/';
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', ...NO_CACHE });
    res.end('400 Bad Request');
    return;
  }

  let filePath = path.join(ROOT, pathname);

  // 防目录穿越: 解析后的路径必须仍在根目录内
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', ...NO_CACHE });
    res.end('403 Forbidden');
    return;
  }

  // 目录 → 尝试 index.html
  fs.stat(filePath, (_e1, st1) => {
    if (!_e1 && st1.isDirectory()) filePath = path.join(filePath, 'index.html');

    fs.stat(filePath, (_e2, st2) => {
      if (_e2 || !st2.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...NO_CACHE });
        res.end(`404 Not Found: ${pathname}`);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': st2.size,
        ...NO_CACHE,
      });

      const stream = fs.createReadStream(filePath);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    });
  });
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    // 端口被占时先探测: 占着的是不是"本项目"的地图服务。
    // 判据: 对方 /data/map-meta.json 里的 project 字段与本项目的相同。
    // - 是本项目 → 不重复起服务, 直接弹浏览器(双击 bat 的预期体验);
    // - 不是(别的程序或同模板其它主题地图) → 换下一个端口重试(最多 5 个)。
    // ⚠️ 提示一律用 ASCII: 双击 bat 启动的 cmd 窗口是 GBK 代码页,
    //    node 输出的 UTF-8 中文会变成乱码。
    let myProject = null;
    try {
      myProject = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'map-meta.json'), 'utf-8')).project || null;
    } catch { /* 没有元数据也能跑, 只是复用判断退化为换端口 */ }

    fetch(`http://${HOST}:${PORT}/data/map-meta.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((meta) => {
        if (myProject && meta && meta.project === myProject) {
          console.log('');
          console.log('  [i] The map server is ALREADY running. No need to start again.');
          console.log(`  Opening browser: http://${HOST}:${PORT}/`);
          console.log('  (To restart it, close the old server window first.)');
          console.log('');
          if (OPEN_BROWSER) {
            exec(`start "" "http://${HOST}:${PORT}/"`, { shell: 'cmd.exe' }, () => {});
          }
          process.exit(0);
        }
        throw new Error('different-project');
      })
      .catch(() => {
        if (PORT - PORT_BASE < 5) {
          console.log(`  [i] Port ${PORT} is busy. Trying ${PORT + 1} ...`);
          PORT += 1;
          server.listen(PORT, HOST);
          return;
        }
        console.error(`\n  [!] Ports ${PORT_BASE}-${PORT} are all used by other programs.`);
        console.error(`      Close them first, or pick another port.\n`);
        process.exit(1);
      });
    return;
  }
  console.error(`\n  [!] ${e.message}\n`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}/`;
  console.log('');
  console.log('  ============================================');
  console.log('   3D Relief Map - Local Server Running');
  console.log('  ============================================');
  console.log('');
  console.log(`   URL          : ${url}`);
  console.log(`   Root         : ${ROOT}`);
  console.log('   Cache        : disabled (no-store)');
  console.log('');
  console.log('   Press Ctrl+C to stop the server');
  console.log('');

  // 启动自检: 根目录不对时立刻说清楚, 别让用户对着 404 猜
  if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
    console.log('  [!] WARNING: index.html NOT FOUND in the root above!');
    console.log('      The map will show "404 Not Found: /" in the browser.');
    console.log('      Check the Root path printed above - if it is wrong,');
    console.log('      the launcher passed a bad directory argument.');
    console.log('');
  }

  // 服务器真正 listen 成功之后再开浏览器，避免"连接被拒绝"
  if (OPEN_BROWSER) {
    exec(`start "" "${url}"`, { shell: 'cmd.exe' }, () => {});
  }
});

// Ctrl+C 优雅退出
process.on('SIGINT', () => {
  console.log('\n  Server stopped.\n');
  process.exit(0);
});
