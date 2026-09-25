import { PageLoading } from '../components/page-loading'
import { Menu } from '@base-ui-components/react/menu'
import {
  Archive,
  ArchiveRestore,
  Check,
  Ellipsis,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { agents as agentAPI, builder } from '../api/client'
import type { AgentVersionDTO, MyAgentDTO } from '../api/types'
import { Modal } from '../components/modal'
import { CreateAgentAction } from '../components/create-agent-action'
import { OsPanel } from '../components/os-panel'
import { BackLink } from '../components/back-link'
import { Button, ButtonLink } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { VersionList } from '../components/version-list'
import {
  AgentMatchHistory,
  PlayerProfileRecord,
} from '../components/agent-profile'
import {
  beginEntryMutation,
  finishEntryMutation,
  getEntryMutation,
  notifyAgentsChanged,
  subscribeAgentsChanged,
  subscribeEntryMutation,
} from '../lib/agent-events'
import { purgeBuilderDraftJournals } from '../lib/builder-draft-storage'
import { cn } from '../lib/cn'
import { messageOf } from '../lib/use-async'
import { usePageQuery } from '../lib/use-page-query'
import { agentQuery, inventoryQuery } from '../lib/navigation-queries'
import { versionTag } from '../lib/version-label'
import { tm } from '../testmode/mark'
import {
  dropdownItemClassName,
  dropdownPopupClassName,
  dropdownScrollClassName,
} from '../components/ui/dropdown-styles'

const AGENT_NAME_LIMIT = 30

function displayName(sideName: string, agentID: number, name?: string | null) {
  return name ? `${sideName}「${name}」` : `${sideName} #${agentID}`
}

// EA 智能体主页突出最新保存版本；参赛标记与所选战绩版本彼此独立。
export function AgentViewPage() {
  const { agentId = '' } = useParams()
  return <AgentView key={agentId} agentID={Number(agentId)} />
}

function AgentView({ agentID }: { agentID: number }) {
  const navigate = useNavigate()
  const location = useLocation()

  const { data: view, error, reload } = usePageQuery(agentQuery(agentID))
  const inventory = usePageQuery(inventoryQuery())
  const currentView = view?.requestedAgentID === agentID ? view : null
  const siblings = currentView?.kind === 'owner'
    ? inventory.data?.scenarios
      .find((item) => item.scenarioID === currentView.draft.scenarioID)
      ?.sides[currentView.draft.side] ?? []
    : []
  const data = currentView?.kind === 'owner'
    ? {
      ...currentView,
      siblings: siblings.filter((agent) => !agent.isArchived),
      self: siblings.find((agent) => agent.agentID === agentID) ?? null,
    }
    : null
  const publicView = currentView?.kind === 'public'
    ? currentView.publicView
    : null

  const [selectedVersionID, setSelectedVersionID] = useState<number | null>(
    null,
  )
  const [osOpen, setOsOpen] = useState(false)
  const [preferVersionID, setPreferVersionID] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [savedVersionID, setSavedVersionID] = useState<number | null>(null)
  const [expressError, setExpressError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(
    location.state?.renameNewAgent === true,
  )
  const [nameDraft, setNameDraft] = useState('')
  const [localName, setLocalName] = useState<string | null | undefined>()
  const [renameBusy, setRenameBusy] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [entryNotice, setEntryNotice] = useState<number | null>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const renameFormRef = useRef<HTMLFormElement>(null)
  const renameComposingRef = useRef(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const menuTriggerRef = useRef<HTMLElement>(null)
  const wasRenaming = useRef(false)
  const currentAgentIDRef = useRef(agentID)
  const mountedRef = useRef(true)
  const renameRequestRef = useRef(0)
  const deleteRequestRef = useRef(0)
  const entryMutation = useSyncExternalStore(
    subscribeEntryMutation,
    getEntryMutation,
    getEntryMutation,
  )
  currentAgentIDRef.current = agentID

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      renameRequestRef.current += 1
      deleteRequestRef.current += 1
    }
  }, [])

  useEffect(() => subscribeAgentsChanged(reload), [reload])

  const sorted: AgentVersionDTO[] = data
    ? [...data.versions].sort((a, b) => b.id - a.id)
    : []
  const sideName = data == null
    ? ''
    : data.draft.side === 'a'
    ? data.scenario.summary.sideAName
    : data.scenario.summary.sideBName
  const currentName = localName === undefined
    ? data?.self?.name ?? null
    : localName
  const fallbackSelf: MyAgentDTO | null = data
    ? {
      agentID,
      versionCount: data.versions.length,
      entryVersionID: data.entryVersionID,
      latestVersionID: sorted[0]?.id ?? null,
      name: currentName,
    }
    : null
  const railAgents = data == null
    ? []
    : data.self?.isArchived
    ? data.siblings
    : data.siblings.some((agent) => agent.agentID === agentID)
    ? data.siblings
    : fallbackSelf == null
    ? data.siblings
    : [fallbackSelf, ...data.siblings]
  const entryVersion = sorted.find((version) => version.isEntry) ?? null
  const canDelete = data?.versions.length === 0
  const isArchived = data?.self?.isArchived ?? false
  const [archiveBusy, setArchiveBusy] = useState(false)
  const nameLength = [...nameDraft].length
  const nameTooLong = nameLength > AGENT_NAME_LIMIT

  // Consume Builder's one-shot navigation notice and clear it from history.
  // agentID is the intended trigger: replace(state=null) must not consume it twice.
  useEffect(() => {
    setOsOpen(false)
    setPreferVersionID(null)
    setActionError(null)
    setLocalName(undefined)
    setRenameBusy(false)
    setRenameError(null)
    setDeleteOpen(false)
    setDeleteBusy(false)
    setDeleteError(null)
    setEntryNotice(null)
    const state = location.state as {
      renameNewAgent?: boolean
      savedVersionID?: number
      expressDispatchError?: string
    } | null
    setSavedVersionID(state?.savedVersionID ?? null)
    setExpressError(state?.expressDispatchError ?? null)
    if (
      state?.renameNewAgent || state?.savedVersionID != null ||
      state?.expressDispatchError != null
    ) {
      navigate(location.pathname + location.search, {
        replace: true,
        state: null,
      })
    }
  }, [agentID])

  useLayoutEffect(() => {
    if (renaming) {
      const input = renameFormRef.current?.querySelector('input')
      input?.focus({ preventScroll: true })
      input?.select()
      wasRenaming.current = true
      return
    }
    if (wasRenaming.current) headingRef.current?.focus({ preventScroll: true })
    wasRenaming.current = false
  }, [renaming, currentView != null])

  // Keep the active pill visible without moving the page vertically.
  useLayoutEffect(() => {
    const rail = railRef.current
    if (!rail) return
    let active = true
    const revealCurrent = () => {
      if (!active) return
      const current = rail.querySelector<HTMLElement>('[aria-current="page"]')
      if (!current) return
      const itemRect = current.getBoundingClientRect()
      const railRect = rail.getBoundingClientRect()
      if (itemRect.left < railRect.left || itemRect.right > railRect.right) {
        rail.scrollLeft += itemRect.left - railRect.left -
          (rail.clientWidth - itemRect.width) / 2
      }
    }
    revealCurrent()
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(revealCurrent)
    observer?.observe(rail)
    void document.fonts?.ready.then(revealCurrent)
    return () => {
      active = false
      observer?.disconnect()
    }
  }, [agentID, railAgents.length])

  useEffect(() => {
    if (entryNotice == null) return
    const timer = setTimeout(() => setEntryNotice(null), 2400)
    return () => clearTimeout(timer)
  }, [entryNotice])

  const markEntry = async (versionID: number) => {
    const token = beginEntryMutation(agentID, versionID)
    if (token == null) return
    setActionError(null)
    try {
      await builder.setEntry(agentID, versionID)
      // Shared invalidation refreshes whichever sibling or inventory projection
      // is mounted when this side-wide change completes.
      notifyAgentsChanged()
      if (mountedRef.current && currentAgentIDRef.current === agentID) {
        setEntryNotice(versionID)
      }
    } catch (cause) {
      if (!mountedRef.current || currentAgentIDRef.current !== agentID) return
      setActionError(messageOf(cause, '设置参赛版本失败'))
    } finally {
      finishEntryMutation(token)
    }
  }

  const beginRename = () => {
    renameComposingRef.current = false
    setNameDraft(currentName ?? '')
    setRenameError(null)
    setRenaming(true)
  }

  const saveName = async () => {
    if (renameBusy || (nameTooLong && nameDraft.trim() !== '')) return
    const requestID = ++renameRequestRef.current
    const requestIsCurrent = () =>
      mountedRef.current && renameRequestRef.current === requestID &&
      currentAgentIDRef.current === agentID
    const name = nameDraft.trim()
    setRenameBusy(true)
    setRenameError(null)
    try {
      await agentAPI.rename(agentID, { name: name === '' ? null : name })
      notifyAgentsChanged()
      if (!requestIsCurrent()) return
      setLocalName(name === '' ? null : name)
      setRenaming(false)
    } catch (cause) {
      if (!requestIsCurrent()) return
      setRenameError(messageOf(cause, '重命名失败'))
    } finally {
      if (requestIsCurrent()) setRenameBusy(false)
    }
  }

  useEffect(() => {
    if (!renaming || renameBusy || nameDraft.trim() !== '') return
    const dismissEmptyName = (event: MouseEvent) => {
      if (renameComposingRef.current || !(event.target instanceof Node)) return
      const form = renameFormRef.current
      const input = form?.querySelector('input')
      if (!input || input.contains(event.target)) return
      // Let the explicit save/cancel buttons retain their own behavior.
      if (
        event.target instanceof Element &&
        form?.contains(event.target.closest('button'))
      ) return
      // Do not pull focus away from the control the user just clicked.
      wasRenaming.current = false
      if (currentName == null) setRenaming(false)
      else void saveName()
    }
    document.addEventListener('click', dismissEmptyName, true)
    return () => document.removeEventListener('click', dismissEmptyName, true)
  }, [renaming, renameBusy, nameDraft, currentName])

  const removeAgent = async () => {
    if (!canDelete || deleteBusy) return
    const requestID = ++deleteRequestRef.current
    const requestIsCurrent = () =>
      mountedRef.current && deleteRequestRef.current === requestID &&
      currentAgentIDRef.current === agentID
    const currentIndex = railAgents.findIndex((agent) =>
      agent.agentID === agentID
    )
    const nextAgent = currentIndex < 0
      ? railAgents.find((agent) => agent.agentID !== agentID) ?? null
      : railAgents.slice(currentIndex + 1).find((agent) =>
        agent.agentID !== agentID
      ) ?? railAgents[currentIndex - 1] ?? null
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await agentAPI.remove(agentID)
      purgeBuilderDraftJournals(agentID)
      notifyAgentsChanged()
      if (!requestIsCurrent()) return
      setDeleteOpen(false)
      if (nextAgent) {
        navigate(`/agents/${nextAgent.agentID}`, { replace: true })
      } else {
        navigate('/my-agents', { replace: true })
      }
    } catch (cause) {
      if (!requestIsCurrent()) return
      setDeleteError(messageOf(cause, '删除智能体失败'))
      setDeleteBusy(false)
    }
  }

  const changeArchive = async () => {
    if (archiveBusy) return
    setArchiveBusy(true)
    setActionError(null)
    const requestedID = agentID
    try {
      if (isArchived) await agentAPI.restore(requestedID)
      else await agentAPI.archive(requestedID)
      notifyAgentsChanged()
      if (!mountedRef.current || currentAgentIDRef.current !== requestedID) {
        return
      }
      if (!isArchived) {
        navigate('/my-agents', {
          replace: true,
          state: {
            archivedAgentName: displayName(sideName, agentID, currentName),
          },
        })
      }
    } catch (cause) {
      if (mountedRef.current && currentAgentIDRef.current === requestedID) {
        setActionError(
          messageOf(cause, isArchived ? '恢复智能体失败' : '归档智能体失败'),
        )
      }
    } finally {
      if (mountedRef.current) setArchiveBusy(false)
    }
  }

  // The public DTO contains no prompt; never read private version endpoints here.
  if (publicView) {
    const publicName = displayName(
      publicView.sideName,
      publicView.agentID,
      publicView.name,
    )
    const current = [...publicView.versions].sort((a, b) => b.id - a.id)
    const selected = current.find((v) => v.id === selectedVersionID) ??
      current[0]
    return (
      <div className='space-y-6' {...tm('EA.public-view')}>
        <div>
          <BackLink
            to='/scenarios'
            className='text-sm text-(--foreground-subtle) transition hover:text-(--foreground)'
            {...tm('EA.public-back-link')}
            label='场景'
          />
        </div>
        <div>
          <h1
            className='wrap-anywhere text-2xl font-black tracking-tight text-(--foreground)'
            {...tm('EA.public-title')}
          >
            {publicName}
          </h1>
          <p
            className='mt-1 text-sm text-(--foreground-subtle)'
            {...tm('EA.public-owner-line')}
          >
            {publicView.ownerName} · {publicView.scenarioTitle}
          </p>
        </div>
        <PlayerProfileRecord
          versions={publicView.versions}
          selectedID={selected?.id ?? null}
          onSelect={setSelectedVersionID}
        />
        <Card {...tm('EA.public-record-card')}>
          <CardContent className='space-y-3 pt-5'>
            <h2 className='text-sm font-semibold text-(--foreground)'>
              逐版本战绩
            </h2>
            {publicView.versions.length === 0
              ? (
                <p
                  className='text-sm text-(--foreground-subtle)'
                  {...tm('EA.public-record-empty')}
                >
                  还没有保存过版本。
                </p>
              )
              : (
                <ul className='space-y-2' {...tm('EA.public-version-list')}>
                  {publicView.versions.map((version) => (
                    <li
                      key={version.id}
                      className='flex items-center justify-between rounded-lg border border-(--border-soft) px-3 py-2 text-sm'
                      {...tm('EA.public-version-item')}
                    >
                      <span className='text-(--foreground)'>
                        v{version.ordinal}
                        {version.isEntry
                          ? (
                            <span
                              className='ml-2 text-(--accent)'
                              {...tm('EA.public-entry-badge')}
                            >
                              ★ 参赛版本
                            </span>
                          )
                          : null}
                      </span>
                      <span
                        className='text-(--foreground-subtle)'
                        {...tm('EA.public-record')}
                      >
                        {version.matchCount === 0
                          ? '暂无战绩'
                          : `${version.matchCount} 战 ${version.winCount} 胜`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            <p
              className='text-xs text-(--foreground-muted)'
              {...tm('EA.public-owner-only-hint')}
            >
              提示词只有智能体主人可见。
            </p>
          </CardContent>
        </Card>
        {selected && (
          <AgentMatchHistory
            key={selected.id}
            target={{ kind: 'player', agentID, versionID: selected.id }}
            side={publicView.side === 'a' ? 'a' : 'b'}
          />
        )}
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <BackLink
        to='/my-agents'
        className='block text-sm text-(--foreground-subtle) transition hover:text-(--foreground)'
        {...tm('EA.back-link')}
        label='我的智能体'
      />

      {error
        ? <p className='text-sm text-(--accent)' {...tm('EA.error')}>{error}</p>
        : !data
        ? <PageLoading variant='detail' {...tm('EA.loading')} />
        : (
          <>
            <header {...tm('EA.page-header')}>
              <p className='mb-2 text-xs text-(--foreground-subtle)'>
                智能体主页
              </p>
              <div className='flex items-start gap-2'>
                {renaming
                  ? (
                    <form
                      ref={renameFormRef}
                      className='flex w-full max-w-lg flex-wrap items-center gap-1'
                      {...tm('EA.rename-form')}
                      onSubmit={(event) => {
                        event.preventDefault()
                        void saveName()
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key === 'Enter' &&
                          (event.nativeEvent.isComposing ||
                            event.keyCode === 229)
                        ) event.preventDefault()
                        if (
                          event.key === 'Escape' &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault()
                          setRenaming(false)
                        }
                      }}
                    >
                      <label htmlFor='inline-agent-name' className='sr-only'>
                        智能体名称
                      </label>
                      <Input
                        id='inline-agent-name'
                        value={nameDraft}
                        disabled={renameBusy}
                        aria-invalid={nameTooLong || !!renameError}
                        aria-describedby='inline-agent-name-help'
                        className='h-11 min-w-0 flex-1 text-lg font-semibold'
                        placeholder='智能体名称（可选）'
                        onCompositionStart={() => {
                          renameComposingRef.current = true
                        }}
                        onCompositionEnd={() => {
                          renameComposingRef.current = false
                        }}
                        onChange={(event) => {
                          setNameDraft(event.target.value)
                          setRenameError(null)
                        }}
                      />
                      <Button
                        type='submit'
                        variant='ghost'
                        size='sm'
                        className='h-11 w-11 shrink-0 cursor-pointer p-0 md:h-9 md:w-9'
                        aria-label='保存名称'
                        title='保存名称（Enter）'
                        disabled={renameBusy || nameTooLong}
                      >
                        <Check aria-hidden='true' className='h-4 w-4' />
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='h-11 w-11 shrink-0 cursor-pointer p-0 md:h-9 md:w-9'
                        aria-label='取消重命名'
                        title='取消（Esc）'
                        disabled={renameBusy}
                        onClick={() => setRenaming(false)}
                      >
                        <X aria-hidden='true' className='h-4 w-4' />
                      </Button>
                      <span
                        id='inline-agent-name-help'
                        className={`w-full text-xs ${
                          nameTooLong || renameError
                            ? 'text-(--accent)'
                            : 'text-(--foreground-muted)'
                        }`}
                        role={renameError ? 'alert' : undefined}
                      >
                        {renameError ??
                          (nameTooLong
                            ? `名字最多 ${AGENT_NAME_LIMIT} 字`
                            : `${nameLength}/${AGENT_NAME_LIMIT}`)}
                      </span>
                    </form>
                  )
                  : (
                    <h1
                      ref={headingRef}
                      tabIndex={-1}
                      className='min-w-0 wrap-anywhere text-2xl font-black tracking-tight text-(--foreground) outline-none'
                      {...tm('EA.page-title')}
                    >
                      {displayName(sideName, agentID, currentName)}
                    </h1>
                  )}

                <Menu.Root>
                  <Menu.Trigger
                    ref={menuTriggerRef}
                    hidden={renaming}
                    aria-label='智能体更多操作'
                    title='更多操作'
                    className='flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-(--foreground-subtle) transition hover:bg-white/4 hover:text-(--foreground) focus-visible:outline-2 focus-visible:outline-(--accent) md:h-9 md:w-9'
                    {...tm('EA.identity-menu')}
                  >
                    <Ellipsis aria-hidden='true' className='h-5 w-5' />
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner
                      align='end'
                      sideOffset={6}
                      collisionPadding={16}
                      className='z-[60]'
                    >
                      <Menu.Popup
                        finalFocus={() =>
                          deleteOpen
                            ? false
                            : renameFormRef.current?.querySelector('input') ??
                              menuTriggerRef.current}
                        className={cn(dropdownPopupClassName, 'w-56')}
                      >
                        <div className={dropdownScrollClassName}>
                          <Menu.Item
                            onClick={beginRename}
                            className={dropdownItemClassName}
                          >
                            <Pencil aria-hidden='true' className='h-4 w-4' />
                            重命名
                          </Menu.Item>
                          <div
                            role='separator'
                            className='mx-2.5 my-1 border-t border-(--border-soft)'
                          />
                          <Menu.Item
                            disabled={archiveBusy}
                            onClick={() => {
                              if (canDelete && !isArchived) {
                                setDeleteError(null)
                                setDeleteOpen(true)
                              } else {
                                void changeArchive()
                              }
                            }}
                            className={cn(
                              dropdownItemClassName,
                              'text-(--accent) data-[highlighted]:text-(--accent) data-[disabled]:text-(--foreground-subtle)',
                            )}
                          >
                            {isArchived
                              ? (
                                <ArchiveRestore
                                  aria-hidden='true'
                                  className='h-4 w-4'
                                />
                              )
                              : canDelete
                              ? (
                                <Trash2
                                  aria-hidden='true'
                                  className='h-4 w-4'
                                />
                              )
                              : (
                                <Archive
                                  aria-hidden='true'
                                  className='h-4 w-4'
                                />
                              )}
                            {archiveBusy
                              ? '处理中…'
                              : isArchived
                              ? '恢复智能体'
                              : canDelete
                              ? '删除智能体'
                              : '归档智能体'}
                          </Menu.Item>
                        </div>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              </div>
              <p
                className='mt-1 text-sm text-(--foreground-subtle)'
                {...tm('EA.subtitle')}
              >
                {data.scenario.summary.title} ·{' '}
                {data.draft.side === 'a' ? '甲方' : '乙方'} ·{' '}
                {data.versions.length} 个版本 ·{' '}
                <span
                  className='font-mono text-xs text-(--foreground-muted)'
                  {...tm('EA.agent-id')}
                >
                  #{agentID}
                </span>
              </p>
            </header>

            {isArchived && (
              <p className='flex items-center gap-2 text-sm text-(--foreground-subtle)'>
                <Archive aria-hidden='true' className='h-4 w-4' />
                此智能体已归档。
                <Link
                  to='/settings/archived-agents'
                  className='underline underline-offset-4'
                >
                  查看归档
                </Link>
              </p>
            )}

            {actionError
              ? (
                <p
                  role='alert'
                  className='text-sm text-(--accent)'
                  {...tm('EA.action-error')}
                >
                  {actionError}
                </p>
              )
              : null}
            {expressError
              ? (
                <p
                  role='alert'
                  className='text-sm text-(--accent)'
                  {...tm('EA.express-error')}
                >
                  {expressError}
                </p>
              )
              : null}
            {savedVersionID != null && entryVersion != null &&
                entryVersion.id !== savedVersionID
              ? (
                <p
                  className='rounded-md border border-(--border-soft) bg-white/2 px-3 py-2 text-xs text-(--foreground-subtle)'
                  {...tm('EA.entry-notice')}
                >
                  ★参赛版本仍是{' '}
                  {versionTag(entryVersion, sorted)}；新版本不会自动参赛。
                </p>
              )
              : null}

            <nav
              aria-label='同角色智能体'
              className='flex min-w-0 flex-wrap items-center gap-2'
              {...tm('EA.sibling-pills')}
            >
              <div
                ref={railRef}
                className='flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1'
              >
                {railAgents.map((sibling) => {
                  const siblingName = sibling.agentID === agentID
                    ? currentName
                    : sibling.name
                  const active = sibling.agentID === agentID
                  return (
                    <Link
                      key={sibling.agentID}
                      to={`/agents/${sibling.agentID}`}
                      aria-current={active ? 'page' : undefined}
                      className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition focus-visible:outline-2 focus-visible:outline-(--accent) md:min-h-0 ${
                        active
                          ? 'border-(--accent) font-semibold text-(--accent)'
                          : 'border-(--border) font-medium text-(--foreground-subtle) hover:border-(--foreground-muted) hover:text-(--foreground)'
                      }`}
                      {...tm('EA.sibling-pill')}
                    >
                      {displayName(sideName, sibling.agentID, siblingName)}
                    </Link>
                  )
                })}
              </div>
              <CreateAgentAction
                marker={tm('EA.sibling-create-button')['data-tm']}
                scenarioID={data.draft.scenarioID}
                side={data.draft.side}
                role={sideName}
                oppositeRole={data.draft.side === 'a'
                  ? data.scenario.summary.sideBName
                  : data.scenario.summary.sideAName}
              />
            </nav>

            <PlayerProfileRecord
              versions={data.versions}
              selectedID={selectedVersionID}
              onSelect={setSelectedVersionID}
            />

            <VersionList
              versions={data.versions}
              selectedVersionID={selectedVersionID ?? sorted[0]?.id ?? null}
              sideName={sideName}
              entryBusy={entryMutation != null}
              pendingEntryID={entryMutation?.agentID === agentID
                ? entryMutation.versionID
                : null}
              onSetEntry={(versionID) => void markEntry(versionID)}
              onField={(version) => {
                setPreferVersionID(version.id)
                setOsOpen(true)
              }}
              fieldMarker={tm('EA.field-button')['data-tm']}
              headingAside={null}
              headingAction={
                <span
                  className='inline-flex'
                  {...(sorted.length === 0
                    ? tm('EA.version-empty-build-button')
                    : {})}
                >
                  <ButtonLink
                    to={`/agents/${agentID}/build${
                      new URLSearchParams(location.search).get('express') ===
                          '1'
                        ? `?${new URLSearchParams({
                          scenario: data.draft.scenarioID,
                          side: data.draft.side,
                          express: '1',
                        })}`
                        : ''
                    }`}
                    size='sm'
                    variant='ghost'
                    className='h-11 w-11 shrink-0 cursor-pointer p-0 text-white md:h-8 md:w-8'
                    aria-label='新建版本'
                    title='新建版本'
                    {...tm('EA.edit-button')}
                  >
                    <span aria-hidden='true' className='relative h-5 w-5'>
                      <Pencil className='h-5 w-5' strokeWidth={1.8} />
                      <Plus
                        className='absolute -right-1 -bottom-0.5 h-3 w-3 rounded-sm bg-(--background)'
                        strokeWidth={2}
                      />
                    </span>
                  </ButtonLink>
                </span>
              }
              emptyState={
                <div
                  className='rounded-lg border border-dashed border-(--border-soft) px-4 py-8 text-center'
                  {...tm('EA.version-empty')}
                >
                  <p className='text-sm font-medium text-(--foreground)'>
                    还没有保存过版本
                  </p>
                </div>
              }
            />

            {entryNotice != null
              ? (
                <div
                  role='status'
                  className='fixed bottom-24 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-lg border border-(--border) bg-(--surface-elevated) px-4 py-3 text-sm shadow-xl md:bottom-8'
                >
                  <Check
                    aria-hidden='true'
                    className='h-4 w-4 text-(--success)'
                  />
                  已设置用此版本参赛
                </div>
              )
              : null}

            {deleteOpen
              ? (
                <Modal
                  title='删除智能体'
                  marker={tm('EA.delete-dialog')['data-tm']}
                  returnFocus={menuTriggerRef.current}
                  onClose={() => {
                    if (!deleteBusy) setDeleteOpen(false)
                  }}
                >
                  <p className='text-sm text-(--foreground-subtle)'>
                    删除{displayName(
                      sideName,
                      agentID,
                      currentName,
                    )}？此智能体还没有保存的版本；草稿也会一并删除。
                  </p>
                  {deleteError
                    ? (
                      <p role='alert' className='text-sm text-(--accent)'>
                        {deleteError}
                      </p>
                    )
                    : null}
                  <div className='flex justify-end gap-2'>
                    <Button
                      variant='secondary'
                      className='h-11 cursor-pointer md:h-10'
                      disabled={deleteBusy}
                      onClick={() => setDeleteOpen(false)}
                    >
                      取消
                    </Button>
                    <Button
                      className='h-11 cursor-pointer md:h-10'
                      disabled={deleteBusy}
                      onClick={() => void removeAgent()}
                    >
                      {deleteBusy ? '删除中…' : '确认删除'}
                    </Button>
                  </div>
                </Modal>
              )
              : null}

            {sorted.length > 0 && (
              <AgentMatchHistory
                key={selectedVersionID ?? sorted[0].id}
                target={{
                  kind: 'player',
                  agentID,
                  versionID: sorted.find((v) =>
                    v.id === selectedVersionID
                  )?.id ?? sorted[0].id,
                }}
                side={data.draft.side}
              />
            )}

            <OsPanel
              open={osOpen}
              onClose={() => setOsOpen(false)}
              scenario={data.scenario}
              side={data.draft.side}
              versions={data.versions}
              entryVersionID={data.entryVersionID}
              preferVersionID={preferVersionID}
            />
          </>
        )}
    </div>
  )
}
