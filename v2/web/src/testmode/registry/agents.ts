/* EA 智能体主页（/agents/:id，B3）+ MA 我的智能体（/my-agents，#73/#64）+ X 首战快速通道（/express，A3）。
   2026-09-09 咳嗽方案把三页重排为「清单低复杂度 → 主页高复杂度 → 构建器低复杂度」：
   MA 只负责选择/新建，改名、删除、版本、参赛和出战集中在 EA。EA 的版本卡继续复用
   VersionList 的 E.version-card… 标记，出战面板是 OS.*，创建失败提示是 E.new-agent-*。 */
import type { StepHints, TmRegistry } from '../types'

export const TM_AGENTS: TmRegistry = {
  // ======================= EA 智能体视图 · 公开视图（别人的智能体，#35） =======================
  'EA.public-view': {
    label: '公开视图',
    clauses: ['U10-C12', 'U10-C13'],
    anchors: ['spec-change-35', 'spec-change-20'],
    journeys: ['j8s1'],
    note:
      '打开别人的智能体：主人路径 403 后退到 /public 投影——只有身份 + 逐版本战绩，没有提示词也没有对比',
    when: '打开不属于自己的 /agents/:id',
  },
  'EA.public-back-link': {
    label: '返回场景',
    when: '公开视图',
  },
  'EA.public-title': {
    label: '公开视图标题',
    clauses: ['U10-C12', 'U10-C01'],
    anchors: ['spec-change-63'],
    journeys: ['j8s1'],
    note:
      '展示名口径与主人视图一致：侧角色名「自起名」，无名回落「侧角色名 #id」',
    when: '公开视图',
  },
  'EA.public-owner-line': {
    label: '主人与场景副行',
    clauses: ['U10-C12'],
    journeys: ['j8s1'],
    note: '「属于谁 · 哪个场景」；执哪一方由标题里的侧角色名带出',
    when: '公开视图',
  },
  'EA.public-record-card': {
    label: '逐版本战绩卡',
    clauses: ['U10-C12', 'U10-C05', 'U01-C32'],
    anchors: ['spec-change-35', 'spec-p15'],
    journeys: ['j8s1'],
    note: '#35 战绩有意公开（按侧）',
    when: '公开视图',
  },
  'EA.public-record-empty': {
    label: '公开战绩空态',
    clauses: ['U10-C12', 'LACK-10'],
    when: '公开视图且对方还没保存过版本',
  },
  'EA.public-version-list': {
    label: '公开版本列表',
    clauses: ['U10-C12', 'U10-C05'],
    journeys: ['j8s1'],
    when: '公开视图且对方有版本',
  },
  'EA.public-version-item': {
    label: '公开版本行',
    clauses: ['U10-C05', 'U10-C12', 'U01-C32'],
    journeys: ['j8s1'],
    note: '只有 vN、★ 与战绩——没有提示词、没有动作按钮',
    when: '公开视图且对方有版本',
  },
  'EA.public-entry-badge': {
    label: '公开视图参赛标记',
    clauses: ['U10-C06', 'U10-C12'],
    anchors: ['spec-change-33'],
    when: '公开视图，对方标了 ★ 的那一版',
  },
  'EA.public-record': {
    label: '公开版本战绩',
    clauses: ['U10-C05', 'U01-C32', 'U10-C12'],
    anchors: ['spec-p15', 'spec-change-35'],
    journeys: ['j8s1'],
    note: '0 战「暂无战绩」；有战「N 战 M 胜」（按已计分对局）',
    when: '公开视图且对方有版本',
  },
  'EA.public-owner-only-hint': {
    label: '仅主人可见提示',
    clauses: ['U10-C13', 'U10-C12', 'U10-C04'],
    anchors: ['spec-change-20'],
    journeys: ['j8s2'],
    note: '「提示词只有智能体主人可见。」；版本对比暂不展示',
    when: '公开视图',
  },

  // ======================= EA 智能体视图 · 主人视图 =======================
  'EA.back-link': {
    label: '返回我的智能体',
    clauses: ['U10-C11'],
    note: 'EA ⇄ 我的智能体整行入口互通',
  },
  'EA.error': {
    label: '页面错误',
    clauses: ['LACK-10'],
    note:
      '老服务器无 /public 时打开别人的智能体只会看到「不是你的智能体」（U10-C12 旧形态）',
    when: '草稿/版本接口失败，或老服务器上打开别人的智能体',
  },
  'EA.loading': {
    label: '加载中',
    clauses: ['LACK-10'],
    when: '数据未回时',
  },
  'EA.page-header': {
    label: '页头',
    clauses: ['U10-C01', 'U10-C03'],
    anchors: ['spec-b3'],
    journeys: ['j8s3'],
    note: '标题、副行与身份操作菜单；版本/出战动作在下方版本区',
  },
  'EA.page-title': {
    label: '策略展示名标题',
    clauses: ['U10-C01', 'U01-C20', 'U01-C22', 'U01-C20b'],
    anchors: ['spec-p1', 'spec-change-63'],
    journeys: ['j8s3'],
    note:
      '「商鞅「贪婪」」，无名回落「商鞅 #id」；主页身份菜单可就地改名，保存后全局同步',
  },
  'EA.subtitle': {
    label: '页头副行',
    clauses: ['U10-C01', 'U10-C07'],
    anchors: ['spec-p1'],
    note:
      '「场景 · 甲方/乙方 · N 个版本 · #id」；正文不得出现「策略」「版本线」内部词',
  },
  'EA.agent-id': {
    label: '内部 id 小字',
    clauses: ['U10-C07', 'U01-C20'],
    anchors: ['spec-change-25', 'spec-p1'],
    note: 'P1：id 降为 mono 小字，#25 仍要 id 可见',
  },
  'EA.edit-button': {
    label: '新建版本',
    clauses: ['U10-C03', 'U01-C14'],
    anchors: ['spec-change-75', 'spec-change-81'],
    journeys: ['j8s3'],
    note:
      '版本标题旁的铅笔加号；进入 /agents/:id/build，内容以服务端常驻草稿为准',
  },
  'EA.field-button': {
    label: '出战按钮',
    clauses: ['U05-C01', 'U10-C03'],
    journeys: ['j5s1'],
    note: '每张版本卡内呼出选择对手面板（OS.*），并预选该 agent/场景/执侧/版本',
  },
  'EA.identity-menu': {
    label: '身份操作菜单',
    clauses: ['U01-C22', 'U01-C22b', 'U01-C27'],
    anchors: ['spec-p2', 'spec-p8b'],
    journeys: ['j4s5'],
    note:
      '标题旁唯一的省略号菜单；收纳重命名、空智能体删除或已有版本智能体归档',
  },
  'EA.rename-form': {
    label: '主页改名表单',
    clauses: ['U01-C22', 'U01-C22b', 'U01-C23'],
    anchors: ['spec-p2', 'spec-p3'],
    note:
      '创建后自动展开，或从身份菜单展开；1–30 字、空值回落侧角色名 + #id，支持 Enter 保存、Esc 取消、空白点击框外回落默认标识及中文输入法组字保护',
    when: '创建智能体后或身份操作菜单点「重命名」后',
  },
  'EA.delete-dialog': {
    label: '删除确认弹窗',
    clauses: ['U01-C27'],
    anchors: ['spec-p8b'],
    note: '只有 0 版本空壳可以确认删除；已有版本时提供归档，设置页可恢复',
    when: '0 版本智能体的身份操作菜单点「删除智能体」后',
  },
  'EA.action-error': {
    label: '智能体操作失败',
    clauses: ['LACK-10'],
    when: '版本卡「设为参赛版本」请求失败时',
  },
  'EA.express-error': {
    label: '首战派发失败提示',
    clauses: ['U03-C05', 'LACK-10'],
    anchors: ['spec-a3', 'spec-change-9'],
    note:
      'A3 降级路径：express 保存后自动派发失败，构建器落回这里并带错误文案——版本已保存，可用「出战」手动发起',
    when: '首战快速通道保存后自动派发失败',
  },
  'EA.entry-notice': {
    label: '★未移动提示',
    clauses: ['U06-C11', 'U01-C33', 'U10-C06'],
    anchors: ['spec-e10', 'spec-change-84', 'spec-change-33'],
    note:
      'E10：保存不移动 ★——「★参赛版本仍是 vN——新版本不会自动参赛，可在下方版本卡改标」；只消费一次导航 state，刷新不复现',
    when: '从构建器保存回来，且新版本不是参赛版本时',
  },
  'EA.sibling-pills': {
    label: '同侧智能体栏',
    clauses: ['U10-C10', 'U01-C28'],
    anchors: ['spec-p9'],
    journeys: ['j8s3'],
    note: '同侧横向切换轨道；即使只有当前一个智能体也保留，末尾提供新建入口',
  },
  'EA.sibling-pill': {
    label: '同侧智能体项',
    clauses: ['U10-C10', 'U01-C28', 'U10-C01'],
    anchors: ['spec-p9', 'spec-p1'],
    journeys: ['j8s3'],
    note:
      '当前项高亮（aria-current=page）；文案用策略展示名；点击切到 /agents/:id',
  },
  'EA.sibling-create-button': {
    label: '同侧新建按钮',
    clauses: ['U01-C17', 'U01-C26', 'U06-C08'],
    anchors: ['spec-change-59', 'spec-change-79', 'spec-p8a'],
    note: '同侧切换轨道末尾的机器人加号；打开锚定的新建浮层',
  },
  'EA.version-empty': {
    label: '版本列表空态',
    clauses: ['U01-C13', 'U01-C15', 'LACK-10'],
    note:
      'EA 自己的空态文案「还没有保存过版本 / 去构建你的第一版策略」（VersionList 的默认空态归 E.version-empty）',
    when: '还没保存过版本时',
  },
  'EA.version-empty-build-button': {
    label: '空态进入构建器',
    clauses: ['U10-C03'],
    when: '还没保存过版本时',
  },
  // ======================= MA 我的智能体 =======================
  'MA.page-header': {
    label: '页头',
    anchors: ['spec-change-73'],
  },
  'MA.page-title': {
    label: '页面标题',
    anchors: ['spec-change-73'],
    note: '顶栏「我的智能体」入口落到这里',
  },
  'MA.page-intro': {
    label: '页面一句话说明',
    clauses: ['U06-C14', 'U11-C05'],
    anchors: ['spec-change-58'],
    note: '只说明「选择一个智能体，继续你的策略」；资格细节留在分组状态里',
  },
  'EA.entry-error': {
    label: '打开失败提示',
    clauses: ['LACK-10'],
    when: '打开智能体的目标页中，ensure 请求失败时；可重试或返回场景',
  },
  'MA.loading': {
    label: '加载中',
    clauses: ['LACK-10'],
    when: '数据未回时',
  },
  'MA.error': {
    label: '页面错误',
    clauses: ['LACK-10'],
    when: '场景目录接口失败时（清单接口失败只降级不报错）',
  },
  'MA.scenario-list': {
    label: '场景分组列表',
    anchors: ['spec-change-73'],
    note: '按场景分组；每组一张卡',
  },
  'MA.no-scenarios': {
    label: '暂无场景',
    when: '场景目录为空时',
  },
  'MA.scenario-group': {
    label: '场景分组卡',
    clauses: ['U10-C02', 'U06-C13'],
    anchors: ['spec-change-73', 'spec-change-64'],
    note:
      '数据化分组（/v1/my/agents）：简短场景信息、双侧状态与可整行点入的智能体清单',
    when: '/v1/my/agents 可用时（否则降级为骨架卡）',
  },
  'MA.group-header': {
    label: '分组卡头',
    clauses: ['U10-C02'],
    anchors: ['spec-change-64'],
  },
  'MA.scenario-link': {
    label: '场景标题链接',
    note: '回到该场景介绍页（DA）',
  },
  'MA.scenario-subject': {
    label: '场景一句话主题',
  },
  'MA.side-badge': {
    label: '双侧完成度徽章',
    clauses: ['U10-C02', 'U01-C33', 'U06-C13'],
    anchors: ['spec-change-64', 'spec-change-33'],
    note:
      '三态：「商鞅 ✓」（有 agent 且已标 ★）/「未标参赛」/「未建」；跨该侧全部智能体聚合。#64 点名的两处只落了这一处（EA 页没有）',
  },
  'MA.entry-ready': {
    label: '参赛资格行',
    clauses: ['U06-C14', 'U11-C05', 'U10-C02'],
    anchors: ['spec-change-58', 'spec-change-64'],
    note:
      'entryReady 由服务端判定；未就绪时点名「还差 商鞅（未创建）/ 甘龙（未标参赛版本）」',
  },
  'MA.side-section': {
    label: '一侧的智能体段',
    clauses: ['U01-C21'],
    anchors: ['spec-p1a'],
    note:
      '段头只出现一次角色名与简述并保留一个机器人加号；该侧全部智能体沿用服务端顺序',
  },
  'MA.agent-row': {
    label: '智能体行',
    clauses: ['U10-C11', 'U01-C21', 'U10-C02'],
    anchors: ['spec-change-63'],
    note:
      '#56 每侧可多个；整行是 → /agents/:id 的唯一主操作（data-testid=agent-row）',
  },
  'MA.agent-name': {
    label: '智能体展示名',
    clauses: ['U10-C01', 'U01-C22'],
    anchors: ['spec-change-63', 'spec-p1'],
    journeys: ['j4s5'],
    note:
      '#63：角色名已由段头说明；行内有自起名则只显示自起名，没有则回落 #id；改名后即时变',
  },
  'MA.new-agent-button': {
    label: '新建智能体',
    clauses: ['U01-C17', 'U01-C26', 'U06-C08', 'U02-C19', 'U01-C09'],
    anchors: ['spec-change-59', 'spec-change-79', 'spec-p8a', 'spec-p6a'],
    note:
      '每侧段头唯一的机器人加号；直接创建并进入主页展开空白改名；#59/#79 引导门就地提示',
  },
  'MA.empty-side': {
    label: '缺侧空态行',
    clauses: ['U10-C02'],
    anchors: ['spec-change-64'],
    note: '只显示「还没有商鞅智能体」；创建入口固定在该侧段头',
    when: '该侧还没有智能体',
  },
  'MA.fallback-group': {
    label: '降级分组卡',
    anchors: ['spec-change-54'],
    note: 'P1 降级：/v1/my/agents 不可用时按目录骨架渲染，绝不白屏',
    when: '/v1/my/agents 接口失败或老服务器',
  },
  'MA.fallback-row': {
    label: '降级侧行',
    note: '段头机器人加号直接创建并打开新智能体主页',
    when: '降级骨架时',
  },
  'MA.fallback-hint': {
    label: '降级空态提示',
    anchors: ['spec-change-54'],
    note:
      '#54：数据化槽位不摆假数字——「完成度与参赛资格徽章将在数据接入后点亮」',
    when: '降级骨架时',
  },

  // ======================= X 首战快速通道（A3） =======================
  'X.page': {
    label: '首战快速通道页',
    clauses: ['U03-C02', 'U03-C01', 'U03-C10'],
    anchors: ['spec-a3', 'spec-change-11'],
    journeys: ['j1s3'],
    note:
      '简化版 DA：徽章 + 标题 + 钩子 + 只有我方角色卡 + 一句规则 + 去构建 + 逃生链接；打过首战再访会被重定向到 /scenarios',
  },
  'X.page-header': {
    label: '页头',
    clauses: ['U03-C02'],
    journeys: ['j1s3'],
  },
  'X.badge': {
    label: '首战快速通道徽章',
    clauses: ['U03-C01', 'U08-C04', 'U03-C02'],
    anchors: ['spec-a3', 'spec-b2'],
    journeys: ['j1s2', 'j1s3'],
    note:
      '注册成功自动登录后落到这里——徽章是「进入了首战快速通道」的第一眼证据',
  },
  'X.page-title': {
    label: '场景标题',
    clauses: ['U03-C02', 'U03-C12'],
    journeys: ['j1s3'],
    note: '场景由新手预设三元组决定（缺席回落商鞅场景）',
  },
  'X.hook': {
    label: '场景钩子',
    clauses: ['U03-C02'],
    journeys: ['j1s3'],
  },
  'X.role-card': {
    label: '我方角色卡',
    clauses: ['U03-C02', 'U03-C12', 'U03-C03'],
    anchors: ['spec-change-11', 'spec-change-57'],
    journeys: ['j1s3'],
    note:
      'S4 简化版只保留己方这一张；执方由预设决定（#57 首战＝单侧 agent，执哪方可配置），无切侧控件',
  },
  'X.role-name': {
    label: '我方角色名',
    clauses: ['U03-C02', 'U03-C12'],
    journeys: ['j1s3'],
  },
  'X.win-condition': {
    label: '一句话目标',
    clauses: ['U03-C02'],
    journeys: ['j1s3'],
    note: '来自场景模块 education.winConditions[我方]',
    when: '场景有教育模块时',
  },
  'X.rule-line': {
    label: '一句规则',
    clauses: ['U03-C02'],
    anchors: ['spec-change-11'],
    journeys: ['j1s3'],
    note: '不展开四层教育，一行讲完「N 轮后裁判判定——写好提示词，AI 替你上场」',
  },
  'X.actions': {
    label: '动作行',
    clauses: ['U03-C02'],
  },
  'X.build-button': {
    label: '去构建按钮',
    clauses: ['U03-C03', 'U03-C02', 'U03-C12'],
    anchors: ['spec-a3', 'spec-change-57'],
    journeys: ['j1s3', 'j1s4'],
    note:
      '懒 ensure 单侧 agent → /agents/:id/build?express=1（构建器里保存即自动开战，U03-C05）',
  },
  'X.escape-link': {
    label: '逃生链接',
    clauses: ['U03-C02'],
    note: '「先逛逛全部场景」→ /scenarios',
  },
  'X.loading': {
    label: '加载中',
    clauses: ['LACK-10'],
    when: '配置/场景未回时',
  },
  'X.error-card': {
    label: '首战场景不可用',
    note:
      '场景接口失败：「首战场景暂不可用 / 可以先从场景列表任选一个开始」（config 失败不挡首战，只按默认三元组渲染）',
    when: '场景接口失败时',
  },
  'X.error-browse-button': {
    label: '浏览全部场景',
    when: '首战场景不可用时',
  },
}

export const STEPS_AGENTS: StepHints = {
  // 第一轮旅程 1（第 4 步保存在 E，第 5–6 步在 FA，归各自组）
  j1s3: { route: '/express', marker: 'X.role-card' },
  // 咳嗽方案把改名收进智能体主页的身份菜单。
  j4s5: { route: '/agents/:id', marker: 'EA.identity-menu' },
  // 第一轮旅程 5 第 1 步：从 EA 版本卡「出战」呼出面板（面板本体归 OS）
  j5s1: { route: '/agents/:id', marker: 'EA.field-button' },
  // 第一轮旅程 8 别人的智能体主页
  j8s1: { route: '/agents/:id', marker: 'EA.public-record-card' },
  j8s2: { route: '/agents/:id', marker: 'EA.public-owner-only-hint' },
  j8s3: { route: '/agents/:id', marker: 'EA.sibling-pills' },
}
