/* ============================================================
 *  grading-mock.js · 批改引擎（本地模拟）
 *  轨道 A：示例卷 → 用 seed 里的题目坐标精确批改
 *  轨道 B：真实照片 → 学科×学段规则池 + paperId 伪随机种子
 *          同一张图两次批改结果完全一致（确定性）
 * ============================================================ */

/* ---------- 确定性伪随机（同 seed 同结果） ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ============================================================
 *  轨道 A：示例卷精确批改
 * ============================================================ */
export function gradeSample(sample, paper) {
  const marks = sample.questions.map((q) => ({
    id: q.qid,
    qid: q.qid,
    x: q.x,
    y: q.y,
    shape: q.verdict === 'right' ? 'tick' : 'circle',
    verdict: q.verdict,
    problem: q.problem,
    rootCause: q.rootCause,
    causeTag: q.causeTag,
    knowledge: q.knowledge,
    suggestion: q.suggestion,
    order: q.order,
  }));

  const wrong = marks.filter((m) => m.verdict === 'wrong').length;
  const score = Math.round(((marks.length - wrong) / marks.length) * 100);
  const subject = sample.title.split(' ')[0];

  const summary = wrong === 0
    ? `全对！${subject}基础非常扎实，继续保持！`
    : `共 ${marks.length} 题，错 ${wrong} 题，得分 ${score}。主要问题集中在「${[
        ...new Set(marks.filter((m) => m.verdict === 'wrong').map((m) => m.knowledge)),
      ].join('、')}」，下面逐题看根因。`;

  return { score, summary, marks };
}

/* ============================================================
 *  轨道 B：真实照片启发式批改
 * ============================================================ */

/** 学科 × 错误类型的文案池（保证生成的批语通顺有意义） */
const RULE_POOL = {
  'sub-math': [
    { causeTag: '计算粗心', knowledge: '四则运算准确性',
      problem: '这一步的计算结果与验算不符，疑似进/退位时抄错数字',
      rootCause: '计算过程跳步，进位退位没有打标记，容易抄错',
      suggestion: '竖式计算时把进位点、借位点写出来，算完立刻验算一遍' },
    { causeTag: '概念不清', knowledge: '运算法则理解',
      problem: '解题方向正确，但套用的法则有误（顺序/符号搞反）',
      rootCause: '对法则的适用条件理解模糊，遇到变式就出错',
      suggestion: '把法则完整默写一遍，再做 3 道同类变式题对照' },
    { causeTag: '审题失误', knowledge: '题目条件提取',
      problem: '题目中的关键条件（单位/限制词）没有参与解题',
      rootCause: '读题太快，条件圈画习惯没养成',
      suggestion: '读题时圈出数字与关键词，列式前先复述一遍已知条件' },
    { causeTag: '方法欠缺', knowledge: '解题策略',
      problem: '题目可解但走了弯路，缺少更优的解题策略',
      rootCause: '解题工具箱里方法少，遇到非常规题只能硬算',
      suggestion: '整理一题多解，归纳这类题的通用模型' },
  ],
  'sub-eng': [
    { causeTag: '记忆不牢', knowledge: '单词拼写与用法',
      problem: '单词拼写/搭配出现错误，与正确形式差 1-2 个字母',
      rootCause: '机械抄写居多，缺少语音拼读与语境复现',
      suggestion: '按音节拆分记忆 + 造一个自己的句子，明天复测' },
    { causeTag: '概念不清', knowledge: '时态与语法规则',
      problem: '句子时态/单复数/助动词使用不一致',
      rootCause: '语法规则没有形成体系，靠语感写容易出错',
      suggestion: '画一张时态时间轴，把错句按规则改写 3 遍' },
    { causeTag: '审题失误', knowledge: '题干理解',
      problem: '题干中的否定词/疑问词被忽略，导致答非所问',
      rootCause: '审题时关注单词不关注结构',
      suggestion: '先圈 not/wh 词再作答，养成指读习惯' },
  ],
  'sub-chinese': [
    { causeTag: '记忆不牢', knowledge: '字形字音',
      problem: '形近字/同音字混用，字形结构不规范',
      rootCause: '缺少对比辨析，部件记忆模糊',
      suggestion: '形近字成对记忆并组词，每个写 3 遍' },
    { causeTag: '概念不清', knowledge: '词语搭配与语法',
      problem: '的/地/得、量词、关联词搭配不当',
      rootCause: '对词性与搭配规则没有清晰分类',
      suggestion: '做一张"的+名词、地+动词、得+补语"对照表' },
    { causeTag: '审题失误', knowledge: '阅读审题',
      problem: '回答没有紧扣题目问法（问"为什么"只答了"是什么"）',
      rootCause: '看到熟悉内容直接默写，没有对齐问题',
      suggestion: '答题前先把问题转换成"答什么"的提纲' },
  ],
  default: [
    { causeTag: '概念不清', knowledge: '核心概念理解',
      problem: '核心概念的应用出现偏差，结果与标准思路不一致',
      rootCause: '概念只停留在"认识"层面，没有达到"会用"',
      suggestion: '用自己的话复述概念，再做 2 道直接应用题' },
    { causeTag: '记忆不牢', knowledge: '关键知识点记忆',
      problem: '要点记忆不完整，答题漏关键点',
      rootCause: '缺少及时复现，记忆曲线掉得太快',
      suggestion: '用间隔复习：当天、第2天、第7天各过一遍' },
    { causeTag: '方法欠缺', knowledge: '答题方法与规范',
      problem: '会做但答题不规范，步骤/格式丢分',
      rootCause: '缺少答题模板与书写规范训练',
      suggestion: '背一个标准答题模板，限时仿写 2 题' },
  ],
};

/**
 * 启发式批改：网格定位 + 规则池 + 确定性随机
 */
export function gradeHeuristic(paper) {
  const rng = mulberry32(hashSeed(paper.id));
  const pool = RULE_POOL[paper.subjectId] || RULE_POOL.default;

  // 随机挑 3~5 条规则（不重复）
  const count = 3 + Math.floor(rng() * 3); // 3~5
  const picked = [];
  const used = new Set();
  while (picked.length < Math.min(count, pool.length)) {
    const i = Math.floor(rng() * pool.length);
    if (used.has(i)) continue;
    used.add(i);
    picked.push(pool[i]);
  }

  // 网格定位：纵向等分，标注落在区域中心偏右（像老师批的位置）
  const marks = picked.map((rule, i) => {
    const slot = (i + 0.5) / picked.length;
    const x = 0.55 + (rng() - 0.5) * 0.3;
    const y = 0.2 + slot * 0.62 + (rng() - 0.5) * 0.04;
    // 约 2/3 是错题，1/3 是对勾（更像真实批改）
    const isRight = rng() < 0.33;
    return {
      id: 'auto-' + i,
      qid: 'q' + (i + 1),
      x: clamp(x, 0.08, 0.92),
      y: clamp(y, 0.1, 0.92),
      shape: isRight ? 'tick' : (rng() < 0.5 ? 'circle' : 'cross'),
      verdict: isRight ? 'right' : 'wrong',
      problem: isRight ? '此题作答正确，步骤清晰' : rule.problem,
      rootCause: isRight ? '' : rule.rootCause,
      causeTag: isRight ? '' : rule.causeTag,
      knowledge: rule.knowledge,
      suggestion: isRight ? '' : rule.suggestion,
      order: i,
    };
  });

  const wrong = marks.filter((m) => m.verdict === 'wrong').length;
  const score = Math.round(((marks.length - wrong) / marks.length) * 100);
  const stage = paper.stage || 'primary';

  const summary = buildSummary(stage, marks, score, wrong);

  return { score, summary, marks };
}

/** 按学段生成不同风格的总评 */
function buildSummary(stage, marks, score, wrong) {
  const knowledges = [...new Set(marks.filter((m) => m.verdict === 'wrong').map((m) => m.knowledge))];
  const weak = knowledges.slice(0, 2).join('、');

  if (stage === 'primary') {
    return wrong === 0
      ? '宝贝全对，太棒了！奖励一颗小星星 ⭐ 继续保持哦！'
      : `这次得分 ${score}，错了 ${wrong} 题，主要卡在「${weak}」。没关系，我们一起玩个闯关小游戏把它攻克！`;
  }
  if (stage === 'junior') {
    return wrong === 0
      ? `全对，得分 ${score}。思路和书写都很规范，继续保持。`
      : `得分 ${score}，错 ${wrong} 题，问题集中在「${weak}」。先想一想：这几道题有没有共同点？找到共性就通了。`;
  }
  return wrong === 0
    ? `得分 ${score}。步骤完整、书写规范，得分点全部拿到。`
    : `得分 ${score}，失分 ${wrong} 处，集中在「${weak}」。建议按考纲定位→拆解失分点→限时专练的顺序补齐。`;
}

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
