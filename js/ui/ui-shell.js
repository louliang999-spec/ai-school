/* ============================================================
 *  ui-shell.js · 外壳：页签路由 + 顶栏（学段/老师/导出）+ toast/弹窗
 * ============================================================ */

import {
  state, setStage, setActiveTeacher, getSubject,
} from '../store.js';
import { exportGradedPapers } from '../features/exporter.js';

let route = null;          // main.js 注册的切页函数
let activeSection = 'home';

/**
 * 注册路由：main.js 传入真正的切页函数
 * ⚠️ 这里绝不能传 goSection 自己（会无限递归）
 */
export function initShell(router) {
  route = router;

  // 页签点击
  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (btn) goSection(btn.dataset.section);
  });

  // 学段切换
  const stageSel = document.getElementById('stageSelect');
  stageSel.addEventListener('change', () => {
    setStage(stageSel.value);
    toast(stageLabel(stageSel.value) + '模式已启用，老师话术同步切换');
  });

  // 当前老师切换
  document.getElementById('teacherSelect').addEventListener('change', (e) => {
    setActiveTeacher(e.target.value);
    toast('已切换到 ' + (state.teachers.find((t) => t.id === e.target.value)?.name || ''));
  });

  // 导航栏：导出已批改试卷
  document.getElementById('navExportBtn').addEventListener('click', async () => {
    const btn = document.getElementById('navExportBtn');
    btn.disabled = true;
    try {
      await exportGradedPapers();
    } finally {
      btn.disabled = false;
    }
  });

  // 全局错误提示通道（store 等模块通过事件报错）
  window.addEventListener('aischool:error', (e) => toast(e.detail, true));

  renderShell();
}

export function goSection(key) {
  activeSection = key;
  if (route && route !== goSection) route(key);
}

export function currentSection() {
  return activeSection;
}

/** 顶栏渲染：老师下拉、学段选中态、导出按钮计数 */
export function renderShell() {
  const stageSel = document.getElementById('stageSelect');
  if (stageSel.value !== state.settings.stage) stageSel.value = state.settings.stage;

  // 学段强调色
  document.documentElement.dataset.stage = state.settings.stage;

  // 老师下拉
  const tSel = document.getElementById('teacherSelect');
  const cur = state.settings.activeTeacherId;
  if (tSel.dataset.count !== String(state.teachers.length) || !tSel.value) {
    tSel.innerHTML = '';
    state.teachers.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.avatar} ${t.name}`;
      tSel.appendChild(opt);
    });
    tSel.dataset.count = String(state.teachers.length);
  }
  tSel.value = cur;

  // 导出按钮：显示未导出的已批改数量
  const pending = state.papers.filter((p) => p.grading.status === 'graded' && !p.exported && p.image);
  const btn = document.getElementById('navExportBtn');
  btn.textContent = pending.length
    ? `📤 导出已批改试卷（${pending.length}）`
    : '📤 导出已批改试卷';
  btn.disabled = pending.length === 0;
}

export function stageLabel(stage) {
  return { primary: '小学', junior: '初中', senior: '高中' }[stage] || stage;
}

/* ---------- toast ---------- */
export function toast(msg, isError) {
  const box = document.getElementById('toastBox');
  const el = document.createElement('div');
  el.className = 'toast';
  if (isError) el.style.background = 'rgba(180,40,40,0.95)';
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => {
    el.style.transition = '0.4s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }, 2600);
}

/* ---------- 简易弹窗 ---------- */
/**
 * openModal({ title, bodyHTML, onOk, okText, cancelText })
 * bodyHTML 里的交互自己在 onMount 里接线
 */
export function openModal({ title, bodyHTML, okText = '确定', cancelText = '取消', onOk, onMount }) {
  const mask = document.getElementById('modalBox');
  mask.innerHTML = '';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <h3></h3>
    <div class="modal-body"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-act="cancel"></button>
      <button class="btn btn-accent" data-act="ok"></button>
    </div>`;
  modal.querySelector('h3').textContent = title;
  modal.querySelector('.modal-body').innerHTML = bodyHTML;
  modal.querySelector('[data-act="cancel"]').textContent = cancelText;
  modal.querySelector('[data-act="ok"]').textContent = okText;
  mask.hidden = false;

  const close = () => { mask.hidden = true; mask.innerHTML = ''; };
  modal.querySelector('[data-act="cancel"]').onclick = close;
  modal.querySelector('[data-act="ok"]').onclick = async () => {
    if (onOk) {
      const keep = await onOk(modal);
      if (keep === false) return;   // onOk 返回 false 表示不关闭
    }
    close();
  };
  mask.onclick = (e) => { if (e.target === mask) close(); };
  mask.appendChild(modal);
  if (onMount) onMount(modal, close);
  return { modal, close };
}

/** 确认框（Promise<boolean>） */
export function confirmBox(msg) {
  return new Promise((resolve) => {
    openModal({
      title: '请确认',
      bodyHTML: `<p style="line-height:1.8">${msg}</p>`,
      okText: '确认',
      onOk: () => { resolve(true); },
    });
    // 取消路径
    const mask = document.getElementById('modalBox');
    const observer = new MutationObserver(() => {
      if (mask.hidden) { resolve(false); observer.disconnect(); }
    });
    observer.observe(mask, { attributes: true, attributeFilter: ['hidden'] });
  });
}

export { getSubject };
