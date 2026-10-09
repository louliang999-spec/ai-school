/* ============================================================
 *  profile-mock.js · 画像 / 根因 / 定制教案（本地模拟）
 *  - analyzeMarks：批改标注补全根因标签
 *  - buildProfile：聚合错题 → 擅长/薄弱/正确率/背诵法则
 *  - buildTeachPlan：按 学段 × 薄弱点 × 老师话术 生成非标准化教案
 * ============================================================ */

import { state, getSubject, activeTeacher, teacherStyle } from '../store.js';
import { stageLabel } from '../ui/ui-shell.js';

/* 五类根因标签 + 分析句式 */
export const CAUSE_SENTENCES = {
  '概念不清': (k, n) => `最近 ${n} 次错误都卡在「${k}」，说明概念只停留在"认识"、还没到"会用"，需要回到定义本身重新建构。`,
  '审题失误': (k, n) => `「${k}」上连续 ${n} 次失分都不是因为不会，而是漏读/误读条件，属于审题习惯问题。`,
  '计算粗心': (k, n) => `「${k}」相关计算 ${n} 次出错，多为跳步和进退位标记缺失，是流程规范问题而非能力问题。`,
  '方法欠缺': (k, n) => `「${k}」相关题目 ${n} 次用到非常规方法，说明解题工具箱还需要补充模型。`,
  '记忆不牢': (k, n) => `「${k}」在 ${n} 次复现中反复遗忘，符合记忆曲线衰减规律，需要间隔复习。`,
};

/**
 * 批改入库前的根因补全（目前主要是统一兜底）
 */
export function analyzeMarks(marks, paper) {
  return marks.map((m) => ({
    ...m,
    causeTag: m.verdict === 'wrong' ? (m.causeTag || '概念不清') : '',
    knowledge: m.knowledge || '未分类知识点',
  }));
}

/**
 * 聚合学习画像
 */
export function buildProfile() {
  const notes = state.wrongNotes;
  const subjectStats = {};

  // ---- 按学科统计（从批改结果算正确率） ----
  state.papers.forEach((p) => {
    if (p.grading.status !== 'graded') return;
    const sid = p.subjectId;
    if (!sid) return;
    const marks = p.grading.marks || [];
    if (!marks.length) return;
    const st = subjectStats[sid] || { correct: 0, count: 0, right: 0 };
    st.count += marks.length;
    st.right += marks.filter((m) => m.verdict === 'right').length;
    subjectStats[sid] = st;
  });
  Object.values(subjectStats).forEach((st) => {
    st.correct = st.count ? st.right / st.count : 0;
  });

  // ---- 薄弱知识点（按错题计数排序） ----
  const knowMap = {};
  notes.filter((w) => !w.mastered).forEach((w) => {
    const k = knowMap[w.knowledge] || { name: w.knowledge, count: 0, subjectId: w.subjectId, causeTag: w.causeTag };
    k.count++;
    knowMap[w.knowledge] = k;
  });
  const weakList = Object.values(knowMap).sort((a, b) => b.count - a.count);

  // ---- 擅长学科（正确率最高且有数据） ----
  const withData = Object.entries(subjectStats).filter(([, s]) => s.count >= 3);
  const sorted = withData.sort((a, b) => b[1].correct - a[1].correct);
  const strengths = sorted.filter(([, s]) => s.correct >= 0.75).map(([id]) => {
    const sub = getSubject(id);
    return sub ? sub.name + (sub.name === '英语' ? '听说' : '基础') : id;
  });
  const weaknesses = weakList.slice(0, 3).map((w) => {
    const sub = getSubject(w.subjectId);
    return (sub ? sub.name + '·' : '') + w.name;
  });

  // ---- 需背诵的核心法则（从错题知识点映射 + 内置） ----
  const memorize = deriveMemorize(weakList);

  return {
    subjectStats,
    strengths: strengths.length ? strengths : ['暂无（多批改几份试卷就会出现）'],
    weaknesses: weaknesses.length ? weaknesses : ['暂无（太棒了，继续保持）'],
    weakList: weakList.slice(0, 5),
    memorize,
    generatedAt: Date.now(),
  };
}

/** 从薄弱点推导要背的法则 */
function deriveMemorize(weakList) {
  const LIB = {
    '100以内进位加法': '进位加法口诀：个位满十，向十位进一',
    '100以内退位减法': '退位减法口诀：个位不够减，向十位借一当十',
    '的地得': '修饰名词用"的"，修饰动词用"地"，补语用"得"',
    '形近字：已己巳': '半封"已"、全开"己"、全封"巳"',
    '一般现在时第三人称单数': 'she/he/it 用 does，动词加 -s/-es',
    'like + doing 用法': 'like + doing（喜欢做某事）',
    'ph 发音规则': 'ph 组合发 /f/：elephant、photo、phone',
    '加减法应用题审题': '买了画 ⬆、吃了画 ⬇，再列式',
  };
  const fromWeak = weakList.map((w) => LIB[w.name]).filter(Boolean);
  const base = state.memorize || [];
  // 去重、保留 5 条
  return [...new Set([...fromWeak, ...base])].slice(0, 5);
}

/* ============================================================
 *  定制教学方案（学段 × 薄弱点 × 老师话术，每次生成都有依据）
 * ============================================================ */
export function buildTeachPlan(stage) {
  const profile = buildProfile();
  const teacher = activeTeacher();
  const style = teacher ? teacherStyle(teacher.id, stage) : null;
  const weak = profile.weakList.slice(0, 3);
  const stageName = stageLabel(stage);

  // 依据：最近批改里的具体题号
  const evidence = [];
  state.papers.forEach((p) => {
    if (p.grading.status !== 'graded') return;
    (p.grading.marks || []).forEach((m) => {
      if (m.verdict === 'wrong' && evidence.length < 4) {
        const sub = getSubject(p.subjectId);
        evidence.push(`${sub ? sub.name : ''}${m.qid.replace('q', '第')}题`);
      }
    });
  });

  const steps = [];

  // 开场（学段差异极大）
  const opener = {
    primary: `${style ? style.greeting : '宝贝，我们开始闯关啦！'} 今天只攻 ${weak.length || 1} 个小怪兽，攻完就发奖章！`,
    junior: `${style ? style.greeting : '先看学情。'} 本次方案基于你最近的错题，目标是把 ${weak.length || 1} 个薄弱点转成得分点。`,
    senior: `${style ? style.greeting : '直接进入方案。'} 以下安排按失分权重排序，限时完成，做完即可验证。`,
  }[stage];
  steps.push({ title: '开场 · 今日目标', body: opener, why: '按当前学段由老师话术生成' });

  // 薄弱点攻坚（按学段换结构）
  if (weak.length === 0) {
    steps.push({
      title: '保持 · 拓展挑战',
      body: stage === 'primary'
        ? '目前没有薄弱点！奖励一关拓展挑战题，保持手感 ⭐'
        : '目前无明显薄弱点，安排一组综合拔高题保持状态。',
      why: '画像中无未掌握错题',
    });
  } else {
    weak.forEach((w, i) => {
      steps.push(weakStep(stage, w, i, profile, style));
    });
  }

  // 复盘（学段差异）
  const closer = {
    primary: '练完找老师领口令测试：把今天的口诀大声念 3 遍，全对解锁明日勋章！',
    junior: '复盘：每道错题写出"错因一句话"，明天同一时间再测 3 题。',
    senior: '复盘：整理失分清单，标注"知识型/粗心型"，周末同类题限时重测。',
  }[stage];
  steps.push({ title: '收尾 · 复盘与巩固', body: closer, why: '按学段学习习惯要求生成' });

  return {
    stage,
    stageName,
    steps,
    evidence,
    memorize: profile.memorize.slice(0, 3),
    teacherName: teacher ? teacher.name : '老师',
    generatedAt: Date.now(),
  };
}

/** 薄弱点攻坚步骤（三个学段结构完全不同） */
function weakStep(stage, w, i, profile, style) {
  const sub = getSubject(w.subjectId);
  const subName = sub ? sub.name : '综合';
  const causeSentence = CAUSE_SENTENCES[w.causeTag]
    ? CAUSE_SENTENCES[w.causeTag](w.name, w.count)
    : `「${w.name}」累计出现 ${w.count} 次错误，需要专项巩固。`;

  if (stage === 'primary') {
    return {
      title: `第 ${i + 1} 关 · 攻克「${w.name}」`,
      body: `🎮 玩一玩：用生活小例子演一遍「${w.name}」；`
        + `✏️ 练一练：做 3 道递进小题（${subName}）；`
        + `⭐ 奖一颗星：全对后把口诀大声念出来。`,
      why: `${causeSentence} 游戏化三步法适合小学低段注意力特点。`,
    };
  }
  if (stage === 'junior') {
    return {
      title: `模块 ${i + 1} · 「${w.name}」清单`,
      body: `📖 知识点：回归课本定义，用自己的话复述；`
        + `📝 典型例题：精做 1 道母题；`
        + `🔁 变式训练：换问法再做 2 道；`
        + `❓ 自我提问：我错在哪一步？下次如何避免？`,
      why: `${causeSentence} 启发式四步法适合初中抽象思维发展期。`,
    };
  }
  return {
    title: `专项 ${i + 1} · 「${w.name}」失分拆解`,
    body: `🎯 考纲定位：该点在考纲中的要求与常见考法；`
      + `✂️ 拆解失分：对照错题标出丢分环节（知识型/粗心型）；`
      + `⏱ 限时专练：15 分钟完成 5 道高频题；`
      + `📐 归纳模型：总结成可复用的解题模板。`,
    why: `${causeSentence} 考纲导向+限时训练适合高中备考节奏。`,
  };
}
