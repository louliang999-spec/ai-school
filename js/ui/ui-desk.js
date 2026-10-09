/* ============================================================
 *  ui-desk.js · AI 学习课桌（核心模块）
 *  左：来源工具条（选摄像头/拍照/截图/示例卷）+ 标注图（可点注释）
 *  右：批改详情（分数/评语/逐题问题与根因/关联错题）
 *  底：试卷列表 + 批量批改 + 导出
 * ============================================================ */

import { state, addPaper, getPaper, setGrading, addWrongNotes, removePaper, getSubject, teacherStyle } from '../store.js';
import { SAMPLE_PAPERS } from '../seed-data.js';
import { listCameras, openCamera, stopCamera, capture, grabScreen, cameraErrorText } from '../features/camera.js';
import { drawMarks, renderBadges, hitTest, highlightBadge } from '../features/annotate.js';
import { gradePaper } from '../ai/aiClient.js';
import { exportPaperPNG, exportOne } from '../features/exporter.js';
import { compressCanvas } from '../features/storage-guard.js';
import { goSection, toast, openModal } from './ui-shell.js';
import { speak } from '../features/speech.js';

let selPaperId = null;      // 当前选中的试卷
let activeMark = -1;        // 当前高亮的标注
let badges = [];
let cameras = [];
let cameraReady = false;

export function initDesk() { /* 事件渲染时绑定 */ }

/* ============================================================
 *  渲染
 * ============================================================ */
export function renderDesk() {
  const el = document.getElementById('section-desk');
  const paper = selPaperId ? getPaper(selPaperId) : null;
  if (selPaperId && !paper) selPaperId = null;
  const active = paper || state.papers[0] || null;
  if (active && !selPaperId) selPaperId = active.id;

  const pendingCount = state.papers.filter((p) => p.grading.status === 'pending').length;

  el.innerHTML = `
    <div class="desk-layout">
      <!-- ======== 左：拍照 + 标注图 ======== -->
      <div>
        <div class="card" style="margin-bottom:12px">
          <div class="desk-toolbar">
            <select id="camSelect" class="form-input" style="width:auto"><option>加载摄像头列表…</option></select>
            <button class="btn" id="camOpenBtn">📷 打开摄像头</button>
            <button class="btn btn-accent" id="shotBtn" disabled>📸 拍照发送批改</button>
            <button class="btn" id="screenBtn">🖥 屏幕截图</button>
            <button class="btn" id="importBtn">📁 导入图片</button>
            <button class="btn" id="sampleBtn">📄 示例试卷</button>
            <button class="btn btn-green" id="batchBtn" ${pendingCount ? '' : 'disabled'}>
              ⚡ 一键批改全部${pendingCount ? `（${pendingCount}）` : ''}
            </button>
          </div>
          <input type="file" id="importInput" accept="image/*" multiple hidden>
          <div id="batchProgress" hidden>
            <div class="progress"><div class="progress-bar" id="batchBar" style="width:0%"></div></div>
            <div class="muted" id="batchText"></div>
          </div>

          <!-- 摄像头取景（打开后出现） -->
          <div id="camBox" hidden>
            <video id="camVideo" playsinline muted></video>
            <p class="muted" id="camHint" style="margin:8px 0 0"></p>
          </div>

          <!-- 批改画布 -->
          <div class="canvas-wrap" id="canvasWrap">
            <div class="canvas-stack" id="canvasStack" hidden>
              <canvas id="imgCanvas"></canvas>
              <canvas id="markCanvas"></canvas>
            </div>
            <div class="desk-empty" id="deskEmpty">
              📖 还没有试卷<br>
              拍照、截图、导入本地图片，或点「示例试卷」体验
            </div>
          </div>

          <div class="desk-toolbar" style="margin:10px 0 0" id="paperActions" ${active ? '' : 'hidden'}>
            <button class="btn btn-accent" id="gradeBtn">🤖 开始批改</button>
            <button class="btn" id="exportOneBtn">💾 导出本张 PNG</button>
            <button class="btn btn-ghost" id="printBtn">🖨 打印/存 PDF</button>
            <button class="btn btn-red btn-sm" id="delPaperBtn">删除</button>
          </div>
        </div>

        <!-- 试卷列表 -->
        <div class="card">
          <div class="card-title-row">
            <h3>🗂 试卷列表（${state.papers.length}）</h3>
            <span class="muted">点选查看 · 🟢已批改 🟡待批改</span>
          </div>
          <div class="paper-list" id="paperList">
            ${paperListHTML()}
          </div>
        </div>
      </div>

      <!-- ======== 右：批改详情 ======== -->
      <div>
        <div class="card" id="gradePanel">
          ${gradePanelHTML(active)}
        </div>
      </div>
    </div>
  `;

  bindDeskEvents(el, active);
  // 若已有试卷，把图画出来
  if (active && active.image) drawPaperCanvas(active);
  // 恢复示例卷载入请求
  const loadSample = sessionStorage.getItem('aischool:loadSample');
  if (loadSample) {
    sessionStorage.removeItem('aischool:loadSample');
    loadSamplePaper(loadSample);
  }
}

/* ---------- 试卷列表 HTML ---------- */
function paperListHTML() {
  if (!state.papers.length) return '<span class="muted">暂无试卷</span>';
  return state.papers.map((p) => {
    const sub = getSubject(p.subjectId);
    const graded = p.grading.status === 'graded';
    return `
      <div class="paper-item ${p.id === selPaperId ? 'active' : ''}" data-paper="${p.id}">
        ${p.image ? `<img class="paper-thumb" src="${p.image}">` : '<div class="paper-thumb"></div>'}
        <div class="paper-meta">
          <div class="t">${sub ? sub.icon + ' ' + sub.name : '未分类'} · ${p.student}
            ${graded ? `<span class="tag tag-green">🟢 ${p.grading.score} 分</span>` : '<span class="tag tag-amber">🟡 待批改</span>'}
            ${p.exported ? '<span class="tag">已导出</span>' : ''}
          </div>
          <div class="s">${new Date(p.createdAt).toLocaleString('zh-CN')} · ${sourceLabel(p.source)}</div>
        </div>
        <button class="link-btn" data-del-paper="${p.id}" title="删除">✕</button>
      </div>`;
  }).join('');
}

function sourceLabel(s) {
  return { camera: '📷 摄像头', display: '🖥 截图', sample: '📄 示例卷', import: '📁 导入' }[s] || s;
}

/** 把本地图片文件画到 canvas（统一走批改台 + 压缩入库） */
function fileToCanvas(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('不是图片文件')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片解码失败')); };
    img.src = url;
  });
}

/* ---------- 右栏批改详情 HTML ---------- */
function gradePanelHTML(paper) {
  if (!paper) {
    return `<h3>📝 批改详情</h3><p class="muted">左侧载入试卷并批改后，这里会显示分数、评语，以及每道题的问题与根因。点击图片上的红圈/数字，可定位到对应题目。</p>`;
  }
  const sub = getSubject(paper.subjectId);
  const teacher = state.teachers.find((t) => t.id === paper.teacherId);
  const g = paper.grading;

  const head = `
    <div class="grade-head">
      <h3 style="margin:0">📝 批改详情</h3>
      ${g.status === 'graded'
        ? `<span class="grade-score">${g.score}<small style="font-size:14px;color:var(--text-2)"> 分</small></span>`
        : '<span class="tag tag-amber">待批改</span>'}
    </div>
    <div class="muted" style="margin-bottom:10px">
      ${sub ? sub.icon + ' ' + sub.name : ''} · ${paper.student} ·
      批改老师：${teacher ? teacher.avatar + ' ' + teacher.name : '—'} ·
      ${new Date(paper.createdAt).toLocaleDateString('zh-CN')}
    </div>`;

  if (g.status !== 'graded') {
    return head + `
      <div class="thinking"><div class="spinner"></div>尚未批改，点左侧「开始批改」</div>
      <p class="muted" style="line-height:1.9">
        批改后会在这里逐题列出：<b>问题是什么 → 根因是什么 → 怎么改</b>，
        并可一键跳转到学习画像里关联的历史错题。
      </p>`;
  }

  const summary = g.summary
    ? `<div class="grade-summary">💬 <b>老师总评：</b>${g.summary}</div>`
    : '';

  const cards = (g.marks || []).map((m, i) => {
    const right = m.verdict === 'right';
    return `
      <div class="mark-card ${right ? 'right' : ''} ${i === activeMark ? 'active' : ''}" data-mark="${i}">
        <div class="mark-card-title">
          <span class="tag ${right ? 'tag-green' : 'tag-red'}">${right ? '✓ 正确' : '✗ 错误'}</span>
          题 ${i + 1}
          ${m.causeTag ? `<span class="tag tag-amber">${m.causeTag}</span>` : ''}
        </div>
        <div class="mark-line"><b>问题：</b>${m.problem || '—'}</div>
        ${right ? '' : `
          <div class="mark-line"><b>根因：</b><span class="rc">${m.rootCause || '—'}</span></div>
          <div class="mark-line"><b>建议：</b>${m.suggestion || '—'}</div>
          <div class="mark-line"><b>薄弱知识点：</b>${m.knowledge || '—'}</div>
          <button class="link-btn" data-relate="${m.knowledge || ''}">🔗 关联历史错题 →</button>
        `}
      </div>`;
  }).join('');

  return head + summary + cards;
}

/* ============================================================
 *  事件绑定
 * ============================================================ */
function bindDeskEvents(el, paper) {
  // ---- 摄像头 ----
  const camSel = el.querySelector('#camSelect');
  const video = el.querySelector('#camVideo');
  const shotBtn = el.querySelector('#shotBtn');

  refreshCameras(el).then(() => { cameraReady = true; });

  el.querySelector('#camOpenBtn').onclick = async () => {
    const hint = el.querySelector('#camHint');
    const camBox = el.querySelector('#camBox');
    camBox.hidden = false;
    hint.textContent = '正在打开摄像头…';
    try {
      const devId = camSel.value;
      await openCamera(video, devId);
      shotBtn.disabled = false;
      const settings = video.srcObject?.getVideoTracks?.()[0]?.getSettings?.();
      hint.textContent = `已打开（${video.videoWidth}×${video.videoHeight}）${settings?.deviceId ? '' : ''}，对准试卷后点「拍照发送批改」`;
    } catch (e) {
      hint.textContent = String(e.message || e);
      hint.style.color = 'var(--red)';
      shotBtn.disabled = true;
    }
  };

  shotBtn.onclick = () => {
    const canvas = capture(video);
    if (!canvas.width) { toast('摄像头还没画面', true); return; }
    addImagePaper(canvas, 'camera');
    stopCamera(video);
    el.querySelector('#camBox').hidden = true;
    shotBtn.disabled = true;
    toast('拍照成功，已发送批改台');
  };

  // ---- 屏幕截图 ----
  el.querySelector('#screenBtn').onclick = async () => {
    try {
      const canvas = await grabScreen();
      addImagePaper(canvas, 'display');
      toast('截图成功，已发送批改台');
    } catch (e) {
      toast(e.message || '截图失败', true);
    }
  };

  // ---- 示例试卷 ----
  el.querySelector('#sampleBtn').onclick = () => samplePickerFlow();

  // ---- 导入本地图片 ----
  const importInput = el.querySelector('#importInput');
  el.querySelector('#importBtn').onclick = () => importInput.click();
  importInput.onchange = async () => {
    const files = Array.from(importInput.files || []);
    if (!files.length) return;
    let ok = 0;
    for (const file of files) {
      try {
        const canvas = await fileToCanvas(file);
        addImagePaper(canvas, 'import');
        ok++;
      } catch (e) {
        toast(`导入失败：${file.name}`, true);
      }
    }
    if (ok > 1) toast(`已导入 ${ok} 张图片`);
  };

  // ---- 批量批改 ----
  el.querySelector('#batchBtn').onclick = batchGrade;

  // ---- 单张操作 ----
  const gradeBtn = el.querySelector('#gradeBtn');
  if (gradeBtn) gradeBtn.onclick = () => gradeOne(selPaperId);
  const expBtn = el.querySelector('#exportOneBtn');
  if (expBtn) expBtn.onclick = () => exportOne(selPaperId);
  const printBtn = el.querySelector('#printBtn');
  if (printBtn) printBtn.onclick = () => exportPaperPNG(selPaperId, { print: true });
  const delBtn = el.querySelector('#delPaperBtn');
  if (delBtn) delBtn.onclick = () => { removePaper(selPaperId); selPaperId = null; toast('已删除'); };

  // ---- 试卷列表 ----
  el.querySelectorAll('[data-paper]').forEach((item) => {
    item.onclick = (e) => {
      if (e.target.dataset.delPaper) return;
      selPaperId = item.dataset.paper;
      activeMark = -1;
      renderDesk();
    };
  });
  el.querySelectorAll('[data-del-paper]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      removePaper(b.dataset.delPaper);
      if (selPaperId === b.dataset.delPaper) selPaperId = null;
      toast('已删除');
    };
  });

  // ---- 右栏卡片 ↔ 图上标注 双向联动 ----
  el.querySelectorAll('.mark-card').forEach((card) => {
    card.onclick = (e) => {
      if (e.target.dataset.relate !== undefined) {
        sessionStorage.setItem('aischool:filterKnowledge', e.target.dataset.relate);
        goSection('profile');
        return;
      }
      activeMark = Number(card.dataset.mark);
      syncActiveMark();
    };
  });
}

/** 刷新摄像头下拉 */
async function refreshCameras(el) {
  const sel = el.querySelector('#camSelect');
  if (!sel) return;
  try {
    cameras = await listCameras();
    sel.innerHTML = cameras.length
      ? cameras.map((c) => `<option value="${c.deviceId}">${c.label}</option>`).join('')
      : '<option value="">未检测到摄像头</option>';
  } catch {
    sel.innerHTML = '<option value="">无法列出摄像头</option>';
  }
}

/* ---------- 载图 & 画布 ---------- */
function addImagePaper(canvas, source) {
  const compressed = compressCanvas(canvas);
  const p = addPaper({
    image: compressed,
    source,
    subjectId: state.subjects[0]?.id,
  });
  selPaperId = p.id;
  activeMark = -1;
  renderDesk();
  toast('已加入批改列表，点「开始批改」');
}

function loadSamplePaper(sampleId) {
  const sample = SAMPLE_PAPERS.find((s) => s.id === sampleId);
  if (!sample) return;
  const canvas = document.createElement('canvas');
  sample.draw(canvas);
  const p = addPaper({
    image: canvas.toDataURL('image/jpeg', 0.85),
    source: 'sample',
    subjectId: sample.subjectId,
    sampleId: sample.id,
  });
  selPaperId = p.id;
  activeMark = -1;
  renderDesk();
  toast(`已载入示例卷：${sample.title}`);
}

function samplePickerFlow() {
  openModal({
    title: '选择示例试卷',
    bodyHTML: `<div class="quick-row">${SAMPLE_PAPERS.map((s) => `
      <button class="btn" data-pick="${s.id}">${s.title}</button>`).join('')}</div>
      <p class="muted" style="margin-top:10px">示例卷带题目坐标，批改结果像素级精确。</p>`,
    okText: '关闭',
    cancelText: '返回',
    onOk: () => {},
    onMount: (m, close) => {
      m.querySelectorAll('[data-pick]').forEach((b) => {
        b.onclick = () => { close(); loadSamplePaper(b.dataset.pick); };
      });
    },
  });
}

/** 把试卷图画到 canvas 上 + 标注 + 徽章 */
function drawPaperCanvas(paper) {
  const stack = document.getElementById('canvasStack');
  const empty = document.getElementById('deskEmpty');
  if (!stack || !paper.image) return;
  stack.hidden = false;
  if (empty) empty.hidden = true;

  const img = new Image();
  img.onload = () => {
    const maxW = 760;
    const scale = Math.min(1, maxW / img.width);
    const W = Math.round(img.width * scale);
    const H = Math.round(img.height * scale);

    const imgC = document.getElementById('imgCanvas');
    const markC = document.getElementById('markCanvas');
    imgC.width = W; imgC.height = H;
    markC.width = W; markC.height = H;
    imgC.getContext('2d').drawImage(img, 0, 0, W, H);

    const marks = paper.grading.marks || [];
    drawMarks(markC, marks);
    badges = renderBadges(stack, marks, (i) => {
      activeMark = i;
      syncActiveMark(true);
    });

    // 图上点击命中检测
    imgC.style.cursor = marks.length ? 'pointer' : 'default';
    imgC.onclick = (e) => {
      if (!marks.length) return;
      const rect = imgC.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      const idx = hitTest(marks, nx, ny);
      if (idx >= 0) { activeMark = idx; syncActiveMark(true); }
    };
  };
  img.src = paper.image;
}

/** 同步高亮（图 ↔ 卡片） */
function syncActiveMark(scrollCard) {
  const stack = document.getElementById('canvasStack');
  if (stack) highlightBadge(badges, activeMark);
  document.querySelectorAll('.mark-card').forEach((c, i) => {
    c.classList.toggle('active', i === activeMark);
    if (scrollCard && i === activeMark) {
      c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
}

/* ============================================================
 *  批改流程
 * ============================================================ */
async function gradeOne(paperId) {
  const panel = document.getElementById('gradePanel');
  if (panel) {
    panel.innerHTML = `<h3>📝 批改中</h3>
      <div class="thinking"><div class="spinner"></div>AI 正在批改这份试卷…</div>`;
  }
  try {
    const result = await gradePaper(paperId);
    const paper = getPaper(paperId);
    setGrading(paperId, { status: 'graded', ...result });
    // 错题自动入库
    addWrongNotes(paperId, result.marks, paper.subjectId);
    activeMark = -1;
    renderDesk();
    // 老师语音点评
    const teacher = state.teachers.find((t) => t.id === paper.teacherId);
    const style = teacher ? teacherStyle(teacher.id, paper.stage) : null;
    const praise = result.score >= 90 ? (style?.praise || '不错！') : (style?.comfort || '继续加油！');
    toast(`批改完成：${result.score} 分`);
    speak(`${praise}`, paper.stage === 'senior' ? 'zh-CN' : 'zh-CN');
  } catch (e) {
    toast('批改失败：' + (e.message || e), true);
    renderDesk();
  }
}

async function batchGrade() {
  const pending = state.papers.filter((p) => p.grading.status === 'pending');
  if (!pending.length) { toast('没有待批改的试卷'); return; }

  const wrap = document.getElementById('batchProgress');
  const bar = document.getElementById('batchBar');
  const text = document.getElementById('batchText');
  const btn = document.getElementById('batchBtn');
  if (wrap) wrap.hidden = false;
  if (btn) btn.disabled = true;

  for (let i = 0; i < pending.length; i++) {
    if (text) text.textContent = `正在批改 ${i + 1}/${pending.length}…`;
    if (bar) bar.style.width = `${(i / pending.length) * 100}%`;
    await gradePaper(pending[i].id).then((result) => {
      setGrading(pending[i].id, { status: 'graded', ...result });
      addWrongNotes(pending[i].id, result.marks, pending[i].subjectId);
    });
  }
  if (bar) bar.style.width = '100%';
  if (text) text.textContent = `完成！共批改 ${pending.length} 份`;
  toast(`批量批改完成（${pending.length} 份）`);
  activeMark = -1;
  renderDesk();
}
