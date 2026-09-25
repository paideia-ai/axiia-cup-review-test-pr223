import { CreateAgentAction } from '../components/create-agent-action'
import { PageLoading } from '../components/page-loading'
import { Clock, Hammer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import type {
  MyAgentDTO,
  ScenarioScoringDTO,
  ScenarioSummary,
  Side,
} from '../api/types'
import { Accordion, AccordionItem } from '../components/ui/accordion'
import { Badge } from '../components/ui/badge'
import { Button, ButtonLink } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { gateMet, sideMet, sideProgressText } from '../lib/gate'
import { usePageQuery } from '../lib/use-page-query'
import { inventoryQuery, scenarioQuery } from '../lib/navigation-queries'
import {
  DIFFICULTY_LABEL,
  scenarioGuidance,
  scenarioModule,
} from '../scenarios'
import { tm } from '../testmode/mark'
import { useAuth } from '../context/auth'
import type {
  ScenarioEducation,
  ScenarioHiddenGoalList,
  ScenarioIntroCollection,
  ScenarioIntroCopy,
  ScenarioIntroFact,
  ScenarioIntroImage,
  ScenarioIntroSide,
  ScenarioIntroTimeline,
} from '../scenarios/types'

// 场景介绍的主体为四张顶层卡：背景故事、甲方、乙方、裁判与计分。
// 个别场景可把游戏流程从背景故事中移到末尾，成为独立卡片。
// `module.intro.source` 逐字来自 docs/competition/scenario-intro.html；这里可以
// 重排，但不改写或省略。计分、难度、时长和状态属于额外的产品信息，单独渲染。
export function ScenarioDetailPage() {
  const { scenarioId = '' } = useParams()
  const { account, isLoading: authLoading } = useAuth()
  const module = scenarioModule(scenarioId)
  const intro = module?.intro ?? null
  const education = module?.education ?? null

  const { data, error, loading: queryLoading } = usePageQuery(
    {
      ...scenarioQuery(scenarioId, 'a', account ? 'include' : 'omit'),
      enabled: !authLoading,
    },
  )
  const loading = authLoading || queryLoading

  const {
    data: mine,
    error: mineError,
    loading: mineLoading,
    reload: reloadMine,
  } = usePageQuery({
    ...inventoryQuery(),
    enabled: !!account,
  })
  const mineOf = (side: Side) =>
    mine?.scenarios.find((item) => item.scenarioID === scenarioId)
      ?.sides[side].filter((agent) => !agent.isArchived) ?? []

  return (
    <div className='mx-auto w-full max-w-6xl space-y-6' {...tm('DA.page')}>
      {loading
        ? <PageLoading variant='detail' {...tm('DA.loading')} />
        : error
        ? (
          <p className='text-sm text-(--accent)' {...tm('DA.error')}>
            {error}
          </p>
        )
        : data
        ? (
          <>
            <header
              className='flex flex-wrap items-start justify-between gap-4'
              {...tm('DA.page-header')}
            >
              <div>
                {intro?.source.category
                  ? (
                    <p className='mb-2 text-xs font-semibold tracking-[0.1em] text-(--accent)'>
                      {intro.source.category}
                    </p>
                  )
                  : null}
                <h1 className='text-2xl font-black tracking-tight text-(--foreground) sm:text-3xl'>
                  {intro?.source.title ?? data.summary.title}
                </h1>
                <p className='mt-2 text-sm text-(--foreground-subtle)'>
                  {data.summary.subject}
                </p>
                <p
                  className='mt-3 text-xs text-(--foreground-muted)'
                  {...tm('DA.header-matchup')}
                >
                  {module?.hideHeaderMatchup
                    ? education?.formatLabel ?? `${data.summary.turnCount} 轮`
                    : (
                      <>
                        {intro?.source.participants.sides.a.name ??
                          data.summary.sideAName} 对{' '}
                        {intro?.source.participants.sides.b.name ??
                          data.summary.sideBName} · {education?.formatLabel ??
                          `${data.summary.turnCount} 轮`}
                      </>
                    )}
                </p>
              </div>
              {account ? <GateStatus summary={data.summary} /> : null}
            </header>

            <OverviewCard
              intro={intro}
              education={education}
              summary={data.summary}
              images={module?.overviewImages ?? null}
              factImages={module?.overviewFactImages ?? null}
              timelineAtEnd={module?.timelineAtEnd ?? false}
            />

            <section
              className='space-y-3'
              aria-labelledby='participants-title'
              {...tm('DA.participants-section')}
            >
              <div>
                <h2
                  id='participants-title'
                  className='text-lg font-bold text-(--foreground)'
                >
                  {intro?.source.participants.title ?? '双方与胜利条件'}
                </h2>
                {intro?.source.participants.intro
                  ? (
                    <p className='mt-1 text-sm leading-relaxed text-(--foreground-subtle)'>
                      {intro.source.participants.intro}
                    </p>
                  )
                  : null}
              </div>

              <div className='grid items-start gap-4 md:grid-cols-2'>
                {(['a', 'b'] as const).map((side) => (
                  <SideCard
                    key={side}
                    side={side}
                    scenarioID={scenarioId}
                    copy={intro?.source.participants.sides[side] ?? null}
                    fallbackName={side === 'a'
                      ? data.summary.sideAName
                      : data.summary.sideBName}
                    fallbackLabel={side === 'a'
                      ? data.summary.sideALabel
                      : data.summary.sideBLabel}
                    fallbackGoal={education?.winConditions[side] ?? null}
                    hiddenGoals={module?.hiddenGoals?.[side] ?? null}
                    agents={!account ? [] : mine == null ? null : mineOf(side)}
                    inventoryError={mineError}
                    inventoryLoading={mineLoading}
                    onRetryInventory={reloadMine}
                  />
                ))}
              </div>
            </section>

            {data.presets.length > 0 && (
              <section aria-label='官方 NPC' className='space-y-3'>
                <h2 className='text-lg font-bold text-(--foreground)'>
                  官方 NPC
                </h2>
                <p className='text-sm text-(--foreground-subtle)'>
                  查看对手的策略、当前版本胜率与对战记录。
                </p>
                <div className='flex flex-wrap gap-2'>
                  {data.presets.map((preset) => (
                    <Link
                      key={preset.key}
                      to={`/scenarios/${encodeURIComponent(scenarioId)}/npcs/${
                        encodeURIComponent(preset.key)
                      }`}
                      className='inline-flex min-h-11 items-center rounded-lg border border-(--border) px-4 py-2 text-sm text-(--foreground-subtle) transition hover:border-(--foreground-muted) hover:text-(--foreground)'
                    >
                      {preset.side === 'a'
                        ? data.summary.sideAName
                        : data.summary.sideBName}「{preset.label}」
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <JudgeScoringCard
              intro={intro}
              education={education}
              scoring={data.scoring ?? null}
              scoringLabel={module?.scoringLabel ?? '计分规则'}
              scoringInitiallyCollapsed={module?.scoringInitiallyCollapsed ??
                false}
            />

            {module?.timelineAtEnd && intro?.source.overview.timeline
              ? <TimelineCard timeline={intro.source.overview.timeline} />
              : null}
          </>
        )
        : null}
    </div>
  )
}

function OverviewCard({
  intro,
  education,
  summary,
  images,
  factImages,
  timelineAtEnd,
}: {
  intro: ScenarioIntroCopy | null
  education: ScenarioEducation | null
  summary: ScenarioSummary
  images: ScenarioIntroImage[] | null
  factImages: Record<string, ScenarioIntroImage> | null
  timelineAtEnd: boolean
}) {
  const overview = intro?.source.overview ?? null
  const guidance = scenarioGuidance(summary, education)
  return (
    <Card data-testid='scenario-intro-card' {...tm('DA.overview-card')}>
      <CardContent className='space-y-5 pt-5'>
        <div className='space-y-3' {...tm('DA.overview-story')}>
          <p className='text-[11px] font-semibold tracking-[0.1em] text-(--foreground-muted)'>
            01 · {overview?.label ?? '场景介绍'}
          </p>
          {overview
            ? (
              <>
                <h2 className='text-xl font-bold leading-snug text-(--foreground) sm:text-2xl'>
                  {overview.title}
                </h2>
                {overview.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className='max-w-5xl text-sm leading-7 text-(--foreground-subtle)'
                  >
                    {paragraph}
                  </p>
                ))}
              </>
            )
            : (
              <p
                className='rounded-md border border-dashed border-(--border-soft) px-3 py-2 text-xs text-(--foreground-muted)'
                {...tm('DA.overview-empty')}
              >
                场景导读整理中
              </p>
            )}
        </div>

        {images && images.length > 0
          ? <ScenarioOverviewImages images={images} />
          : null}

        {overview?.facts && overview.facts.length > 0
          ? (
            <div
              className='grid gap-3 md:grid-cols-3'
              {...tm('DA.overview-facts')}
            >
              {overview.facts.map((fact) => (
                <OverviewFactCard
                  key={fact.title}
                  fact={fact}
                  image={factImages?.[fact.title] ?? null}
                />
              ))}
            </div>
          )
          : null}

        {overview?.timeline && !timelineAtEnd
          ? (
            <section
              className='space-y-3 border-t border-(--border-soft) pt-5'
              {...tm('DA.timeline')}
            >
              <h3 className='text-base font-semibold text-(--foreground)'>
                {overview.timeline.title}
              </h3>
              <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                {overview.timeline.items.map((item) => (
                  <article
                    key={`${item.step}:${item.title}`}
                    className='rounded-lg border border-(--border-soft) bg-white/2 p-4'
                  >
                    <p className='font-mono text-xs text-(--warning)'>
                      {item.step}
                    </p>
                    <h4 className='mt-2 text-sm font-semibold text-(--foreground)'>
                      {item.title}
                    </h4>
                    <p className='mt-2 text-xs leading-6 text-(--foreground-subtle)'>
                      {item.text}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )
          : null}

        {overview?.actions
          ? (
            <CollectionBlock
              collection={overview.actions}
              mark={tm('DA.actions-list')}
            />
          )
          : null}

        {intro?.source.participants.note
          ? (
            <div
              className='rounded-lg border border-(--warning)/35 bg-(--warning)/5 px-4 py-3 sm:flex sm:items-baseline sm:gap-3'
              {...tm('DA.participants-note')}
            >
              <strong className='text-sm text-(--warning)'>
                {intro.source.participants.note.title}
              </strong>
              <p className='mt-1 text-sm leading-6 text-(--foreground-subtle) sm:mt-0'>
                {intro.source.participants.note.text}
              </p>
            </div>
          )
          : null}

        {guidance.difficulty != null || guidance.minutes != null ||
            guidance.noviceFriendly || education?.formatLabel
          ? (
            <div
              className='flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-(--border-soft) pt-4 text-xs text-(--foreground-subtle)'
              {...tm('DA.education-row')}
            >
              {guidance.difficulty != null
                ? (
                  <span title={`难度 ${guidance.difficulty} / 3`}>
                    难度 {DIFFICULTY_LABEL[guidance.difficulty]}{' '}
                    <span
                      aria-hidden='true'
                      className='tracking-[0.12em] text-(--warning)'
                    >
                      {'★'.repeat(guidance.difficulty)}
                      <span className='text-(--foreground-muted)'>
                        {'☆'.repeat(3 - guidance.difficulty)}
                      </span>
                    </span>
                  </span>
                )
                : null}
              {guidance.minutes != null
                ? (
                  <span className='inline-flex items-center gap-1'>
                    <Clock className='h-3.5 w-3.5' />
                    一场约 {guidance.minutes} 分钟
                  </span>
                )
                : null}
              {education?.formatLabel
                ? <span>{education.formatLabel}</span>
                : null}
              {guidance.noviceFriendly
                ? <Badge tone='success'>适合新手</Badge>
                : null}
            </div>
          )
          : null}

        {statsLine(summary)
          ? (
            <p
              className='rounded-md border border-(--border-soft) bg-white/2 px-3 py-2 text-xs text-(--foreground-subtle)'
              {...tm('DA.stats-line')}
            >
              <span className='mr-2 font-semibold tracking-[0.06em] text-(--foreground-muted)'>
                侧方胜率
              </span>
              {statsLine(summary)}
            </p>
          )
          : (
            <p
              className='rounded-md border border-dashed border-(--border-soft) px-3 py-2 text-xs text-(--foreground-muted)'
              {...tm('DA.stats-empty')}
            >
              数据积累中
            </p>
          )}
      </CardContent>
    </Card>
  )
}

function ScenarioOverviewImages({ images }: { images: ScenarioIntroImage[] }) {
  return (
    <div
      className={`grid gap-3 ${
        images.length > 1 ? 'sm:grid-cols-2' : 'mx-auto w-full max-w-xl'
      }`}
      data-testid='scenario-overview-images'
    >
      {images.map((image) => (
        <figure
          key={image.src}
          className='overflow-hidden rounded-lg border border-(--border-soft) bg-white'
        >
          <img
            alt={image.alt}
            className='aspect-[4/3] w-full object-contain'
            loading='eager'
            src={image.src}
          />
          {image.caption
            ? (
              <figcaption className='border-t border-(--border-soft) bg-(--background) px-3 py-2 text-xs text-(--foreground-subtle)'>
                {image.caption}
              </figcaption>
            )
            : null}
        </figure>
      ))}
    </div>
  )
}

function TimelineCard({ timeline }: { timeline: ScenarioIntroTimeline }) {
  return (
    <Card data-testid='scenario-intro-card' {...tm('DA.timeline')}>
      <CardContent className='space-y-4 pt-5'>
        <h2 className='text-xl font-bold text-(--foreground)'>
          {timeline.title}
        </h2>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {timeline.items.map((item) => (
            <article
              key={`${item.step}:${item.title}`}
              className='rounded-lg border border-(--border-soft) bg-white/2 p-4'
            >
              <p className='font-mono text-xs text-(--warning)'>
                {item.step}
              </p>
              <h3 className='mt-2 text-sm font-semibold text-(--foreground)'>
                {item.title}
              </h3>
              <p className='mt-2 text-xs leading-6 text-(--foreground-subtle)'>
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function OverviewFactCard({
  fact,
  image,
}: {
  fact: ScenarioIntroFact
  image: ScenarioIntroImage | null
}) {
  return (
    <article className='rounded-lg border border-(--border-soft) bg-white/2 p-4'>
      {image
        ? (
          <img
            alt={image.alt}
            className='mb-4 aspect-[4/3] w-full rounded-md border border-(--border-soft) bg-white object-contain'
            loading='lazy'
            src={image.src}
          />
        )
        : null}
      <h3 className='text-sm font-semibold text-(--foreground)'>
        {fact.title}
      </h3>
      <p className='mt-2 text-xs leading-6 text-(--foreground-subtle)'>
        {fact.text}
      </p>
    </article>
  )
}

function CollectionBlock(
  { collection, mark }: {
    collection: ScenarioIntroCollection
    /** 测试模式标记：两处调用各自一个 id（见 testmode/registry/discovery.ts） */
    mark: ReturnType<typeof tm>
  },
) {
  return (
    <section
      className='space-y-3 border-t border-(--border-soft) pt-5'
      {...mark}
    >
      <div>
        <h3 className='text-base font-semibold text-(--foreground)'>
          {collection.title}
        </h3>
        {collection.intro
          ? (
            <p className='mt-2 max-w-5xl text-sm leading-7 text-(--foreground-subtle)'>
              {collection.intro}
            </p>
          )
          : null}
      </div>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        {collection.items.map((item) => (
          <article
            key={`${item.title}:${item.text}`}
            className='rounded-lg border border-(--border-soft) bg-white/2 p-4'
          >
            <h4 className='text-sm font-semibold text-(--foreground)'>
              {item.title}
            </h4>
            <p className='mt-2 text-xs leading-6 text-(--foreground-subtle)'>
              {item.text}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

function SideCard({
  side,
  scenarioID,
  copy,
  fallbackName,
  fallbackLabel,
  fallbackGoal,
  hiddenGoals,
  agents,
  inventoryError,
  inventoryLoading,
  onRetryInventory,
}: {
  side: Side
  scenarioID: string
  copy: ScenarioIntroSide | null
  fallbackName: string
  fallbackLabel: string | null | undefined
  fallbackGoal: string | null
  hiddenGoals: ScenarioHiddenGoalList | null
  agents: MyAgentDTO[] | null
  inventoryError: string | null
  inventoryLoading: boolean
  onRetryInventory: () => void
}) {
  const { account } = useAuth()
  const name = copy?.name ?? fallbackName
  const homeAgent = agents?.find((agent) => agent.entryVersionID != null) ??
    agents?.[0]
  return (
    <Card data-testid='scenario-intro-card' {...tm('DA.side-card')}>
      <CardContent className='flex flex-col gap-4 pt-5'>
        <div>
          <p className='text-[11px] font-semibold tracking-[0.1em] text-(--foreground-muted)'>
            {side === 'a' ? '02' : '03'} · {copy?.eyebrow ??
              (side === 'a' ? '甲方' : '乙方')}
          </p>
          <h3 className='mt-2 text-xl font-bold text-(--foreground)'>
            {name}
          </h3>
          {(copy ? copy.subtitle : fallbackLabel)
            ? (
              <p className='mt-1 text-xs text-(--foreground-muted)'>
                {copy ? copy.subtitle : fallbackLabel}
              </p>
            )
            : null}
        </div>

        <div className='space-y-4'>
          {copy?.paragraphs.map((paragraph) => (
            <p
              key={paragraph}
              className='text-sm leading-7 text-(--foreground-subtle)'
            >
              {paragraph}
            </p>
          ))}
        </div>

        <div
          className='rounded-lg border border-(--border-soft) bg-black/10 p-3'
          {...tm('DA.side-goal')}
        >
          <p className='text-[11px] font-semibold tracking-[0.08em] text-(--foreground-muted)'>
            {copy?.goalLabel ?? '胜利条件'}
          </p>
          <p className='mt-1 text-sm leading-6 text-(--foreground-subtle)'>
            {copy?.goal ?? fallbackGoal ?? '胜利条件文案整理中'}
          </p>
        </div>

        {copy?.choices && copy.choices.length > 0
          ? (
            <div className='space-y-2' {...tm('DA.side-choices')}>
              {copy.choices.map((choice) => {
                const roleGoals = hiddenGoals?.groups.find((group) =>
                  group.role === choice.name
                )
                return (
                  <div key={choice.name} className='space-y-2'>
                    <section className='rounded-lg border border-(--border-soft) bg-white/2 p-3'>
                      <h4 className='text-sm font-semibold text-(--foreground)'>
                        {choice.name}
                      </h4>
                      <p className='mt-1 text-xs leading-6 text-(--foreground-subtle)'>
                        {choice.text}
                      </p>
                    </section>
                    {roleGoals && hiddenGoals
                      ? (
                        <HiddenGoalList
                          goals={{
                            note: hiddenGoals.note,
                            groups: [roleGoals],
                          }}
                          showRole={false}
                        />
                      )
                      : null}
                  </div>
                )
              })}
            </div>
          )
          : null}

        {hiddenGoals && hiddenGoals.groups.every((group) => !group.role)
          ? <HiddenGoalList goals={hiddenGoals} />
          : null}

        {agents != null && agents.length > 0
          ? (
            <p
              className='text-xs text-(--foreground-muted)'
              {...tm('DA.side-owned-note')}
            >
              你已有 {agents.length} 个{name}：{' '}
              {agents.map((agent) => agent.name ?? `#${agent.agentID}`).join(
                ' · ',
              )}
            </p>
          )
          : null}

        <div
          className='mt-auto flex flex-wrap items-center gap-2 pt-1'
          {...tm('DA.side-actions')}
        >
          {agents == null
            ? inventoryError != null
              ? (
                <div
                  className='flex flex-wrap items-center gap-2 text-xs text-(--foreground-muted)'
                  role='alert'
                >
                  <span>我的{name}清单加载失败：{inventoryError}</span>
                  <Button
                    size='sm'
                    variant='secondary'
                    onClick={onRetryInventory}
                  >
                    重试清单
                  </Button>
                </div>
              )
              : (
                <Button size='sm' variant='secondary' disabled>
                  {inventoryLoading
                    ? `正在确认我的${name}…`
                    : `暂时无法确认我的${name}`}
                </Button>
              )
            : !account
            ? (
              <ButtonLink
                size='sm'
                data-testid={side === 'a' ? 'build-agent' : 'build-agent-b'}
                to={`/scenarios/${
                  encodeURIComponent(scenarioID)
                }/build?side=${side}`}
                {...tm('DA.build-button')}
              >
                <Hammer className='mr-1.5 h-3.5 w-3.5' />
                {copy?.actionLabel ?? `去构建${name}`}
              </ButtonLink>
            )
            : (
              <>
                <CreateAgentAction
                  scenarioID={scenarioID}
                  side={side}
                  role={name}
                  testID={agents.length === 0
                    ? (side === 'a' ? 'build-agent' : 'build-agent-b')
                    : undefined}
                  marker={agents.length === 0
                    ? tm('DA.build-button')['data-tm']
                    : tm('DA.build-more-button')['data-tm']}
                >
                  <Hammer className='mr-1.5 h-3.5 w-3.5' />
                  {agents.length === 0
                    ? (copy?.actionLabel ?? `去构建${name}`)
                    : `再建一个${name}`}
                </CreateAgentAction>
                {homeAgent && (
                  <Link
                    to={`/agents/${homeAgent.agentID}`}
                    className='ml-auto inline-flex min-h-11 cursor-pointer items-center rounded-md px-2 text-xs text-(--foreground-muted) transition hover:text-(--foreground-subtle) hover:underline focus-visible:outline-2 focus-visible:outline-(--accent) md:min-h-8'
                    {...tm('DA.view-mine-button')}
                  >
                    查看我的{name}（{agents.length}）
                  </Link>
                )}
              </>
            )}
        </div>
      </CardContent>
    </Card>
  )
}

function HiddenGoalList({
  goals,
  showRole = true,
}: {
  goals: ScenarioHiddenGoalList
  showRole?: boolean
}) {
  return (
    <section
      className='overflow-hidden rounded-lg border border-(--border-soft) bg-white/2 px-3'
      {...tm('DA.hidden-goals')}
    >
      <Accordion className='divide-y-0'>
        <AccordionItem
          value='hidden-goals'
          title='隐藏目标列表'
          triggerClassName='text-xs font-medium tracking-[0.04em] text-(--foreground-muted)'
        >
          <div className='space-y-3 border-t border-(--border-soft) pt-3'>
            <p className='text-[11px] leading-5 text-(--foreground-muted)'>
              {goals.note}
            </p>
            {goals.groups.map((group, groupIndex) => (
              <div
                key={group.role ?? groupIndex}
                className={groupIndex === 0
                  ? 'space-y-2'
                  : 'space-y-2 border-t border-(--border-soft) pt-3'}
              >
                {showRole && group.role
                  ? (
                    <h5 className='text-xs font-medium text-(--foreground-subtle)'>
                      {group.role}
                    </h5>
                  )
                  : null}
                <ul className='divide-y divide-(--border-soft)'>
                  {group.options.map((option) => (
                    <li
                      key={option.id}
                      className='grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-2 py-2 text-xs leading-5 text-(--foreground-subtle) first:pt-0 last:pb-0'
                    >
                      <code className='w-fit rounded border border-(--border-soft) bg-black/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-4 text-(--foreground-muted)'>
                        {option.id}
                      </code>
                      <span>{option.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </AccordionItem>
      </Accordion>
    </section>
  )
}

function JudgeScoringCard({
  intro,
  education,
  scoring,
  scoringLabel,
  scoringInitiallyCollapsed,
}: {
  intro: ScenarioIntroCopy | null
  education: ScenarioEducation | null
  scoring: ScenarioScoringDTO | null
  scoringLabel: string
  scoringInitiallyCollapsed: boolean
}) {
  const participants = intro?.source.participants ?? null
  const scoringHeading = scoringLabel === '胜负规则'
    ? '裁判与胜负规则'
    : scoringLabel === '投票规则'
    ? '裁判与投票规则'
    : '裁判与计分'
  return (
    <Card data-testid='scenario-intro-card' {...tm('DA.judge-card')}>
      <CardContent className='space-y-5 pt-5'>
        <h2 className='text-xl font-bold text-(--foreground)'>
          {scoringHeading}
        </h2>
        <div className='grid items-start gap-6 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]'>
          <section
            className='min-w-0 space-y-3 lg:pr-6'
            {...tm('DA.judge-intro')}
          >
            {participants
              ? (
                <div>
                  <p className='text-[11px] font-medium tracking-[0.06em] text-(--foreground-muted)'>
                    裁判
                  </p>
                  <h3 className='mt-2 text-xl font-bold text-(--foreground)'>
                    {participants.judge.name}
                  </h3>
                  <p className='mt-1 text-xs text-(--foreground-muted)'>
                    {participants.judge.label}
                  </p>
                  {participants.judge.paragraphs.map((paragraph) => (
                    <p
                      key={paragraph}
                      className='mt-3 text-sm leading-7 text-(--foreground-subtle)'
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              )
              : (
                <p className='rounded-md border border-dashed border-(--border-soft) px-3 py-2 text-xs text-(--foreground-muted)'>
                  裁判说明整理中
                </p>
              )}
            {education?.judgePrompt
              ? (
                <JudgePromptDisclosure
                  model={education.judgeModel ?? null}
                  note={education.judgePromptNote ?? null}
                  prompt={education.judgePrompt}
                />
              )
              : null}
          </section>
          <ScoringRules
            initiallyCollapsed={scoringInitiallyCollapsed}
            label={scoringLabel}
            scoring={scoring}
            text={education?.scoring ?? '计分规则整理中'}
          />
        </div>
        {participants?.supporting
          ? (
            <CollectionBlock
              collection={participants.supporting}
              mark={tm('DA.supporting-list')}
            />
          )
          : null}
      </CardContent>
    </Card>
  )
}

function ScoringRules({
  initiallyCollapsed,
  label,
  scoring,
  text,
}: {
  initiallyCollapsed: boolean
  label: string
  scoring: ScenarioScoringDTO | null
  text: string
}) {
  if (initiallyCollapsed) {
    return (
      <section
        className='min-w-0 lg:border-l lg:border-(--border-soft) lg:pl-6'
        {...tm('DA.scoring-rules')}
      >
        <Accordion className='divide-y-0'>
          <AccordionItem
            value='scoring-rules'
            title={label}
            triggerClassName='text-lg font-semibold text-(--foreground)'
          >
            <div className='border-t border-(--border-soft) pt-3'>
              <ScoringContent scoring={scoring} text={text} />
            </div>
          </AccordionItem>
        </Accordion>
      </section>
    )
  }
  return (
    <section
      className='min-w-0 lg:border-l lg:border-(--border-soft) lg:pl-6'
      {...tm('DA.scoring-rules')}
    >
      <h3 className='text-lg font-semibold text-(--foreground)'>
        {label}
      </h3>
      <div className='mt-4'>
        <ScoringContent scoring={scoring} text={text} />
      </div>
    </section>
  )
}

function ScoringContent({
  scoring,
  text,
}: {
  scoring: ScenarioScoringDTO | null
  text: string
}) {
  if (!scoring) {
    return (
      <p className='whitespace-pre-line border-l-2 border-(--accent) pl-4 text-sm leading-7 text-(--foreground-subtle)'>
        {text}
      </p>
    )
  }

  return (
    <div className='space-y-5'>
      <p className='whitespace-pre-line text-sm leading-7 text-(--foreground-subtle)'>
        {scoring.summary}
      </p>
      <div className='divide-y divide-(--border-soft) border-y border-(--border-soft)'>
        {scoring.items.map((item) => (
          <ScoreRuleRow
            key={item.id}
            item={item}
          />
        ))}
      </div>
      {scoring.notes?.map((note, index) => (
        <p
          key={`${index}:${note}`}
          className='whitespace-pre-line text-xs leading-6 text-(--foreground-muted)'
        >
          {note}
        </p>
      ))}
    </div>
  )
}

function ScoreRuleRow({ item }: { item: ScenarioScoringDTO['items'][number] }) {
  const score = `${item.points > 0 ? '+' : item.points < 0 ? '−' : ''}${
    Math.abs(item.points)
  }`
  const scoreClassName = item.points > 0
    ? 'bg-emerald-500/12 text-emerald-300 ring-1 ring-inset ring-emerald-500/20'
    : item.points < 0
    ? 'bg-rose-500/12 text-rose-300 ring-1 ring-inset ring-rose-500/20'
    : 'bg-white/5 text-(--foreground-subtle) ring-1 ring-inset ring-(--border-soft)'
  return (
    <div
      className='flex items-center justify-between gap-4 py-3'
      {...tm('DA.score-rule-row')}
    >
      <p className='min-w-0 text-xs font-medium text-(--foreground)'>
        {item.label}
      </p>
      <span
        className={`inline-flex min-w-16 shrink-0 items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${scoreClassName}`}
      >
        {score}
      </span>
    </div>
  )
}

// A4 内容基线「裁判 prompt + 摘要」（u04-c10 裁定）：对局中真实喂给裁判/NPC
// 裁决者的扮演 system prompt 原文，只读、默认收起。文与 script.js 同源
// （runtime-quotes.json，deno task validate 逐字核对）。#51 只豁免
// judgeOsPrompt——裁判内心独白的生成提示维持不公开，因此不在原文之内。
function JudgePromptDisclosure({
  model,
  note,
  prompt,
}: {
  model: string | null
  note: string | null
  prompt: string
}) {
  return (
    <div
      data-testid='judge-prompt'
      className='overflow-hidden rounded-lg border border-(--border-soft) bg-white/2 px-3'
      {...tm('DA.judge-prompt')}
    >
      <Accordion className='divide-y-0'>
        <AccordionItem
          value='judge-prompt'
          title='裁判提示词原文'
          triggerClassName='text-xs font-medium tracking-[0.04em] text-(--foreground-muted)'
        >
          <div className='space-y-3 border-t border-(--border-soft) pt-3'>
            {model
              ? (
                <p className='text-[11px] leading-5 text-(--foreground-muted)'>
                  裁判／计分模型：默认 {model}，可由对局参数覆盖。
                </p>
              )
              : null}
            {note
              ? (
                <p className='text-[11px] leading-5 text-(--foreground-muted)'>
                  {note}
                </p>
              )
              : null}
            <p className='text-[11px] leading-5 text-(--foreground-muted)'>
              以下不包含用于生成裁判内心独白的提示词。
            </p>
            <pre className='whitespace-pre-wrap border-l-2 border-(--border-soft) pl-3 font-sans text-xs leading-6 text-(--foreground-subtle)'>
              {prompt}
            </pre>
          </div>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

function statsLine(summary: ScenarioSummary): string | null {
  const stats = summary.stats
  if (!stats) return null
  const pct = (rate: number) => `${Math.round(rate * 100)}%`
  return `${stats.battleCount} 场 · ${summary.sideAName} ${
    pct(stats.sideWinRate.a)
  } / ${summary.sideBName} ${pct(stats.sideWinRate.b)}`
}

function GateStatus({ summary }: { summary: ScenarioSummary }) {
  const progress = summary.gateProgress ?? null
  if (!progress) {
    return (
      <Badge
        tone={summary.gateUnlocked ? 'success' : 'info'}
        {...tm('DA.gate-status')}
      >
        {summary.gateUnlocked ? 'PvP 已解锁' : 'PvE 阶段'}
      </Badge>
    )
  }
  if (gateMet(progress)) {
    return (
      <Badge tone='success' {...tm('DA.gate-status')}>
        ✓ PVP 已解锁
      </Badge>
    )
  }
  return (
    <div
      className='flex flex-wrap items-center gap-1.5'
      {...tm('DA.gate-status')}
    >
      <span className='text-xs text-(--foreground-muted)'>
        每侧各赢 ≥{progress.a.needed} 场 PVE 练习解锁 PVP
      </span>
      {(['a', 'b'] as const).map((which) => (
        <Badge
          key={which}
          tone={sideMet(progress[which]) ? 'success' : 'info'}
          {...tm('DA.gate-side-badge')}
        >
          {which === 'a' ? summary.sideAName : summary.sideBName}{' '}
          {sideProgressText(progress[which])}
          {sideMet(progress[which]) ? ' ✓' : ''}
        </Badge>
      ))}
    </div>
  )
}
