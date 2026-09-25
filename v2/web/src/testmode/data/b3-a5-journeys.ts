/* B3 / A5 当前可交接人测集。
   这份数据刻意与 spec-v4 的 verification-journeys.json 使用同一组稳定 HV-* id：
   Test Mode 负责在产品里带路并写条款结果，详细手册负责 fixture、截图和完整证据提交。
   U05-C11 / U05-C12 虽各自规范句已确认，但两者的默认取版规则冲突，解决前不得进入本集合。 */
import type { FixtureField, FixtureProfile, Journey, Step } from '../data'

import { REVIEWED_MANUAL_PATH } from './reviewed-manual'

export const B3_A5_MANUAL_PATH = REVIEWED_MANUAL_PATH

/**
 * 只允许注入可公开的稳定业务 ID。账号别名留在 profile 文案；密码、cookie、
 * token 及运行时 a5HotseatActiveMatchId 不得进入此对象。
 */
export const B3_A5_FIXTURE_DEFAULTS: Record<string, string> = {
  appBaseUrl: 'https://axiia-cup-2-web.isofucius.cn',
  b3OwnerAgentId: '224',
  b3OwnerSiblingAgentId: '226',
  b3OwnerSoloSideAgentId: '225',
  b3OwnerTournamentId: '2',
  b3OwnerCompletedMatchId: '132',
  b3MissingSideAgentId: '227',
  b3PublicTargetAgentId: '224',
  a5CoreAgentId: '228',
  a5CoreMissingSideAgentId: '230',
  a5CoreLockedAgentId: '231',
  a5CoreMobileAgentId: '233',
  a5HotseatAgentId: '231',
  a5PvpExhaustedAgentId: '233',
  a5PvpExhaustedOpponentVersionId: '367',
  a5PvpChallengerAgentId: '228',
  a5PvpOpponentVersionId: '372',
}

type HandoffStep =
  & Pick<
    Step,
    | 'id'
    | 'action'
    | 'expected'
    | 'route'
    | 'marker'
    | 'versionPins'
    | 'testUrl'
    | 'links'
    | 'captures'
    | 'fixtureRefs'
    | 'knownGap'
    | 'screenshotEvidence'
  >
  & { clauseIds: string[] }

interface HandoffJourney {
  id: string
  n: string
  chapter: 'B3' | 'A5'
  title: string
  prerequisites: string[]
  evidenceRequirements: string[]
  completion: string
  fixtureProfiles: FixtureProfile[]
  steps: HandoffStep[]
}

const SCREENSHOT_HANDOFF =
  '先按指定文件名截图，再到「详细手册 · 上传本步骤截图」提交。Test Mode 的结果按钮只写条款与步骤状态，不会代替图片上传。'

function preparedId(name: string, label: string, help: string): FixtureField {
  return { name, label, help }
}

function handoffJourney(input: HandoffJourney): Journey {
  const fieldNames = new Set(
    input.fixtureProfiles.filter((profile) =>
      profile.readiness !== 'refresh-required'
    ).flatMap((profile) =>
      profile.fields.filter((field) => field.kind !== 'runtime').map((field) =>
        field.name
      )
    ),
  )
  const fixtureDefaults = Object.fromEntries(
    Object.entries(B3_A5_FIXTURE_DEFAULTS).filter(([name]) =>
      fieldNames.has(name)
    ),
  )
  return {
    id: input.id,
    round: 'handoff',
    n: input.n,
    chapter: input.chapter,
    title: input.title,
    manual: B3_A5_MANUAL_PATH,
    manualAnchor: input.id,
    prerequisites: input.prerequisites,
    evidenceRequirements: input.evidenceRequirements,
    completion: input.completion,
    fixtureProfiles: input.fixtureProfiles,
    fixtureDefaults,
    steps: input.steps.map((step, index) => ({
      ...step,
      round: 'handoff',
      journey: input.n,
      index: index + 1,
      specLine: `${input.chapter} · 规范句已确认 · 固定现行版本`,
      anchors: [],
      primary: step.clauseIds.slice(0, 1),
      known: null,
      humanOnly: SCREENSHOT_HANDOFF,
      manualUrl: `${B3_A5_MANUAL_PATH}#${step.id}`,
    })),
  }
}

export const B3_A5_JOURNEYS: Journey[] = [
  handoffJourney({
    id: 'HV-B3-OWNER-EA',
    n: 'B3.1',
    chapter: 'B3',
    title: '所有者 EA：入口、身份、版本与动作',
    prerequisites: [
      '先按 fixture 卡切换到「B3 人测·完整所有者」；主智能体保留 v1=359、v2=360，可能已有额外版本。开测前按当前版本 API 记录最新版 ID/文本与本阵营唯一 ★；不要假定 v2 仍为最新版或参赛版，也不要为恢复种子状态而改标或删除版本。',
      '初始种子统计基线：版本 359 有 1 场已计分、0 胜；版本 360 为 0 场。这不是当前参赛标记或版本总数的保证；执行前记录当前版本与统计，新增版本或对局后按当时实际统计判定。',
      '同一阵营另有 b3OwnerSiblingAgentId，另一阵营有且仅有 b3OwnerSoloSideAgentId；缺侧检查必须切换到「B3 人测·访客缺侧」。',
      '准备 b3OwnerTournamentId 对应积分榜条目、D/DA「我的智能体」入口、玩家对局列表、b3OwnerCompletedMatchId 战报和一次 E 保存后返回主页的结果，全部指向 b3OwnerAgentId。',
      '记录环境 URL、build SHA、所有相关 agent/version/match ID 和预期统计。',
    ],
    evidenceRequirements: [
      '提交每个 screenshotEvidence 指定文件，截图须含地址栏或同时提交对应 URL 清单。',
      '另附去敏后的版本/对局种子查询，证明 S05 的已计分口径；不得提交密码、cookie 或令牌。',
      '记录 tester、执行时间、build SHA，以及每一步 pass/fail 和实际结果。',
    ],
    completion:
      'S01–S09 全部执行并提交证据；任何失败只更新 humanVerification 结果，不改变「规范句已确认」状态。',
    fixtureProfiles: [
      {
        id: 'b3-owner-rich',
        label: '测试角色 A · B3 完整所有者',
        accountAlias: 'B3 人测·完整所有者',
        readiness: 'ready',
        description:
          '双侧齐全；主智能体 224 保留 v1=版本 359、v2=版本 360，初始种子统计分别为 1 场已计分、0 胜与 0 场。可能已有额外版本；最新版与当前唯一 ★ 以开测时的版本 API 记录为准，不重置共享版本状态。同侧兄弟=226，对侧唯一智能体=225。登录信息已通过 axiia-cup-product 群账号包交付。',
        fields: [
          preparedId(
            'b3OwnerAgentId',
            '完整所有者的主智能体 ID',
            '至少两个版本，且具备已计分与 0 场版本。',
          ),
          preparedId(
            'b3OwnerSiblingAgentId',
            '同阵营兄弟智能体 ID',
            '与主智能体同阵营，用于核对横向胶囊切换。',
          ),
          preparedId(
            'b3OwnerSoloSideAgentId',
            '另一阵营单智能体 ID',
            '该阵营同侧只有一个智能体，用于核对胶囊整排仍保留当前项与新建入口。',
          ),
          preparedId(
            'b3OwnerTournamentId',
            '含主智能体的锦标赛 ID',
            '积分榜中必须有主智能体的可点击条目。',
          ),
          preparedId(
            'b3OwnerCompletedMatchId',
            '含主智能体的已完成对局 ID',
            '战报必须显示可进入该智能体详情的入口。',
          ),
        ],
      },
      {
        id: 'b3-owner-missing-side',
        label: '测试角色 B · B3 缺少对侧',
        accountAlias: 'B3 人测·访客缺侧',
        readiness: 'ready',
        description:
          '专门核对缺侧时的信息分层；与旅程 2 的只读访客复用 axiia-cup-product 群账号包中的同一账号。',
        fields: [
          preparedId(
            'b3MissingSideAgentId',
            '缺少对侧账号的智能体 ID',
            '这个账号与完整所有者账号不是同一个状态。',
          ),
        ],
      },
    ],
    steps: [
      {
        id: 'HV-B3-OWNER-EA-S01',
        testUrl: '{{appBaseUrl}}/tournaments/{{b3OwnerTournamentId}}',
        links: [
          { label: '玩家对局列表', url: '{{appBaseUrl}}/matches' },
          {
            label: '已完成战报',
            url: '{{appBaseUrl}}/matches/{{b3OwnerCompletedMatchId}}',
          },
          { label: '我的智能体', url: '{{appBaseUrl}}/my-agents' },
          {
            label: '主智能体工作区',
            url: '{{appBaseUrl}}/agents/{{b3OwnerAgentId}}/build',
          },
        ],
        fixtureRefs: ['b3-owner-rich'],
        route: '/tournaments/:id',
        marker: null,
        action:
          '以「B3 人测·完整所有者」依次执行入口矩阵：在 b3OwnerTournamentId 积分榜点击属于 b3OwnerAgentId 的参赛版本入口；在玩家对局列表点击同一智能体的独立入口；打开已完成战报后点击该侧的「← 我的智能体」；在「我的智能体」侧卡点击该智能体的展示名；在 E 保存一个新版本并观察自动返回。上方每个辅助网址都可直接打开；每次记录落地 URL，再返回下一个入口。',
        expected:
          '每个入口都打开 /agents/{{b3OwnerAgentId}}，没有落到别的智能体或只停在中间列表页。',
        clauseIds: ['U10-C11', 'U10-C11b'],
        versionPins: {
          'U10-C11': 'baseline:U10-C11',
          'U10-C11b': 'comment-v2:U10-C11b',
        },
        screenshotEvidence: [
          'HV-B3-OWNER-EA-S01-leaderboard.png',
          'HV-B3-OWNER-EA-S01-player-matches.png',
          'HV-B3-OWNER-EA-S01-report.png',
          'HV-B3-OWNER-EA-S01-da-save.png',
        ],
      },
      {
        id: 'HV-B3-OWNER-EA-S02',
        testUrl: '{{appBaseUrl}}/agents/{{b3OwnerAgentId}}',
        links: [
          {
            label: '缺侧账号的 EA',
            url: '{{appBaseUrl}}/agents/{{b3MissingSideAgentId}}',
          },
          { label: '缺侧账号的我的智能体', url: '{{appBaseUrl}}/my-agents' },
        ],
        fixtureRefs: ['b3-owner-rich', 'b3-owner-missing-side'],
        route: '/agents/:id',
        marker: 'EA.page-header',
        action:
          '先以「B3 人测·完整所有者」查看 EA 页头的展示名、场景名与身份菜单；再切换「B3 人测·访客缺侧」，分别打开上方「缺侧账号的 EA」与「缺侧账号的我的智能体」，核对两层各自承担的信息。',
        expected:
          '展示名使用「侧角色名「自起名」· 场景」口径，无自起名时回落「侧角色名 #id」，界面不出现「策略」「版本线」内部词；EA 不重复双侧完成度或补侧提醒，我的智能体页以克制的状态摘要呈现两侧准备度并各保留一个新建入口。',
        clauseIds: ['U10-C01', 'U10-C02'],
        versionPins: {
          'U10-C01': 'baseline:U10-C01',
          'U10-C02': 'baseline:U10-C02',
        },
        screenshotEvidence: [
          'HV-B3-OWNER-EA-S02-header.png',
          'HV-B3-OWNER-EA-S02-missing-side.png',
        ],
      },
      {
        id: 'HV-B3-OWNER-EA-S03',
        testUrl: '{{appBaseUrl}}/agents/{{b3OwnerAgentId}}',
        fixtureRefs: ['b3-owner-rich'],
        route: '/agents/:id',
        marker: 'EA.edit-button',
        action:
          '点击版本标题旁的「新建版本」铅笔加号，等待工作区加载完成；不要修改或保存文本。',
        expected:
          '浏览器进入 /agents/{{b3OwnerAgentId}}/build，编辑区载入该智能体唯一的服务端草稿；已保存版本保持不可变且不在构建器重复展示。',
        clauseIds: ['U10-C03'],
        versionPins: { 'U10-C03': 'comment-v2:U10-C03' },
        screenshotEvidence: ['HV-B3-OWNER-EA-S03-edit-latest.png'],
      },
      {
        id: 'HV-B3-OWNER-EA-S04',
        testUrl: '{{appBaseUrl}}/agents/{{b3OwnerAgentId}}',
        fixtureRefs: ['b3-owner-rich'],
        route: '/agents/:id',
        marker: 'EA.page-header',
        knownGap: {
          title: '版本对比暂不提供，修订提案待审阅',
          detail:
            '2026-09-18 产品要求暂不做版本 diff；此处保留原条款与版本 pin，不代表当前实现仍提供对比。',
          instruction:
            '核对主页不显示版本对比，记录与历史规范的差异，不把旧条款标为通过。',
        },
        action:
          '打开主页，核对当前版本战绩与提示词；版本 diff 已按 2026-09-18 要求暂时移除，原验收预期保留待审阅。',
        expected:
          '所有者能看到完整提示词和版本差异；基准、对比选择器都可用，结果对应所选两个版本。',
        clauseIds: ['U10-C04'],
        versionPins: { 'U10-C04': 'baseline:U10-C04' },
        screenshotEvidence: ['HV-B3-OWNER-EA-S04-diff.png'],
      },
      {
        id: 'HV-B3-OWNER-EA-S05',
        testUrl: '{{appBaseUrl}}/agents/{{b3OwnerAgentId}}',
        fixtureRefs: ['b3-owner-rich'],
        route: '/agents/:id',
        marker: 'E.version-record',
        action:
          '逐张核对版本卡的对局数和胜场数；把非零版本与种子查询逐项比对，再定位 0 场版本并检查空态。',
        expected:
          '每张版本卡都按已完成且已计分对局显示对局数与胜场数，未完成/未计分对局不计入；0 场版本显示明确空态而不是空白。',
        clauseIds: ['U01-C32', 'U10-C05'],
        versionPins: {
          'U01-C32': 'baseline:U01-C32',
          'U10-C05': 'baseline:U10-C05',
        },
        screenshotEvidence: [
          'HV-B3-OWNER-EA-S05-scored-counts.png',
          'HV-B3-OWNER-EA-S05-zero-state.png',
        ],
      },
      {
        id: 'HV-B3-OWNER-EA-S06',
        testUrl: '{{appBaseUrl}}/agents/{{b3OwnerAgentId}}',
        fixtureRefs: ['b3-owner-rich'],
        route: '/agents/:id',
        marker: 'E.entry-badge',
        action:
          '检查全部已保存版本的参赛徽章，记录当前唯一参赛版；点击一个非参赛版本的勾选图标并等待请求完成，再次核对全部版本卡，包括之前测试新增的版本。',
        expected:
          '操作前后本阵营始终恰好一个版本带参赛标记；改标后旧标记消失，新标记只出现在所选版本。',
        clauseIds: ['U10-C06'],
        versionPins: { 'U10-C06': 'baseline:U10-C06' },
        screenshotEvidence: [
          'HV-B3-OWNER-EA-S06-before.png',
          'HV-B3-OWNER-EA-S06-after.png',
        ],
      },
      {
        id: 'HV-B3-OWNER-EA-S07',
        testUrl: '{{appBaseUrl}}/agents/{{b3OwnerAgentId}}',
        fixtureRefs: ['b3-owner-rich'],
        route: '/agents/:id',
        marker: 'E.version-card',
        action:
          '在一张参赛版本卡和一张非参赛版本卡上逐项检查紧凑图标，并点击复制提示词与安全的展开动作；只打开「出战」面板后立即关闭，不确认派发。全文搜索「复制为新智能体」。',
        expected:
          '版本卡提供复制提示词、勾选参赛版本、出战，以及正文超过三行时的展开/收起；不再内嵌「基于该版本迭代」，也不存在「复制为新智能体」或其降级入口。',
        clauseIds: ['U10-C08'],
        versionPins: { 'U10-C08': 'baseline:U10-C08' },
        screenshotEvidence: [
          'HV-B3-OWNER-EA-S07-actions.png',
          'HV-B3-OWNER-EA-S07-no-copy.png',
        ],
      },
      {
        id: 'HV-B3-OWNER-EA-S08',
        testUrl: '{{appBaseUrl}}/agents/{{b3OwnerAgentId}}/build',
        links: [
          {
            label: '同一智能体 EA',
            url: '{{appBaseUrl}}/agents/{{b3OwnerAgentId}}',
          },
        ],
        fixtureRefs: ['b3-owner-rich'],
        route: '/agents/:id/build',
        marker: 'E.workspace-card',
        action:
          '截取 E 的单一策略工作区与两个辅助入口，再打开上方「同一智能体 EA」截取版本列表；逐项核对两层分工。',
        expected:
          'E 只保留主文本区、模型/备注/persona 和始终可用的两个辅助弹窗，不展示版本卡；EA 集中承载版本号、战绩、复制、参赛、出战与 diff。',
        clauseIds: ['U10-C09'],
        versionPins: { 'U10-C09': 'baseline:U10-C09' },
        screenshotEvidence: [
          'HV-B3-OWNER-EA-S08-e.png',
          'HV-B3-OWNER-EA-S08-ea.png',
        ],
      },
      {
        id: 'HV-B3-OWNER-EA-S09',
        testUrl: '{{appBaseUrl}}/agents/{{b3OwnerAgentId}}',
        links: [
          {
            label: '同阵营兄弟 EA',
            url: '{{appBaseUrl}}/agents/{{b3OwnerSiblingAgentId}}',
          },
          {
            label: '另一阵营单智能体 EA',
            url: '{{appBaseUrl}}/agents/{{b3OwnerSoloSideAgentId}}',
          },
        ],
        fixtureRefs: ['b3-owner-rich'],
        route: '/agents/:id',
        marker: 'EA.sibling-pills',
        action:
          '在主智能体页点击 b3OwnerSiblingAgentId 的同侧兄弟胶囊并确认 URL；然后打开上方「另一阵营单智能体 EA」。',
        expected:
          '同角色胶囊整排始终显示；有多个时当前项高亮且点击切换到 b3OwnerSiblingAgentId，只有一个时仍显示当前项与唯一的新建图标。',
        clauseIds: ['U10-C10'],
        versionPins: { 'U10-C10': 'baseline:U10-C10' },
        screenshotEvidence: [
          'HV-B3-OWNER-EA-S09-siblings.png',
          'HV-B3-OWNER-EA-S09-solo.png',
        ],
      },
    ],
  }),

  handoffJourney({
    id: 'HV-B3-PUBLIC-NPC',
    n: 'B3.2',
    chapter: 'B3',
    title: '非所有者公开 EA 与 PVE NPC 聚合视图',
    prerequisites: [
      '按 fixture 卡登录「B3 人测·访客缺侧」；该账号与 b3PublicTargetAgentId 无所有权关系。提前保存目标智能体的逐版本预期战绩和一段可唯一识别的提示词片段。',
      'NPC 预设详情页及入口已按产品要求移除，NPC 练习仍从出战面板发起。原 NPC 聚合视图条款保留为历史验收缺口，不用填写或拼造 npcAgentId。',
      '记录环境 URL、build SHA、账号角色和所有预期值。',
    ],
    evidenceRequirements: [
      '提交指定截图及去敏后的公开/私有字段核对表。',
      '截图须能识别登录视角、玩家 agent ID、场景与 URL；NPC 入口缺失时明确写「无 NPC ID，不拼造」，不要求伪造 ID。',
      '记录 tester、执行时间、build SHA 和每一步实际结果。',
    ],
    completion:
      'S01–S02 全部执行并提交证据；实现缺口应记为 humanVerification fail，不改变「规范句已确认」状态。',
    fixtureProfiles: [
      {
        id: 'b3-public-viewer',
        label: '测试角色 C · B3 非所有者只读视角',
        accountAlias: 'B3 人测·访客缺侧',
        readiness: 'ready',
        description:
          '与目标智能体无所有权关系；与旅程 1 的缺侧账号复用 axiia-cup-product 群账号包中的同一账号。',
        fields: [
          preparedId(
            'b3PublicTargetAgentId',
            '只读账号要查看的玩家智能体 ID',
            '测试者以无所有权关系的账号打开此 ID。',
          ),
        ],
      },
      {
        id: 'b3-npc-gap',
        label: 'NPC 聚合视图 · 无账号 ID',
        kind: 'known-gap',
        readiness: 'known-gap',
        description:
          '从场景页逐 NPC 链接查看当前预设身份、执方、模型；此入口不代表历史对局配置。两侧胜率仍未交付，保留 U10-C14 的未完成状态，不填写或拼造 npcAgentId。',
        fields: [],
      },
    ],
    steps: [
      {
        id: 'HV-B3-PUBLIC-NPC-S01',
        testUrl: '{{appBaseUrl}}/agents/{{b3PublicTargetAgentId}}',
        fixtureRefs: ['b3-public-viewer'],
        route: '/agents/:id',
        marker: 'EA.public-version-list',
        action:
          '以「B3 人测·访客缺侧」打开 b3PublicTargetAgentId，逐张检查公开版本战绩；全文搜索已知提示词片段，并检查版本差异、工作区草稿或相关入口是否出现。',
        expected:
          '公开视图展示每个版本的对局数和胜场数；页面不显示提示词、工作区草稿或版本差异，也不能通过可见入口取得这些内容。',
        clauseIds: ['U10-C12', 'U10-C13'],
        versionPins: {
          'U10-C12': 'baseline:U10-C12',
          'U10-C13': 'baseline:U10-C13',
        },
        screenshotEvidence: [
          'HV-B3-PUBLIC-NPC-S01-public-stats.png',
          'HV-B3-PUBLIC-NPC-S01-private-content-absent.png',
        ],
      },
      {
        id: 'HV-B3-PUBLIC-NPC-S02',
        testUrl: '{{appBaseUrl}}/scenarios/shangyang-court',
        fixtureRefs: ['b3-public-viewer', 'b3-npc-gap'],
        knownGap: {
          title: 'NPC 单侧主页已实现；原双侧统计条款待审阅',
          detail:
            '2026-09-18 要求恢复 NPC 单侧主页，展示当前配置胜率与公开提示词。当前实现与原双侧统计条款不一致，修订提案待审阅；原条款版本 pin 不自动改写。',
          instruction:
            '从场景页实际 NPC 链接打开主页，核对单侧胜率、提示词与底部记录。记录与历史双侧条款的差异，不标原条款通过；不要拼造 ID。',
        },
        route: '/scenarios/:id',
        marker: 'DA.page',
        action:
          '从场景详情页的官方 NPC 入口打开主页。确认只展示该 NPC 所属单侧的战绩；原双侧胜率预期保留为历史条款待审阅。',
        expected:
          '每个 PVE NPC 都有可查看的聚合视图；目标 NPC 在当前场景分别展示两个阵营胜率，数值与种子数据一致，不显示成玩家胜率。',
        clauseIds: ['U10-C14'],
        versionPins: { 'U10-C14': 'baseline:U10-C14' },
        screenshotEvidence: [
          'HV-B3-PUBLIC-NPC-S02-entry.png',
          'HV-B3-PUBLIC-NPC-S02-known-gap-or-two-side-rates.png',
        ],
      },
    ],
  }),

  handoffJourney({
    id: 'HV-A5-OS-CORE',
    n: 'A5.1',
    chapter: 'A5',
    title: '选择对手面板：预选、版本、换侧、锁定与移动端',
    prerequisites: [
      '「A5 人测·完整发起方」在同一场景两个阵营各有智能体，a5CoreAgentId 有三个版本且有显式参赛版本；创建引导必须另切「A5 人测·缺侧玩家」。',
      '锁定态必须切换到「A5 人测·锁定热座」，并记录当前可配置解锁门槛及两侧实时进度。',
      '移动端使用测试角色 G，登录「A5 人测·配额被约方」（与 PVP 边界的 I / K 共用登录）；浏览器切到 390×844，并在测试当天完成前序派发，让进行中对战条出现足够卡片后再执行本步。',
      '本旅程不点击最终派发按钮；记录环境 URL、build SHA 与 fixture 标识。',
    ],
    evidenceRequirements: [
      '提交每一步指定截图，S02 截图须同时显示版本选项和参赛标识，S05 须提交滚动前后两张。',
      '附当前解锁配置与账号门槛状态的去敏数据说明。',
      '记录 tester、执行时间、viewport、build SHA 和每一步实际结果。',
    ],
    completion:
      'S01–S05 全部执行并提交证据；fixme 或实现缺口可以导致失败，但不改变「规范句已确认」状态。',
    fixtureProfiles: [
      {
        id: 'a5-core-rich-owner',
        label: '测试角色 D · A5 双侧多版本',
        accountAlias: 'A5 人测·完整发起方',
        readiness: 'ready',
        description:
          '双侧齐全；主智能体 228 有版本 364（参赛版）、365、366，对侧智能体 229 的版本为 367；用于预选、版本列表与正常换侧。',
        fields: [
          preparedId(
            'a5CoreAgentId',
            '双侧齐全、含多版本的智能体 ID',
            '用于预选、版本列表与换侧，不执行最终派发。',
          ),
        ],
      },
      {
        id: 'a5-core-missing-side',
        label: '测试角色 E · A5 缺少对侧',
        accountAlias: 'A5 人测·缺侧玩家',
        readiness: 'ready',
        description: '只用于创建对侧引导。',
        fields: [
          preparedId(
            'a5CoreMissingSideAgentId',
            '缺少对侧的智能体 ID',
            '用于核对换侧时的创建引导。',
          ),
        ],
      },
      {
        id: 'a5-core-pvp-locked',
        label: '测试角色 F · A5 PVP 未解锁',
        accountAlias: 'A5 人测·锁定热座',
        readiness: 'ready',
        description:
          '新账号保持 PVP 未解锁，用于锁图标、配置门槛和双侧实时进度；与 Hotseat 旅程复用 axiia-cup-product 群账号包中的同一账号。',
        fields: [
          preparedId(
            'a5CoreLockedAgentId',
            'PVP 未解锁账号的智能体 ID',
            '需记录当前配置门槛与两侧实时进度。',
          ),
        ],
      },
      {
        id: 'a5-core-mobile-overflow',
        label: '测试角色 G · A5 移动端多卡横向滚动',
        accountAlias: 'A5 人测·配额被约方',
        readiness: 'refresh-required',
        description:
          '与 PVP 边界的测试角色 I / K 复用 axiia-cup-product 群账号包中的同一账号；多张进行中卡片会自然结束，测试当天按步骤派发后再核对移动端横向对战条。',
        fields: [
          preparedId(
            'a5CoreMobileAgentId',
            '有多张进行中卡片的智能体 ID',
            '用于 390×844 下核对底部弹层与对战条横向滚动。',
          ),
        ],
      },
    ],
    steps: [
      {
        id: 'HV-A5-OS-CORE-S01',
        testUrl: '{{appBaseUrl}}/agents/{{a5CoreAgentId}}',
        fixtureRefs: ['a5-core-rich-owner'],
        route: '/agents/:id',
        marker: 'EA.field-button',
        action:
          '在指定版本卡点击「出战」并保持面板打开；关闭后再从另一张版本卡打开一次。',
        expected:
          '每次都打开紧凑的选择对手面板并预选 a5CoreAgentId；面板始终钉住所点击版本，不存在脱离版本语境的页头出战入口。',
        clauseIds: ['U05-C01'],
        versionPins: { 'U05-C01': 'comment-v2:U05-C01' },
        screenshotEvidence: ['HV-A5-OS-CORE-S01-preselected.png'],
      },
      {
        id: 'HV-A5-OS-CORE-S02',
        testUrl: '{{appBaseUrl}}/agents/{{a5CoreAgentId}}',
        fixtureRefs: ['a5-core-rich-owner'],
        route: '/agents/:id',
        marker: 'OS.fielded-version',
        action:
          '先从非参赛版本卡打开面板并核对副标题，关闭后再从参赛版本卡打开并核对副标题；两次都不要确认派发。',
        expected:
          '面板没有己方版本选择器：非参赛卡显示「出战版本：指定版本 vN」，参赛卡才显示「出战版本：★参赛版本 vN」；真正派发的版本始终等于呼出面板的版本。',
        clauseIds: ['U05-C02', 'U05-C02b'],
        versionPins: {
          'U05-C02': 'comment-v2:U05-C02',
          'U05-C02b': 'baseline:U05-C02b',
        },
        screenshotEvidence: [
          'HV-A5-OS-CORE-S02-version-list.png',
          'HV-A5-OS-CORE-S02-entry-marker.png',
        ],
      },
      {
        id: 'HV-A5-OS-CORE-S03',
        testUrl: '{{appBaseUrl}}/agents/{{a5CoreAgentId}}',
        links: [
          {
            label: '缺侧账号的 EA',
            url: '{{appBaseUrl}}/agents/{{a5CoreMissingSideAgentId}}',
          },
        ],
        fixtureRefs: ['a5-core-rich-owner', 'a5-core-missing-side'],
        route: '/agents/:id',
        marker: 'OS.tab-hotseat',
        action:
          '先以「A5 人测·完整发起方」查看面板当前阵营，点击「测试另一侧」或等义换侧操作并核对所选智能体；随后切换「A5 人测·缺侧玩家」，打开上方「缺侧账号的 EA」重开面板并点击同一换侧操作。',
        expected:
          '当前阵营清楚可见；测试另一侧后改为选择对侧智能体；缺少该侧智能体时出现并可点击明确的创建引导。',
        clauseIds: ['U05-C03', 'U05-C04'],
        versionPins: {
          'U05-C03': 'comment-v2:U05-C03',
          'U05-C04': 'baseline:U05-C04',
        },
        screenshotEvidence: [
          'HV-A5-OS-CORE-S03-side-switch.png',
          'HV-A5-OS-CORE-S03-create-other-side.png',
        ],
      },
      {
        id: 'HV-A5-OS-CORE-S04',
        testUrl: '{{appBaseUrl}}/agents/{{a5CoreLockedAgentId}}',
        fixtureRefs: ['a5-core-pvp-locked'],
        route: '/agents/:id',
        marker: 'OS.gate-locked',
        action:
          '切换到「A5 人测·锁定热座」，打开「出战」并点击可见的 PVP/玩家约战 tab；核对锁图标、进度徽章和两侧数值。',
        expected:
          'PVP tab 在锁定时仍可见，内容明确显示锁定和两侧进度；门槛/进度数值来自当前配置，不是固定旧值。',
        clauseIds: ['U05-C06'],
        versionPins: { 'U05-C06': 'baseline:U05-C06' },
        screenshotEvidence: ['HV-A5-OS-CORE-S04-locked-progress.png'],
      },
      {
        id: 'HV-A5-OS-CORE-S05',
        testUrl: '{{appBaseUrl}}/agents/{{a5CoreMobileAgentId}}',
        fixtureRefs: ['a5-core-mobile-overflow'],
        route: '/agents/:id',
        marker: 'OS.panel',
        action:
          '切换到「A5 人测·配额被约方」，把 viewport 设为 390×844，点击「出战」；关闭面板后定位进行中对战条，用触摸或 Shift+滚轮横向滚到最后一张卡。',
        expected:
          '选择对手面板呈现为贴底弹层；对战条可横向滚动到全部卡片，页面本身不产生横向溢出。',
        clauseIds: ['U05-C14'],
        versionPins: { 'U05-C14': 'baseline:U05-C14' },
        screenshotEvidence: [
          'HV-A5-OS-CORE-S05-mobile-sheet.png',
          'HV-A5-OS-CORE-S05-strip-end.png',
        ],
      },
    ],
  }),

  handoffJourney({
    id: 'HV-A5-HOTSEAT-LIFECYCLE',
    n: 'A5.2',
    chapter: 'A5',
    title: '左右手互搏与进行中对战条',
    prerequisites: [
      '按 fixture 卡登录「A5 人测·锁定热座」：PVP 未解锁，但每日总对战仍有至少 1 场余量；同一场景两侧智能体齐全。',
      '操作前记录 battlesToday、pvpBattlesToday、总配额和 PVP 配额；确保没有其他进行中对局。',
      '打开网络记录和屏幕录制。a5HotseatActiveMatchId 不能预填：S01 派发成功后，把落地 /matches/:id 网址粘贴到本步的运行时记录框。',
      '执行顺序为 S01 → S03 → S02：派发后立即取证并在对局仍进行中时完成 S03 观战跳转，最后完成 S02 的完局与 15 分钟到期观察；全程使用 S01 的同一场对局，不另开一场只为观测。步骤 ID 与条款 pin 保持原编号。',
    ],
    evidenceRequirements: [
      '提交指定截图、a5HotseatActiveMatchId、配额前后值和去敏后的派发响应。',
      'S02 另交一段从派发后出现到完局后隐藏的连续录屏或带时间戳截图序列。',
      '记录 tester、执行时间、build SHA 和每一步实际结果。',
    ],
    completion:
      'S01–S03 全部执行并提交证据；任何实现偏差记录为对应 clause 的真人失败。',
    fixtureProfiles: [
      {
        id: 'a5-hotseat',
        label: '测试角色 H · A5 Hotseat 生命周期',
        accountAlias: 'A5 人测·锁定热座',
        readiness: 'ready',
        description:
          '双侧齐全、总配额仍有余量、PVP 未解锁或 PVP 配额不可用；执行前应无其他进行中对局。',
        fields: [
          preparedId(
            'a5HotseatAgentId',
            '可派发左右手互搏的智能体 ID',
            '双侧齐全、每日总对战至少剩 1 场，且操作前没有其他进行中对局。',
          ),
          {
            name: 'a5HotseatActiveMatchId',
            label: 'S01 本轮新派发的对局 ID',
            help:
              '不能预填：完成 S01 后粘贴 /matches/:id 的完整网址或只粘贴 ID，本页会自动提取并解锁后续网址。',
            kind: 'runtime',
            extract: 'matchId',
          },
        ],
      },
    ],
    steps: [
      {
        id: 'HV-A5-HOTSEAT-LIFECYCLE-S01',
        testUrl: '{{appBaseUrl}}/agents/{{a5HotseatAgentId}}',
        fixtureRefs: ['a5-hotseat'],
        captures: [
          {
            variable: 'a5HotseatActiveMatchId',
            label: '派发后记录本轮 activeMatchId',
            placeholder: '粘贴 …/matches/123 或只粘贴 123',
            hint:
              '本值只保存在当前标签会话；填入后 S02/S03 的对局网址会立即变成可点击链接。',
          },
        ],
        route: '/agents/:id',
        marker: 'OS.hotseat-dispatch-button',
        action:
          '点击「出战」→「左右手互搏」，确认双方智能体后点击「自打一场」；派发落地后立即把地址栏中的 /matches/:id 完整网址粘贴到下方记录框，并记录操作前后配额。',
        expected:
          '即使 PVP 门槛未解锁或 PVP 配额不可用也能派发 hotseat；pvpBattlesToday 不增加，battlesToday 恰增加 1。',
        clauseIds: ['U05-C08'],
        versionPins: {
          'U05-C08': 'confirmed-2026-09-06-u05-c08',
        },
        screenshotEvidence: [
          'HV-A5-HOTSEAT-LIFECYCLE-S01-before.png',
          'HV-A5-HOTSEAT-LIFECYCLE-S01-dispatched.png',
          'HV-A5-HOTSEAT-LIFECYCLE-S01-quota-after.png',
        ],
      },
      {
        id: 'HV-A5-HOTSEAT-LIFECYCLE-S03',
        testUrl: '{{appBaseUrl}}/agents/{{a5HotseatAgentId}}/build',
        links: [
          {
            label: '预期观战落点',
            url: '{{appBaseUrl}}/matches/{{a5HotseatActiveMatchId}}',
          },
        ],
        fixtureRefs: ['a5-hotseat'],
        route: '/agents/:id/build',
        marker: 'OS.battle-card',
        action:
          '派发后立即返回工作区，确认 a5HotseatActiveMatchId 卡片立即出现，并同时保留 S02 所需的立即出现证据；在该对局仍进行中时点击横条里的卡片，把实际落地与上方「预期观战落点」比较。先完成本步，再执行 S02 的完局与到期等待。',
        expected:
          '系统打开可观看的 a5HotseatActiveMatchId 对局视图；本条不要求 A5 内出现分享入口。',
        clauseIds: ['U05-C10'],
        versionPins: { 'U05-C10': 'comment-v2:U05-C10' },
        screenshotEvidence: ['HV-A5-HOTSEAT-LIFECYCLE-S03-watch.png'],
      },
      {
        id: 'HV-A5-HOTSEAT-LIFECYCLE-S02',
        testUrl: '{{appBaseUrl}}/agents/{{a5HotseatAgentId}}/build',
        links: [
          { label: '非派发处：场景目录', url: '{{appBaseUrl}}/scenarios' },
          {
            label: '本轮进行中对局',
            url: '{{appBaseUrl}}/matches/{{a5HotseatActiveMatchId}}',
          },
        ],
        fixtureRefs: ['a5-hotseat'],
        route: '/agents/:id/build',
        marker: 'OS.battle-strip',
        action:
          '先核对 S03 阶段采集的「派发后立即出现」证据；返回工作区，定位「进行中的对战」条并点击折叠/展开；打开上方「场景目录」和「本轮进行中对局」核对非派发处与观战落点。对局结束后记录 finishedAt，返回工作区核对「刚完成」卡片；到 finishedAt + 15 分钟后，再等待一次最多 30 秒的轮询，检查是否隐藏空条。',
        expected:
          '横条只在派发相关区域出现；派发后立即包含本人发起且仍进行中的 a5HotseatActiveMatchId，也保留结束未满 15 分钟的「刚完成」对局，可折叠；非派发处不出现。「0 进行 · 1 刚完成」不是空态，横条应保留。finishedAt + 15 分钟后，最多再等 30 秒轮询；仅在没有进行中对局、也没有未过期的「刚完成」卡片时自动隐藏。后台标签页暂停轮询，回到前台后立即刷新。',
        clauseIds: ['U05-C09', 'U05-C09b'],
        versionPins: {
          'U05-C09': 'baseline:U05-C09',
          'U05-C09b': 'comment-v2:U05-C09b',
        },
        screenshotEvidence: [
          'HV-A5-HOTSEAT-LIFECYCLE-S02-expanded.png',
          'HV-A5-HOTSEAT-LIFECYCLE-S02-collapsed.png',
          'HV-A5-HOTSEAT-LIFECYCLE-S02-absent.png',
          'HV-A5-HOTSEAT-LIFECYCLE-S02-finished-hidden.png',
        ],
      },
    ],
  }),

  handoffJourney({
    id: 'HV-A5-PVP-BOUNDARIES',
    n: 'A5.3',
    chapter: 'A5',
    title: 'PVP 单场约战、积分边界与被约方通知',
    prerequisites: [
      '旧 N/N 次数负例已由积分规则取代，S01 保持 blocked；不要为旧负例消耗对局。{{a5PvpExhaustedOpponentVersionId}} 仅为历史预留引用。',
      '「A5 人测·完整发起方」与「A5 人测·配额被约方」在同一场景两侧智能体齐全；测试当天先完成双方 PVP 解锁，每侧显式标记一个参赛版本，成功约战时显式选择 {{a5PvpOpponentVersionId}}。',
      '「A5 人测·配额被约方」保持另一个浏览器会话并打开通知页；两边都打开网络记录，记录环境 URL 与 build SHA。',
    ],
    evidenceRequirements: [
      '提交指定截图，以及两次操作前后的对局/队列数量和去敏网络响应。',
      'S02 使用显式版本选择并只判断无需同意与通知，不记录 U05-C11/U05-C12 的冲突默认值；不得提交账号密码或令牌。',
      '记录 tester、执行时间、build SHA 和每一步实际结果。',
    ],
    completion:
      'S01 记录旧次数条款已被取代，不计为当前通过；S02 提交本轮单场约战通知证据，等待同意或没有通知则标记失败。',
    fixtureProfiles: [
      {
        id: 'a5-pvp-exhausted',
        label: '测试角色 I · A5 PVP 已触顶',
        accountAlias: 'A5 人测·配额被约方',
        readiness: 'refresh-required',
        description:
          '旧每日次数负例已停用；该账号不代表当前积分不足，S01 保持 blocked。',
        fields: [
          preparedId(
            'a5PvpExhaustedAgentId',
            '旧每日次数负例的发起智能体 ID',
            '必须已解锁 PVP，且执行前后都要核对队列与对局基线。',
          ),
          preparedId(
            'a5PvpExhaustedOpponentVersionId',
            '触顶负例使用的有效对手版本 ID',
            '历史预留版本；不得据此声称已准备好当前积分不足状态。',
          ),
        ],
      },
      {
        id: 'a5-pvp-challenger',
        label: '测试角色 J · A5 成功约战发起方',
        accountAlias: 'A5 人测·完整发起方',
        readiness: 'refresh-required',
        description:
          '与被约方在同一场景、两侧齐全且版本 ID 已预置；测试当天先完成 PVP 解锁，再显式选择双方版本。',
        fields: [
          preparedId(
            'a5PvpChallengerAgentId',
            '成功约战发起方智能体 ID',
            '发起方双侧齐全并已解锁 PVP。',
          ),
          preparedId(
            'a5PvpOpponentVersionId',
            '成功约战被约方版本 ID',
            '在面板内显式选择；不以默认版本行为判定本步。',
          ),
        ],
      },
      {
        id: 'a5-pvp-invitee',
        label: '测试角色 K · A5 被约方通知会话',
        accountAlias: 'A5 人测·配额被约方',
        readiness: 'ready',
        description:
          '在另一个浏览器会话登录；与触顶负例复用 axiia-cup-product 群账号包中的同一账号，无需填写公开业务 ID，直接打开通知页。',
        fields: [],
      },
    ],
    steps: [
      {
        id: 'HV-A5-PVP-BOUNDARIES-S01',
        testUrl: '{{appBaseUrl}}/agents/{{a5PvpExhaustedAgentId}}',
        links: [
          { label: '操作前后对局列表', url: '{{appBaseUrl}}/matches' },
        ],
        fixtureRefs: ['a5-pvp-exhausted'],
        route: '/agents/:id',
        marker: 'OS.challenge-button',
        action:
          '本步骤原每日次数验收已过时，请先阅读下方规则变更说明；不要继续消耗对局尝试达到 N/N。 原预留对手版本 {{a5PvpExhaustedOpponentVersionId}} 不能证明当前积分不足，不据此派发。',
        expected:
          '旧次数条款保持 blocked，不因当前积分系统允许继续派发而判为产品失败。',
        knownGap: {
          'title': '旧每日次数条款已由积分规则取代',
          'detail':
            '本步骤原版本验证每日总场数／PvP 次数上限。当前服务端以 0 表示这些上限已退役，不能继续按 N/N 准备账号或判定失败。',
          'instruction':
            '保留本步骤的原版本与既有评审，不对旧条款写入当前通过结果。当前余额不足应按奖励规格 U18-C24/C32/C33 使用独立积分 fixture 验证；本步等待替代条款与账号准备。',
        },
        clauseIds: ['U03-C11'],
        versionPins: {
          'U03-C11': 'confirmed-2026-09-06-u03-c11',
        },
        screenshotEvidence: [
          'HV-A5-PVP-BOUNDARIES-S01-copy.png',
          'HV-A5-PVP-BOUNDARIES-S01-no-new-match.png',
        ],
      },
      {
        id: 'HV-A5-PVP-BOUNDARIES-S02',
        testUrl: '{{appBaseUrl}}/agents/{{a5PvpChallengerAgentId}}',
        links: [
          { label: '被约方通知页', url: '{{appBaseUrl}}/notifications' },
        ],
        fixtureRefs: ['a5-pvp-challenger', 'a5-pvp-invitee'],
        route: '/agents/:id',
        marker: 'OS.challenge-button',
        action:
          '切换到「A5 人测·完整发起方」，在「玩家约战」显式选择双方版本（被约方选择 {{a5PvpOpponentVersionId}}）后发起友谊约战；不要评价默认版本选择。「A5 人测·配额被约方」的独立会话不做同意操作，直接打开上方通知页并检查是否有拒绝/取消入口。',
        expected:
          '约战无需被约方同意即可派发，被约方收到约战通知，且没有可拒绝已派发约战的入口；本步不判断创建几场或默认采用哪个版本。',
        clauseIds: ['U05-C13'],
        versionPins: { 'U05-C13': 'baseline:U05-C13' },
        screenshotEvidence: [
          'HV-A5-PVP-BOUNDARIES-S02-dispatched-without-consent.png',
          'HV-A5-PVP-BOUNDARIES-S02-notification.png',
        ],
      },
    ],
  }),
]
