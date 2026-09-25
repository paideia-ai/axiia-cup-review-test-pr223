import { type ReactNode, useState } from 'react'
import { Link } from 'react-router-dom'

import { agents, npcs } from '../api/client'
import type { MatchSummary, Side } from '../api/types'
import { modelsQuery } from '../lib/navigation-queries'
import { usePageQuery } from '../lib/use-page-query'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Select, SelectItem } from './ui/select'

export interface ProfileVersion {
  id: number
  ordinal?: number
  isEntry: boolean
  modelID?: string
  createdAt?: number
  matchCount?: number
  winCount?: number
  drawCount?: number
  lossCount?: number
}

export function ProfileRecord({
  record,
  label,
  modelID,
  createdAt,
  children,
}: {
  record: Pick<
    ProfileVersion,
    'matchCount' | 'winCount' | 'drawCount' | 'lossCount'
  >
  label: string
  modelID?: string
  createdAt?: number
  children?: ReactNode
}) {
  const models = usePageQuery(modelsQuery())
  const total = record.matchCount ?? 0
  const rate = total > 0
    ? new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(
      (record.winCount ?? 0) / total * 100,
    ) + '%'
    : null
  const model = models.data?.models?.find((item) => item.id === modelID)
  return (
    <section aria-label='版本战绩' data-testid='profile-record'>
      <Card className='overflow-hidden border-(--accent)/30 shadow-none'>
        <CardContent className='space-y-5 pt-5 sm:p-6'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <h2 className='text-sm font-semibold text-(--foreground)'>
              {label}
            </h2>
            {children}
          </div>
          <div className='flex flex-wrap items-end gap-x-10 gap-y-5'>
            <div>
              <p className='text-xs text-(--foreground-subtle)'>胜率</p>
              <p
                className={`mt-2 font-bold tracking-tight text-(--foreground) ${
                  rate ? 'text-5xl sm:text-6xl' : 'text-3xl'
                }`}
                data-testid='profile-win-rate'
              >
                {rate ?? '暂无战绩'}
              </p>
            </div>
            <dl className='grid w-full grid-cols-4 gap-4 pb-1 sm:w-auto sm:min-w-80 sm:max-w-sm sm:flex-1'>
              {[
                ['有效完赛', total],
                ['胜', record.winCount ?? 0],
                ['负', total === 0 ? 0 : record.lossCount ?? '—'],
                ['平', total === 0 ? 0 : record.drawCount ?? '—'],
              ].map(([title, value]) => (
                <div key={title}>
                  <dt className='whitespace-nowrap text-xs text-(--foreground-subtle)'>
                    {title}
                  </dt>
                  <dd className='mt-2 text-2xl font-semibold tabular-nums text-(--foreground)'>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className='space-y-1 border-t border-(--border-soft) pt-4 text-xs leading-6 text-(--foreground-subtle)'>
            {modelID && (
              <p>
                模型：{model?.label ?? modelID}
                {createdAt
                  ? ` · 保存于 ${
                    new Date(createdAt * 1000).toLocaleDateString('zh-CN')
                  }`
                  : ''}
              </p>
            )}
            <p>
              胜率 = 胜场 ÷
              有效完赛场次。包含所有对局类型，平局计入分母；失败、取消与未完成的对局不计入。
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

export function PlayerProfileRecord({
  versions,
  selectedID,
  onSelect,
}: {
  versions: ProfileVersion[]
  selectedID: number | null
  onSelect: (id: number) => void
}) {
  const sorted = [...versions].sort((a, b) => b.id - a.id)
  const selected = sorted.find((v) => v.id === selectedID) ?? sorted[0]
  const ordinal = (version: ProfileVersion) =>
    version.ordinal ?? sorted.filter((v) => v.id <= version.id).length
  const current = selected?.id === sorted[0]?.id
  return (
    <ProfileRecord
      record={selected ?? {}}
      label={selected
        ? `${current ? '当前版本' : '历史版本'} · v${ordinal(selected)}${
          selected.isEntry ? ' · 参赛版本' : ''
        }`
        : '当前版本 · 尚未保存'}
      modelID={selected?.modelID}
      createdAt={selected?.createdAt}
    >
      {sorted.length > 1 && (
        <div className='w-52'>
          <Select
            placeholder='查看版本'
            renderValue={(value) => {
              const version = sorted.find((item) => String(item.id) === value)
              return version
                ? `v${ordinal(version)}${
                  version.id === sorted[0]?.id ? ' · 当前版本' : ''
                }${version.isEntry ? ' · 参赛版本' : ''}`
                : value
            }}
            value={String(selected?.id ?? '')}
            onValueChange={(value) => {
              if (value) onSelect(Number(value))
            }}
          >
            {sorted.map((version, index) => (
              <SelectItem key={version.id} value={String(version.id)}>
                v{ordinal(version)}
                {index === 0 ? ' · 当前版本' : ''}
                {version.isEntry ? ' · 参赛版本' : ''}
              </SelectItem>
            ))}
          </Select>
        </div>
      )}
    </ProfileRecord>
  )
}

function resultOf(match: MatchSummary, side: Side) {
  // A job can fail before dispatch; a terminal result must never look queued.
  if (!match.finished) return match.dispatched ? '进行中' : '排队中'
  if (!match.scored) return '未计分'
  if (!match.winner) return '未计分'
  if (match.winner === 'draw') return '平'
  if (!['a', 'b'].includes(match.winner)) return '未计分'
  return match.winner === side ? '胜' : '负'
}

type HistoryTarget = { kind: 'player'; agentID: number; versionID: number } | {
  kind: 'npc'
  scenarioID: string
  presetKey: string
}

export function AgentMatchHistory(
  { target, side }: { target: HistoryTarget; side: Side },
) {
  const [cursors, setCursors] = useState<number[]>([])
  const before = cursors.at(-1)
  const identity = target.kind === 'player'
    ? [target.agentID, target.versionID]
    : [target.scenarioID, target.presetKey]
  const query = usePageQuery({
    queryKey: ['matches', 'profile', target.kind, ...identity, before],
    queryFn: () =>
      target.kind === 'player'
        ? agents.history(target.agentID, target.versionID, before)
        : npcs.history(target.scenarioID, target.presetKey, before),
  })
  const rows = query.data?.matches ?? []
  return (
    <section
      aria-label='对战记录'
      className='space-y-3 border-t border-(--border-soft) pt-6'
      data-testid='profile-history'
    >
      <div>
        <h2 className='text-base font-semibold text-(--foreground)'>
          对战记录
        </h2>
        <p className='mt-1 text-xs leading-6 text-(--foreground-subtle)'>
          所选版本的对局，按时间倒序排列。仅展示你有权查看的记录，因此条数可能少于战绩统计。
        </p>
      </div>
      {query.loading
        ? <p role='status' className='text-sm'>正在加载对战记录…</p>
        : query.error
        ? (
          <div className='flex flex-wrap items-center gap-3'>
            <p role='alert' className='text-sm text-(--foreground-subtle)'>
              暂时无法加载对战记录。
            </p>
            <Button variant='secondary' onClick={query.reload}>重试</Button>
          </div>
        )
        : rows.length === 0
        ? (
          <p className='rounded-lg border border-dashed border-(--border-soft) px-4 py-8 text-center text-sm text-(--foreground-subtle)'>
            暂无可查看的对战记录
          </p>
        )
        : (
          <ul className='divide-y divide-(--border-soft) rounded-lg border border-(--border-soft)'>
            {rows.map((match) => {
              const result = resultOf(match, side)
              const opponent = match.participants?.[side === 'a' ? 'b' : 'a']
              const at = match.finishedAt ?? match.createdAt
              return (
                <li key={match.id}>
                  <Link
                    to={`/matches/${match.id}`}
                    className='flex min-h-20 items-center gap-4 px-4 py-3 transition hover:bg-white/3'
                  >
                    <span
                      className={`flex h-9 min-w-12 shrink-0 items-center justify-center rounded-md px-1 text-sm font-semibold ${
                        result === '胜'
                          ? 'bg-(--success)/10 text-(--success)'
                          : result === '负'
                          ? 'bg-(--accent)/10 text-(--accent)'
                          : 'bg-white/5 text-(--foreground-subtle)'
                      }`}
                    >
                      {result}
                    </span>
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate text-sm text-(--foreground)'>
                        对战 #{match.id} · {opponent?.ownerDisplayName ??
                          (opponent?.presetKey ? '官方 NPC' : '对手')}
                      </span>
                      <span className='mt-1 block text-xs text-(--foreground-subtle)'>
                        {at
                          ? new Date(at * 1000).toLocaleString('zh-CN')
                          : '查看战报'}
                        {opponent?.versionID
                          ? ` · 对手版本 #${opponent.versionID}`
                          : ''}
                      </span>
                    </span>
                    <span
                      aria-hidden='true'
                      className='text-(--foreground-subtle)'
                    >
                      →
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      {(cursors.length > 0 || rows.length === 20) && (
        <div className='flex items-center justify-end gap-2'>
          <Button
            variant='secondary'
            disabled={cursors.length === 0 || query.loading}
            onClick={() => setCursors((value) => value.slice(0, -1))}
          >
            上一页
          </Button>
          <Button
            variant='secondary'
            disabled={rows.length < 20 || query.loading}
            onClick={() => setCursors((value) => [...value, rows.at(-1)!.id])}
          >
            下一页
          </Button>
        </div>
      )}
    </section>
  )
}
