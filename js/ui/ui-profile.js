/* ============================================================
 *  ui-profile.js · 学习画像与进度
 *  - 擅长/不擅长学科（正确率条形图）
 *  - 错题本：根因分析、薄弱知识点、与历史错题关联、核心法则
 *  - 生成非标准化定制教学方案（含依据）
 * ============================================================ */

import {
  state, getSubject, toggleMastered, removeWrongNote,
} from '../store.js';
import { buildFullProfile, buildPlan } from '../ai/aiClient.js';
import { CAUSE_SENTENCES, buildProfile } from '../ai/profile-mock.js';
import { toast, stageLabel } from './ui-shell.js';
import { speak } from '../features/speech.js';

let profile = null;
let plan = null;
let filterKnowledge = '';
let busy = false;

export function initProfile() { /* 渲染时绑定 */ }

export function renderProfile() {
  const el = document.getElementById('section-profile');

  // 接收课桌页跳转过来的知识点过滤
  const f = sessionStorage.getItem('aischool:filterKnowledge');
  if (f !== null) { filterKnowledge = f; sessionStorage.removeItem('aischool:filterKnowledge'); }

  if (!profile) profile = buildProfileSync();

  const stage = state.settings.stage;

  el.innerHTML = `
    <div class="grid grid-2">
      <!-- 擅长 / 薄弱 -->
      <div class="card">
        <div class="card-title-row">
          <h3>📊 学科掌握度</h3>
          <button class="btn btn-sm" id="refreshProfile">🔄 重新分析</button>
        </div>
        ${subjectBarsHTML(profile)}
        <div style="margin-top:14px">
          <div class="muted" style="margin-bottom:6px">🟢 擅长</div>
          <div class="theme-chips">${profile.strengths.map((s) => `<span class="chip active" style="background:var(--green);border-color:var(--green)">${s}</span>`).join('')}</div>
          <div class="muted" style="margin:10px 0 6px">🔴 薄弱</div>
          <div class="theme-chips">${profile.weaknesses.map((s) => `<span class="chip active" style="background:var(--red);border-color:var(--red)">${s}</span>`).join('')}</div>
        </div>
      </div>

      <!-- 需背诵的核心法则 -->
      <div class="card">
        <h3>🧠 需背诵的核心法则</h3>
        <div class="memorize-list">
          ${profile.memorize.map((m) => `
            <div class="memorize-item">
              <span>${m}</span>
              <button class="btn btn-sm" data-speak="${encodeURIComponent(m)}">🔊 朗读</button>
            </div>`).join('') || '<span class="muted">暂无（先批改几份试卷）</span>'}
        </div>
      </div>
    </div>

    <!-- 定制教学方案 -->
    <div class="card">
      <div class="card-title-row">
        <h3>🎯 非标准化定制教学方案（${stageLabel(stage)}专属）</h3>
        <div style="display:flex;gap:8px">
          ${plan ? '<button class="btn btn-sm" id="replanBtn">🔄 重新生成</button>' : ''}
          <button class="btn btn-accent" id="planBtn">${plan ? '👁 查看方案' : '✨ 生成我的方案'}</button>
        </div>
      </div>
      <div id="planBox">
        ${plan ? planHTML(plan) : '<p class="muted">点击「生成我的方案」，系统会基于你的错题画像、薄弱点与当前学段，生成一份专属教学方案，并注明依据。</p>'}
      </div>
    </div>

    <!-- 错题本 -->
    <div class="card">
      <div class="card-title-row">
        <h3>📕 错题本（${state.wrongNotes.filter((w) => !w.mastered).length} 待攻克 / 共 ${state.wrongNotes.length}）</h3>
        <div style="display:flex;gap:8px;align-items:center">
          ${filterKnowledge ? `<span class="tag tag-red">筛选：${filterKnowledge}</span><button class="link-btn" id="clearFilter">清除筛选</button>` : ''}
        </div>
      </div>
      <div id="wrongList">${wrongListHTML()}</div>
    </div>
  `;

  bindProfileEvents(el);
}

/* ---------- 同步版画像（首屏不等 async） ---------- */
function buildProfileSync() {
  return buildProfile();
}

/* ---------- 掌握度条形 ---------- */
function subjectBarsHTML(pf) {
  const entries = Object.entries(pf.subjectStats);
  if (!entries.length) {
    return '<p class="muted">还没有批改数据 —— 去「AI 学习课桌」批改几份试卷，这里就会出现画像。</p>';
  }
  return entries.map(([sid, s]) => {
    const sub = getSubject(sid);
    const pct = Math.round(s.correct * 100);
    return `
      <div class="bar-row">
        <div class="bar-label">${sub ? sub.icon + ' ' + sub.name : sid}</div>
        <div class="bar-track"><div class="bar-fill ${pct < 60 ? 'weak' : ''}" style="width:${pct}%"></div></div>
        <div class="bar-val">${pct}%</div>
      </div>`;
  }).join('');
}

/* ---------- 错题本 ---------- */
function wrongListHTML() {
  let list = [...state.wrongNotes].sort((a, b) => b.date - a.date);
  if (filterKnowledge) list = list.filter((w) => w.knowledge === filterKnowledge);
  if (!list.length) return `<p class="muted">${filterKnowledge ? '没有匹配的历史错题。' : '错题本是空的，太棒了！'}</p>`;

  return list.map((w) => {
    const sub = getSubject(w.subjectId);
    const causeSentence = CAUSE_SENTENCES[w.causeTag]
      ? CAUSE_SENTENCES[w.causeTag](w.knowledge, countSame(w.knowledge))
      : w.rootCause;

    // 关联链
    const related = (w.relatedTo || [])
      .map((id) => state.wrongNotes.find((x) => x.id === id))
      .filter(Boolean);

    return `
      <div class="wrong-item ${w.mastered ? 'mastered' : ''}">
        <div class="wrong-head">
          <span class="tag tag-red">${w.causeTag}</span>
          <span class="tag">${sub ? sub.icon + ' ' + sub.name : ''}</span>
          <strong>${w.knowledge}</strong>
          <span class="muted">${new Date(w.date).toLocaleDateString('zh-CN')}</span>
          <span style="flex:1"></span>
          <button class="btn btn-sm ${w.mastered ? '' : 'btn-green'}" data-master="${w.id}">
            ${w.mastered ? '↩ 重新练习' : '✅ 已掌握'}
          </button>
          <button class="btn btn-sm btn-ghost" data-rm="${w.id}">删除</button>
        </div>
        <div class="wrong-body">
          <b>根因分析：</b>${w.rootCause || '—'}<br>
          <b>规律：</b>${causeSentence}<br>
          <b>改进：</b>${w.suggestion || '—'}
          ${related.length ? `
            <div class="rel-chain" style="margin-top:6px">
              🔗 关联历史错题：
              ${related.map((r) => `<span class="tag tag-amber">${r.knowledge}</span>`).join(' → ')}
            </div>` : ''}
        </div>
      </div>`;
  }).join('');
}

function countSame(knowledge) {
  return state.wrongNotes.filter((w) => w.knowledge === knowledge).length;
}

/* ---------- 方案 HTML ---------- */
function planHTML(p) {
  return `
    <div class="muted" style="margin-bottom:8px">
      ${p.stageName} · 由 ${p.teacherName} 生成于 ${new Date(p.generatedAt).toLocaleString('zh-CN')}
      ${p.evidence.length ? ` · <b>本方案依据：${p.evidence.join('、')}</b>` : ''}
    </div>
    ${p.steps.map((s, i) => `
      <div class="plan-step">
        <div class="plan-idx ${i > 9 ? 'small' : ''}">${i + 1}</div>
        <div class="plan-body">
          <b>${s.title}</b><br>${s.body}
          <div class="why">💡 ${s.why}</div>
        </div>
      </div>`).join('')}
    ${p.memorize.length ? `
      <div style="margin-top:10px">
        <div class="muted" style="margin-bottom:6px">📌 本方案要求背诵：</div>
        <div class="memorize-list">${p.memorize.map((m) => `<div class="memorize-item"><span>${m}</span><button class="btn btn-sm" data-speak="${encodeURIComponent(m)}">🔊</button></div>`).join('')}</div>
      </div>` : ''}
  `;
}

/* ---------- 事件 ---------- */
function bindProfileEvents(el) {
  el.querySelector('#refreshProfile').onclick = async () => {
    profile = await buildFullProfile();
    renderProfile();
    toast('画像已更新');
  };

  el.querySelector('#planBtn').onclick = generatePlan;
  const replan = el.querySelector('#replanBtn');
  if (replan) replan.onclick = generatePlan;

  el.querySelectorAll('[data-master]').forEach((b) => {
    b.onclick = () => toggleMastered(b.dataset.master);
  });
  el.querySelectorAll('[data-rm]').forEach((b) => {
    b.onclick = () => { removeWrongNote(b.dataset.rm); toast('已删除'); };
  });
  const clear = el.querySelector('#clearFilter');
  if (clear) clear.onclick = () => { filterKnowledge = ''; renderProfile(); };
  bindSpeak(el);
}

async function generatePlan() {
  if (busy) return;
  busy = true;
  const box = document.getElementById('planBox');
  box.innerHTML = '<div class="thinking"><div class="spinner"></div>正在根据你的画像定制方案…</div>';
  try {
    plan = await buildPlan(state.settings.stage);
    renderProfile();
    toast('定制方案已生成');
  } catch (e) {
    toast('生成失败：' + (e.message || e), true);
    renderProfile();
  } finally {
    busy = false;
  }
}

/** 所有 data-speak 按钮统一接线 */
export function bindSpeak(el) {
  el.querySelectorAll('[data-speak]').forEach((b) => {
    b.onclick = () => speak(decodeURIComponent(b.dataset.speak), 'zh-CN');
  });
}
