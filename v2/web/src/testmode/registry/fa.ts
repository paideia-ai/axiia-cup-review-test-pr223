/* FA 战报（/matches/:id）——排队 / 进行中·实况 / 完局三态共用一个视图（U07-C01）。
   完局区块次序＝结果卡 → 对话全文 → 问询 → 隐藏目标 → 计分推导（#69）；
   回放（#24）把终局层整段藏起来；调试模式（#22）只管「内心」折叠。
   本文件还登记战报里复用的时间线部件（timeline/*、verdict-card、judge-trend、
   replay-controls）以及 components/script-view（只在管理面用，故 id 以 ADM. 开头）。
   条款以 spec-index 里 page=FA 的 16 行为准，另带上在本页落地的 U03/U05 行。 */
import type { StepHints, TmRegistry } from '../types'

export const TM_FA: TmRegistry = {
  // ---------- 加载 / 错误态 ----------
  'FA.loading': {
    label: '加载中',
    clauses: ['U07-C01', 'LACK-10'],
    when: '首次打开、接口未返回时',
  },
  'FA.not-found': {
    label: '对局不存在',
    clauses: ['U07-C11', 'LACK-03'],
    note:
      '404 / 接口错误落这里；未登录访问接口 401 会先落登录页——谁能看战报未定义（LACK-03）',
    when: '打开一个不存在或无权访问的 /matches/:id',
  },
  'FA.not-found-back-link': {
    label: '返回对战列表',
    when: '同「对局不存在」',
  },

  // ---------- 页头 ----------
  'FA.back-link': {
    label: '页头返回链',
    clauses: ['U07-C04'],
    note:
      '全局「← 我的智能体」回 /my-agents；参战卡上另有直达我方智能体的醒目按钮',
  },
  'FA.page-title': {
    label: '页面标题',
    clauses: ['U07-C01'],
    note: '「对战 #id」——三态同一标题',
  },
  'FA.match-subtitle': {
    label: '场景与双方',
    clauses: ['U07-C01', 'U07-C13'],
    note: '「场景 · 甲 对乙」用角色显示名，不露 a/b 内部键',
  },
  'FA.time-meta': {
    label: '发起完局时间',
    anchors: ['spec-change-71', 'spec-change-25'],
    note: 'P3 头部元数据；老服务器无字段时整行不出',
    when: '契约带 createdAt / finishedAt 时',
  },
  'FA.debug-toggle': {
    label: '调试模式开关',
    clauses: ['U07-C06', 'U07-C07', 'U07-C08', 'U07-C10', 'U07-C09'],
    journeys: ['j7s5'],
    note:
      '任何观众可开（#22）；只揭示「内心」折叠——己方 trace 仅所有者、裁判/NPC trace 公开；回放中 aria-disabled 强制关闭（B1）',
  },
  'FA.replay-button': {
    label: '回放按钮',
    clauses: ['U07-C09'],
    journeys: ['j7s4', 'jR5s1', 'jR5s5'],
    note:
      '纯前端重演，无新 LLM 调用；点下后结果/问询/隐藏目标/计分推导整段隐藏',
    when: '完局且已计分、且有可回放步骤时出现；回放中隐藏',
  },
  'FA.challenge-leg-badge': {
    label: '约战①/② 徽章',
    clauses: ['U05-C11'],
    journeys: ['jR6s2'],
    note: '#66 历史双场约战：标出这是一对中的第几场',
    when: '约战产生的对局（challengeLeg 非空）',
  },
  'FA.sibling-link': {
    label: '查看另一场链接',
    clauses: ['U05-C11', 'U05-C12', 'U07-C12'],
    journeys: ['jR7s2', 'jR6s3'],
    note:
      'F7：另一场已判定时把它的结果写在链接里，两场胜负一处看全；从 matches.list() 按 challengeID 找兄弟场；React Router Link 同标签页打开（U07-C12 不强制新窗口）',
    when: '约战对局且能在列表里找到另一条腿',
  },
  'FA.journey-anchor': {
    label: '首战旅程锚点',
    clauses: ['U03-C08'],
    note: '#67：顶部只留小锚点，旅程卡本体在页底',
    when: '从 express 首战导航过来（location.state.express）且完局',
  },
  'FA.kind-badge': {
    label: '对战类型徽章',
    clauses: ['U07-C01'],
    note: '赛事、PVP、PVE 全部同一视图，只用徽章区分',
  },
  'FA.status-badge': {
    label: '状态徽章',
    clauses: ['U07-C01', 'U07-C02', 'U07-C09', 'LACK-09', 'U03-C07'],
    journeys: ['j1s5', 'jR9s3'],
    note:
      '三态：直播中（SSE 已连）/ 进行中（未连）/ 完局结果（与结果卡同口径 我方（商鞅）胜）；回放中换成中性「回放中」不剧透。断线时只降为「进行中」，无重连提示（LACK-09）；U03-C07：express 保存后直进这里的实况',
  },

  // ---------- 参战双方（P3 G20） ----------
  'FA.participants': {
    label: '参战双方区',
    clauses: ['U07-C03', 'U07-C04'],
    when: '契约带 participants 时（老服务器整块不渲染）',
  },
  'FA.participant-card': {
    label: '参战方卡',
    clauses: ['U07-C03', 'U07-C04', 'U07-C10'],
    note:
      '展示名 + 模型（#21 永远公开）+ 版本 id 与复制按钮（#25）；我方/对手两种形态',
  },
  'FA.participant-side-badge': {
    label: '执方徽章',
    clauses: ['U07-C01'],
    note: '「执A · 商鞅」——侧别 + 角色显示名',
  },
  'FA.participant-name': {
    label: '我方展示名',
    clauses: ['U07-C04'],
    when: '参战方是我的智能体',
  },
  'FA.opponent-line': {
    label: '对手一行',
    clauses: ['U07-C04', 'U10-C11b'],
    note:
      'gap_known：规格要对手侧有低调「查看对手智能体」入口（公开视图 #71）；现在只有纯文本「对手：{名} · v#{id}」，无链接',
    when: '参战方不是我的',
  },
  'FA.my-agent-button': {
    label: '我的智能体按钮',
    clauses: ['U07-C04', 'U10-C11b'],
    note: '我方侧醒目 accent 按钮直达 /agents/:id（高频）',
    when: '我方参战卡上',
  },
  'FA.model-chip': {
    label: '模型 chip',
    clauses: ['U07-C10', 'U02-C07'],
    note: '#21 模型永远公开——旁观者也看得到双方模型 id',
  },
  'FA.version-id': {
    label: '版本 id',
    clauses: ['U07-C03', 'U05-C12'],
    journeys: ['j6s4'],
    note: '「v#252」——指定版本约战的发现路径（#25）',
  },
  'FA.copy-id-button': {
    label: '复制 id 按钮',
    clauses: ['U07-C03'],
    journeys: ['j6s4'],
    note: '复制后 1.5s 显示「已复制」；非安全上下文静默不复制，id 仍可手抄',
  },
  'FA.version-id-hint': {
    label: '按id约战提示',
    clauses: ['U07-C03', 'U05-C12'],
  },
  'FA.preset-label': {
    label: 'PVE 预设标注',
    clauses: ['U07-C03', 'U07-C08'],
    note: 'NPC 侧没有版本 id，标「PVE 预设 · key」（官方运行，#80）',
    when: 'PVE 对局的 NPC 侧',
  },

  // ---------- 完局：结果卡（#69 置顶） ----------
  'FA.result-card': {
    label: '结果卡',
    clauses: ['U07-C02', 'U07-C02b'],
    journeys: ['j7s1', 'jR9s1', 'jR9s3'],
    note:
      '完局第一块：胜负 + 比分 + 签名明细；回放中整卡隐藏（换成回放控制条）',
    when: '完局且已计分、非回放中',
  },
  'FA.result-winner': {
    label: '胜负行',
    clauses: ['U07-C02', 'U07-C04'],
    journeys: ['jR7s1', 'jR7s5'],
    note:
      'F7（#69/#71）：带视角与角色名「我方（商鞅）胜」/「对方（甘龙）胜」；旁观回退「胜方 商鞅」；左右手互搏另有写法；胜方必须是高分侧（R9）',
  },
  'FA.result-score': {
    label: '比分行',
    clauses: ['U07-C02'],
    journeys: ['jR9s1'],
    note: '服务端 scoreA/scoreB——与账目表合计同一数据源（#26）',
  },
  'FA.result-summary': {
    label: '签名明细',
    clauses: ['U07-C02', 'U07-C02b', 'U04-C11'],
    journeys: ['jR2s1', 'jR9s2'],
    note:
      'F2：比分下每侧一行「甘龙 +1 大政方针 · −1 被识破 = 0」，不必翻到页底；平分时靠它解释「同分为何有胜方」',
    when: '得分账能解析出条目时（商鞅类结构化计分场景）',
  },
  'FA.result-summary-line': {
    label: '签名明细一行',
    clauses: ['U07-C02b'],
    journeys: ['jR2s1'],
    when: '同签名明细',
  },

  // ---------- 完局：对话全文 / 问询 ----------
  'FA.report-section': {
    label: '战报区块',
    clauses: ['U07-C02'],
    journeys: ['j7s1'],
    note:
      '对话全文 / 问询两种区块，按对局真实次序排（问询不会被结果压到后面）；问询区块的标题「问询」也在这里（问询裁决卡标题见 FA.verdict-title）',
  },
  'FA.dialogue-heading': {
    label: '对话全文标题',
    clauses: ['U07-C02', 'U07-C09'],
    note: '回放中改读「对话重演」',
  },
  'FA.debug-hint': {
    label: '调试提示行',
    clauses: ['U07-C07', 'U07-C06'],
    note:
      '「内心与思考过程默认隐藏——页头「调试模式」可开启」；只在完局、有可揭示轨迹、调试未开时出现',
    when: '完局且对局里确有 reasoning、调试未开、非回放',
  },
  'FA.section-empty': {
    label: '区块空态',
    clauses: ['U07-C09', 'LACK-10'],
    note: '回放刚开始读「回放即将开始…」；无回合读「暂无回合。」',
    when: '区块内无可见回合',
  },
  'FA.trailing-verdicts': {
    label: '收尾裁决区',
    clauses: ['U07-C02'],
    note: '锚不到任何阶段行的裁决卡放这里（时序末尾）',
    when: '有裁决锚点落在全部阶段之外时',
  },

  // ---------- 完局：隐藏目标（#69 五步） ----------
  'FA.hidden-goal-section': {
    label: '隐藏目标区块',
    clauses: ['U07-C02b', 'U07-C02'],
    journeys: ['j7s3', 'jR2s2'],
    note:
      'F2：独立区块，位于问询之后、计分推导之前；spec-index 仍记 gap_open（审计时还混在计分说明里）',
    when: '完局、非回放、计分事件带 trueRequests 时',
  },
  'FA.hidden-goal-card': {
    label: '隐藏目标五步卡',
    clauses: ['U07-C02b'],
    journeys: ['j7s3', 'jR2s2'],
    note:
      '每侧：真目标 → 是否达成 → 对手猜了什么 → 是否被识破（被识破 −1）→ 得分变化；事件证据优先，缺席用得分账回补，都没有显「—」',
  },

  // ---------- 完局：计分推导（#26） ----------
  'FA.scoring-section': {
    label: '计分推导区块',
    clauses: ['U07-C02', 'U04-C11'],
    journeys: ['jR2s5'],
    note: '倾向轨迹图 + 账目卡；回放中整段隐藏',
    when: '完局、非回放',
  },
  'FA.trend-card': {
    label: '倾向轨迹卡',
    clauses: ['U07-C05', 'U07-C09'],
    note: '零节拍不出卡（#18 不留空壳）',
    when: '对局里有裁判心声节拍',
  },
  'FA.scoring-empty': {
    label: '暂无计分明细',
    clauses: ['U04-C11', 'LACK-10'],
    when: '既无结构化 breakdown 也无 reasoning 散文',
  },
  'FA.scoring-card': {
    label: '计分账目卡',
    clauses: ['U07-C02', 'U04-C11', 'U07-C02b'],
    journeys: ['jR2s5'],
    note: '真目标 / 对方猜测 / 准驳结果 / 得分账 四行',
  },
  'FA.ledger-true-request': {
    label: '真目标行',
    clauses: ['U07-C02b'],
  },
  'FA.ledger-guesses': {
    label: '对方猜测行',
    clauses: ['U07-C02b'],
  },
  'FA.ledger-rulings': {
    label: '准驳结果行',
    clauses: ['U07-C02'],
    note: '每条请求 同意/驳回 的 chip',
  },
  'FA.ledger-table': {
    label: '得分账账目表',
    clauses: ['U07-C02', 'U04-C11', 'U07-C02b'],
    journeys: ['jR2s3'],
    note:
      'F2：一条一行、带符号分值（加分绿 / 扣分红）、分侧小计、合计；解析不出条目时回退散文',
    when: '得分账能解析出条目',
  },
  'FA.ledger-item': {
    label: '账目一行',
    clauses: ['U07-C02', 'U04-C11'],
    journeys: ['jR2s3'],
  },
  'FA.ledger-identified-badge': {
    label: '被识破扣分标签',
    clauses: ['U07-C02b'],
    journeys: ['jR2s3'],
    when: '账目里有 identified 条目',
  },
  'FA.ledger-subtotal': {
    label: '分侧小计',
    clauses: ['U04-C11'],
    journeys: ['jR2s3'],
  },
  'FA.ledger-total': {
    label: '合计行',
    clauses: ['U07-C02', 'U04-C11'],
    journeys: ['jR2s3', 'jR9s1'],
    note:
      '一律用服务端 scoreA/scoreB——必须与结果卡完全一致；散文回退分支也用同一 id',
  },
  'FA.ledger-prose': {
    label: '得分账散文',
    clauses: ['U04-C11', 'U07-C02'],
    journeys: ['jR2s5'],
    note:
      '解析不出条目的场景（LLM 散文计分，如码头疑云）整段原文回退；能解析时剩余散文作 leftover 附在账目表下',
    when: '散文计分场景，或账目表下有剩余散文',
  },

  // ---------- 实况（进行中） ----------
  'FA.offstage-card': {
    label: '幕后卡',
    clauses: ['U07-C01', 'U07-C07', 'LACK-09'],
    note:
      '无时间线行的私有生成（affordance-only act）显示「X 正在推演…」；调试开时带流式内心',
    when: '实况中有 seq<0 的气泡',
  },
  'FA.live-dialogue-heading': {
    label: '实况对话标题',
    clauses: ['U07-C01'],
    journeys: ['j1s5', 'jR8s1'],
    note: '「对话」标题；自动跟底的行为在下面的实况对话区',
    when: '排队 / 进行中 / 完局未计分',
  },
  'FA.live-dialogue': {
    label: '实况对话区',
    clauses: ['U07-C12', 'U07-C01'],
    journeys: ['j1s5', 'jR8s1'],
    note:
      '实况区自动跟底（usePinToBottom）：新行到达随之滚动，读者向上滚即解除——U07-C12「不强制自动滚动（首战实况例外）」的落点',
    when: '排队 / 进行中 / 完局未计分',
  },
  'FA.live-empty': {
    label: '对局即将开始',
    clauses: ['U07-C01', 'LACK-10'],
    note:
      '排队态与刚派发时读「对局即将开始…」——排队态无独立布局（源码里未完成态共用实况布局）',
    when: '实况尚无任何回合',
  },
  'FA.live-score-line': {
    label: '实况判词比分行',
    clauses: ['U07-C02'],
    when: '完局但未计分（finished && !scored）且有终局判词',
  },
  'FA.live-ledger': {
    label: '实况判词计分散文',
    clauses: ['U04-C11'],
    when: '同实况判词比分行',
  },
  'FA.match-error': {
    label: '对战错误行',
    clauses: ['U07-C01', 'LACK-10'],
    journeys: ['jR9s3'],
    note:
      'R9：胜方与高分侧矛盾的对局会被不变量拦下作废——失败原因显示在这里，请截图',
    when: 'data.error 非空',
  },

  // ---------- 首战旅程卡（A3 ④ / #67 / Keso 2026-09-09） ----------
  'FA.journey-card': {
    label: '首战旅程卡',
    clauses: ['U03-C08', 'U03-C09'],
    journeys: ['j1s6'],
    note:
      '首战完局置底：三格方向性 CTA + 单一工作区/常驻辅助说明；回放中不渲染',
    when: '从 express 首战导航过来且完局、非回放',
  },
  'FA.journey-next-round': {
    label: '通往下一轮格',
    clauses: ['U03-C08'],
    journeys: ['j1s6'],
  },
  'FA.journey-rematch-button': {
    label: '再战一场按钮',
    clauses: ['U03-C08'],
    note: '回我方智能体主页（无 agentID 时降级 /my-agents）',
  },
  'FA.journey-opposite': {
    label: '解锁对侧格',
    clauses: ['U03-C08', 'U05-C11'],
    note: '两侧都练过才解锁玩家约战',
  },
  'FA.journey-opposite-button': {
    label: '去创建对侧按钮',
    clauses: ['U03-C08'],
    note:
      '#59/#64 ensure（get-or-create）后先进入智能体主页；participants 缺席时降级为「去场景页选侧」',
  },
  'FA.journey-pvp': {
    label: '通往 PVP 格',
    clauses: ['U03-C08', 'U05-C11'],
  },
  'FA.journey-progress-button': {
    label: '查看解锁进度按钮',
    clauses: ['U03-C08'],
    note: '去智能体主页的「出战」面板看进度',
  },
  'FA.journey-modes-card': {
    label: '构建器辅助说明卡',
    clauses: ['U03-C09', 'U02-C02', 'U02-C01'],
    note: 'Keso 2026-09-09：单一策略工作区，两个辅助入口在首版与后续版本都可用',
  },
  'FA.journey-mode-item': {
    label: '工作辅助格',
    clauses: ['U02-C02'],
    note: '策略工作区 / 选择预设策略 / 让你的 AI 帮你想策略',
  },
  'FA.journey-modes-hint': {
    label: '文本工作台提示',
    clauses: ['U01-C09', 'U02-C19', 'U03-C13'],
    note:
      '两个辅助入口常驻；版本管理、参赛选择和出战集中在智能体主页；版本对比暂不展示',
  },
  'FA.journey-build-link': {
    label: '继续写策略',
    clauses: ['U01-C09'],
    when: '我方 agentID 已知',
  },

  // ---------- 裁决卡（verdict-card.tsx） ----------
  'FA.verdict-card': {
    label: '裁决卡',
    clauses: ['U07-C02', 'U07-C05', 'U07-C06', 'U07-C13'],
    journeys: ['j7s2'],
    note:
      '终局判词与过程裁决共用；完局里终局判词按时序与过程裁决同路径放置（问询不会被压到判词之后）；回放中终局判词隐藏',
  },
  'FA.verdict-title': {
    label: '裁决卡标题',
    clauses: ['U07-C13'],
    note:
      'gap_open：问询两张卡以内部 key「inquiry-a」「inquiry-b」作标题（verdictLabel 未翻译），应显示角色名或中文',
  },
  'FA.verdict-interim-badge': {
    label: '仅观众可见徽章',
    clauses: ['U07-C05', 'U07-C10'],
    note: '过程裁决旁观者可见但从不注入角色上下文——没有徽章会读成作弊',
    when: '过程（非终局）裁决',
  },
  'FA.verdict-model': {
    label: '裁决模型 id',
    clauses: ['U07-C10'],
    note: '#21 裁判模型永远公开',
  },
  'FA.verdict-field': {
    label: '裁决字段',
    clauses: ['U07-C02'],
    journeys: ['j7s2'],
    note:
      '解析出的字段（胜方 / 理由 …）；winner/selectedSide 字段用角色显示名；解析不出时整段原文',
  },

  // ---------- 裁判心声卡（timeline/os-beat-card.tsx，#22① / #24） ----------
  'FA.aside-card': {
    label: '裁判心声卡',
    clauses: ['U07-C05', 'U07-C09', 'U07-C06'],
    journeys: ['j7s2', 'jR4s3', 'jR8s1', 'jR8s2', 'jR8s3'],
    note:
      '默认对所有观众可见、从不受调试模式门控；按 afterSeq 内插在对话行之后；回放锚点态加环高亮；商鞅/本能寺首轮即出第一拍、之后隔轮、末轮不落拍（R8）',
  },
  'FA.aside-title': {
    label: '心声卡标题',
    clauses: ['U07-C05', 'U07-C13'],
    note:
      '场景化人设名「君上心声」——按 judge-aside / judge 通道解析显示名，解析不出才用「裁判心声」',
  },
  'FA.aside-model': {
    label: '心声模型 id',
    clauses: ['U07-C10', 'U07-C05'],
    note: '#21 模型公开；保留裁判人设与模型',
  },
  'FA.aside-anchor-badge': {
    label: '倾向变化标签',
    clauses: ['U07-C09'],
    when: '回放停在这张卡的锚点上',
  },
  'FA.aside-text': {
    label: '心声正文',
    clauses: ['U07-C05'],
    journeys: ['j7s2'],
  },
  'FA.aside-tendency': {
    label: '当前倾向',
    clauses: ['U07-C05'],
    note:
      '#24 结构化倾向数据（favor + strength + attention）——同一数据驱动轨迹图与回放锚点',
    when: '节拍带 attention 或 favor',
  },
  'FA.aside-resume-button': {
    label: '继续按钮',
    clauses: ['U07-C09'],
    journeys: ['jR5s2'],
    note: '教学锚点：倾向变化处回放自动停，按「继续」接着重演',
    when: '回放锚点停留时',
  },

  // ---------- 倾向轨迹图（judge-trend.tsx，#24 / F4） ----------
  'FA.trend-chart': {
    label: '裁判倾向轨迹图',
    clauses: ['U07-C05', 'U07-C09'],
    journeys: ['jR4s1', 'jR8s4'],
    note:
      'x＝节拍序，y＝带号强度（A 上 B 下）；完局在计分推导里全画，回放中嵌在控制条里随揭示逐点生长',
  },
  'FA.trend-hint': {
    label: '轨迹图提示文字',
    clauses: ['U07-C05'],
    journeys: ['jR4s1'],
    note: 'F4/B8：「空心圈＝倾向变化 · 点选节拍查看心声」——不再写「悬停」',
  },
  'FA.trend-legend': {
    label: '轨迹图图例',
    clauses: ['U07-C05'],
    note: '上下两侧的角色名 + 侧别色',
  },
  'FA.trend-plot': {
    label: '轨迹图本体',
    clauses: ['U07-C05', 'U07-C09'],
    journeys: ['jR8s4'],
    note: 'R8：第一个节拍点应落在对局开头（第 1 轮附近）；aria-label 报节拍数',
  },
  'FA.trend-beat': {
    label: '节拍点',
    clauses: ['U07-C05', 'U07-C09'],
    journeys: ['jR4s2', 'jR4s4'],
    note:
      'F4：role=button、Tab 可达、Enter/空格切换；28px 隐形命中圆；changed 节拍加空心外圈；<title> 只是桌面悬停加分',
  },
  'FA.trend-beat-detail': {
    label: '节拍内联说明',
    clauses: ['U07-C05'],
    journeys: ['jR4s2'],
    note:
      '图下方内联展开：倾向、强度、最挂心、心声全文（不是浮层）；回放收缩让节拍消失时自动清掉选中',
    when: '点选一个节拍后',
  },
  'FA.trend-view-card-button': {
    label: '查看心声卡按钮',
    clauses: ['U07-C05'],
    journeys: ['jR4s3'],
    note: '按 id beat-<key> scrollIntoView 跳到对话全文里那张始终可见的心声卡',
    when: '节拍内联说明里',
  },
  'FA.trend-close-button': {
    label: '关闭说明按钮',
    journeys: ['jR4s2'],
    when: '节拍内联说明里',
  },

  // ---------- 回放控制条（replay-controls.tsx，#24 / F5） ----------
  'FA.replay-controls': {
    label: '回放控制条',
    clauses: ['U07-C09'],
    journeys: ['jR5s1'],
    note: '回放中取代结果卡置顶；内嵌倾向轨迹小图兼作进度感',
    when: '回放进行中',
  },
  'FA.replay-progress': {
    label: '回放进度',
    clauses: ['U07-C09'],
    note: '「已揭示步数/总步数」',
  },
  'FA.replay-ended': {
    label: '回放结束标',
    clauses: ['U07-C09'],
    journeys: ['jR5s4'],
    note: 'F5：播完停在结尾常驻，不再定时硬拉回战报',
    when: '回放播到最后',
  },
  'FA.replay-restart-button': {
    label: '重新播放按钮',
    clauses: ['U07-C09'],
    journeys: ['jR5s4'],
    note: '从 0 重来，保留当前倍速',
    when: '回放结束态',
  },
  'FA.replay-play-button': {
    label: '播放暂停按钮',
    clauses: ['U07-C09'],
    journeys: ['jR5s2'],
    note: '锚点停留时读作「继续」并 accent 描边',
  },
  'FA.replay-back-button': {
    label: '上一步按钮',
    clauses: ['U07-C09'],
    journeys: ['jR5s3'],
    note: 'F5：回退一格并暂停；cursor=0 时禁用；回退不会漏出后面未播的内容',
  },
  'FA.replay-step-button': {
    label: '步进按钮',
    clauses: ['U07-C09'],
    journeys: ['jR5s2'],
  },
  'FA.replay-speed-group': {
    label: '倍速分段',
    clauses: ['U07-C09'],
    journeys: ['jR5s1', 'jR5s2', 'jR5s5'],
    note:
      'F5：0.5× / 1× / 2× 三档，切档即时生效并写入 localStorage（axiia-replay-speed），下次回放记住；默认 1× 短句停留 ≥1.5s、越长停越久',
  },
  'FA.replay-speed-button': {
    label: '倍速一档',
    clauses: ['U07-C09'],
    journeys: ['jR5s2'],
    note: 'aria-pressed 标当前档',
  },
  'FA.replay-exit-button': {
    label: '退出回放按钮',
    clauses: ['U07-C09'],
    journeys: ['jR5s4', 'jR5s5'],
    note: '退出后结果 / 问询 / 隐藏目标 / 计分推导恢复，调试开关恢复原值',
  },
  'FA.replay-anchor-note': {
    label: '锚点停留提示',
    clauses: ['U07-C09'],
    journeys: ['jR5s2'],
    note: '「倾向发生变化，值得停留……按「继续」接着重演」——教学节奏（#24）',
    when: '回放停在倾向变化节拍上',
  },

  // ---------- 时间线阶段（timeline/stage.tsx） ----------
  'FA.stage': {
    label: '阶段区块',
    clauses: ['U07-C01', 'U07-C02'],
    note: '一个 stage group：标题 + 各通道的行 + 阶段内插的裁决卡',
  },
  'FA.stage-title': {
    label: '阶段标题',
    clauses: ['U07-C02', 'U07-C13'],
    note: '「朝堂辩论（第 1/3 阶段）」——标题来自场景 stage.title',
  },
  'FA.channel-label': {
    label: '通道标签',
    clauses: ['U07-C13'],
    note: '多通道阶段才显示；用 channel.label 不露 id',
    when: '阶段有多个通道且有标签',
  },
  'FA.phase-marker': {
    label: '阶段内小节标',
    clauses: ['U07-C02'],
    note: '居中的小节名（如「朝堂判词」），插在下一行之前或阶段末尾',
    when: '场景在阶段内发 phase 标记',
  },

  // ---------- 对话行（timeline/dialogue-row.tsx） ----------
  'FA.dialogue-row': {
    label: '对话行',
    clauses: ['U07-C02', 'U07-C10', 'U07-C07'],
    journeys: ['j7s1'],
    note:
      '左边框侧别色（A accent / B info / 旁白 warning）；调试开且行带 reasoning 时下面出「内心」折叠',
  },
  'FA.speaker-line': {
    label: '发言人一行',
    clauses: ['U07-C13'],
    note: '角色显示名 + #序号（+ 旁白角色 / 正在发言）',
  },
  'FA.narrator-badge': {
    label: '旁白角色标',
    clauses: ['U07-C13'],
    note: '发言人不是 A/B 任一侧（NPC lane）时标出',
    when: 'NPC / 旁白 lane 发言的行',
  },
  'FA.live-indicator': {
    label: '正在发言指示',
    clauses: ['U07-C01', 'LACK-09'],
    when: '实况中流式行',
  },
  'FA.dialogue-text': {
    label: '发言正文',
    clauses: ['U07-C02', 'U07-C10'],
    note: 'committed 行的 finalText（act 标签已由 transcript.ts 剥净）',
  },
  'FA.live-dialogue-row': {
    label: '实况流式行',
    clauses: ['U07-C01', 'U07-C07', 'LACK-09'],
    journeys: ['j1s5', 'jR8s1'],
    note:
      '虚线边框；按 chunk delta 生长，turnCompleted 落地后被 committed 行替换；流式文本自剥 act 标签',
    when: '进行中对局',
  },
  'FA.live-placeholder': {
    label: '正在思考占位',
    clauses: ['U07-C07', 'U07-C01'],
    note:
      'reasoning 先于正文到达：有 reasoning 读「正在斟酌措辞…」否则「正在思考…」——正文为空是正常早期态',
    when: '流式行尚无正文',
  },

  // ---------- 内心折叠（timeline/reasoning-fold.tsx，#22②） ----------
  'FA.reasoning-fold': {
    label: '内心折叠',
    clauses: ['U07-C07', 'U07-C06', 'U07-C08', 'U07-C10', 'U07-C09'],
    journeys: ['j7s5'],
    note:
      '模型真实 thinking trace，默认折叠；只在调试模式下挂载。己方行仅所有者可见（服务端对非所有者剥空 a 侧 reasoning）；裁判 / NPC（官方侧 #80）trace 对任何开了调试的观众可见；回放中一律不出',
    when: '调试模式开启且该行 / 卡带 reasoning',
  },
  'FA.reasoning-toggle': {
    label: '内心展开按钮',
    clauses: ['U07-C07', 'U07-C06'],
    note: '「内心 · N 字」/ 流式时「· 推演中…」',
  },
  'FA.reasoning-text': {
    label: '内心全文',
    clauses: ['U07-C07', 'U07-C06', 'U07-C08'],
    when: '展开折叠后',
  },

  // ---------- 事件行（timeline/event-row.tsx，引擎不经 LLM 提交的旁白） ----------
  'FA.event-scene': {
    label: '场景旁白行',
    clauses: ['U07-C02'],
    note: 'scene 事件：居中虚框旁白，不能读成发言气泡',
  },
  'FA.event-order': {
    label: '次序已定行',
    clauses: ['U07-C02'],
    note: 'order 事件：先 / 后 两枚 chip',
  },
  'FA.event-gesture': {
    label: '拆密函动作行',
    clauses: ['U07-C02'],
    note: 'gesture 事件：「（X 拆开密函，细读）」/「始终未拆」',
  },
  'FA.event-verdict': {
    label: '裁决事件行',
    clauses: ['U07-C02'],
    note: 'verdict 事件：判语 + 采信谁 + 各请求准驳',
  },
  'FA.event-verdict-requests': {
    label: '请求准驳格',
    clauses: ['U07-C02'],
    when: 'verdict 事件带 requests',
  },
  'FA.event-score': {
    label: '计分事件行',
    clauses: ['U07-C02', 'U07-C02b', 'U04-C11'],
    journeys: ['jR2s4'],
    note:
      'score 事件：比分 + 胜方 + 每侧真目标 / 猜测，就地标注（猜中）（被识破）（F2，crossIdentified 派生）；（被识破）（猜中）两个内联标注也归这一行',
  },
  'FA.event-score-side': {
    label: '计分事件一侧行',
    clauses: ['U07-C02b'],
    journeys: ['jR2s4'],
  },
  'FA.event-generic': {
    label: '未适配事件行',
    clauses: ['U07-C13'],
    note:
      '未知事件类型：自带文本或类型名 + 「原始数据」折叠——不把裸 JSON 直接铺进阅读流',
    when: '场景发了本版本未适配的事件类型',
  },
  'FA.event-raw-data': {
    label: '原始数据折叠',
    clauses: ['U07-C13'],
    note: '<details> 里是事件 JSON 原文——内部数据上界面，仅作兜底',
    when: '未适配事件行',
  },

  // ---------- 码头疑云陪审团事件（timeline/jury-event-row.tsx，legal-harbor-murder-jury 专用） ----------
  'FA.jury-speech': {
    label: '陪审员发言',
    clauses: ['LACK-01', 'U07-C08'],
    note: '码头疑云：NPC 陪审员公开发言；调试开时带内心折叠',
  },
  'FA.jury-action-decision': {
    label: '行动选择',
    clauses: ['LACK-01', 'U07-C07'],
    note: '玩家智能体在行动窗口的选择（秘密投票 / 私聊 / 复核证据 …）',
  },
  'FA.jury-speaker-draw': {
    label: '发言抽签',
    clauses: ['LACK-01'],
  },
  'FA.jury-secret-poll-opened': {
    label: '秘密意向投票发起',
    clauses: ['LACK-01'],
  },
  'FA.jury-secret-poll-result': {
    label: '秘密意向投票结果',
    clauses: ['LACK-01', 'U07-C10'],
    note: '「真人幕后」——观众可见的票型对场内其他 Agent 保密',
  },
  'FA.jury-private-chat': {
    label: '一对一私聊',
    clauses: ['LACK-01', 'U07-C10'],
    note: '场内其他 Agent 不知道这次私聊；旁观者可读全文',
  },
  'FA.jury-private-message': {
    label: '私聊一条',
    clauses: ['LACK-01'],
  },
  'FA.jury-evidence-review': {
    label: '公开证据复核',
    clauses: ['LACK-01'],
    note: '固定证据卡，不是新发现',
  },
  'FA.jury-motion-opened': {
    label: '提前终局动议',
    clauses: ['LACK-01'],
  },
  'FA.jury-motion-votes': {
    label: '动议记名票',
    clauses: ['LACK-01'],
  },
  'FA.jury-motion-result': {
    label: '动议结果',
    clauses: ['LACK-01'],
  },
  'FA.jury-ballot': {
    label: '票型一格',
    clauses: ['LACK-01', 'U07-C08'],
    note: '陪审员 + 票型 + 关键证据 + 理由；调试开时带内心',
  },
  'FA.jury-final-vote-reveal': {
    label: '十一人最终判决',
    clauses: ['LACK-01'],
  },
  'FA.jury-match-result': {
    label: '陪审团对局结果',
    clauses: ['LACK-01', 'U07-C02'],
    note: 'score 事件在码头疑云的呈现：X 获胜 + 有罪 : 无罪',
  },

  // ---------- 管理面复用（components/script-view.tsx，只在 /admin/slots/:id 出现） ----------
  'ADM.slot-script-view': {
    label: '场景脚本源码',
    note: '管理面场景详情里的带行号高亮源码视图；文件归 FA 组维护，页面属 ADM',
    when: '/admin 场景详情页',
  },
}

export const STEPS_FA: StepHints = {
  // 第一轮
  j1s5: { route: '/matches/:id', marker: 'FA.status-badge' },
  j1s6: { route: '/matches/:id', marker: 'FA.journey-card' },
  j6s4: { route: '/matches/:id', marker: 'FA.copy-id-button' },
  j7s1: { route: '/matches/:id', marker: 'FA.result-card' },
  j7s2: { route: '/matches/:id', marker: 'FA.verdict-card' },
  j7s3: { route: '/matches/:id', marker: 'FA.hidden-goal-section' },
  j7s4: { route: '/matches/:id', marker: 'FA.replay-button' },
  j7s5: { route: '/matches/:id', marker: 'FA.debug-toggle' },
  // 第二轮
  jR2s1: { route: '/matches/:id', marker: 'FA.result-summary' },
  jR2s2: { route: '/matches/:id', marker: 'FA.hidden-goal-section' },
  jR2s3: { route: '/matches/:id', marker: 'FA.ledger-table' },
  jR2s4: { route: '/matches/:id', marker: 'FA.event-score' },
  jR2s5: { route: '/matches/:id', marker: 'FA.scoring-section' },
  jR4s1: { route: '/matches/:id', marker: 'FA.trend-hint' },
  jR4s2: { route: '/matches/:id', marker: 'FA.trend-beat' },
  jR4s3: { route: '/matches/:id', marker: 'FA.trend-view-card-button' },
  jR4s4: { route: '/matches/:id', marker: 'FA.trend-beat' },
  jR5s1: { route: '/matches/:id', marker: 'FA.replay-speed-group' },
  jR5s2: { route: '/matches/:id', marker: 'FA.replay-speed-group' },
  jR5s3: { route: '/matches/:id', marker: 'FA.replay-back-button' },
  jR5s4: { route: '/matches/:id', marker: 'FA.replay-restart-button' },
  jR5s5: { route: '/matches/:id', marker: 'FA.replay-exit-button' },
  jR6s2: { route: '/matches/:id', marker: 'FA.challenge-leg-badge' },
  jR6s3: { route: '/matches/:id', marker: 'FA.sibling-link' },
  jR7s1: { route: '/matches/:id', marker: 'FA.result-winner' },
  jR7s2: { route: '/matches/:id', marker: 'FA.sibling-link' },
  jR7s5: { route: '/matches/:id', marker: 'FA.result-winner' },
  jR8s1: { route: '/matches/:id', marker: 'FA.aside-card' },
  jR8s2: { route: '/matches/:id', marker: 'FA.aside-card' },
  jR8s3: { route: '/matches/:id', marker: 'FA.aside-card' },
  jR8s4: { route: '/matches/:id', marker: 'FA.trend-plot' },
  jR9s1: { route: '/matches/:id', marker: 'FA.result-card' },
  jR9s2: { route: '/matches/:id', marker: 'FA.result-summary' },
  jR9s3: { route: '/matches/:id', marker: 'FA.result-card' },
}
