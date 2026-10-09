/* ============================================================
 *  annotate.js · 标注层
 *  底层 canvas 画原图，上层透明 canvas 画红笔标注，
 *  另外叠一排可点击的数字徽章（①②③）。
 *  坐标全部归一化（0~1），图片缩放后标注位置依然准确。
 * ============================================================ */

const RED = '#e53935';
const GREEN = '#2e9e5b';

/**
 * 绘制全部标注
 * @param markCanvas 透明标注层
 * @param marks       [{x,y,shape,verdict}] shape: circle|cross|tick|note
 */
export function drawMarks(markCanvas, marks) {
  const ctx = markCanvas.getContext('2d');
  const W = markCanvas.width;
  const H = markCanvas.height;
  ctx.clearRect(0, 0, W, H);
  const lw = Math.max(2, W * 0.004);

  marks.forEach((m) => {
    const x = m.x * W;
    const y = m.y * H;
    const r = Math.max(16, W * 0.035);
    const right = m.verdict === 'right';
    ctx.strokeStyle = right ? GREEN : RED;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (m.shape) {
      case 'circle':
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.72, -0.15, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'cross':
        drawCross(ctx, x, y, r * 0.7);
        break;
      case 'tick':
        drawTick(ctx, x, y, r);
        break;
      case 'note':
      default:
        // 批注气泡
        ctx.beginPath();
        const bw = r * 2.4, bh = r * 1.5;
        roundRect(ctx, x - bw / 2, y - bh / 2, bw, bh, 8);
        ctx.fillStyle = right ? 'rgba(46,158,91,0.15)' : 'rgba(229,57,53,0.15)';
        ctx.fill();
        ctx.stroke();
        break;
    }
  });
}

function drawCross(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r);
  ctx.stroke();
}

function drawTick(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x - r * 0.9, y);
  ctx.lineTo(x - r * 0.2, y + r * 0.7);
  ctx.lineTo(x + r * 0.9, y - r * 0.7);
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * 渲染数字徽章锚点（HTML 元素，绝对定位在 canvas-stack 内）
 * @returns 徽章元素数组
 */
export function renderBadges(container, marks, onClick) {
  // 清旧徽章
  container.querySelectorAll('.mark-badge').forEach((b) => b.remove());
  const badges = [];
  marks.forEach((m, i) => {
    const b = document.createElement('div');
    b.className = 'mark-badge' + (m.verdict === 'right' ? ' right' : '');
    b.textContent = String(i + 1);
    b.style.left = (m.x * 100) + '%';
    b.style.top = (m.y * 100) + '%';
    b.dataset.markId = m.id || String(i);
    b.title = m.problem || '';
    b.onclick = (e) => {
      e.stopPropagation();
      onClick && onClick(i);
    };
    container.appendChild(b);
    badges.push(b);
  });
  return badges;
}

/** 高亮某个徽章 */
export function highlightBadge(badges, index) {
  badges.forEach((b, i) => b.classList.toggle('active', i === index));
}

/**
 * 命中检测：点击图片位置 → 找最近的标注（归一化距离 < 0.05）
 * @returns 命中的标注下标，未命中返回 -1
 */
export function hitTest(marks, nx, ny) {
  let best = -1;
  let bestD = 0.05;
  marks.forEach((m, i) => {
    const d = Math.hypot(m.x - nx, (m.y - ny) * 0.75);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/** 某个标注短暂脉冲高亮（点了右栏卡片时图上响应） */
export function pulseMark(container, index, marks) {
  const b = container.querySelectorAll('.mark-badge')[index];
  if (!b) return;
  b.classList.add('active');
  b.style.transform = 'scale(1.5)';
  setTimeout(() => { b.style.transform = ''; }, 500);
}
