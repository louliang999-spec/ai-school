/* ============================================================
 *  main.js · 应用装配入口
 *  职责：读档 → 注册 7 个页签模块 → 页签路由 → 启动完成
 * ============================================================ */

import { load, subscribe } from './store.js';
import { initShell, renderShell, goSection, currentSection } from './ui/ui-shell.js';
import { initHome, renderHome } from './ui/ui-home.js';
import { initTeachers, renderTeachers } from './ui/ui-teachers.js';
import { initDesk, renderDesk } from './ui/ui-desk.js';
import { initTools, renderTools } from './ui/ui-tools.js';
import { initStartup, renderStartup } from './ui/ui-startup.js';
import { initProfile, renderProfile } from './ui/ui-profile.js';
import { initOral, renderOral } from './ui/ui-oral.js';

const PAGES = {
  home: { init: initHome, render: renderHome },
  teachers: { init: initTeachers, render: renderTeachers },
  desk: { init: initDesk, render: renderDesk },
  tools: { init: initTools, render: renderTools },
  startup: { init: initStartup, render: renderStartup },
  profile: { init: initProfile, render: renderProfile },
  oral: { init: initOral, render: renderOral },
};

/** 重渲染当前激活页 */
function renderActive() {
  renderShell();
  const key = currentSection();
  const p = PAGES[key];
  if (p) {
    try { p.render(); } catch (e) { console.error('[render] ' + key, e); }
  }
}

/** 页签切页函数（注册给 ui-shell 的路由） */
function switchSection(key) {
  document.querySelectorAll('.section').forEach((el) => {
    el.classList.toggle('active', el.id === 'section-' + key);
  });
  document.querySelectorAll('.tab').forEach((el) => {
    el.classList.toggle('active', el.dataset.section === key);
  });
  const p = PAGES[key];
  if (p) {
    try { p.render(); } catch (e) { console.error('[render] ' + key, e); }
  }
  window.scrollTo({ top: 0 });
}

function boot() {
  window.__boot.stage = '读取存档';
  load();

  window.__boot.stage = '初始化外壳';
  initShell(switchSection);

  window.__boot.stage = '初始化页面';
  Object.values(PAGES).forEach((p) => {
    try { p.init(); } catch (e) { console.error('[init]', e); }
  });

  // 数据订阅：一变就重渲染（顶栏 + 当前页）
  subscribe(renderActive);

  // 初始渲染所有页
  renderShell();
  Object.entries(PAGES).forEach(([key, p]) => {
    try { p.render(); } catch (e) { console.error('[render] ' + key, e); }
  });

  // 恢复上次页签（若有）
  const saved = sessionStorage.getItem('aischool:section');
  if (saved && PAGES[saved]) goSection(saved);

  // 隐藏启动遮罩
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';

  window.__boot.stage = '启动完成';
  window.__boot.done = true;
  if (window.__bootGuard) window.__bootGuard.finish();
  console.log('[ai-school] 启动完成');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
