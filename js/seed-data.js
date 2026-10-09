/* ============================================================
 *  seed-data.js · 种子数据
 *  首次打开（或清空存档）时写入的默认内容。
 *  包含：学科 / 老师（三学段话术）/ 示例试卷（带题目坐标）/
 *        教具主题 / 口语句子 / 创业向导提示
 *
 *  ⚠️ seedData() 返回的必须是"可 JSON 序列化"的纯数据，
 *     示例试卷的绘制函数放在单独的 SAMPLE_PAPERS 里（不进存档）。
 * ============================================================ */

/* ---------- 默认学科 ---------- */
const SUBJECTS = [
  { id: 'sub-math', name: '数学', color: '#4f8ef7', icon: '📐' },
  { id: 'sub-chinese', name: '语文', color: '#e57373', icon: '📖' },
  { id: 'sub-eng', name: '英语', color: '#2e9e5b', icon: '🔤' },
  { id: 'sub-science', name: '科学', color: '#f5a623', icon: '🔬' },
];

/* ---------- 默认老师（同一人三学段完全不同话术） ---------- */
const TEACHERS = [
  {
    id: 't1', name: '李老师', avatar: '🧑‍🏫', subjectIds: ['sub-math'],
    styles: {
      primary: {
        tone: '亲切鼓励',
        greeting: '宝贝，我们来玩一个数字闯关游戏，准备好了吗？',
        praise: '哇，你太棒了！奖励一颗星！',
        comfort: '没关系，我们用小棒摆一摆，再来一次你一定行！',
      },
      junior: {
        tone: '引导启发',
        greeting: '这道题我们先拆成两步，你觉得先求什么？',
        praise: '思路很清晰，这一步的推理没问题。',
        comfort: '先别急，回到已知条件，卡住的是哪一步？',
      },
      senior: {
        tone: '严谨高效',
        greeting: '直接看考点与易错项，这道题属于必考模型。',
        praise: '得分点抓得准，过程分也拿满了。',
        comfort: '回归定义与公式，定位失分环节再专练。',
      },
    },
  },
  {
    id: 't2', name: '王老师', avatar: '👩‍🏫', subjectIds: ['sub-chinese'],
    styles: {
      primary: {
        tone: '讲故事',
        greeting: '宝贝，今天的故事里藏着三个生字，我们一起找！',
        praise: '这个词用得真妙，像个小作家！',
        comfort: '读错了没关系，跟着老师再读一遍～',
      },
      junior: {
        tone: '启发赏析',
        greeting: '这段文字先圈出关键词，说说作者想表达什么。',
        praise: '赏析角度找得准，表述也完整。',
        comfort: '回到原文，答案就藏在上下文里。',
      },
      senior: {
        tone: '考点精讲',
        greeting: '按答题模板走：手法→内容→情感，三步得分。',
        praise: '术语准确，文本细读到位。',
        comfort: '答案缺层次，补齐"写了什么+怎么写+为何写"。',
      },
    },
  },
  {
    id: 't3', name: 'Miss Li', avatar: '👩‍💼', subjectIds: ['sub-eng'],
    styles: {
      primary: {
        tone: '儿歌律动',
        greeting: 'Hi 小朋友！Clap your hands, we will play a word game!',
        praise: 'Wonderful! Your pronunciation is so cute!',
        comfort: 'It is OK! Listen to me and try again, sweetie!',
      },
      junior: {
        tone: '情境对话',
        greeting: '先读情境再开口，注意连读和重音。',
        praise: 'Nice fluency, the stress is right.',
        comfort: 'Slow down, one sentence at a time.',
      },
      senior: {
        tone: '应试+地道表达',
        greeting: '口语评分看三档：准确、流利、地道，先过准确关。',
        praise: '准确率高，表达地道，稳了。',
        comfort: '回放对比原音，先修元音再练语调。',
      },
    },
  },
  {
    id: 't4', name: '张老师', avatar: '🧑‍🔬', subjectIds: ['sub-science'],
    styles: {
      primary: {
        tone: '好奇探索',
        greeting: '宝贝，今天我们像小科学家一样做实验找答案！',
        praise: '观察得真仔细，发现了关键线索！',
        comfort: '猜错了也是发现，我们再试一次～',
      },
      junior: {
        tone: '实验探究',
        greeting: '先提出假设，再设计实验验证它。',
        praise: '变量控制得当，结论有依据。',
        comfort: '假设不成立很正常，重新提一个。',
      },
      senior: {
        tone: '原理建模',
        greeting: '从考纲实验出发，重点是变量与误差分析。',
        praise: '模型建立正确，表述规范。',
        comfort: '检查实验条件，找出控制变量的漏洞。',
      },
    },
  },
];

/* ---------- 示例卷题目坐标（归一化 0~1，对应示例卷画布） ---------- */

const SAMPLE_MATH_QUESTIONS = [
  { qid: 'q1', x: 0.62, y: 0.245, verdict: 'right', order: 0,
    problem: '24 + 35 = 59，计算正确', rootCause: '', causeTag: '', knowledge: '两位数加法（不进位）', suggestion: '' },
  { qid: 'q2', x: 0.62, y: 0.335, verdict: 'right', order: 1,
    problem: '68 - 24 = 44，计算正确', rootCause: '', causeTag: '', knowledge: '两位数减法（不退位）', suggestion: '' },
  { qid: 'q3', x: 0.62, y: 0.425, verdict: 'wrong', order: 2,
    problem: '27 + 58 算成 75：个位 7+8=15，向十位进 1 后忘记加，得 70+5 应为 85',
    rootCause: '进位加法的"满十进一"规则没有内化，个位相加超十后十位漏加进位',
    causeTag: '概念不清', knowledge: '100以内进位加法',
    suggestion: '用小棒摆一摆 7+8，再做 5 道进位加法热身，重点盯"十位 +1"' },
  { qid: 'q4', x: 0.62, y: 0.515, verdict: 'wrong', order: 3,
    problem: '100 - 46 算成 56：十位 10-4=6 没有先向个位借 1，退位减法出错',
    rootCause: '退位减法步骤混乱，个位不够减时忘记十位要减 1',
    causeTag: '概念不清', knowledge: '100以内退位减法',
    suggestion: '借位打点标记法：先在十位上点一个借位点，再算个位 16-6、十位 9-4' },
  { qid: 'q5', x: 0.62, y: 0.605, verdict: 'right', order: 4,
    problem: '36 + 27 = 63，计算正确', rootCause: '', causeTag: '', knowledge: '100以内进位加法', suggestion: '' },
  { qid: 'q6', x: 0.62, y: 0.695, verdict: 'wrong', order: 5,
    problem: '应用题"小明有 30 颗糖，吃了 12 颗，又买了 8 颗"列成 30 - 12 - 8，正确应为 30 - 12 + 8',
    rootCause: '审题时把"又买了"当成"又吃了"，加减意义没读清',
    causeTag: '审题失误', knowledge: '加减法应用题审题',
    suggestion: '读题圈关键词："买了"画 ⬆、"吃了"画 ⬇，再列式' },
];

const SAMPLE_ENG_QUESTIONS = [
  { qid: 'q1', x: 0.55, y: 0.26, verdict: 'right', order: 0,
    problem: 'apple 拼写与配图一致', rootCause: '', causeTag: '', knowledge: '水果类单词', suggestion: '' },
  { qid: 'q2', x: 0.55, y: 0.35, verdict: 'wrong', order: 1,
    problem: 'elephant 写成 elefant：ph 发 /f/ 音，漏掉字母 h',
    rootCause: 'ph 组合发音规则未掌握，靠听音拼写导致漏字母',
    causeTag: '记忆不牢', knowledge: 'ph 发音规则',
    suggestion: '记 ph=/f/ 三例：elephant、photo、phone，各抄 3 遍并朗读' },
  { qid: 'q3', x: 0.55, y: 0.44, verdict: 'right', order: 2,
    problem: 'banana 拼写正确', rootCause: '', causeTag: '', knowledge: '水果类单词', suggestion: '' },
  { qid: 'q4', x: 0.55, y: 0.53, verdict: 'wrong', order: 3,
    problem: '翻译"我喜欢游泳"写成 I like swim，应为 I like swimming / I like to swim',
    rootCause: 'like 后接动词 -ing 的用法没记住',
    causeTag: '记忆不牢', knowledge: 'like + doing 用法',
    suggestion: '口诀"喜欢做某事 doing"，仿写 3 句：like reading / like singing / like dancing' },
  { qid: 'q5', x: 0.55, y: 0.62, verdict: 'wrong', order: 4,
    problem: '选择题"What ___ she like?" 选了 do，正确是 does（第三人称单数）',
    rootCause: '一般现在时第三人称单数助动词用 does 的规则不熟',
    causeTag: '概念不清', knowledge: '一般现在时第三人称单数',
    suggestion: '整理 be/do/does 三行表，重点记 she/he/it → does' },
  { qid: 'q6', x: 0.55, y: 0.71, verdict: 'right', order: 5,
    problem: 'cat 配图拼写正确', rootCause: '', causeTag: '', knowledge: '动物类单词', suggestion: '' },
];

const SAMPLE_CHINESE_QUESTIONS = [
  { qid: 'q1', x: 0.5, y: 0.27, verdict: 'right', order: 0,
    problem: '"晴"字书写规范，日字旁结构正确', rootCause: '', causeTag: '', knowledge: '形声字：日字旁', suggestion: '' },
  { qid: 'q2', x: 0.5, y: 0.37, verdict: 'wrong', order: 1,
    problem: '"已经"写成"己经"："已"半封口、"己"全开口，形近字混淆',
    rootCause: '已/己/巳三个形近字未区分清楚',
    causeTag: '记忆不牢', knowledge: '形近字：已己巳',
    suggestion: '口诀"半封已、全开己、全封巳"，各组词 2 个' },
  { qid: 'q3', x: 0.5, y: 0.47, verdict: 'right', order: 2,
    problem: '"公园"书写正确', rootCause: '', causeTag: '', knowledge: '常用词语书写', suggestion: '' },
  { qid: 'q4', x: 0.5, y: 0.57, verdict: 'wrong', order: 3,
    problem: '组词"的/得/地"用混："跑得快"写成"跑的快"',
    rootCause: '的+名词、地+动词、得+补语 三分规则没分清',
    causeTag: '概念不清', knowledge: '的地得用法',
    suggestion: '记三分表 + 造句 5 个，重点练"动词+得+形容词"' },
  { qid: 'q5', x: 0.5, y: 0.67, verdict: 'right', order: 4,
    problem: '看图写词"下雨"内容贴切', rootCause: '', causeTag: '', knowledge: '看图写词', suggestion: '' },
];

/* ============================================================
 *  示例卷画布（运行时绘制，不外链任何图片，天然可导出）
 * ============================================================ */

function paperBase(ctx, W, H, title, sub) {
  // 纸张
  ctx.fillStyle = '#fffdf7';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#d8d2c4';
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  // 标题
  ctx.fillStyle = '#2b2b2b';
  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.round(W * 0.045)}px "Microsoft YaHei"`;
  ctx.fillText(title, W / 2, H * 0.075);
  ctx.font = `${Math.round(W * 0.025)}px "Microsoft YaHei"`;
  ctx.fillStyle = '#777';
  ctx.fillText(sub, W / 2, H * 0.115);
  // 分割线
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W * 0.08, H * 0.14);
  ctx.lineTo(W * 0.92, H * 0.14);
  ctx.stroke();
  ctx.textAlign = 'left';
}

/** 手写感辅助 */
function handwriting(ctx, text, x, y, size, color) {
  ctx.fillStyle = color || '#3a5fc8';
  ctx.font = `${size}px "Kaiti SC", "STKaiti", "KaiTi", "Microsoft YaHei"`;
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}

/** 示例卷 1：数学进位/退位加减 */
function drawSampleMath(canvas) {
  const W = 800, H = 1100;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  paperBase(ctx, W, H, '二年级数学 · 100 以内加减法练习', '姓名：小明    日期：10月9日');

  const rows = [
    ['1. 24 + 35 =', '59', true],
    ['2. 68 - 24 =', '44', true],
    ['3. 27 + 58 =', '75', false],
    ['4. 100 - 46 =', '56', false],
    ['5. 36 + 27 =', '63', true],
  ];
  rows.forEach((r, i) => {
    const y = H * (0.245 + i * 0.09) + 8;
    ctx.fillStyle = '#222';
    ctx.font = `${Math.round(W * 0.036)}px "Microsoft YaHei"`;
    ctx.textAlign = 'left';
    ctx.fillText(r[0], W * 0.14, y);
    handwriting(ctx, r[1], W * 0.6, y + 2, Math.round(W * 0.04), r[2] ? '#3a5fc8' : '#3a5fc8');
    // 对/错预画（批改前留淡痕）
    if (r[2]) {
      handwriting(ctx, '√', W * 0.78, y + 4, Math.round(W * 0.045), 'rgba(0,0,0,0.12)');
    } else {
      handwriting(ctx, '×', W * 0.78, y + 4, Math.round(W * 0.045), 'rgba(0,0,0,0.12)');
    }
  });

  // 应用题
  ctx.fillStyle = '#222';
  ctx.font = `${Math.round(W * 0.034)}px "Microsoft YaHei"`;
  ctx.fillText('6. 小明有 30 颗糖，吃了 12 颗，', W * 0.14, H * 0.69);
  ctx.fillText('    又买了 8 颗，现在有几颗？', W * 0.14, H * 0.725);
  handwriting(ctx, '30 - 12 - 8 = 10（颗）', W * 0.3, H * 0.755, Math.round(W * 0.038));
}

/** 示例卷 2：英语单词 */
function drawSampleEng(canvas) {
  const W = 800, H = 1100;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  paperBase(ctx, W, H, '三年级英语 · Unit 2 单词拼写', 'Name: Xiao Ming    Date: Oct 9');

  const rows = [
    ['1. 苹果（配图）', 'apple'],
    ['2. 大象（配图）', 'elefant'],
    ['3. 香蕉（配图）', 'banana'],
    ['4. 我喜欢游泳。（翻译）', 'I like swim.'],
    ['5. What ___ she like?  (do/does)', 'do'],
    ['6. 小猫（配图）', 'cat'],
  ];
  rows.forEach((r, i) => {
    const y = H * (0.26 + i * 0.09) + 8;
    ctx.fillStyle = '#222';
    ctx.font = `${Math.round(W * 0.034)}px "Microsoft YaHei"`;
    ctx.textAlign = 'left';
    ctx.fillText(r[0], W * 0.12, y);
    handwriting(ctx, r[1], W * 0.53, y + 2, Math.round(W * 0.038));
  });
}

/** 示例卷 3：语文 */
function drawSampleChinese(canvas) {
  const W = 800, H = 1100;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  paperBase(ctx, W, H, '一年级语文 · 识字与组词', '姓名：小明    日期：10月9日');

  const rows = [
    ['1. 看图写字：太阳（  ）', '晴'],
    ['2. 写一写：（  经', '已'],
    ['3. 组词：公（  ）', '公园'],
    ['4. 选一选：我跑（  ）快', '的'],
    ['5. 看图写词：', '下雨'],
  ];
  rows.forEach((r, i) => {
    const y = H * (0.27 + i * 0.1) + 8;
    ctx.fillStyle = '#222';
    ctx.font = `${Math.round(W * 0.036)}px "Microsoft YaHei"`;
    ctx.textAlign = 'left';
    ctx.fillText(r[0], W * 0.12, y);
    handwriting(ctx, r[1], W * 0.48, y + 2, Math.round(W * 0.042));
  });
}

/* ---------- 示例卷（不进存档，批改时按 sampleId 精确比对） ---------- */
export const SAMPLE_PAPERS = [
  { id: 'sample-math', title: '数学 · 100以内加减法', subjectId: 'sub-math', draw: drawSampleMath, questions: SAMPLE_MATH_QUESTIONS },
  { id: 'sample-eng', title: '英语 · 单词拼写', subjectId: 'sub-eng', draw: drawSampleEng, questions: SAMPLE_ENG_QUESTIONS },
  { id: 'sample-chinese', title: '语文 · 识字组词', subjectId: 'sub-chinese', draw: drawSampleChinese, questions: SAMPLE_CHINESE_QUESTIONS },
];

/* ---------- 教具主题（兴趣皮肤） ---------- */
export const AID_THEMES = [
  { id: 'game', name: '游戏', emoji: '🎮', color: '#7c5cf0',
    exampleStyle: (t) => `像打怪升级一样，答对一题就获得 100 经验值！` },
  { id: 'animal', name: '小动物', emoji: '🐣', color: '#2e9e5b',
    exampleStyle: (t) => `${t}在草地上蹦蹦跳跳，把知识也带回家～` },
  { id: 'dino', name: '恐龙', emoji: '🦖', color: '#f5a623',
    exampleStyle: (t) => `${t}恐龙迈开大步，一脚踩出正确答案！` },
  { id: 'space', name: '太空', emoji: '🚀', color: '#3b56d4',
    exampleStyle: (t) => `坐上飞船，${t}知识就能送达宇宙空间站！` },
  { id: 'candy', name: '糖果', emoji: '🍬', color: '#e57373',
    exampleStyle: (t) => `这颗${t}味知识糖果，甜甜地记住每一个字！` },
];

/* ---------- 教具类型 ---------- */
export const AID_TYPES = [
  { id: 'word', name: '识字卡', fields: ['title', 'pinyin', 'example'] },
  { id: 'formula', name: '公式卡', fields: ['title', 'body', 'example'] },
  { id: 'vocab', name: '单词卡', fields: ['title', 'body', 'example'] },
];

/* ---------- 英语口语句子库 ---------- */
export const ORAL_SENTENCES = [
  { en: 'The quick brown fox jumps over the lazy dog.', zh: '那只敏捷的棕色狐狸跳过了那只懒狗。', level: '小学' },
  { en: 'I like swimming in the summer holiday.', zh: '我喜欢在暑假游泳。', level: '小学' },
  { en: 'Could you please pass me the book on the desk?', zh: '你能把桌上的书递给我吗？', level: '初中' },
  { en: 'Practice makes perfect, so keep trying every day.', zh: '熟能生巧，所以每天都要坚持练习。', level: '初中' },
  { en: 'If you keep working hard, you will make great progress.', zh: '如果你继续努力，你会取得很大进步。', level: '高中' },
  { en: 'Reading widely helps us broaden our horizons.', zh: '广泛阅读帮助我们开阔视野。', level: '高中' },
];

/* ---------- 创业向导 6 步配置 ---------- */
export const STARTUP_STEPS = [
  { key: 'pain', title: '第一步 · 记录痛点', emoji: '😣',
    hint: '写一件你自己学习/生活中最难受的事。越具体越好，比如"背单词总是第二天就忘"。',
    placeholder: '例：每次背单词，第二天就忘了一大半……' },
  { key: 'insight', title: '第二步 · 挖掘洞察', emoji: '🔍',
    hint: '问自己三个问题：谁在什么时候最难受？现在他们怎么解决？为什么现有的办法不好用？',
    placeholder: '例：晚上 9 点复习时最难受；现在靠反复抄，太慢也记不牢……' },
  { key: 'solution', title: '第三步 · 一句话方案', emoji: '💡',
    hint: '用"给（谁）提供（什么方法），让他能（得到什么结果）"的句式写一句话。',
    placeholder: '例：给背单词的孩子提供游戏化的每日 5 分钟闯关，让单词记得牢……' },
  { key: 'mvp', title: '第四步 · MVP 画布', emoji: '🧱',
    hint: '最小可行产品：只做"必须有"的功能，一行一功能，砍掉花哨的。', placeholder: '' },
  { key: 'feedback', title: '第五步 · 收集反馈', emoji: '📣',
    hint: '写 3 个你会问用户的问题，以及你从哪里找到第一批用户（同学/家人/班级群）。',
    placeholder: '例：1) 你背单词最烦的是什么？ 2) 你现在怎么背？……' },
  { key: 'iterate', title: '第六步 · 迭代清单', emoji: '🔁',
    hint: '根据反馈，列出下一轮要改的 3 件事，按"最有用→最省事"排序。',
    placeholder: '例：1) 加发音跟读 2) 错词自动重来 3) 每周报告……' },
];

/* ---------- 需背诵的核心法则（画像页默认示例） ---------- */
const MEMORIZE = [
  '加法交换律：a + b = b + a',
  '进位加法口诀：个位满十，向十位进一',
  '退位减法口诀：个位不够减，向十位借一当十',
  '的地得：修饰名词用"的"，修饰动词用"地"，补语用"得"',
  '一般现在时：第三人称单数动词加 -s / 助动词用 does',
];

/* ============================================================
 *  seedData()：返回完整的初始状态（纯数据，可 JSON 序列化）
 * ============================================================ */
export function seedData() {
  return {
    v: 1,
    settings: {
      activeTeacherId: 't1',
      stage: 'primary',
      interests: ['游戏', '小动物'],
      studentName: '小明',
    },
    subjects: JSON.parse(JSON.stringify(SUBJECTS)),
    teachers: JSON.parse(JSON.stringify(TEACHERS)),
    papers: [],
    wrongNotes: [
      // 预置 2 条历史错题，方便一打开就能看到"错题关联"
      {
        id: 'w-hist-1', paperId: null, qid: 'q3', subjectId: 'sub-math',
        knowledge: '100以内进位加法', rootCause: '满十进一的规则没有内化',
        causeTag: '概念不清', suggestion: '小棒操作 + 5 道进位热身题',
        order: 0, date: Date.now() - 6 * 86400000, relatedTo: [], mastered: false,
      },
      {
        id: 'w-hist-2', paperId: null, qid: 'q4', subjectId: 'sub-math',
        knowledge: '100以内退位减法', rootCause: '退位时十位忘记减 1',
        causeTag: '概念不清', suggestion: '借位打点标记法练习 10 题',
        order: 0, date: Date.now() - 3 * 86400000, relatedTo: ['w-hist-1'], mastered: false,
      },
    ],
    teachingAids: [],
    startup: {
      steps: { pain: '', insight: '', solution: '', mvp: '', feedback: '', iterate: '' },
      history: [],
    },
    oral: { sessions: [] },
    memorize: MEMORIZE,
  };
}
