/* ============================================================
 *  ui-startup.js · 创业工坊（基于自身痛点的创业闭环工具）
 *  6 步向导：痛点 → 洞察 → 方案 → MVP → 反馈 → 迭代
 *  每步一屏、localStorage 续传、最后可导出创业画布 PNG
 * ============================================================ */

import { state, setStartupStep, finishStartupRound } from '../store.js';
import { STARTUP_STEPS } from '../seed-data.js';
import { toast, openModal } from './ui-shell.js';

let cur = 0;   // 当前步骤下标
const MVP_FIELDS = [
  { key: 'must', label: '必须有（MVP 只做这些）', color: '#e53935' },
  { key: 'could', label: '可以有（有空再做）', color: '#f5a623' },
  { key: 'wont', label: '先不做（忍痛砍掉）', color: '#9aa3b2' },
];

export function initStartup() { /* 渲染时绑定 */ }

export function renderStartup() {
  const el = document.getElementById('section-startup');
  const step = STARTUP_STEPS[cur];
  const steps = state.startup.steps;

  // MVP 字段存成 JSON 字符串
  let mvp = { must: '', could: '', wont: '' };
  try { mvp = { ...mvp, ...JSON.parse(steps.mvp || '{}') }; } catch { /* ignore */ }

  el.innerHTML = `
    <div class="card">
      <div class="card-title-row">
        <h3>🚀 创业工坊 · 把我的痛点变成一个产品</h3>
        <span class="muted">闭环：痛点 → 洞察 → 方案 → MVP → 反馈 → 迭代</span>
      </div>

      <div class="stepper">
        ${STARTUP_STEPS.map((s, i) => `
          <div class="step-dot ${i === cur ? 'active' : ''} ${i < cur ? 'done' : ''}" data-goto="${i}">
            ${s.emoji} ${s.title.replace(/第.步 · /, '')}
          </div>`).join('')}
      </div>

      <div class="step-panel">
        <h3>${step.emoji} ${step.title}</h3>
        <div class="hint-box">💡 ${step.hint}</div>

        ${step.key === 'mvp' ? `
          <div class="mvp-cols">
            ${MVP_FIELDS.map((f) => `
              <div class="mvp-col">
                <h4 style="color:${f.color}">${f.label}</h4>
                <textarea data-mvp="${f.key}" rows="6" placeholder="一行一个功能">${escapeHTML(mvp[f.key])}</textarea>
              </div>`).join('')}
          </div>` : `
          <div class="field">
            <textarea id="stepText" rows="7" placeholder="${escapeAttr(step.placeholder)}">${escapeHTML(steps[step.key] || '')}</textarea>
          </div>`}
      </div>

      <div class="modal-actions" style="justify-content:space-between">
        <button class="btn" id="prevBtn" ${cur === 0 ? 'disabled' : ''}>← 上一步</button>
        <div style="display:flex;gap:8px">
          <button class="btn" id="saveBtn">💾 保存本步</button>
          ${cur < STARTUP_STEPS.length - 1
            ? '<button class="btn btn-accent" id="nextBtn">下一步 →</button>'
            : '<button class="btn btn-green" id="finishBtn">✅ 完成闭环</button>'}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title-row">
        <h3>📋 历史闭环（${state.startup.history.length}）</h3>
        <button class="btn" id="exportCanvasBtn" ${state.startup.history.length ? '' : 'disabled'}>🖼 导出我的创业画布</button>
      </div>
      ${historyHTML()}
    </div>
  `;

  bindStartupEvents(el, step);
}

function historyHTML() {
  if (!state.startup.history.length) {
    return '<p class="muted">完成一次 6 步闭环后，会在这里留下记录。</p>';
  }
  return state.startup.history.map((h) => `
    <div class="wrong-item">
      <div class="wrong-head">
        <span class="tag tag-green">已闭环</span>
        <strong>${escapeHTML(h.steps.solution || h.steps.pain || '（未命名）')}</strong>
        <span class="muted">${new Date(h.at).toLocaleString('zh-CN')}</span>
      </div>
      <div class="wrong-body">
        <b>痛点：</b>${escapeHTML(h.steps.pain || '—')}<br>
        <b>方案：</b>${escapeHTML(h.steps.solution || '—')}<br>
        <b>迭代：</b>${escapeHTML(h.steps.iterate || '—')}
      </div>
    </div>`).join('');
}

function bindStartupEvents(el, step) {
  el.querySelectorAll('[data-goto]').forEach((d) => {
    d.onclick = () => { saveStep(el, STARTUP_STEPS[cur]); cur = Number(d.dataset.goto); renderStartup(); };
  });

  el.querySelector('#prevBtn').onclick = () => {
    saveStep(el, STARTUP_STEPS[cur]);
    if (cur > 0) { cur--; renderStartup(); }
  };
  const next = el.querySelector('#nextBtn');
  if (next) next.onclick = () => {
    saveStep(el, STARTUP_STEPS[cur]);
    if (cur < STARTUP_STEPS.length - 1) { cur++; renderStartup(); }
  };
  el.querySelector('#saveBtn').onclick = () => {
    saveStep(el, STARTUP_STEPS[cur]);
    toast('已保存');
  };
  const fin = el.querySelector('#finishBtn');
  if (fin) fin.onclick = () => {
    saveStep(el, STARTUP_STEPS[cur]);
    const s = state.startup.steps;
    if (!s.pain.trim()) { toast('请先写下你的痛点', true); return; }
    openModal({
      title: '🎉 恭喜完成一轮闭环！',
      bodyHTML: `<p style="line-height:1.9">你已经走完了「痛点 → 洞察 → 方案 → MVP → 反馈 → 迭代」的完整闭环。<br>
        记录会保存在下方历史中，下一步：把方案讲给 3 个人听！</p>`,
      okText: '保存并开始新一轮',
      onOk: () => {
        finishStartupRound();
        cur = 0;
        renderStartup();
        toast('闭环已保存');
      },
    });
  };

  el.querySelector('#exportCanvasBtn').onclick = exportCanvas;

  // MVP 字段自动保存
  el.querySelectorAll('[data-mvp]').forEach((t) => {
    t.onchange = () => saveStep(el, step);
  });
}

function saveStep(el, step) {
  if (step.key === 'mvp') {
    const obj = {};
    el.querySelectorAll('[data-mvp]').forEach((t) => { obj[t.dataset.mvp] = t.value; });
    setStartupStep('mvp', JSON.stringify(obj));
  } else {
    const ta = el.querySelector('#stepText');
    if (ta) setStartupStep(step.key, ta.value);
  }
}

/* ---------- 导出创业画布 PNG ---------- */
function exportCanvas() {
  const W = 1200, H = 860;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f5f7fb';
  ctx.fillRect(0, 0, W, H);

  // 标题
  ctx.fillStyle = '#4f6ef7';
  ctx.font = 'bold 44px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText('🚀 我的创业画布', W / 2, 70);
  ctx.fillStyle = '#5b6472';
  ctx.font = '22px "Microsoft YaHei"';
  ctx.fillText('痛点 → 洞察 → 方案 → MVP → 反馈 → 迭代　·　AI 学习工作台', W / 2, 108);

  const h = state.startup.history[0];
  const steps = h ? h.steps : state.startup.steps;
  let mvp = {};
  try { mvp = JSON.parse(steps.mvp || '{}'); } catch { /* ignore */ }

  const boxes = [
    { title: '😣 痛点', body: steps.pain, x: 40, y: 140, w: 550, h: 200 },
    { title: '🔍 洞察', body: steps.insight, x: 610, y: 140, w: 550, h: 200 },
    { title: '💡 一句话方案', body: steps.solution, x: 40, y: 360, w: 1120, h: 130 },
    { title: '🧱 MVP · 必须有', body: mvp.must, x: 40, y: 510, w: 360, h: 220 },
    { title: '📣 反馈', body: steps.feedback, x: 420, y: 510, w: 360, h: 220 },
    { title: '🔁 迭代', body: steps.iterate, x: 800, y: 510, w: 360, h: 220 },
  ];

  boxes.forEach((b) => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e3e7ef';
    ctx.lineWidth = 2;
    roundRect(ctx, b.x, b.y, b.w, b.h, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#4f6ef7';
    ctx.font = 'bold 24px "Microsoft YaHei"';
    ctx.textAlign = 'left';
    ctx.fillText(b.title, b.x + 20, b.y + 38);

    ctx.fillStyle = '#333a46';
    ctx.font = '19px "Microsoft YaHei"';
    wrapLeft(ctx, b.body || '（空）', b.x + 20, b.y + 74, b.w - 40, 28, 5);
  });

  ctx.fillStyle = '#9aa3b2';
  ctx.font = '18px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText(new Date().toLocaleString('zh-CN'), W / 2, H - 24);

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = '我的创业画布.png';
  a.click();
  toast('创业画布已导出');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLeft(ctx, text, x, y, maxW, lineH, maxLines) {
  let line = '';
  let yy = y;
  let lines = 0;
  for (const ch of String(text)) {
    if (ctx.measureText(line + ch).width > maxW) {
      ctx.fillText(line, x, yy);
      line = ch;
      yy += lineH;
      lines++;
      if (lines >= maxLines) {
        ctx.fillText('…', x + ctx.measureText(line).width + 4, yy);
        return;
      }
    } else line += ch;
  }
  if (line) ctx.fillText(line, x, yy);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function escapeAttr(s) {
  return escapeHTML(s).replace(/"/g, '&quot;');
}
