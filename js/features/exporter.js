/* ============================================================
 *  exporter.js · 导出
 *  - 单张：原图 + 底部批语区（分数/评语/老师签名/日期）→ PNG 下载
 *  - 批量：导航栏「导出已批改试卷」逐张下载
 *  - PDF：window.print() 打印视图，用户"另存为 PDF"
 *  所有图片都是本地生成的 dataURL，无跨域污染风险
 * ============================================================ */

import { state, getPaper, getSubject, markExported, teacherStyle } from '../store.js';
import { toast } from '../ui/ui-shell.js';

const RED = '#e53935';

/** 合成"原图 + 批语区"的 canvas */
async function compose(paper) {
  const img = await loadImage(paper.image);
  const W = img.width;
  const FOOTER = Math.round(W * 0.22);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = img.height + FOOTER;
  const ctx = canvas.getContext('2d');

  // 纸底 + 图
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  // 批语区
  const y0 = img.height;
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y0);
  ctx.lineTo(W, y0);
  ctx.stroke();

  const g = paper.grading;
  const sub = getSubject(paper.subjectId);
  const teacher = state.teachers.find((t) => t.id === paper.teacherId);
  const stageName = { primary: '小学', junior: '初中', senior: '高中' }[paper.stage] || '';

  // 左：分数
  ctx.fillStyle = RED;
  ctx.textAlign = 'left';
  ctx.font = `bold ${Math.round(W * 0.09)}px "Microsoft YaHei"`;
  ctx.fillText(`${g.score} 分`, W * 0.04, y0 + FOOTER * 0.42);

  // 中：评语
  ctx.fillStyle = '#333';
  ctx.font = `${Math.round(W * 0.026)}px "Microsoft YaHei"`;
  const summary = wrapText(ctx, g.summary || '', W * 0.26, W * 0.66);
  summary.slice(0, 3).forEach((line, i) => {
    ctx.fillText(line, W * 0.26, y0 + FOOTER * 0.26 + i * W * 0.036);
  });

  // 底：签名行
  ctx.fillStyle = '#888';
  ctx.font = `${Math.round(W * 0.022)}px "Microsoft YaHei"`;
  ctx.fillText(
    `${stageName}${sub ? ' · ' + sub.name : ''}  批改：${teacher ? teacher.name : 'AI 老师'}  ${new Date().toLocaleDateString('zh-CN')}  ·  AI 学习工作台`,
    W * 0.04, y0 + FOOTER * 0.88,
  );

  // 红线框
  ctx.strokeStyle = RED;
  ctx.lineWidth = Math.max(3, W * 0.005);
  ctx.strokeRect(W * 0.02, y0 + FOOTER * 0.08, W * 0.96, FOOTER * 0.84);

  return canvas;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

function wrapText(ctx, text, x, maxW) {
  const words = String(text);
  const lines = [];
  let line = '';
  for (const ch of words) {
    if (ctx.measureText(line + ch).width > maxW) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function download(blobOrUrl, filename) {
  const a = document.createElement('a');
  if (typeof blobOrUrl === 'string') {
    a.href = blobOrUrl;
  } else {
    a.href = URL.createObjectURL(blobOrUrl);
    a.addEventListener('click', () => setTimeout(() => URL.revokeObjectURL(a.href), 5000));
  }
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** 导出单张为 PNG（默认动作），或 {print:true} 走打印/存 PDF */
export async function exportOne(paperId, opts = {}) {
  const paper = getPaper(paperId);
  if (!paper) { toast('试卷不存在', true); return; }
  if (paper.grading.status !== 'graded') { toast('请先批改再导出', true); return; }
  if (!paper.image) { toast('原图已被清理，无法导出', true); return; }

  try {
    const canvas = await compose(paper);
    if (opts.print) {
      printCanvas(canvas, paper);
      markExported([paper.id]);
      return;
    }
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const sub = getSubject(paper.subjectId);
    download(blob, `批改_${paper.student}_${sub ? sub.name : '试卷'}_${fmtDate(paper.createdAt)}.png`);
    markExported([paper.id]);
    toast('已导出 PNG');
  } catch (e) {
    toast('导出失败：' + (e.message || e), true);
  }
}

/** 导出（含打印别名，供课桌页按钮调用） */
export const exportPaperPNG = exportOne;

/** 导航栏：批量导出所有"已批改且未导出"的试卷 */
export async function exportGradedPapers() {
  const list = state.papers.filter(
    (p) => p.grading.status === 'graded' && !p.exported && p.image,
  );
  if (!list.length) { toast('没有可导出的已批改试卷'); return; }

  toast(`开始导出 ${list.length} 份，浏览器可能询问"允许多文件下载"`);
  for (const p of list) {
    await exportOne(p.id);
    await new Promise((r) => setTimeout(r, 400));  // 错开下载，避免被浏览器拦截
  }
  toast(`已导出 ${list.length} 份试卷`);
}

/** 打印视图 → 用户另存为 PDF */
function printCanvas(canvas, paper) {
  const view = document.getElementById('printView');
  view.innerHTML = '';
  const img = new Image();
  img.src = canvas.toDataURL('image/png');
  img.onload = () => {
    view.appendChild(img);
    setTimeout(() => window.print(), 120);
  };
}

function fmtDate(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

export { compose as composeGradedCanvas };
