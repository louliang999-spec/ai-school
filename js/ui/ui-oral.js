/* ============================================================
 *  ui-oral.js · 英语口语实时练习
 *  - 范读（speechSynthesis）→ 跟读（麦克风识别）→ 词级评分标红
 *  - 不支持/网络失败 → 自动降级"跟读自评"（黄条明示）
 * ============================================================ */

import { state, addOralSession } from '../store.js';
import { ORAL_SENTENCES } from '../seed-data.js';
import { speak, stopSpeak } from '../features/speech.js';
import { recognizeOnce, recognitionSupported } from '../features/oral-recog.js';
import { checkOral } from '../ai/aiClient.js';
import { toast } from './ui-shell.js';

let mode = recognitionSupported() ? 'recognition' : 'self';  // recognition | self
let listening = false;
let lastResult = null;   // {sentenceIndex, score, diffs}

export function initOral() { /* 渲染时绑定 */ }

export function renderOral() {
  const el = document.getElementById('section-oral');
  const stage = state.settings.stage;
  const stageName = { primary: '小学', junior: '初中', senior: '高中' }[stage];
  // 按学段推荐句子（全学段都可练全部）
  const sentences = ORAL_SENTENCES;
  const sessions = state.oral.sessions.slice(0, 10);

  el.innerHTML = `
    ${mode === 'self' ? `
      <div class="notice">
        ⚠️ ${recognitionSupported()
          ? '语音识别暂不可用（网络或权限原因），已切换为<b>跟读自评</b>模式：点「范读」听原音，自己跟读后打星评分。'
          : '当前浏览器不支持语音识别（建议用 Chrome），已切换为<b>跟读自评</b>模式：听范读 → 跟读 → 自评打星。'}
      </div>` : ''}

    <div class="card">
      <div class="card-title-row">
        <h3>🗣 英语口语实时练习（${stageName}推荐）</h3>
        <div class="oral-modes" style="margin:0">
          <button class="btn btn-sm ${mode === 'recognition' ? 'btn-accent' : ''}" data-mode="recognition">🎤 智能评分</button>
          <button class="btn btn-sm ${mode === 'self' ? 'btn-accent' : ''}" data-mode="self">⭐ 跟读自评</button>
        </div>
      </div>

      <div id="sentenceList">
        ${sentences.map((s, i) => sentenceHTML(s, i)).join('')}
      </div>
    </div>

    <div class="card">
      <h3>📈 最近练习记录</h3>
      ${sessions.length ? `
        <div class="paper-list">
          ${sessions.map((s) => `
            <div class="paper-item" style="cursor:default">
              <div class="paper-meta">
                <div class="t">${s.score >= 80 ? '🟢' : s.score >= 60 ? '🟡' : '🔴'} ${s.score} 分
                  <span class="tag">${s.mode === 'self' ? '自评' : '识别'}</span></div>
                <div class="s">${escapeHTML(s.sentence)} · ${new Date(s.at).toLocaleString('zh-CN')}</div>
              </div>
            </div>`).join('')}
        </div>` : '<p class="muted">还没有练习记录，选一句开始吧！</p>'}
    </div>
  `;

  bindOralEvents(el);
}

function sentenceHTML(s, i) {
  const res = lastResult && lastResult.sentenceIndex === i ? lastResult : null;
  return `
    <div class="sentence-card" data-idx="${i}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">
        <span class="tag">${s.level}</span>
        <span class="muted">${s.zh}</span>
      </div>
      <div class="sentence-en" id="senEn-${i}">${renderWords(s.en, res?.diffs)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button class="btn btn-sm" data-play="${i}">🔊 范读</button>
        <button class="btn btn-sm btn-accent" data-record="${i}">🎤 跟读评分</button>
        ${mode === 'self' ? `<button class="btn btn-sm" data-self="${i}">⭐ 我读完了，自评</button>` : ''}
        ${res ? `<span class="score-big" style="font-size:22px">${res.score} 分</span>` : ''}
      </div>
      ${mode === 'self' ? `<div class="stars" data-star="${i}">${'★'.repeat(res?.score ? Math.round(res.score / 20) : 0)}${'☆'.repeat(5 - (res?.score ? Math.round(res.score / 20) : 0))}</div>` : ''}
    </div>`;
}

/** 渲染单词，识别结果差异标红/标绿 */
function renderWords(en, diffs) {
  if (!diffs) return escapeHTML(en);
  return diffs.map((d, i) =>
    d.ok ? `<span class="diff-word">${escapeHTML(d.word)}</span>`
         : `<span class="diff-word bad">${escapeHTML(d.word)}</span>`,
  ).join(' ');
}

function bindOralEvents(el) {
  // 模式切换
  el.querySelectorAll('[data-mode]').forEach((b) => {
    b.onclick = () => {
      mode = b.dataset.mode;
      renderOral();
      toast(mode === 'recognition' ? '已切换为智能评分模式' : '已切换为跟读自评模式');
    };
  });

  // 范读
  el.querySelectorAll('[data-play]').forEach((b) => {
    b.onclick = () => {
      const s = ORAL_SENTENCES[Number(b.dataset.play)];
      stopSpeak();
      speak(s.en, 'en-US');
    };
  });

  // 跟读评分（识别模式）
  el.querySelectorAll('[data-record]').forEach((b) => {
    b.onclick = async () => {
      const idx = Number(b.dataset.record);
      const s = ORAL_SENTENCES[idx];
      if (listening) return;

      if (mode === 'recognition' && recognitionSupported()) {
        listening = true;
        b.disabled = true;
        b.textContent = '🎙 请对着麦克风读…';
        // 先范读一遍，再开始听
        await speak(s.en, 'en-US');
        const r = await recognizeOnce('en-US');
        listening = false;
        b.disabled = false;
        b.textContent = '🎤 跟读评分';

        if (r.error) {
          toast('识别不可用（' + r.error + '），已切换自评模式', true);
          mode = 'self';
          renderOral();
          return;
        }
        const result = await checkOral(s.en, r.text);
        lastResult = { sentenceIndex: idx, score: result.score, diffs: result.diffs };
        addOralSession({ id: 'o' + Date.now(), sentence: s.en, score: result.score, mode: 'recognition', at: Date.now() });
        renderOral();
        toast(`识别得分 ${result.score} 分${result.score >= 80 ? '，很棒！' : '，继续加油！'}`);
      } else {
        // 自评：范读 → 提示自评
        stopSpeak();
        await speak(s.en, 'en-US');
        toast('听清了吗？读完后点「我读完了，自评」打星');
      }
    };
  });

  // 自评打星
  el.querySelectorAll('[data-self]').forEach((b) => {
    b.onclick = () => {
      const idx = Number(b.dataset.self);
      const s = ORAL_SENTENCES[idx];
      const stars = el.querySelector(`[data-star="${idx}"]`);
      const n = prompt('给自己打几颗星？(1-5)', '4');
      const v = Math.max(1, Math.min(5, Number(n) || 4));
      const score = v * 20;
      lastResult = { sentenceIndex: idx, score, diffs: null };
      addOralSession({ id: 'o' + Date.now(), sentence: s.en, score, mode: 'self', at: Date.now() });
      renderOral();
      toast(`自评 ${v} 星（${score} 分）已记录`);
    };
  });

  // 星星直接点
  el.querySelectorAll('[data-star] span').forEach((sp, i) => {
    sp.onclick = () => { /* 由"我读完了"统一处理 */ };
  });
}

function escapeHTML(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
