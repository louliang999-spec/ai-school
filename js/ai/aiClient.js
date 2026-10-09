/* ============================================================
 *  aiClient.js · 统一 AI 出口
 *  所有页面只准调用这里的函数，内部目前是"本地模拟"。
 *  将来要接真实大模型（如通义/豆包/OpenAI 兼容接口），
 *  只需改这一个文件的实现，页面代码一行不用动。
 * ============================================================ */

import { gradeSample, gradeHeuristic } from './grading-mock.js';
import { analyzeMarks, buildProfile, buildTeachPlan } from './profile-mock.js';
import { getPaper } from '../store.js';
import { SAMPLE_PAPERS } from '../seed-data.js';

/** 模拟 AI 思考耗时（让骨架屏有意义） */
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 批改一份试卷
 * @param paperId 存档里的试卷 id
 * @returns {score, summary, marks[]}  marks 含 problem/rootCause/causeTag/knowledge/suggestion
 */
export async function gradePaper(paperId) {
  const paper = getPaper(paperId);
  if (!paper) throw new Error('试卷不存在');

  await delay(500 + Math.random() * 500);   // 模拟思考

  let result;
  const sample = SAMPLE_PAPERS.find((s) => s.id === paper.sampleId);
  if (sample) {
    // 轨道 A：示例卷 → 像素级精确批改
    result = gradeSample(sample, paper);
  } else {
    // 轨道 B：真实照片 → 确定性启发式批改
    result = gradeHeuristic(paper);
  }

  // 根因补全 + 历史关联准备
  result.marks = analyzeMarks(result.marks, paper);

  return result;
}

/**
 * 构建学习画像（聚合试卷 + 错题本）
 */
export async function buildFullProfile() {
  await delay(300 + Math.random() * 300);
  return buildProfile();
}

/**
 * 生成非标准化定制教学方案
 * @param stage 学段 primary|junior|senior
 */
export async function buildPlan(stage) {
  await delay(600 + Math.random() * 400);
  return buildTeachPlan(stage);
}

/**
 * 英语口语检查：比对朗读文本与原句
 * @returns {score, diffs:[{word, ok}]}
 */
export async function checkOral(sentence, saidText) {
  await delay(200);
  return compareSentences(sentence, saidText);
}

/* ---------- 词级比对（Levenshtein 对齐） ---------- */

function normalize(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function lev(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

export function compareSentences(target, said) {
  const t = normalize(target).split(' ').filter(Boolean);
  const s = normalize(said).split(' ').filter(Boolean);
  const dist = lev(t.join(' '), s.join(' '));
  const maxLen = Math.max(t.join(' ').length, 1);
  let score = Math.round(Math.max(0, (1 - dist / maxLen) * 100));

  // 简单词级对齐（贪心按序匹配，够用且直观）
  const diffs = t.map((w, i) => ({ word: w, ok: s.includes(w) || (s[i] && lev(w, s[i]) <= 1) }));
  const hit = diffs.filter((d) => d.ok).length;
  if (t.length) score = Math.round((hit / t.length) * 100 * 0.6 + score * 0.4);

  return { score, diffs };
}
