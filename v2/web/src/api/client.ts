import type {
  AgentRefResponse,
  AgentVersionDTO,
  ArchivedAgentsResponse,
  BindPhoneRequest,
  ChallengeResponse,
  ChangePasswordRequest,
  ClaimRewardResponse,
  ConfigResponse,
  CreateAgentRequest,
  CreateChallengeRequest,
  CreateRegistrationCodeRequest,
  CreateScriptRequest,
  DispatchPVERequest,
  DispatchPVPRequest,
  DispatchResponse,
  DraftResponse,
  ElevateRequest,
  EnsureAgentRequest,
  ErrorResponse,
  FieldMutationRequest,
  LandingResponse,
  LoginRequest,
  MatchDetail,
  MatchListResponse,
  MatchRewardResponse,
  MeResponse,
  ModelListResponse,
  MyAgentsResponse,
  NotificationsResponse,
  NPCProfileResponse,
  OKResponse,
  OpponentListResponse,
  PhoneCodeSentResponse,
  PhoneVerifyRequest,
  PublicAgentResponse,
  RenameAgentRequest,
  RewardQuoteResponse,
  RewardsResponse,
  SaveVersionRequest,
  ScenarioDetail,
  ScenarioListResponse,
  ScriptRefResponse,
  ScriptResponse,
  SendPhoneCodeRequest,
  Side,
  SignupRequest,
  SlotListResponse,
  StandingsResponse,
  TournamentListResponse,
  UpdateProfileRequest,
  UpdateSlotRequest,
  VersionDiffResponse,
  VersionListResponse,
  VersionRefResponse,
} from './types'
import { retryAfterSeconds } from '../lib/cooldown'
import { refreshRewards } from '../lib/reward-events'
import {
  invalidateNavigation,
  navigationEpoch,
  navigationReadEpoch,
} from '../lib/navigation-cache'

// Same-origin by design (plan §6): the SPA is served from the Swift origin (dev:
// via the vite `/v1` proxy) so the HttpOnly cookie and CSRF Sec-Fetch-Site gate
// work with zero auth code in JS. `credentials: 'include'` sends the cookie; the
// browser stamps Sec-Fetch-Site itself. Web code never builds an auth header.
const API_ROOT =
  (import.meta.env.VITE_API_ROOT as string | undefined)?.replace(/\/$/, '') ??
    ''

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly retryAfter: number | null

  constructor(
    message: string,
    status: number,
    code: string,
    retryAfter: number | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }

  get isUnauthorized() {
    return this.status === 401
  }
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    'message' in value
  )
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

async function performRequest<T>(
  method: Method,
  path: string,
  body?: unknown,
  options?: Pick<RequestInit, 'keepalive' | 'credentials' | 'signal'>,
): Promise<T> {
  const epoch = navigationEpoch()
  const headers = new Headers()
  const init: RequestInit = {
    method,
    credentials: options?.credentials ?? 'include',
    headers,
    keepalive: options?.keepalive,
    signal: options?.signal,
  }
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
    init.body = JSON.stringify(body)
  }

  const response = await fetch(`${API_ROOT}/v1${path}`, init)
  const text = await response.text()
  // Not every response is JSON: the CSRF refusal and encode-failure fallbacks are
  // plain text, and a dead proxy answers HTML. Never let JSON.parse mask the real
  // status with a SyntaxError.
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    if (isErrorResponse(payload)) {
      throw new ApiError(
        payload.message,
        response.status,
        payload.error,
        retryAfterSeconds(response.headers),
      )
    }
    throw new ApiError(
      text || '请求失败',
      response.status,
      'unknown',
      retryAfterSeconds(response.headers),
    )
  }

  if (method !== 'GET' && epoch === navigationEpoch()) {
    invalidateNavigation(path)
  }
  return (payload ?? {}) as T
}

// Coalesce concurrent GETs, including StrictMode and auxiliary consumers. An
// explicitly abortable request keeps its own lifetime. No response cache here.
const pendingReads = new Map<string, Promise<unknown>>()
function request<T>(
  method: Method,
  path: string,
  body?: unknown,
  options?: Pick<RequestInit, 'keepalive' | 'credentials' | 'signal'>,
): Promise<T> {
  if (method !== 'GET' || options?.signal) {
    return performRequest<T>(method, path, body, options)
  }
  const key = `${navigationReadEpoch()}:${
    options?.credentials ?? 'include'
  }:${path}`
  const existing = pendingReads.get(key)
  if (existing) return existing as Promise<T>
  const promise = performRequest<T>(method, path, body, options).finally(() => {
    if (pendingReads.get(key) === promise) pendingReads.delete(key)
  })
  pendingReads.set(key, promise)
  return promise
}

// ── Auth ────────────────────────────────────────────────────────────────────

export const auth = {
  signup: (input: SignupRequest) =>
    request<MeResponse>('POST', '/auth/signup', input),
  login: (input: LoginRequest) =>
    request<MeResponse>('POST', '/auth/login', input),
  logout: () => request<OKResponse>('POST', '/auth/logout'),
  me: () => request<MeResponse>('GET', '/auth/me'),
  elevate: (input: ElevateRequest) =>
    request<MeResponse>('POST', '/auth/elevate', input),
  // 手机号验证码登录/注册：一条路两用——号码已注册就是登录，没注册就带注册码
  // 当场开号（verify 时才要昵称）。verify 答完整 me 并下发会话 cookie，与
  // /auth/login 同形，所以两条路都经 AuthProvider 落账号态。
  sendPhoneCode: (input: SendPhoneCodeRequest) =>
    request<PhoneCodeSentResponse>('POST', '/auth/sms/code', input),
  verifyPhone: (input: PhoneVerifyRequest) =>
    request<MeResponse>('POST', '/auth/sms/verify', input),
  // 绑定（settings 页）：两个端点都要已登录会话，答完整 me。
  sendBindCode: (input: SendPhoneCodeRequest) =>
    request<PhoneCodeSentResponse>('POST', '/auth/phone/code', input),
  bindPhone: (input: BindPhoneRequest) =>
    request<MeResponse>('POST', '/auth/phone/bind', input),
  // 账户自助（settings 页）：改昵称答完整 me，SPA 直接 setAccount 而不再拉
  // /auth/me；改密成功后本会话保持有效、其他会话被服务端吊销。
  updateProfile: (input: UpdateProfileRequest) =>
    request<MeResponse>('PATCH', '/account/profile', input),
  changePassword: (input: ChangePasswordRequest) =>
    request<OKResponse>('POST', '/account/password', input),
}

// ── Catalog ─────────────────────────────────────────────────────────────────

export const catalog = {
  scenarios: (options?: Pick<RequestInit, 'credentials'>) =>
    request<ScenarioListResponse>('GET', '/scenarios', undefined, options),
  scenario: (
    id: string,
    side: Side,
    options?: Pick<RequestInit, 'credentials' | 'signal'>,
  ) =>
    request<ScenarioDetail>(
      'GET',
      `/scenarios/${encodeURIComponent(id)}?side=${side}`,
      undefined,
      options,
    ),
  models: () => request<ModelListResponse>('GET', '/models'),
  opponents: (id: string, side: Side) =>
    request<OpponentListResponse>(
      'GET',
      `/scenarios/${encodeURIComponent(id)}/opponents?side=${side}`,
    ),
}

// ── Config & inventory (P2) ─────────────────────────────────────────────────

// B1 公开落地页素材（免鉴权）：真实对局节选 / 示范对局 / 顶尖玩家 / 总对战数。
export const landing = {
  get: () => request<LandingResponse>('GET', '/landing'),
}

export const config = {
  // §C2 read-only projection: quotas, gate threshold, models, trials switch,
  // plus the caller's usage. Callers must degrade gracefully on failure.
  get: (options?: Pick<RequestInit, 'signal'>) =>
    request<ConfigResponse>('GET', '/config', undefined, options),
}

export const myAgents = {
  archived: () => request<ArchivedAgentsResponse>('GET', '/my/archived-agents'),
  // Cross-scenario inventory of the caller's agents (#64/#58).
  list: () => request<MyAgentsResponse>('GET', '/my/agents'),
}

// ── Agents（多槽位，#56/#84） ────────────────────────────────────────────────

export const agents = {
  history: (agentID: number, versionID: number, before?: number) =>
    request<MatchListResponse>(
      'GET',
      `/agents/${agentID}/matches?versionID=${versionID}&limit=20${
        before == null ? '' : `&before=${before}`
      }`,
    ),
  archive: (agentID: number) =>
    request<OKResponse>('PUT', `/agents/${agentID}/archive`),
  restore: (agentID: number) =>
    request<OKResponse>('DELETE', `/agents/${agentID}/archive`),
  // P2 改名：空名＝清除，展示名回落「侧名 #id」。老服务器无此端点 → 404/405。
  rename: (agentID: number, input: RenameAgentRequest) =>
    request<OKResponse>('PATCH', `/agents/${agentID}`, input),
  // P8b 删除：仅 0 版本策略；有版本的服务端答 agent_not_empty。
  remove: (agentID: number) =>
    request<OKResponse>('DELETE', `/agents/${agentID}`),
  // E4 复制为新智能体：在同场景同侧另建一个 agent（受 #59 引导门，错误码
  // sibling_gate 走 lib/reject-copy）。后端批次未上线时答 404/405，调用方
  // 就地降级文案、按钮保留。
  create: (input: CreateAgentRequest) =>
    request<AgentRefResponse>('POST', '/agents', input),
}

export const npcs = {
  profile: (scenarioID: string, key: string) =>
    request<NPCProfileResponse>(
      'GET',
      `/scenarios/${encodeURIComponent(scenarioID)}/npcs/${
        encodeURIComponent(key)
      }`,
    ),
  history: (scenarioID: string, key: string, before?: number) =>
    request<MatchListResponse>(
      'GET',
      `/scenarios/${encodeURIComponent(scenarioID)}/npcs/${
        encodeURIComponent(key)
      }/matches?limit=20${before == null ? '' : `&before=${before}`}`,
    ),
}

// ── Builder ─────────────────────────────────────────────────────────────────

export const builder = {
  ensure: (input: EnsureAgentRequest) =>
    request<AgentRefResponse>('POST', '/agents/ensure', input),
  mutate: (
    agentID: number,
    input: FieldMutationRequest,
    options?: Pick<RequestInit, 'keepalive'>,
  ) => request<OKResponse>('POST', `/agents/${agentID}/mutate`, input, options),
  save: (agentID: number, input: SaveVersionRequest) =>
    request<AgentVersionDTO>('POST', `/agents/${agentID}/save`, input),
  draft: (agentID: number) =>
    request<DraftResponse>('GET', `/agents/${agentID}/draft`),
  // #35 公开视图：任何登录玩家都能看别人的智能体身份与逐版本战绩（提示词永不
  // 在内——响应类型里就没有这个字段）。老服务器无此端点 → 404/405，调用方降级。
  public: (agentID: number) =>
    request<PublicAgentResponse>('GET', `/agents/${agentID}/public`),
  versions: (agentID: number) =>
    request<VersionListResponse>('GET', `/agents/${agentID}/versions`),
  setEntry: (agentID: number, versionID: number) =>
    request<OKResponse>('POST', `/agents/${agentID}/entry/${versionID}`),
  diff: (agentID: number, base: number, head: number) =>
    request<VersionDiffResponse>(
      'GET',
      `/agents/${agentID}/diff?base=${base}&head=${head}`,
    ),
}

// ── Matches ─────────────────────────────────────────────────────────────────

export const matches = {
  dispatchPVE: (
    input: DispatchPVERequest,
    options?: Pick<RequestInit, 'signal'>,
  ) =>
    request<DispatchResponse>('POST', '/matches/pve', input, options).finally(
      refreshRewards,
    ),
  dispatchPVP: (input: DispatchPVPRequest) =>
    request<DispatchResponse>('POST', '/matches/pvp', input).finally(
      refreshRewards,
    ),
  list: () => request<MatchListResponse>('GET', '/matches'),
  detail: (id: number) => request<MatchDetail>('GET', `/matches/${id}`),
}

// ── Challenges（P3 #66） ────────────────────────────────────────────────────

export const challenges = {
  create: (input: CreateChallengeRequest) =>
    request<ChallengeResponse>('POST', '/challenges', input).finally(
      refreshRewards,
    ),
}

export const rewards = {
  get: () => request<RewardsResponse>('GET', '/rewards'),
  quote: (scenarioID: string, side: string, kind: string) =>
    request<RewardQuoteResponse>(
      'GET',
      `/rewards/quote?${new URLSearchParams({ scenarioID, side, kind })}`,
    ),
  match: (matchID: number) =>
    request<MatchRewardResponse>('GET', `/rewards/matches/${matchID}`),
  claim: (matchID: number) =>
    request<ClaimRewardResponse>('POST', `/rewards/matches/${matchID}/claim`),
}

export const versions = {
  // #25/#62 按 id 约战的解析读：版本 id → {玩家/场景/侧/模型}；不存在 → 404
  // not_found；老服务器无此端点，同样按降级处理。
  ref: (id: number, signal?: AbortSignal) =>
    request<VersionRefResponse>('GET', `/versions/${id}/ref`, undefined, {
      signal,
    }),
}

// ── Notifications ───────────────────────────────────────────────────────────

export const notifications = {
  list: () => request<NotificationsResponse>('GET', '/notifications'),
  markRead: (id: number) =>
    request<OKResponse>('POST', `/notifications/${id}/read`),
  // G25 批量动作：两个都按调用者本人圈定，无 id 可漏。老服务器 404 → 调用方
  // 就地提示，不影响逐条已读。
  readAll: () => request<OKResponse>('POST', '/notifications/read-all'),
  clear: () => request<OKResponse>('DELETE', '/notifications'),
}

// ── Tournaments ─────────────────────────────────────────────────────────────

export const tournaments = {
  list: () => request<TournamentListResponse>('GET', '/tournaments'),
  standings: (id: number) =>
    request<StandingsResponse>('GET', `/tournaments/${id}/standings`),
}

// ── Admin ───────────────────────────────────────────────────────────────────

export const admin = {
  createRegistrationCode: (input: CreateRegistrationCodeRequest) =>
    request<OKResponse>('POST', '/admin/registration-codes', input),
  // Scripts are content-addressed: uploading the same source twice returns the
  // same sha and writes nothing.
  createScript: (input: CreateScriptRequest) =>
    request<ScriptRefResponse>('POST', '/admin/scripts', input),
  script: (sha: string) =>
    request<ScriptResponse>('GET', `/admin/scripts/${encodeURIComponent(sha)}`),
  slots: () => request<SlotListResponse>('GET', '/admin/slots'),
  updateSlot: (id: string, input: UpdateSlotRequest) =>
    request<OKResponse>(
      'PATCH',
      `/admin/slots/${encodeURIComponent(id)}`,
      input,
    ),
}

// ── SSE ─────────────────────────────────────────────────────────────────────

// EventSource rides the same-origin HttpOnly cookie automatically — the whole
// reason auth is cookie-based (Safari EventSource cannot carry an Authorization
// header). Frames are unnamed (data: only); callers JSON-parse and discriminate on
// the single object key.

export function sseUrl(path: string): string {
  return `${API_ROOT}/v1${path}`
}
