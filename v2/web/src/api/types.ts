// Hand-written mirror of the Swift AxiiaContract target (packages/axiia/Targets/
// AxiiaContract). Wire keys are the verbatim Swift property names — no snake_case,
// no CodingKeys renames. Swift Optionals encode as absent keys, so every optional
// tolerates both `undefined` and `null`. TS emission from the Swift contract is a
// queued follow-up; keep this the single source module so the generated file drops
// in here unchanged.

export type Side = 'a' | 'b'

// Server-owned points: the browser never derives balances or eligibility.
export interface RewardsResponse {
  balance: number
  dailyAllowance: number
  battleCost: number
  dailyRuns: number
  pveWinRefundPercent: number
  pvpWinRefundPercent: number
  pointsPerYuan: number
  nextGrantAt: number
  claimableRewards: { matchID: number; points: number; kind: 'pve' | 'pvp' }[]
}

export interface RewardQuoteResponse {
  cost: number
  perBattleCost: number
  repeatRoleSurcharge: boolean
  battleCosts: number[]
}

export interface MatchRewardResponse {
  matchID: number
  points: number
  status: 'pending' | 'claimable' | 'claimed' | 'ineligible'
  kind?: 'pve' | 'pvp' | 'hotseat' | null
}

export interface ClaimRewardResponse {
  matchID: number
  creditedPoints: number
  alreadyClaimed: boolean
  balance: number
}

// ── AccountDTOs ─────────────────────────────────────────────────────────────

export interface SignupRequest {
  code: string
  email?: string | null
  phone?: string | null
  password: string
  displayName: string
}

export interface LoginRequest {
  email: string
  password: string
}

// 短信验证码族（POST /v1/auth/sms/code · /v1/auth/sms/verify ·
// /v1/auth/phone/code · /v1/auth/phone/bind）。注册码只在「该号未注册」时
// 需要，服务端先验后扣：发码时校验、verify 时才真正消耗。
export interface SendPhoneCodeRequest {
  phone: string
  inviteCode?: string | null
}

// registered 决定下一屏是否要昵称——服务端已经用「登录发码不要注册码、注册
// 发码没有注册码就拒」把这个事实泄露出去了，响应里明说更省一次试探。
export interface PhoneCodeSentResponse {
  registered: boolean
}

export interface PhoneVerifyRequest {
  phone: string
  code: string
  displayName?: string | null
}

export interface BindPhoneRequest {
  phone: string
  code: string
}

export interface ElevateRequest {
  code: string
}

// PATCH /v1/account/profile：服务端 trim 后要求 1–50 字符，越界答
// invalid_display_name；成功答完整 MeResponse（同 /v1/auth/me）。
export interface UpdateProfileRequest {
  displayName: string
}

// POST /v1/account/password：先节流（同登录护栏，key 为 pwchange:<uid>），
// 再验当前密码（错 → invalid_credentials），新密码 <8 位 → weak_password。
// 成功后服务端吊销本人其他会话，本会话保持有效；答 OKResponse。
export interface ChangePasswordRequest {
  current: string
  new: string
}

export interface AccountDTO {
  id: string
  email?: string | null
  phone?: string | null
  displayName: string
  isAdmin: boolean
  hasTOTP: boolean
}

export interface MeResponse {
  account: AccountDTO
  elevated: boolean
  // A3/#12：是否完成过自己发起的对局（派生，服务端算）。P5 才消费；老服务
  // 器缺席 → undefined，当 false 用。
  firstBattleDone?: boolean
}

// ── CatalogDTOs ─────────────────────────────────────────────────────────────

export interface ScenarioSummary {
  id: string
  title: string
  subject: string
  sideAName: string
  sideBName: string
  sideALabel: string
  sideBLabel: string
  turnCount: number
  // #65: true only when BOTH sides meet the per-side trial threshold.
  gateUnlocked: boolean
  // Additive (G12): per-side progress toward that threshold; absent on a
  // pre-P2 server.
  gateProgress?: GateProgressDTO | null
  // #38/#39：只在达到展示门槛时出现——低于门槛服务端整个省略 key，前端
  // 不可能误显示小样本胜率；老服务器同样缺席。
  stats?: ScenarioStatsDTO | null
  // #54：场景槽位上线的 epoch 秒，「新上线」徽章的依据。
  onlineAt?: number | null
  // Optional public scenario metadata; older scripts may omit each field.
  difficulty?: 'easy' | 'medium' | 'hard' | null
  beginnerFriendly?: boolean | null
  estimatedMinutes?: number | null
}

export interface SideWinRateDTO {
  a: number
  b: number
}

// 计分口径（#38）：每场计 1、含 PVE，只数已计分对局。
export interface ScenarioStatsDTO {
  battleCount: number
  sideWinRate: SideWinRateDTO
}

export interface ChannelDTO {
  id: string
  label: string
}

// The generic presentation unit: the transcript is grouped by stage and channel
// without the SPA knowing any scenario.
export interface StageDTO {
  id: string
  title: string
  channels: ChannelDTO[]
}

export interface PresetOpponentDTO {
  key: string
  side: string
  label: string
  modelID: string
  // The scenario-private blob this bot is cast with; opaque to the server, and
  // absent on a scenario whose presets declare none.
  options?: JSONValue | string | null
}

export interface ScenarioDetail {
  summary: ScenarioSummary
  stages: StageDTO[]
  presets: PresetOpponentDTO[]
  scoring?: ScenarioScoringDTO | null
}

// Explicit public script metadata, including exact weights; absent on older
// scripts. Item names/count and notes are scenario-specific.
export interface ScenarioScoringDTO {
  summary: string
  items: { id: string; label: string; points: number }[]
  notes?: string[]
}

export interface ScenarioListResponse {
  scenarios: ScenarioSummary[]
}

export interface ModelDTO {
  id: string
  label: string
}

export interface ModelListResponse {
  models: ModelDTO[]
}

// A fieldable opponent agent for friendly PVP; `isSelf` marks your own
// opposite-side agent, which makes the match a hotseat.
export interface OpponentAgentDTO {
  agentID: number
  displayName: string
  isSelf: boolean
  // P6 多智能体：所有者给这个 agent 起的可选名字。
  name?: string | null
  // #66：所有者账号 id——按玩家约战的目标；老服务器缺席。
  ownerAccountID?: string | null
}

export interface OpponentListResponse {
  opponents: OpponentAgentDTO[]
}

// ── ConfigDTOs ──────────────────────────────────────────────────────────────

// The read-only client projection behind GET /v1/config (RFC §5 P2).
export interface ConfigResponse {
  dailyBattleLimit: number
  pvpDailyLimit: number
  concurrencyLimit: number
  // Per-side threshold (#65): distinct presets to beat on EACH side for pvp.
  pvpUnlockPerSideWins: number
  promptUnitLimit: number
  expressPreset?: ExpressPresetDTO | null
  // The same list GET /v1/models serves.
  models: ModelDTO[]
  opponentDailyChallengeLimit: number
  trialsBlocked: boolean
  usage: UsageDTO
}

export interface ExpressPresetDTO {
  scenarioID: string
  side: string
  presetKey: string
}

// The calling user's consumption against the daily quotas (UTC+8 day, R16).
export interface UsageDTO {
  battlesToday: number
  pvpBattlesToday: number
}

// Per-side trial progress (G12/#65): distinct presets beaten vs the threshold.
export interface GateSideProgressDTO {
  beaten: number
  needed: number
}

export interface GateProgressDTO {
  a: GateSideProgressDTO
  b: GateSideProgressDTO
}

// One of the caller's agents in the GET /v1/my/agents inventory. Names arrive
// in P6; until then an agent is identified by its scenario/side position.
export interface MyAgentDTO {
  isArchived?: boolean
  agentID: number
  versionCount: number
  entryVersionID?: number | null
  latestVersionID?: number | null
  // #63 自起名（P6 起）；老服务器缺席。
  name?: string | null
  // P1a：最近一次保存或草稿暂存的时间——多策略并存时用来认出「上次在改哪个」。
  lastEditedAt?: number
}

// A side with no agent yet is an empty array, never an absent key.
export interface SideAgentsDTO {
  a: MyAgentDTO[]
  b: MyAgentDTO[]
}

export interface MyAgentsScenarioDTO {
  scenarioID: string
  title: string
  sides: SideAgentsDTO
  gateProgress: GateProgressDTO
  // #58: both sides hold an entry-flagged version.
  entryReady: boolean
}

export interface MyAgentsResponse {
  scenarios: MyAgentsScenarioDTO[]
}

// ── SubmissionDTOs (builder) ────────────────────────────────────────────────

export interface EnsureAgentRequest {
  scenarioID: string
  side: string
}

// E4「复制为新智能体」（#84）的落点：POST /v1/agents 总是在同场景同侧新建
// 一个 agent（从 v1 开始），受 #59/#79 引导门约束——与 ensure 的 get-or-create
// 语义不同。`name` 随 P6 命名批次启用，当前可省略。
export interface CreateAgentRequest {
  scenarioID: string
  side: string
  name?: string | null
}

export interface AgentRefResponse {
  agentID: number
}

// GET /v1/versions/:id/ref（P3 #25/#62）：任意可见版本 id 的公开身份——玩家/
// 场景/侧/模型，够钉一次约战，永远不含提示词。
export interface VersionRefResponse {
  versionID: number
  agentID: number
  side: string
  scenarioID: string
  ownerAccountID: string
  ownerDisplayName: string
  modelID: string
}

export interface FieldMutationRequest {
  field: string
  value: string
}

// `options` is a JSON-encoded string the server stores and hands back to the
// script untouched; its vocabulary is the scenario's own (see src/scenarios).
// Omitting it is always valid, and a scenario the SPA has no module for never
// sends it.
export interface RenameAgentRequest {
  name?: string | null
}

export interface SaveVersionRequest {
  prompt: string
  modelID: string
  parentVersionID?: number | null
  options?: string | null
  // 初始化来源佐证（#83）：'raw' | 'mcq' | 'builder'（元提示词）。文本仍是唯一事实源。
  method?: string | null
  // P10：保存时可选填，写一次不再改。
  note?: string | null
}

export interface AgentVersionDTO {
  id: number
  agentID: number
  prompt: string
  modelID: string
  parentVersionID?: number | null
  isEntry: boolean
  // E2/#82：线性版本号（v1 → v2 → … → vN），服务端按 id 次序派生。要显示版本号
  // 只能读这个；服务端还没带上时（部署错位）由 lib/version-label 按 id 次序补。
  ordinal?: number
  // 草稿自动暂存水位（服务端脏检测用），不是版本号——永远不要渲染它。
  snapshotSeq: number
  options?: string | null
  // P10（E5 承诺过）：备注与保存时间是版本身份的一部分。老服务器缺席。
  note?: string | null
  createdAt?: number
  // P15（B3 承诺过）：该版本自己的战绩——玩家据此决定 ★ 给哪一版。
  matchCount?: number
  winCount?: number
  drawCount?: number
  lossCount?: number
}

export interface DraftResponse {
  fields: Record<string, string>
  scenarioID: string
  side: Side
}

export interface VersionListResponse {
  versions: AgentVersionDTO[]
  entryVersionID?: number | null
}

export interface VersionDiffResponse {
  base: AgentVersionDTO
  head: AgentVersionDTO
}

// Swift enum with associated values → single-key discriminated object.
export type BuilderEventDTO =
  | {
    fieldMutated: {
      agentID: number
      field: string
      value: string
      seq: number
    }
  }
  | { versionCreated: { agentID: number; versionID: number } }

// ── MatchDTOs ───────────────────────────────────────────────────────────────

export interface DispatchPVERequest {
  versionID: number
  presetKey: string
}

export interface DispatchPVPRequest {
  versionID: number
  opponentAgentID: number
}

export interface DispatchResponse {
  matchID: number
}

// POST /v1/challenges: mine contains exactly one side, matching the selected agent.
export interface ChallengeSideRef {
  versionID: number
}

export interface ChallengeMineRequest {
  a?: ChallengeSideRef | null
  b?: ChallengeSideRef | null
}

export interface ChallengeOpponentRequest {
  accountID?: string | null
  pinnedVersionID?: number | null
}

export interface CreateChallengeRequest {
  scenarioID: string
  mine: ChallengeMineRequest
  opponent: ChallengeOpponentRequest
}

// Each new challenge returns one match ID.
export interface ChallengeResponse {
  challengeID: number
  matchIDs: number[]
}

export type TurnKind = 'dialogue' | 'event'

// Any JSON the script emitted; the emit vocabulary is per-scenario content.
export type JSONValue =
  | null
  | boolean
  | number
  | string
  | JSONValue[]
  | { [key: string]: JSONValue }

// One ordered timeline row. `dialogue` carries speech in `finalText` with the
// model trace in `reasoning`; `event` carries the script's `game.emit` payload in
// `event` and leaves `finalText` empty.
export interface TurnDTO {
  seq: number
  channel: string
  kind: TurnKind
  speaker: string
  finalText: string
  reasoning?: string | null
  event?: JSONValue | null
  promptTokens?: number | null
  completionTokens?: number | null
  cost?: number | null
  ttftMs?: number | null
  finishReason?: string | null
}

// 一侧参战方（G20，viewer 过滤）：`isMine` 只对请求者本人计算，从不复述他人
// 的所有权；提示词永不出现。预设侧带 presetKey（+模型）；版本侧带对手钉约战
// （P3）所需的版本/agent/玩家名引用。
export interface MatchParticipantDTO {
  agentID?: number | null
  versionID?: number | null
  presetKey?: string | null
  ownerDisplayName?: string | null
  modelID?: string | null
  isMine: boolean
}

export interface MatchParticipantsDTO {
  a: MatchParticipantDTO
  b: MatchParticipantDTO
}

// P3 新增字段全部 additive：老服务器缺席时按 P1/P2 行为渲染。
// `createdAt`/`finishedAt` 是 epoch 秒；`challengeID` 标识约战，只有历史双场
// 记录有 `challengeLeg`；新约战为单场。`initiatorIsMe` 按观众视角计算。
export interface MatchSummary {
  id: number
  scenarioID: string
  scenarioTitle: string
  kind: string
  dispatched: boolean
  finished: boolean
  scored: boolean
  winner?: string | null
  participants?: MatchParticipantsDTO | null
  createdAt?: number | null
  finishedAt?: number | null
  challengeID?: number | null
  challengeLeg?: number | null
  initiatorIsMe?: boolean
}

// `output` is the program validator's normalized JSON, carried as a string.
// `afterSeq` is the transcript position it settled at: it was decided on the
// first `afterSeq` committed rows, so it belongs after them in the timeline.
export interface VerdictDTO {
  key: string
  afterSeq: number
  output: string
  model: string
}

export interface MatchDetail {
  summary: MatchSummary
  currentTurn: number
  turns: TurnDTO[]
  verdicts: VerdictDTO[]
  scoreA?: number | null
  scoreB?: number | null
  reasoning?: string | null
  error?: string | null
  stages: StageDTO[]
  // Every speaker key this transcript can carry — the two sides under their
  // scenario names, plus each NPC and event speaker.
  speakerLabels: Record<string, string>
}

export interface MatchListResponse {
  matches: MatchSummary[]
  open: boolean
}

// Swift enum with associated values → single-key discriminated object. SSE frames
// carry these unnamed (data: only); discriminate on the key.
export type MatchEventDTO =
  | {
    turnCompleted: {
      matchID: number
      seq: number
      channel: string
      kind: string
    }
  }
  | {
    chunk: {
      matchID: number
      seq: number
      channel: string
      speaker: string
      // 'thinking' | 'text' — the reasoning stream and the speech stream of the
      // same in-flight turn.
      phase: string
      delta: string
      // 'say' | 'act' | 'act_repair' — 外层生成型别。act 的 text 流里带结构化
      // 标签（#22），渲染前要剥；老服务端不带这个字段。
      call?: string
    }
  }
  | { verdictRecorded: { matchID: number; key: string } }
  | { matchFinished: { matchID: number; winner: string } }
  | { matchFailed: { matchID: number } }

// ── EngagementDTOs ──────────────────────────────────────────────────────────

export interface TournamentRoundDTO {
  id: number
  roundNumber: number
  status: string
  // 'qualifier' = 海选，'main' = 正赛。
  phase: string
}

export interface TournamentSummary {
  id: number
  scenarioID: string
  status: string
  currentRound: number
  totalRounds: number
  // 最新一轮所属阶段；还没开轮时缺席。老服务器同样缺席，UI 直接不显示徽章。
  phase?: string | null
  // B4「含选择器与按轮时间线」：轮次时间线随列表下发。
  rounds?: TournamentRoundDTO[]
}

export interface TournamentListResponse {
  tournaments: TournamentSummary[]
}

// #64「排名一律按玩家（不按 agent、不按侧）」：一行＝一个人。玩家在一场赛事里
// 通常两侧各投一个版本，`submissionIDs` 保留这些条目供下钻，但名次属于人。
export interface StandingsEntryDTO {
  playerID: string
  playerName: string
  submissionIDs: number[]
  wins: number
  losses: number
  buchholz: number
  matchesPlayed: number
  winRate: number
  rank: number
}

export interface StandingsResponse {
  entries: StandingsEntryDTO[]
}

// `title`/`body` 是服务端渲染好的中文（G25）——客户端只展示、不再拼写；
// 新契约必发，老服务器缺席 → 回落到本地 kind 文案。`link` 是 SPA 路径
// （如 /matches/7），该 kind 无落点时缺席。
export interface NotificationDTO {
  id: number
  kind: string
  matchID?: number | null
  tournamentID?: number | null
  read: boolean
  title?: string
  body?: string
  link?: string | null
}

export interface NotificationsResponse {
  notifications: NotificationDTO[]
  unreadCount: number
}

export interface BellEventDTO {
  unreadCount: number
}

// ── AdminDTOs ───────────────────────────────────────────────────────────────

export interface CreateRegistrationCodeRequest {
  code: string
  uses: number
}

export interface IDResponse {
  id: number
}

export interface OKResponse {
  ok: boolean
}

export interface ErrorResponse {
  error: string
  message: string
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface RefreshTokenResponse {
  accessToken: string
  refreshToken: string
  accessExpiresAt: number
}

// ── ScriptDTOs ──────────────────────────────────────────────────────────────

export interface CreateScriptRequest {
  source: string
}

export interface ScriptRefResponse {
  sha: string
}

export interface ScriptResponse {
  sha: string
  source: string
  createdAt: number
}

export interface SlotDTO {
  id: string
  title: string
  scriptSHA: string
  params: JSONValue
  status: string
}

export interface SlotListResponse {
  slots: SlotDTO[]
}

export interface UpdateSlotRequest {
  scriptSHA?: string | null
  title?: string | null
  params?: JSONValue | null
  status?: string | null
}

// #35 公开视图：别人看你的智能体时能看到的一切——身份 + 逐版本战绩。
// 没有 prompt 字段，也没有 diff：契约层面就不给（#20）。
export interface PublicAgentVersionDTO {
  id: number
  ordinal: number
  isEntry: boolean
  createdAt: number
  matchCount: number
  winCount: number
  drawCount?: number
  lossCount?: number
  modelID?: string
}

export interface NPCProfileResponse {
  scenarioID: string
  scenarioTitle: string
  key: string
  side: Side
  sideName: string
  label: string
  modelID: string
  prompt: string
  versionTag: string
  matchCount: number
  winCount: number
  drawCount: number
  lossCount: number
  challengeCount: number
}

export interface PublicAgentResponse {
  agentID: number
  scenarioID: string
  scenarioTitle: string
  side: string
  sideName: string
  name?: string | null
  ownerName: string
  versions: PublicAgentVersionDTO[]
}

// ── Landing (B1) ────────────────────────────────────────────────────────────
export interface LandingTurnDTO {
  speaker: string
  text: string
}

export interface LandingExcerptDTO {
  matchID: number
  scenarioID: string
  scenarioTitle: string
  turns: LandingTurnDTO[]
}

export interface LandingPlayerDTO {
  displayName: string
  wins: number
}

export interface LandingDemoDTO {
  matchID: number
  scenarioTitle: string
}

export interface LandingResponse {
  totalBattles: number
  topPlayers: LandingPlayerDTO[]
  excerpt?: LandingExcerptDTO | null
  demoMatches: LandingDemoDTO[]
}

export interface ArchivedAgentsResponse {
  agents: {
    agent: MyAgentDTO
    scenarioID: string
    scenarioTitle: string
    sideName: string
  }[]
}
