/* ============================================================
 *  ui-tools.js · 教具生成
 *  按孩子兴趣（游戏/小动物/恐龙…）× 教具类型（识字/公式/单词卡）
 *  用 canvas 生成主题化卡片 → 预览 / 下载 PNG / 朗读
 * ============================================================ */

import { state, addTeachingAid, removeTeachingAid, setInterests } from '../store.js';
import { AID_THEMES, AID_TYPES } from '../seed-data.js';
import { speak } from '../features/speech.js';
import { toast } from './ui-shell.js';

let selTheme = AID_THEMES[1];   // 默认小动物
let selType = AID_TYPES[0];
let lastAidCanvas = null;
let lastAidTitle = '';
let lastAidExample = '';

export function initTools() { /* 渲染时绑定 */ }

export function renderTools() {
  const el = document.getElementById('section-tools');

  el.innerHTML = `
    <div class="card">
      <div class="card-title-row">
        <h3>🎨 按我的兴趣生成教具</h3>
        <span class="muted">喜欢什么风格，就用什么风格学！</span>
      </div>

      <div class="field">
        <label>1. 选兴趣主题（可多选进画像，点选生成风格）</label>
        <div class="theme-chips" id="themeChips">
          ${AID_THEMES.map((t) => `
            <span class="chip ${t.id === selTheme.id ? 'active' : ''}" data-theme="${t.id}">${t.emoji} ${t.name}</span>
          `).join('')}
          <input type="text" id="customTheme" placeholder="自定义主题，如：我的小仓鼠" style="width:200px;display:inline-block">
        </div>
      </div>

      <div class="field">
        <label>2. 选教具类型</label>
        <div class="theme-chips" id="typeChips">
          ${AID_TYPES.map((t) => `
            <span class="chip ${t.id === selType.id ? 'active' : ''}" data-type="${t.id}">${t.name}</span>
          `).join('')}
        </div>
      </div>

      <div class="grid grid-3" style="margin-top:8px">
        <div class="field"><label>知识点（卡片大字）</label>
          <input type="text" id="aidTitle" placeholder="例：晴 / a+b=b+a / elephant"></div>
        <div class="field"><label>注释（拼音/公式说明/词性）</label>
          <input type="text" id="aidBody" placeholder="例：qíng / 加法交换律 / n. 大象"></div>
        <div class="field"><label>例句</label>
          <input type="text" id="aidExample" placeholder="留空会按主题自动生成趣味例句"></div>
      </div>

      <div style="display:flex;gap:8px">
        <button class="btn btn-accent" id="genAidBtn">✨ 生成教具</button>
        <button class="btn" id="speakAidBtn" disabled>🔊 朗读</button>
        <button class="btn" id="dlAidBtn" disabled>💾 下载 PNG</button>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <h3>🖼 生成预览</h3>
        <div class="aid-preview" id="aidPreview">
          <span class="muted">还没生成，填好上面的表单点「生成教具」</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title-row">
          <h3>🗂 我的教具箱（${state.teachingAids.length}）</h3>
        </div>
        <div class="paper-list" id="aidList">
          ${aidListHTML()}
        </div>
      </div>
    </div>
  `;

  bindToolsEvents(el);
}

function aidListHTML() {
  if (!state.teachingAids.length) return '<span class="muted">教具箱是空的</span>';
  return state.teachingAids.map((a) => {
    const theme = AID_THEMES.find((t) => t.name === a.theme);
    return `
      <div class="paper-item" style="cursor:default">
        <div class="paper-meta">
          <div class="t">${theme ? theme.emoji : '🎨'} ${a.type} · ${escapeHTML(a.content.title)}</div>
          <div class="s">主题：${escapeHTML(a.theme)} · ${new Date(a.createdAt).toLocaleDateString('zh-CN')}</div>
        </div>
        <button class="btn btn-sm" data-aid-speak="${a.id}">🔊</button>
        <button class="btn btn-sm btn-ghost" data-aid-del="${a.id}">✕</button>
      </div>`;
  }).join('');
}

function bindToolsEvents(el) {
  // 主题选择
  el.querySelectorAll('[data-theme]').forEach((c) => {
    c.onclick = () => {
      selTheme = AID_THEMES.find((t) => t.id === c.dataset.theme) || selTheme;
      el.querySelectorAll('[data-theme]').forEach((x) => x.classList.toggle('active', x === c));
      // 同步进画像兴趣
      const names = state.settings.interests?.slice() || [];
      if (!names.includes(selTheme.name)) names.push(selTheme.name);
      setInterests(names.slice(-4));
    };
  });

  // 类型选择
  el.querySelectorAll('[data-type]').forEach((c) => {
    c.onclick = () => {
      selType = AID_TYPES.find((t) => t.id === c.dataset.type) || selType;
      el.querySelectorAll('[data-type]').forEach((x) => x.classList.toggle('active', x === c));
    };
  });

  // 生成
  el.querySelector('#genAidBtn').onclick = () => generateAid(el);
  el.querySelector('#speakAidBtn').onclick = () => {
    const t = el.querySelector('#aidTitle').value.trim() || lastAidTitle;
    const ex = el.querySelector('#aidExample').value.trim() || lastAidExample;
    speak([t, ex].filter(Boolean).join('。'), 'zh-CN');
  };
  el.querySelector('#dlAidBtn').onclick = () => {
    if (!lastAidCanvas) return;
    const a = document.createElement('a');
    a.href = lastAidCanvas.toDataURL('image/png');
    a.download = `教具_${lastAidTitle || 'card'}.png`;
    a.click();
    toast('已下载');
  };

  // 列表操作
  el.querySelectorAll('[data-aid-del]').forEach((b) => {
    b.onclick = () => { removeTeachingAid(b.dataset.aidDel); toast('已移除'); };
  });
  el.querySelectorAll('[data-aid-speak]').forEach((b) => {
    b.onclick = () => {
      const a = state.teachingAids.find((x) => x.id === b.dataset.aidSpeak);
      if (a) speak(`${a.content.title}。${a.content.body}。${a.content.example}`, 'zh-CN');
    };
  });
}

/* ============================================================
 *  生成：模板 × 主题皮肤 → canvas
 * ============================================================ */
function generateAid(el) {
  const custom = el.querySelector('#customTheme').value.trim();
  const theme = custom
    ? { ...selTheme, name: custom, emoji: '🌟', exampleStyle: (t) => `关于"${t}"的趣味知识卡片！` }
    : selTheme;

  const title = el.querySelector('#aidTitle').value.trim();
  if (!title) { toast('请填写知识点', true); return; }
  const body = el.querySelector('#aidBody').value.trim() || ' ';
  const example = el.querySelector('#aidExample').value.trim()
    || theme.exampleStyle(title);

  const canvas = renderCard({ theme, type: selType, title, body, example });
  lastAidCanvas = canvas;
  lastAidTitle = title;
  lastAidExample = example;

  // ⚠️ 先入库：addTeachingAid 会同步触发整页重渲染（清空预览区），
  //    所以必须在它之后再往预览区里塞图片/启用按钮
  addTeachingAid({
    id: 'a' + Date.now(),
    type: selType.name,
    theme: theme.name,
    content: { title, body, example },
    createdAt: Date.now(),
  });

  const preview = el.querySelector('#aidPreview');
  preview.innerHTML = '';
  const img = new Image();
  img.src = canvas.toDataURL('image/png');
  img.alt = '教具预览';
  preview.appendChild(img);

  el.querySelector('#speakAidBtn').disabled = false;
  el.querySelector('#dlAidBtn').disabled = false;

  toast('教具已生成并存入教具箱');
}

/** 画卡片 */
function renderCard({ theme, type, title, body, example }) {
  const W = 720, H = 460;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 背景
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, tint(theme.color, 0.14));
  ctx.fillStyle = grad;
  roundRectPath(ctx, 0, 0, W, H, 28);
  ctx.fill();

  // 边框
  ctx.strokeStyle = theme.color;
  ctx.lineWidth = 10;
  roundRectPath(ctx, 8, 8, W - 16, H - 16, 22);
  ctx.stroke();

  // 主题标签
  ctx.fillStyle = theme.color;
  roundRectPath(ctx, 30, 28, 190, 52, 26);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText(`${theme.emoji} ${theme.name}`, 125, 63);

  // 类型标签
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = theme.color;
  ctx.lineWidth = 3;
  roundRectPath(ctx, W - 190, 28, 160, 52, 26);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = theme.color;
  ctx.font = 'bold 24px "Microsoft YaHei"';
  ctx.fillText(type.name, W - 110, 63);

  // 知识点大字
  ctx.fillStyle = '#22262f';
  ctx.font = `bold ${title.length > 6 ? 72 : 96}px "Microsoft YaHei"`;
  ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, H * 0.5);

  // 注释
  ctx.fillStyle = theme.color;
  ctx.font = '30px "Microsoft YaHei"';
  ctx.fillText(body.trim(), W / 2, H * 0.62);

  // 例句
  ctx.fillStyle = '#5b6472';
  ctx.font = '26px "Microsoft YaHei"';
  wrapCenter(ctx, example, W / 2, H * 0.78, W - 100, 34);

  // 装饰 emoji
  ctx.font = '54px serif';
  ctx.textAlign = 'left';
  ctx.globalAlpha = 0.9;
  ctx.fillText(theme.emoji, 40, H - 42);
  ctx.textAlign = 'right';
  ctx.fillText('AI 学习工作台', W - 40, H - 48);

  return canvas;
}

function wrapCenter(ctx, text, cx, y, maxW, lineH) {
  let line = '';
  let yy = y;
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW) {
      ctx.fillText(line, cx, yy);
      line = ch;
      yy += lineH;
    } else line += ch;
  }
  if (line) ctx.fillText(line, cx, yy);
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 颜色淡化 */
function tint(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
