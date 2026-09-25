import { Dialog } from '@base-ui-components/react/dialog'
import { Lock, Unlock, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  ApiError,
  catalog,
  challenges,
  config as configApi,
  matches,
  versions as versionsApi,
} from '../api/client'
import type {
  AgentVersionDTO,
  ChallengeOpponentRequest,
  ChallengeResponse,
  ConfigResponse,
  OpponentAgentDTO,
  PresetOpponentDTO,
  ScenarioDetail,
  Side,
  VersionRefResponse,
} from '../api/types'
import { gateMet, sideMet, sideProgressText } from '../lib/gate'
import { BattleCostNotice } from './rewards'
import { useBattleQuote } from '../context/rewards'
import { playButtonHover, playSound, unlockAudio } from '../lib/sound'
import { trackSoundMatch } from '../lib/match-sound'
import { challengeRejectCopy, rejectCopy } from '../lib/reject-copy'
import { messageOf } from '../lib/use-async'
import { versionTag } from '../lib/version-label'
import { roleOfOptions, scenarioModule } from '../scenarios'
import { tm } from '../testmode/mark'
import { Badge } from './ui/badge'
import { Button, ButtonLink } from './ui/button'
import { agentEntryUrl } from '../lib/agent-entry'
import { Input } from './ui/input'
import { Select, SelectItem } from './ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

interface OsPanelProps {
  open: boolean
  onClose: () => void
  scenario: ScenarioDetail
  side: Side
  versions: AgentVersionDTO[]
  entryVersionID: number | null
  // #88：从版本卡「出战」呼出时，钉住玩家点的那一版（否则回落 ★ / 最新版）。
  preferVersionID?: number | null
}

export function OsPanel({
  open,
  onClose,
  scenario,
  side,
  versions,
  entryVersionID,
  preferVersionID = null,
}: OsPanelProps) {
  const navigate = useNavigate()
  const liveRef = useRef(true)
  const scenarioID = scenario.summary.id
  const roleModule = scenarioModule(scenarioID)

  const [presetKey, setPresetKey] = useState<string | null>(null)
  // null = 未加载：hotseat 区在拿到对手列表前显示加载态，而非误报空态。
  const [opponents, setOpponents] = useState<OpponentAgentDTO[] | null>(null)
  const [opponentAgentID, setOpponentAgentID] = useState<number | null>(null)
  const [dispatching, setDispatching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 受控 tab：锁定态的「去练习该侧」要能把玩家切回 NPC 练习页签。
  const [tab, setTab] = useState('pve')
  const quoteState = useBattleQuote(
    scenarioID,
    side,
    tab,
    open,
  )
  const insufficientPoints = quoteState.blocked
  // null 双关「未加载」与「加载失败」：两种情况都按无 config 降级渲染。
  const [cfg, setCfg] = useState<ConfigResponse | null>(null)
  const configRequestRef = useRef(0)

  const [pvpMode, setPvpMode] = useState<'players' | 'byid'>('players')
  const [idInput, setIdInput] = useState('')
  const [idRef, setIdRef] = useState<VersionRefResponse | null>(null)
  const [idError, setIdError] = useState<string | null>(null)
  const [idLooking, setIdLooking] = useState(false)
  const idInputRef = useRef('')
  const idLookupRequestRef = useRef(0)
  const [challengeDone, setChallengeDone] = useState<ChallengeResponse | null>(
    null,
  )
  // POST /v1/challenges 在老服务器上 404/405：降级为功能提示，不摆假表单。
  const [challengeUnavailable, setChallengeUnavailable] = useState(false)
  const dismissLocked = dispatching

  useEffect(() => {
    liveRef.current = true
    return () => {
      liveRef.current = false
    }
  }, [])

  // 与原构建器派发区同一语义：对手侧的预设就是本侧的 PVE 对手。
  const opponentPresets: PresetOpponentDTO[] = scenario.presets.filter(
    (preset) => preset.side !== side,
  )
  // 预设若带角色 options 则标出角色名；没有就用它自己的 label。
  const presetLabel = (preset: PresetOpponentDTO) => {
    const role = roleOfOptions(roleModule, preset.options)
    return role ? `${preset.label} · ${role.name}` : preset.label
  }

  // 与原构建器一致：不预选，占位符「选择预设对手」引导玩家自己挑；
  // 场景/侧变化时只清掉失效的选择。
  useEffect(() => {
    setPresetKey((current) =>
      opponentPresets.some((preset) => preset.key === current) ? current : null
    )
  }, [scenario, side])

  useEffect(() => {
    if (!open) return
    let live = true
    // 左右手互搏的候选：对侧的可对战 agent 中 isSelf 的那些。
    void catalog
      .opponents(scenarioID, side === 'a' ? 'b' : 'a')
      .then((list) => {
        if (live) setOpponents(list.opponents)
      })
      .catch(() => {
        if (live) setOpponents([])
      })
    return () => {
      live = false
    }
  }, [open, scenarioID, side])

  useEffect(() => {
    if (!open) return
    let live = true
    const requestID = ++configRequestRef.current
    // 配额脚注 + 拒绝文案数字 + 试炼开关；失败降级为 null（脚注隐藏、
    // 文案无数字），派发本身不受影响。
    void configApi
      .get()
      .then((value) => {
        if (live && requestID === configRequestRef.current) setCfg(value)
      })
      .catch(() => {
        if (live && requestID === configRequestRef.current) setCfg(null)
      })
    return () => {
      live = false
      configRequestRef.current += 1
    }
  }, [open])

  const configAfterRejection = async (cause: unknown) => {
    if (
      !(cause instanceof ApiError) ||
      !['daily_limit', 'pvp_daily_limit'].includes(cause.code)
    ) return cfg
    const requestID = ++configRequestRef.current
    // Another tab or an in-flight battle can consume the last slot after this
    // panel opens. Re-read before deciding between exhausted and one-slot copy.
    // This read improves a rejection already received. A stalled read must not
    // hide that rejection or leave the dispatch button disabled indefinitely.
    const fresh = await configApi.get({ signal: AbortSignal.timeout(3000) })
      .catch(() => null)
    if (!liveRef.current || requestID !== configRequestRef.current) return null
    setCfg(fresh)
    return fresh
  }

  const selfOpponents = (opponents ?? []).filter(
    (opponent) => opponent.isSelf,
  )

  useEffect(() => {
    setOpponentAgentID((current) =>
      selfOpponents.some((opponent) => opponent.agentID === current)
        ? current
        : selfOpponents[0]?.agentID ?? null
    )
  }, [opponents])

  // 出战版本 = ★参赛版本，否则最新版（与服务器选对手版本的规则一致）。
  // 派发取版：玩家点的那一版 > ★参赛版本 > 最新版（与服务器对对手侧的取法
  // 一致）。preferVersionID 只在版本卡「出战」路径上有值（#88）。
  const fieldedVersionID = preferVersionID ?? entryVersionID ??
    versions[versions.length - 1]?.id ?? null
  const fieldedVersion = versions.find(
    (version) => version.id === fieldedVersionID,
  )

  const dispatchPVE = async () => {
    if (fieldedVersionID == null || presetKey == null || insufficientPoints) {
      return
    }
    unlockAudio()
    playSound('click')
    setDispatching(true)
    setError(null)
    try {
      const response = await matches.dispatchPVE({
        versionID: fieldedVersionID,
        presetKey,
      })
      if (!liveRef.current) return
      playSound('dispatch', String(response.matchID))
      trackSoundMatch(response.matchID)
      navigate(`/matches/${response.matchID}`)
    } catch (cause) {
      if (!liveRef.current) return
      // #52/#47：按钮保持可点，拒绝在点击后给产品文案（数字来自 config）。
      const freshConfig = await configAfterRejection(cause)
      if (!liveRef.current) return
      setError(rejectCopy(cause, freshConfig, '发起对战失败'))
      setDispatching(false)
    }
  }

  const dispatchHotseat = async () => {
    if (
      fieldedVersionID == null || opponentAgentID == null || insufficientPoints
    ) return
    unlockAudio()
    playSound('click')
    setDispatching(true)
    setError(null)
    try {
      const response = await matches.dispatchPVP({
        versionID: fieldedVersionID,
        opponentAgentID,
      })
      if (!liveRef.current) return
      playSound('dispatch', String(response.matchID))
      trackSoundMatch(response.matchID)
      navigate(`/matches/${response.matchID}`)
    } catch (cause) {
      if (!liveRef.current) return
      const freshConfig = await configAfterRejection(cause)
      if (!liveRef.current) return
      setError(rejectCopy(cause, freshConfig, '发起对战失败'))
      setDispatching(false)
    }
  }

  // ── 门槛态（A5/#65，mock V16/V7）────────────────────────────────────────
  const oppositeSide: Side = side === 'a' ? 'b' : 'a'
  const sideNameOf = (which: Side) =>
    which === 'a' ? scenario.summary.sideAName : scenario.summary.sideBName
  const gateProgress = scenario.summary.gateProgress ?? null
  // 有按侧进度就按它判定（A6 双侧过线）；老服务器没有 → 沿用 gateUnlocked。
  const pvpUnlocked = gateProgress
    ? gateMet(gateProgress)
    : scenario.summary.gateUnlocked

  // ── P3 约战（#66，mock V20） ──────────────────────────────────────────

  // 面板每次打开重置约战流的一次性状态。
  useEffect(() => {
    if (!open) return
    setChallengeDone(null)
    setChallengeUnavailable(false)
    setPvpMode('players')
    setIdInput('')
    idInputRef.current = ''
    idLookupRequestRef.current += 1
    setIdRef(null)
    setIdError(null)
  }, [open])

  // 对手玩家（#66①）：对侧可对战 agent 中非 isSelf 的，按 ownerAccountID
  // 去重成「玩家」行；老服务器条目无 ownerAccountID → 过滤掉（不给假按钮）。
  const rivals = useMemo(() => {
    const seen = new Set<string>()
    const list: {
      accountID: string
      displayName: string
      agentLabel: string
    }[] = []
    for (const opponent of opponents ?? []) {
      if (opponent.isSelf) continue
      const accountID = opponent.ownerAccountID
      if (accountID == null || accountID === '' || seen.has(accountID)) {
        continue
      }
      seen.add(accountID)
      list.push({
        accountID,
        displayName: opponent.displayName,
        agentLabel: opponent.name ?? `agent #${opponent.agentID}`,
      })
    }
    return list
  }, [opponents])
  // 有对手却全都缺 ownerAccountID＝老服务器：提示改走按 id。
  const rivalsUnattributed = rivals.length === 0 &&
    (opponents ?? []).some((opponent) => !opponent.isSelf)

  const submitChallenge = async (opponent: ChallengeOpponentRequest) => {
    if (fieldedVersionID == null || dispatching || insufficientPoints) {
      return
    }
    unlockAudio()
    playSound('click')
    if (opponent.pinnedVersionID != null) {
      const currentID = Number(idInputRef.current.trim())
      if (
        !Number.isInteger(currentID) || currentID <= 0 || idRef == null ||
        idRef.versionID !== currentID || opponent.pinnedVersionID !== currentID
      ) {
        setIdRef(null)
        setIdError('版本 id 已变化，请重新查询后再约战')
        return
      }
    }
    setDispatching(true)
    setError(null)
    try {
      const response = await challenges.create({
        scenarioID,
        mine: { [side]: { versionID: fieldedVersionID } },
        opponent,
      })
      if (!liveRef.current) return
      playSound('dispatch', `challenge:${response.challengeID}`)
      for (const matchID of response.matchIDs) trackSoundMatch(matchID)
      if (response.matchIDs.length > 0) {
        onClose()
        navigate(`/matches/${response.matchIDs[0]}`)
      } else {
        setChallengeDone(response)
      }
    } catch (cause) {
      if (!liveRef.current) return
      if (
        cause instanceof ApiError && cause.code === 'unknown' &&
        (cause.status === 404 || cause.status === 405)
      ) {
        setChallengeUnavailable(true)
      } else {
        const freshConfig = await configAfterRejection(cause)
        if (!liveRef.current) return
        setError(challengeRejectCopy(cause, freshConfig))
      }
    } finally {
      if (liveRef.current) setDispatching(false)
    }
  }

  // 指定版本约战（#66②/#25）：版本 id → 公开身份卡；跨场景就地报错。
  const lookupRef = async () => {
    const normalizedInput = idInputRef.current.trim()
    const id = Number(normalizedInput)
    const requestID = ++idLookupRequestRef.current
    setIdRef(null)
    if (!Number.isInteger(id) || id <= 0) {
      setIdError('请输入数字版本 id（战报页可复制）')
      return
    }
    setIdLooking(true)
    setIdError(null)
    try {
      const ref = await versionsApi.ref(id)
      if (
        !liveRef.current || requestID !== idLookupRequestRef.current ||
        idInputRef.current.trim() !== normalizedInput
      ) return
      if (ref.scenarioID !== scenarioID) {
        setIdError(
          `该版本属于其他场景（${ref.scenarioID}），不能用于本场景约战`,
        )
      } else if (ref.side !== oppositeSide) {
        setIdError(
          `请选择对方的${sideNameOf(oppositeSide)}版本，与当前${
            sideNameOf(side)
          }对战`,
        )
      } else {
        setIdRef(ref)
      }
    } catch (cause) {
      if (
        !liveRef.current || requestID !== idLookupRequestRef.current ||
        idInputRef.current.trim() !== normalizedInput
      ) return
      if (cause instanceof ApiError && cause.code === 'not_found') {
        setIdError('未找到该版本 id')
      } else if (
        cause instanceof ApiError && cause.code === 'unknown' &&
        (cause.status === 404 || cause.status === 405)
      ) {
        setIdError('服务器版本暂不支持按 id 查询——该功能即将上线')
      } else {
        setIdError(messageOf(cause, '查询失败'))
      }
    } finally {
      if (liveRef.current && requestID === idLookupRequestRef.current) {
        setIdLooking(false)
      }
    }
  }

  return (
    <Dialog.Root
      open={open}
      modal
      disablePointerDismissal={dismissLocked}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !dismissLocked) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className='fixed inset-0 z-50 bg-black/60 backdrop-blur-sm' />
        <Dialog.Viewport className='fixed inset-0 z-[51] flex items-end justify-center md:items-center md:p-6'>
          <Dialog.Popup
            initialFocus
            finalFocus
            className='max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-(--border-soft) bg-(--surface) text-(--foreground) shadow-[0_20px_60px_rgba(0,0,0,0.5)] outline-none md:max-w-xl md:rounded-xl'
            {...tm('OS.panel')}
          >
            <div className='flex items-start justify-between gap-3 border-b border-(--border-soft) px-5 py-4'>
              <div className='min-w-0'>
                <Dialog.Title
                  id='os-panel-title'
                  className='text-base font-semibold text-(--foreground)'
                  {...tm('OS.panel-title')}
                >
                  出战 · {scenario.summary.title}
                </Dialog.Title>
                <p
                  className='mt-0.5 text-xs text-(--foreground-muted)'
                  {...tm('OS.fielded-version')}
                >
                  {fieldedVersion
                    ? fieldedVersionID === entryVersionID
                      ? `出战版本：★参赛版本 ${
                        versionTag(fieldedVersion, versions)
                      }`
                      : preferVersionID != null
                      ? `出战版本：指定版本 ${
                        versionTag(fieldedVersion, versions)
                      }`
                      : `出战版本：最新版 ${
                        versionTag(fieldedVersion, versions)
                      }`
                    : '先保存一个版本才能出战。'}
                </p>
              </div>
              {
                /* 触控目标 ≥44px（16px 图标 + 14px 内边距×2）；负外边距抵消
            视觉占位，图标大小不变 */
              }
              <Dialog.Close
                aria-label='关闭'
                disabled={dismissLocked}
                className='-m-2 rounded-md p-3.5 text-(--foreground-muted) transition hover:bg-white/4 hover:text-(--foreground) disabled:cursor-not-allowed disabled:opacity-50'
                {...tm('OS.close-button')}
              >
                <X aria-hidden='true' className='h-4 w-4' />
              </Dialog.Close>
            </div>

            <div className='px-5 py-4'>
              <BattleCostNotice kind={tab} quoteState={quoteState} />
              {/* #47 被阻挡态：提前告知；按钮仍可点，点了由 trials_blocked 拒绝 */}
              {cfg?.trialsBlocked
                ? (
                  <p
                    className='mb-3 rounded-md border border-[rgba(251,191,36,0.35)] bg-[rgba(251,191,36,0.08)] px-3 py-2 text-sm text-(--warning)'
                    {...tm('OS.trials-blocked-notice')}
                  >
                    赛事进行中，试炼暂时关闭——请稍后再来
                  </p>
                )
                : null}
              {error
                ? (
                  <p
                    className='mb-3 text-sm text-(--accent)'
                    {...tm('OS.error-notice')}
                  >
                    {error}
                  </p>
                )
                : null}

              <Tabs value={tab} onValueChange={setTab} className='space-y-4'>
                <TabsList {...tm('OS.tabs')}>
                  <TabsTrigger value='pve' {...tm('OS.tab-pve')}>
                    NPC 练习
                  </TabsTrigger>
                  <TabsTrigger value='hotseat' {...tm('OS.tab-hotseat')}>
                    左右手互搏
                  </TabsTrigger>
                  <TabsTrigger value='pvp' {...tm('OS.tab-pvp')}>
                    {pvpUnlocked
                      ? <Unlock className='mr-1.5 h-3.5 w-3.5' />
                      : <Lock className='mr-1.5 h-3.5 w-3.5' />}
                    玩家约战
                  </TabsTrigger>
                </TabsList>

                <TabsContent value='pve' className='space-y-3'>
                  {opponentPresets.length === 0
                    ? (
                      <p
                        className='text-sm text-(--foreground-muted)'
                        {...tm('OS.pve-empty')}
                      >
                        该场景暂无对手侧的预设对手。
                      </p>
                    )
                    : (
                      <>
                        <div
                          className='w-full max-w-xs'
                          {...tm('OS.preset-select')}
                        >
                          <Select
                            placeholder='选择预设对手'
                            value={presetKey}
                            renderValue={(v) => {
                              const preset = opponentPresets.find(
                                (item) => item.key === v,
                              )
                              return preset ? presetLabel(preset) : v
                            }}
                            onValueChange={(v) => setPresetKey(v ?? null)}
                          >
                            {opponentPresets.map((preset) => (
                              <SelectItem key={preset.key} value={preset.key}>
                                {presetLabel(preset)}
                              </SelectItem>
                            ))}
                          </Select>
                        </div>
                        {presetKey && (
                          <Link
                            to={`/scenarios/${
                              encodeURIComponent(scenario.summary.id)
                            }/npcs/${encodeURIComponent(presetKey)}`}
                            onClick={onClose}
                            className='block w-fit py-2 text-sm text-(--foreground-subtle) underline underline-offset-4'
                          >
                            查看这个 NPC 的主页
                          </Link>
                        )}
                        <Button
                          data-testid='dispatch-match'
                          onClick={() => void dispatchPVE()}
                          onPointerEnter={playButtonHover}
                          data-spec='U19-C07 U19-C19 U19-C20'
                          {...tm('OS.pve-dispatch-button')}
                          disabled={dispatching || insufficientPoints ||
                            presetKey == null ||
                            fieldedVersionID == null}
                        >
                          {dispatching ? '派发中…' : '发起对战'}
                        </Button>
                      </>
                    )}
                </TabsContent>

                <TabsContent value='hotseat' className='space-y-3'>
                  {opponents === null
                    ? (
                      <p
                        className='text-sm text-(--foreground-subtle)'
                        {...tm('OS.hotseat-loading')}
                      >
                        加载中…
                      </p>
                    )
                    : selfOpponents.length === 0
                    ? (
                      <div
                        className='rounded-lg border border-dashed border-(--border-soft) px-4 py-6 text-center'
                        {...tm('OS.hotseat-empty')}
                      >
                        <p className='text-sm font-medium text-(--foreground)'>
                          你还没有对侧智能体
                        </p>
                        <p className='mt-1 text-xs text-(--foreground-muted)'>
                          左右手互搏＝拿本方打你自己的对侧。先为另一方构建并保存版本。
                        </p>
                        <div className='mt-4 flex justify-center'>
                          <ButtonLink
                            to='/my-agents'
                            size='sm'
                            variant='secondary'
                            {...tm('OS.hotseat-go-my-agents')}
                          >
                            去我的智能体
                          </ButtonLink>
                        </div>
                      </div>
                    )
                    : (
                      <>
                        {selfOpponents.length > 1
                          ? (
                            <div
                              className='w-full max-w-xs'
                              {...tm('OS.hotseat-opponent-select')}
                            >
                              <Select
                                placeholder='选择你的对侧智能体'
                                value={opponentAgentID != null
                                  ? String(opponentAgentID)
                                  : undefined}
                                renderValue={(v) => {
                                  const opponent = selfOpponents.find(
                                    (item) => String(item.agentID) === v,
                                  )
                                  return opponent
                                    ? `${opponent.displayName} · agent #${opponent.agentID}`
                                    : v
                                }}
                                onValueChange={(v) =>
                                  setOpponentAgentID(v ? Number(v) : null)}
                              >
                                {selfOpponents.map((opponent) => (
                                  <SelectItem
                                    key={opponent.agentID}
                                    value={String(opponent.agentID)}
                                  >
                                    {opponent.displayName} · agent #
                                    {opponent.agentID}
                                  </SelectItem>
                                ))}
                              </Select>
                            </div>
                          )
                          : (
                            <p
                              className='text-sm text-(--foreground)'
                              {...tm('OS.hotseat-opponent-label')}
                            >
                              对侧：{selfOpponents[0].displayName} · agent #
                              {selfOpponents[0].agentID}
                            </p>
                          )}
                        {/* #18：对侧版本选择需后端支持（后续阶段），不放假选择器 */}
                        <p
                          className='text-xs text-(--foreground-muted)'
                          {...tm('OS.hotseat-version-note')}
                        >
                          对侧将以其★参赛版本（否则最新版）出战 ·
                          指定具体版本将在后续版本开放。
                        </p>
                        <Button
                          onClick={() => void dispatchHotseat()}
                          onPointerEnter={playButtonHover}
                          data-spec='U19-C07 U19-C19 U19-C20'
                          {...tm('OS.hotseat-dispatch-button')}
                          disabled={dispatching || insufficientPoints ||
                            opponentAgentID == null ||
                            fieldedVersionID == null}
                        >
                          {dispatching ? '派发中…' : '自打一场'}
                        </Button>
                      </>
                    )}
                </TabsContent>

                <TabsContent value='pvp' className='space-y-3'>
                  {
                    /* A5 门槛是状态：锁定/已解锁都如实呈现；解锁态＝P3 真约战
                （#66，mock V20），锁定态照旧按侧进度徽章。 */
                  }
                  {pvpUnlocked
                    ? (
                      <>
                        <div
                          className='flex flex-wrap items-center gap-2'
                          {...tm('OS.pvp-unlocked-header')}
                        >
                          <Unlock className='h-4 w-4 shrink-0 text-(--success)' />
                          <p className='text-sm font-medium text-(--foreground)'>
                            玩家约战已解锁
                          </p>
                          {gateProgress
                            ? (['a', 'b'] as const).map((which) => (
                              <Badge key={which} tone='success'>
                                {sideNameOf(which)}{' '}
                                {sideProgressText(gateProgress[which])} ✓
                              </Badge>
                            ))
                            : null}
                        </div>
                        {challengeDone
                          ? (
                            <div
                              className='space-y-3 rounded-lg border border-[rgba(52,211,153,0.35)] bg-[rgba(52,211,153,0.06)] px-4 py-4'
                              {...tm('OS.challenge-success')}
                            >
                              <p className='text-sm font-medium text-(--foreground)'>
                                已发起约战 · 对局已入队
                              </p>
                              <div className='flex flex-wrap gap-2'>
                                {challengeDone.matchIDs.map((
                                  matchID,
                                ) => (
                                  <Link
                                    key={matchID}
                                    to={`/matches/${matchID}`}
                                    className='inline-flex items-center gap-1.5 rounded-lg border border-(--border) px-3 py-2 text-sm font-medium text-(--foreground) transition hover:border-(--foreground-muted) hover:bg-white/3'
                                  >
                                    对局 · #{matchID}
                                  </Link>
                                ))}
                              </div>
                              <p className='text-xs text-(--foreground-muted)'>
                                本次只发起一场对战；对方会收到通知，无需同意。
                              </p>
                            </div>
                          )
                          : challengeUnavailable
                          ? (
                            <p
                              className='rounded-lg border border-dashed border-(--border-soft) px-4 py-6 text-center text-sm text-(--foreground-muted)'
                              {...tm('OS.challenge-unavailable')}
                            >
                              约战功能尚未在该服务器启用——敬请期待
                            </p>
                          )
                          : (
                            <>
                              <div
                                className='rounded-lg border border-(--border-soft) bg-white/2 px-4 py-3'
                                {...tm('OS.lineup')}
                              >
                                <p className='text-sm font-medium text-(--foreground)'>
                                  我方{sideNameOf(side)}{' '}
                                  vs 对方{sideNameOf(oppositeSide)}
                                </p>
                                <p className='mt-1 text-xs text-(--foreground-subtle)'>
                                  出战版本：{fieldedVersion
                                    ? versionTag(fieldedVersion, versions)
                                    : '尚未保存版本'}
                                </p>
                              </div>

                              {/* 子模式切换：① 对手玩家 · ② 指定版本约战。 */}
                              <div
                                className='flex gap-2'
                                {...tm('OS.pvp-mode-switch')}
                              >
                                {([
                                  ['players', '对手玩家'],
                                  ['byid', '指定版本约战'],
                                ] as const).map(([mode, label]) => (
                                  <button
                                    key={mode}
                                    type='button'
                                    aria-pressed={pvpMode === mode}
                                    onClick={() => setPvpMode(mode)}
                                    {...tm('OS.pvp-mode-button')}
                                    className={pvpMode === mode
                                      ? 'cursor-pointer rounded-full border border-(--accent) px-3 py-1.5 text-xs font-semibold text-(--accent)'
                                      : 'cursor-pointer rounded-full border border-(--border) px-3 py-1.5 text-xs font-semibold text-(--foreground-subtle) transition hover:text-(--foreground)'}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>

                              {pvpMode === 'players'
                                ? (
                                  <div className='space-y-2'>
                                    {opponents === null
                                      ? (
                                        <p
                                          className='text-sm text-(--foreground-subtle)'
                                          {...tm('OS.rivals-loading')}
                                        >
                                          加载中…
                                        </p>
                                      )
                                      : rivals.length === 0
                                      ? (
                                        <p
                                          className='text-sm text-(--foreground-muted)'
                                          {...tm('OS.rivals-empty')}
                                        >
                                          {rivalsUnattributed
                                            ? '服务器版本暂不支持按玩家约战——试试指定版本约战'
                                            : '暂无可约战的对手玩家——等其他玩家在本场景出战后再来'}
                                        </p>
                                      )
                                      : rivals.map((rival) => (
                                        <div
                                          key={rival.accountID}
                                          className='flex flex-wrap items-center gap-3 rounded-lg border border-(--border-soft) bg-white/2 px-4 py-2.5'
                                          {...tm('OS.rival-row')}
                                        >
                                          <div className='min-w-0 flex-1'>
                                            <p className='text-sm font-semibold text-(--foreground)'>
                                              {rival.displayName}
                                            </p>
                                            <p className='text-xs text-(--foreground-muted)'>
                                              {rival.agentLabel}
                                            </p>
                                          </div>
                                          <Button
                                            size='sm'
                                            variant='secondary'
                                            disabled={dispatching ||
                                              insufficientPoints ||
                                              fieldedVersionID == null}
                                            onClick={() =>
                                              void submitChallenge({
                                                accountID: rival.accountID,
                                              })}
                                            onPointerEnter={playButtonHover}
                                            data-spec='U19-C07 U19-C19 U19-C20'
                                            {...tm('OS.challenge-button')}
                                          >
                                            {dispatching
                                              ? '约战中…'
                                              : '发起约战'}
                                          </Button>
                                        </div>
                                      ))}
                                  </div>
                                )
                                : (
                                  <div className='space-y-2'>
                                    <div className='flex gap-2'>
                                      <Input
                                        value={idInput}
                                        onChange={(event) => {
                                          const value = event.target.value
                                          idInputRef.current = value
                                          idLookupRequestRef.current += 1
                                          setIdInput(value)
                                          setIdRef(null)
                                          setIdError(null)
                                          setIdLooking(false)
                                        }}
                                        placeholder='输入对方对侧版本 id（战报页可复制）'
                                        {...tm('OS.byid-input')}
                                      />
                                      <Button
                                        size='sm'
                                        variant='secondary'
                                        className='h-10 shrink-0'
                                        disabled={idLooking ||
                                          idInput.trim() === ''}
                                        onClick={() => void lookupRef()}
                                        {...tm('OS.byid-lookup-button')}
                                      >
                                        {idLooking ? '查询中…' : '查询'}
                                      </Button>
                                    </div>
                                    {idError
                                      ? (
                                        <p
                                          className='text-xs text-(--warning)'
                                          {...tm('OS.byid-error')}
                                        >
                                          {idError}
                                        </p>
                                      )
                                      : null}
                                    {idRef
                                      ? (
                                        // 解析卡：玩家/场景/侧/模型（#25）。
                                        <div
                                          className='rounded-lg border border-(--border-soft) bg-white/2 px-4 py-3'
                                          {...tm('OS.byid-ref-card')}
                                        >
                                          <p className='text-sm font-semibold text-(--foreground)'>
                                            {idRef.ownerDisplayName}
                                          </p>
                                          <p className='mt-1 text-xs text-(--foreground-muted)'>
                                            {scenario.summary.title} · 执
                                            {idRef.side === 'a'
                                              ? `A（${sideNameOf('a')}）`
                                              : `B（${sideNameOf('b')}）`} ·
                                            {' '}
                                            {idRef.modelID}{' '}
                                            · v#{idRef.versionID}
                                          </p>
                                          <p className='mt-1 text-[11px] text-(--foreground-muted)'>
                                            本次将挑战对方的这个版本。
                                          </p>
                                          <div className='mt-2'>
                                            <Button
                                              size='sm'
                                              disabled={dispatching ||
                                                insufficientPoints ||
                                                fieldedVersionID == null}
                                              onClick={() =>
                                                void submitChallenge({
                                                  pinnedVersionID:
                                                    idRef.versionID,
                                                })}
                                              onPointerEnter={playButtonHover}
                                              data-spec='U19-C07 U19-C19 U19-C20'
                                              {...tm('OS.challenge-button')}
                                            >
                                              {dispatching
                                                ? '约战中…'
                                                : '发起约战'}
                                            </Button>
                                          </div>
                                        </div>
                                      )
                                      : null}
                                  </div>
                                )}

                              <ul
                                className='space-y-1 text-[11px] text-(--foreground-muted)'
                                {...tm('OS.pvp-footnotes')}
                              >
                                <li>
                                  一次约战只发起一场，仅发起人支付本场积分并可领取胜利返还。
                                </li>
                                <li>
                                  友谊赛不计排名；对方会收到通知，无需同意、不能拒绝。
                                </li>
                              </ul>
                            </>
                          )}
                      </>
                    )
                    : gateProgress
                    ? (
                      <div
                        className='flex flex-col items-center gap-3 rounded-lg border border-dashed border-(--border-soft) px-4 py-8 text-center'
                        {...tm('OS.gate-locked')}
                      >
                        <Lock className='h-5 w-5 text-(--foreground-muted)' />
                        <p
                          className='text-sm font-medium text-(--foreground-subtle)'
                          {...tm('OS.gate-rule-text')}
                        >
                          每侧各赢 ≥{gateProgress.a.needed}{' '}
                          场 NPC 练习解锁玩家约战
                        </p>
                        {/* 按侧进度徽章（#65，mock V16）：如 商鞅 1/1 ✓ · 甘龙 0/1 */}
                        <div className='flex flex-wrap justify-center gap-2'>
                          {(['a', 'b'] as const).map((which) => (
                            <Badge
                              key={which}
                              tone={sideMet(gateProgress[which])
                                ? 'success'
                                : 'info'}
                              {...tm('OS.gate-side-badge')}
                            >
                              {sideNameOf(which)}{' '}
                              {sideProgressText(gateProgress[which])}
                              {sideMet(gateProgress[which]) ? ' ✓' : ''}
                            </Badge>
                          ))}
                        </div>
                        {
                          /* 差哪侧补哪侧（#62/#64，mock V7）：本侧未达标 → 切回
                      NPC 练习页签；对侧未达标 → 有对侧 agent 去我的智能体换
                      执侧，没有则懒创建进构建器 */
                        }
                        <div className='flex flex-wrap justify-center gap-2'>
                          {!sideMet(gateProgress[side])
                            ? (
                              <Button
                                size='sm'
                                variant='secondary'
                                onClick={() => setTab('pve')}
                                {...tm('OS.gate-practice-this-side')}
                              >
                                去练习该侧（{sideNameOf(side)}）
                              </Button>
                            )
                            : null}
                          {!sideMet(gateProgress[oppositeSide])
                            ? selfOpponents.length > 0
                              ? (
                                <ButtonLink
                                  size='sm'
                                  variant='secondary'
                                  to='/my-agents'
                                  {...tm('OS.gate-practice-opposite')}
                                >
                                  去练习对侧（{sideNameOf(oppositeSide)}）
                                </ButtonLink>
                              )
                              : (
                                <ButtonLink
                                  size='sm'
                                  variant='secondary'
                                  to={agentEntryUrl(scenarioID, oppositeSide)}
                                  {...tm('OS.gate-create-opposite')}
                                >
                                  {`去创建对侧（${sideNameOf(oppositeSide)}）`}
                                </ButtonLink>
                              )
                            : null}
                        </div>
                      </div>
                    )
                    : (
                      // 老服务器（无 gateProgress）：保留 P1 的锁定占位，不摆假进度
                      <div
                        className='flex flex-col items-center gap-2 rounded-lg border border-dashed border-(--border-soft) px-4 py-8 text-center'
                        {...tm('OS.gate-locked-legacy')}
                      >
                        <Lock className='h-5 w-5 text-(--foreground-muted)' />
                        <p className='text-sm font-medium text-(--foreground-subtle)'>
                          双侧各自赢下 PVE 练习后解锁玩家约战
                        </p>
                        <p className='text-xs text-(--foreground-muted)'>
                          解锁进度将在数据接入后点亮
                        </p>
                      </div>
                    )}
                </TabsContent>
              </Tabs>
            </div>

            {/* 面板脚注：三类配额中的两条日额（#52/#46），数字来自 /v1/config */}
            {cfg && (cfg.dailyBattleLimit > 0 || cfg.pvpDailyLimit > 0)
              ? (
                <div
                  className='border-t border-(--border-soft) px-5 py-3 text-xs text-(--foreground-muted)'
                  {...tm('OS.quota-footer')}
                >
                  今日已用 {cfg.usage.battlesToday}/{cfg.dailyBattleLimit}（PVP
                  {' '}
                  {cfg.usage.pvpBattlesToday}/{cfg.pvpDailyLimit}）
                </div>
              )
              : null}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
