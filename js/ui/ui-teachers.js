/* ============================================================
 *  ui-teachers.js · 师资管理
 *  - 学科：无限制增删
 *  - 老师：无限制增删改，一位老师可教多学科
 *  - 三学段教学风格：同一位老师，小学/初中/高中完全不同话术
 * ============================================================ */

import {
  state, addSubject, removeSubject, addTeacher, updateTeacher,
  removeTeacher, setActiveTeacher, DEFAULT_STYLES, getSubject,
} from '../store.js';
import { openModal, toast, stageLabel } from './ui-shell.js';

const STAGES = ['primary', 'junior', 'senior'];
const AVATARS = ['🧑‍🏫', '👩‍🏫', '🧑‍🔬', '👩‍💼', '👨‍🏫', '👩‍🎓', '🧑‍💻', '🦸'];

export function initTeachers() { /* 事件渲染时绑定 */ }

export function renderTeachers() {
  const el = document.getElementById('section-teachers');
  const stage = state.settings.stage;

  el.innerHTML = `
    <div class="card">
      <div class="card-title-row">
        <h3>📚 学科管理（可无限制增删）</h3>
        <button class="btn btn-accent" id="addSubjectBtn">＋ 新增学科</button>
      </div>
      <div class="theme-chips" id="subjectList">
        ${state.subjects.map((s) => `
          <span class="chip active" style="background:${s.color};border-color:${s.color}">
            ${s.icon} ${s.name}
            <button class="link-btn" data-del-sub="${s.id}" style="color:#fff;margin-left:6px">✕</button>
          </span>
        `).join('') || '<span class="muted">还没有学科，点右上角新增</span>'}
      </div>
    </div>

    <div class="card">
      <div class="card-title-row">
        <h3>🧑‍🏫 老师管理（可无限制增删，${state.teachers.length} 位）</h3>
        <button class="btn btn-accent" id="addTeacherBtn">＋ 聘请新老师</button>
      </div>
      <div class="grid grid-2" id="teacherGrid">
        ${state.teachers.map((t) => teacherCardHTML(t, stage)).join('')}
      </div>
    </div>

    <div class="card">
      <h3>🎯 什么是"三学段教学风格"？</h3>
      <p class="muted" style="line-height:1.9">
        同一位老师，面对小学生会用亲切鼓励、游戏化的话术；面对初中生会用引导启发式提问；
        面对高中生则直接讲考点与易错项。在下方每位老师的卡片里，可以分别编辑三套话术。
        顶栏切换"学段"后，全站（欢迎语、评语、教学方案）都会换成对应风格。
      </p>
    </div>
  `;

  // ---- 事件 ----
  document.getElementById('addSubjectBtn').onclick = addSubjectFlow;
  document.getElementById('addTeacherBtn').onclick = addTeacherFlow;

  el.querySelectorAll('[data-del-sub]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      removeSubject(b.dataset.delSub);
      toast('学科已删除');
    };
  });
  el.querySelectorAll('[data-edit-teacher]').forEach((b) => {
    b.onclick = () => editTeacherFlow(b.dataset.editTeacher);
  });
  el.querySelectorAll('[data-del-teacher]').forEach((b) => {
    b.onclick = () => {
      removeTeacher(b.dataset.delTeacher);
      toast('老师已解聘');
    };
  });
  el.querySelectorAll('[data-use-teacher]').forEach((b) => {
    b.onclick = () => {
      setActiveTeacher(b.dataset.useTeacher);
      toast('已设为当前老师');
    };
  });
  el.querySelectorAll('[data-style-teacher]').forEach((b) => {
    b.onclick = () => editStylesFlow(b.dataset.styleTeacher);
  });
}

function teacherCardHTML(t, stage) {
  const subs = (t.subjectIds || []).map((id) => getSubject(id)).filter(Boolean);
  const isActive = state.settings.activeTeacherId === t.id;
  const style = t.styles?.[stage] || DEFAULT_STYLES[stage];

  const styleBlocks = STAGES.map((st) => {
    const s = t.styles?.[st] || DEFAULT_STYLES[st];
    const isCur = st === stage;
    return `
      <div class="style-block ${isCur ? '' : 'is-other'}">
        <span class="stg">${stageLabel(st)}</span>
        <strong>${s.tone}</strong><br>
        ${s.greeting}<br>
        👍 ${s.praise}　💪 ${s.comfort}
      </div>`;
  }).join('');

  return `
    <div class="card teacher-card" style="margin:0">
      <div class="teacher-head">
        <div class="teacher-avatar">${t.avatar}</div>
        <div style="flex:1">
          <div style="font-weight:700">${t.name} ${isActive ? '<span class="tag tag-green">当前老师</span>' : ''}</div>
          <div style="margin-top:4px">
            ${subs.map((s) => `<span class="subject-pill">${s.icon} ${s.name}</span>`).join(' ') || '<span class="muted">未绑定学科</span>'}
          </div>
        </div>
      </div>

      <div class="muted" style="color:var(--stage-accent)">
        当前学段（${stageLabel(stage)}）话术：「${style.greeting}」
      </div>

      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm" data-style-teacher="${t.id}">✎ 编辑三学段话术</button>
        <button class="btn btn-sm" data-edit-teacher="${t.id}">✏️ 编辑资料</button>
        ${isActive ? '' : `<button class="btn btn-sm" data-use-teacher="${t.id}">设为当前</button>`}
        <button class="btn btn-sm btn-red" data-del-teacher="${t.id}">解聘</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:6px">${styleBlocks}</div>
    </div>`;
}

/* ---------- 新增学科 ---------- */
function addSubjectFlow() {
  openModal({
    title: '新增学科',
    bodyHTML: `
      <div class="field"><label>学科名称</label><input type="text" id="f-sub-name" placeholder="例如：历史"></div>
      <div class="field"><label>图标（emoji）</label><input type="text" id="f-sub-icon" value="📚"></div>`,
    okText: '创建',
    onOk: (m) => {
      const name = m.querySelector('#f-sub-name').value.trim();
      if (!name) { toast('请填写学科名称', true); return false; }
      addSubject(name, m.querySelector('#f-sub-icon').value.trim() || '📚');
      toast(`学科「${name}」已创建`);
    },
  });
}

/* ---------- 聘请老师 ---------- */
function addTeacherFlow() {
  const subCheckboxes = state.subjects.map((s) => `
    <label style="display:inline-flex;align-items:center;gap:6px;margin:4px 10px 4px 0;font-size:14px">
      <input type="checkbox" value="${s.id}" class="f-tsub"> ${s.icon} ${s.name}
    </label>`).join('');

  openModal({
    title: '聘请新老师',
    bodyHTML: `
      <div class="field"><label>老师姓名</label><input type="text" id="f-t-name" placeholder="例如：陈老师"></div>
      <div class="field"><label>头像</label>
        <div class="theme-chips" id="avatarPick">
          ${AVATARS.map((a, i) => `<span class="chip ${i === 0 ? 'active' : ''}" data-av="${a}">${a}</span>`).join('')}
        </div>
      </div>
      <div class="field"><label>任教学科（可多选）</label>${subCheckboxes}</div>
      <p class="muted">创建后会自动生成小学/初中/高中三套默认话术，可随时修改。</p>`,
    okText: '聘请',
    onOk: (m) => {
      const name = m.querySelector('#f-t-name').value.trim();
      if (!name) { toast('请填写老师姓名', true); return false; }
      const av = m.querySelector('#avatarPick .chip.active')?.dataset.av || '🧑‍🏫';
      const subjectIds = [...m.querySelectorAll('.f-tsub:checked')].map((c) => c.value);
      addTeacher({ name, avatar: av, subjectIds });
      toast(`欢迎 ${name} 加入！`);
    },
    onMount: (m) => {
      m.querySelectorAll('#avatarPick .chip').forEach((c) => {
        c.onclick = () => {
          m.querySelectorAll('#avatarPick .chip').forEach((x) => x.classList.remove('active'));
          c.classList.add('active');
        };
      });
    },
  });
}

/* ---------- 编辑资料 ---------- */
function editTeacherFlow(id) {
  const t = state.teachers.find((x) => x.id === id);
  if (!t) return;
  const subCheckboxes = state.subjects.map((s) => `
    <label style="display:inline-flex;align-items:center;gap:6px;margin:4px 10px 4px 0;font-size:14px">
      <input type="checkbox" value="${s.id}" class="f-tsub" ${(t.subjectIds || []).includes(s.id) ? 'checked' : ''}>
      ${s.icon} ${s.name}
    </label>`).join('');

  openModal({
    title: '编辑老师资料',
    bodyHTML: `
      <div class="field"><label>姓名</label><input type="text" id="f-t-name" value="${escapeAttr(t.name)}"></div>
      <div class="field"><label>头像</label>
        <div class="theme-chips" id="avatarPick">
          ${AVATARS.map((a) => `<span class="chip ${a === t.avatar ? 'active' : ''}" data-av="${a}">${a}</span>`).join('')}
        </div>
      </div>
      <div class="field"><label>任教学科</label>${subCheckboxes}</div>`,
    okText: '保存',
    onOk: (m) => {
      const name = m.querySelector('#f-t-name').value.trim();
      if (!name) { toast('姓名不能为空', true); return false; }
      const av = m.querySelector('#avatarPick .chip.active')?.dataset.av || t.avatar;
      const subjectIds = [...m.querySelectorAll('.f-tsub:checked')].map((c) => c.value);
      updateTeacher(id, { name, avatar: av, subjectIds });
      toast('已保存');
    },
    onMount: (m) => {
      m.querySelectorAll('#avatarPick .chip').forEach((c) => {
        c.onclick = () => {
          m.querySelectorAll('#avatarPick .chip').forEach((x) => x.classList.remove('active'));
          c.classList.add('active');
        };
      });
    },
  });
}

/* ---------- 编辑三学段话术 ---------- */
function editStylesFlow(id) {
  const t = state.teachers.find((x) => x.id === id);
  if (!t) return;

  const blocks = STAGES.map((st) => {
    const s = t.styles?.[st] || DEFAULT_STYLES[st];
    return `
      <div class="style-block" style="opacity:1">
        <strong>${stageLabel(st)}学段</strong>
        <div class="field"><label>教学风格</label><input type="text" data-f="${st}-tone" value="${escapeAttr(s.tone)}"></div>
        <div class="field"><label>开场白</label><textarea data-f="${st}-greeting">${escapeHTML(s.greeting)}</textarea></div>
        <div class="field"><label>表扬话术</label><input type="text" data-f="${st}-praise" value="${escapeAttr(s.praise)}"></div>
        <div class="field"><label>安慰/纠错话术</label><input type="text" data-f="${st}-comfort" value="${escapeAttr(s.comfort)}"></div>
      </div>`;
  }).join('');

  openModal({
    title: `${t.avatar} ${t.name} · 三学段教学话术`,
    bodyHTML: blocks,
    okText: '保存',
    onOk: (m) => {
      const styles = {};
      STAGES.forEach((st) => {
        styles[st] = {
          tone: m.querySelector(`[data-f="${st}-tone"]`).value.trim() || DEFAULT_STYLES[st].tone,
          greeting: m.querySelector(`[data-f="${st}-greeting"]`).value.trim() || DEFAULT_STYLES[st].greeting,
          praise: m.querySelector(`[data-f="${st}-praise"]`).value.trim() || DEFAULT_STYLES[st].praise,
          comfort: m.querySelector(`[data-f="${st}-comfort"]`).value.trim() || DEFAULT_STYLES[st].comfort,
        };
      });
      updateTeacher(id, { styles });
      toast('三学段话术已保存');
    },
  });
}

function escapeHTML(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function escapeAttr(s) {
  return escapeHTML(s).replace(/"/g, '&quot;');
}
