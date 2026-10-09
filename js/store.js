/* ============================================================
 *  store.js · 数据层
 *  - 单 key 存 localStorage：ai-school-v1（带版本号 v）
 *  - 模式：改数据 → save() → notify() → 各页面订阅重渲染
 *  - 所有写操作必须走下面的 action 函数，不要直接改 state
 * ============================================================ */

import { seedData } from './seed-data.js';

const KEY = 'ai-school-v1';
const VERSION = 1;

/** 当前全局状态（内存中的唯一数据源） */
export let state = null;

/* ---------- 订阅通知 ---------- */
const listeners = [];

/** 页面订阅：数据一变就回调（重渲染） */
export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

function notify() {
  listeners.forEach((fn) => {
    try { fn(state); } catch (e) { console.error('[store] 订阅者出错', e); }
  });
}

/* ---------- 持久化 ---------- */

/** 保存到 localStorage（try/catch 防超限） */
export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('[store] 保存失败', e);
    notifyError('存档失败：浏览器存储空间不足，请到「AI 学习课桌」清理已导出的试卷原图');
    return false;
  }
}

function notifyError(msg) {
  window.dispatchEvent(new CustomEvent('aischool:error', { detail: msg }));
}

/** 启动时读取；无数据或版本不符则写入种子数据 */
export function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === VERSION) {
        state = parsed;
        // 补齐可能新增的顶层字段（版本内向后兼容）
        for (const k of ['subjects', 'teachers', 'papers', 'wrongNotes', 'teachingAids', 'oral']) {
          if (!state[k]) state[k] = seedData()[k];
        }
        if (!state.settings) state.settings = seedData().settings;
        if (!state.startup) state.startup = seedData().startup;
        return state;
      }
      console.warn('[store] 存档版本不符，重建种子数据');
    } catch (e) {
      console.warn('[store] 存档解析失败，重建种子数据', e);
    }
  }
  return resetToSeed();
}

/** 清空存档并回到种子数据 */
export function resetToSeed() {
  state = seedData();
  save();
  notify();
  return state;
}

/** 删除存档（不清空内存，供调试） */
export function wipeSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}

/* ---------- 通用工具 ---------- */

export function uid(prefix) {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

export function getTeacher(id) {
  return state.teachers.find((t) => t.id === id) || null;
}

export function getSubject(id) {
  return state.subjects.find((s) => s.id === id) || null;
}

/** 当前老师 */
export function activeTeacher() {
  return getTeacher(state.settings.activeTeacherId) || state.teachers[0] || null;
}

/** 当前学段的话术（老师缺 style 时用默认兜底） */
export function teacherStyle(teacherId, stage) {
  const t = getTeacher(teacherId);
  const st = stage || state.settings.stage;
  if (t && t.styles && t.styles[st]) return t.styles[st];
  return DEFAULT_STYLES[st];
}

/** 默认学段话术（新增老师自动合并） */
export const DEFAULT_STYLES = {
  primary: {
    tone: '亲切鼓励',
    greeting: '宝贝，我们今天一起闯关啦！',
    praise: '哇，你太棒了！',
    comfort: '没关系，我们再来一次，你一定可以的！',
  },
  junior: {
    tone: '引导启发',
    greeting: '这道题我们先拆成两步看。',
    praise: '思路很清晰，继续保持。',
    comfort: '别急，先找到卡住的那一步。',
  },
  senior: {
    tone: '严谨高效',
    greeting: '直接看考点与易错项。',
    praise: '得分点抓得准。',
    comfort: '回归定义，找失分环节。',
  },
};

/* ============================================================
 *  Action：师资与学科（无限制增删）
 * ============================================================ */

export function addSubject(name, icon) {
  const sub = {
    id: uid('sub'),
    name: name || '新学科',
    color: '#4f8ef7',
    icon: icon || '📚',
  };
  state.subjects.push(sub);
  save(); notify();
  return sub;
}

export function removeSubject(id) {
  state.subjects = state.subjects.filter((s) => s.id !== id);
  // 老师身上也解绑
  state.teachers.forEach((t) => {
    t.subjectIds = (t.subjectIds || []).filter((x) => x !== id);
  });
  save(); notify();
}

export function addTeacher({ name, subjectIds, avatar }) {
  const t = {
    id: uid('t'),
    name: name || '新老师',
    subjectIds: subjectIds || [],
    avatar: avatar || '🧑‍🏫',
    styles: JSON.parse(JSON.stringify(DEFAULT_STYLES)),
  };
  state.teachers.push(t);
  state.settings.activeTeacherId = t.id;
  save(); notify();
  return t;
}

export function updateTeacher(id, patch) {
  const t = getTeacher(id);
  if (!t) return;
  Object.assign(t, patch);
  save(); notify();
}

export function removeTeacher(id) {
  if (state.teachers.length <= 1) {
    notifyError('至少要保留一位老师');
    return;
  }
  state.teachers = state.teachers.filter((t) => t.id !== id);
  if (state.settings.activeTeacherId === id) {
    state.settings.activeTeacherId = state.teachers[0].id;
  }
  save(); notify();
}

export function setStage(stage) {
  state.settings.stage = stage;
  save(); notify();
}

export function setActiveTeacher(id) {
  state.settings.activeTeacherId = id;
  save(); notify();
}

/* ============================================================
 *  Action：试卷（批改）
 * ============================================================ */

/** 新增一份待批改试卷 */
export function addPaper({ image, source, subjectId, sampleId }) {
  const paper = {
    id: uid('p'),
    subjectId: subjectId || state.subjects[0]?.id || null,
    teacherId: state.settings.activeTeacherId,
    stage: state.settings.stage,
    student: '小明',
    createdAt: Date.now(),
    image,
    source: source || 'camera', // camera | display | sample
    sampleId: sampleId || null, // 示例卷 id（精确批改用）
    grading: { status: 'pending', score: null, summary: '', marks: [] },
    exported: false,
  };
  state.papers.unshift(paper);
  save(); notify();
  return paper;
}

export function getPaper(id) {
  return state.papers.find((p) => p.id === id) || null;
}

export function removePaper(id) {
  state.papers = state.papers.filter((p) => p.id !== id);
  save(); notify();
}

/** 写入批改结果（由 ui-desk 调用，结果来自 aiClient） */
export function setGrading(id, grading) {
  const p = getPaper(id);
  if (!p) return;
  p.grading = grading;
  p.teacherId = state.settings.activeTeacherId;
  p.stage = state.settings.stage;
  save(); notify();
}

export function markExported(ids) {
  state.papers.forEach((p) => {
    if (ids.includes(p.id)) p.exported = true;
  });
  save(); notify();
}

/** 清理已导出试卷的原图（释放存储空间） */
export function stripExportedImages() {
  let n = 0;
  state.papers.forEach((p) => {
    if (p.exported && p.image && !p.image.startsWith('assets/')) {
      p.image = '';
      p.stripped = true;
      n++;
    }
  });
  save(); notify();
  return n;
}

/* ============================================================
 *  Action：错题本
 * ============================================================ */

/**
 * 批改后自动入库错题
 * marks: [{qid, verdict, problem, rootCause, causeTag, knowledge, suggestion, order}]
 */
export function addWrongNotes(paperId, marks, subjectId) {
  const wrongs = marks.filter((m) => m.verdict === 'wrong');
  const now = Date.now();
  const added = [];

  wrongs.forEach((m, i) => {
    // 关联规则：同知识点 或 同根因+同学科+30天内，取最近 3 条
    const related = state.wrongNotes
      .filter((w) => {
        const sameKnow = w.knowledge === m.knowledge;
        const sameCause = w.causeTag === m.causeTag && w.subjectId === subjectId
          && Math.abs(now - w.date) < 30 * 86400000;
        return sameKnow || sameCause;
      })
      .slice(-3)
      .map((w) => w.id);

    const note = {
      id: uid('w'),
      paperId,
      qid: m.qid || 'q?',
      subjectId,
      knowledge: m.knowledge || '未分类知识点',
      rootCause: m.rootCause || '',
      causeTag: m.causeTag || '概念不清',
      suggestion: m.suggestion || '',
      order: m.order ?? i,
      date: now,
      relatedTo: related,
      mastered: false,
    };
    state.wrongNotes.push(note);
    added.push(note);
  });

  if (added.length) { save(); notify(); }
  return added;
}

export function toggleMastered(id) {
  const w = state.wrongNotes.find((x) => x.id === id);
  if (!w) return;
  w.mastered = !w.mastered;
  save(); notify();
}

export function removeWrongNote(id) {
  state.wrongNotes = state.wrongNotes.filter((w) => w.id !== id);
  state.wrongNotes.forEach((w) => {
    w.relatedTo = (w.relatedTo || []).filter((r) => r !== id);
  });
  save(); notify();
}

/* ============================================================
 *  Action：教具 / 创业 / 口语
 * ============================================================ */

export function addTeachingAid(aid) {
  state.teachingAids.unshift(aid);
  save(); notify();
}

export function removeTeachingAid(id) {
  state.teachingAids = state.teachingAids.filter((a) => a.id !== id);
  save(); notify();
}

export function setInterests(interests) {
  state.settings.interests = interests;
  save(); notify();
}

export function setStartupStep(key, value) {
  state.startup.steps[key] = value;
  save(); notify();
}

export function finishStartupRound() {
  state.startup.history.unshift({
    id: uid('su'),
    at: Date.now(),
    steps: JSON.parse(JSON.stringify(state.startup.steps)),
  });
  state.startup.steps = { pain: '', insight: '', solution: '', mvp: '', feedback: '', iterate: '' };
  save(); notify();
}

export function addOralSession(session) {
  state.oral.sessions.unshift(session);
  if (state.oral.sessions.length > 60) state.oral.sessions.length = 60;
  save(); notify();
}
