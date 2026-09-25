import type { Meta, StoryObj } from '@storybook/react-vite'
import { http, HttpResponse } from 'msw'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'

import type { AgentVersionDTO, SaveVersionRequest } from '../api/types'
import { purgeBuilderDraftJournals } from '../lib/builder-draft-storage'
import { NavigationMemoryProvider } from '../context/navigation-memory'
import { config, scenario } from '../testing/v34-fixtures'
import { AgentViewPage } from './agent-view'
import { BuilderPage } from './builder'
import { MyAgentsPage } from './my-agents'

// Preview the production pages with isolated sample data. These handlers are
// Storybook-only; every mutation stays in this preview's memory.
const scenarios = [scenario, {
  ...scenario,
  summary: {
    ...scenario.summary,
    id: 'honnoji-decision',
    title: '本能寺之变',
    sideAName: '主战方',
    sideBName: '止战方',
    sideALabel: '劝光秀今夜起兵',
    sideBLabel: '劝光秀暂缓行动',
  },
}]
const models = [
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { id: 'kimi-k2.6', label: 'Kimi K2.6' },
  { id: 'glm-5.3', label: 'GLM-5.3' },
]
const seeds = scenarios.flatMap((scene, index) =>
  Array.from({ length: 12 }, (_, n) => ({
    id: (index + 1) * 100 + n + 1,
    name: `策略 ${n + 1}`,
    scenarioID: scene.summary.id,
    side: n < 8 ? 'a' as const : 'b' as const,
  }))
)
const prompts = [
  '先听完对方的论点，再追问证据。\n每轮只推进一个问题，承认对方合理的顾虑。',
  '先反驳对方的论点，再强调立场。\n每轮讨论多个问题。',
  '先听完对方的论点，再追问证据。\n每轮只推进一个问题，承认对方合理的顾虑。',
]
let saved = new Map<number, AgentVersionDTO[]>()
let drafts = new Map<number, string>()
function reset() {
  for (const agent of seeds) purgeBuilderDraftJournals(agent.id)
  drafts = new Map()
  saved = new Map(
    seeds.map((agent) => [
      agent.id,
      prompts.map((prompt, index) => ({
        id: agent.id * 100 + index + 1,
        agentID: agent.id,
        ordinal: index + 1,
        snapshotSeq: index + 1,
        prompt,
        modelID: models[index % 2].id,
        note: ['保留顾虑', '直接表达立场', '追问证据'][index],
        isEntry: agent.id % 100 === 1 && index === 2,
      })),
    ]),
  )
}
reset()
function Pages() {
  return (
    <div className='mx-auto max-w-[1040px] space-y-6'>
      <div className='flex flex-wrap items-center gap-4 border-b border-(--border-soft) pb-4 text-sm'>
        <span className='text-(--foreground-muted)'>交互预览 · 示例数据</span>
        <Link to='/my-agents'>我的智能体</Link>
        <Link to='/agents/101'>智能体主页</Link>
        <Link to='/agents/201/build'>本能寺构建器</Link>
      </div>
      <Routes>
        <Route path='/my-agents' element={<MyAgentsPage />} />
        <Route path='/agents/:agentId' element={<AgentViewPage />} />
        <Route path='/agents/:agentId/build' element={<BuilderPage />} />
      </Routes>
    </div>
  )
}
const meta = {
  title: 'Agents/Demo parity preview',
  render: () => (
    <MemoryRouter initialEntries={['/agents/101']}>
      <NavigationMemoryProvider scope='agent-parity-preview'>
        <Pages />
      </NavigationMemoryProvider>
    </MemoryRouter>
  ),
  beforeEach: reset,
  parameters: {
    msw: [
      http.get('/v1/config', () => HttpResponse.json({ ...config, models })),
      http.get('/v1/models', () => HttpResponse.json({ models })),
      http.get(
        '/v1/scenarios',
        () => HttpResponse.json({ scenarios: scenarios.map((s) => s.summary) }),
      ),
      http.get(
        '/v1/scenarios/:id',
        ({ params }) =>
          HttpResponse.json(scenarios.find((s) => s.summary.id === params.id)),
      ),
      http.get('/v1/my/agents', () =>
        HttpResponse.json({
          scenarios: scenarios.map((s) => ({
            scenarioID: s.summary.id,
            title: s.summary.title,
            gateProgress: s.summary.gateProgress,
            entryReady: false,
            sides: Object.fromEntries(
              ['a', 'b'].map((side) => [
                side,
                seeds.filter((a) =>
                  a.scenarioID === s.summary.id && a.side === side
                ).map((a) => ({
                  agentID: a.id,
                  name: a.name,
                  versionCount: saved.get(a.id)!.length,
                  entryVersionID: saved.get(a.id)!.find((v) => v.isEntry)?.id ??
                    null,
                  latestVersionID: saved.get(a.id)!.at(-1)!.id,
                })),
              ]),
            ),
          })),
        })),
      http.get('/v1/agents/:id/draft', ({ params }) => {
        const agent = seeds.find((a) => a.id === Number(params.id))!
        return HttpResponse.json({
          fields: { prompt: drafts.get(agent.id) ?? '' },
          scenarioID: agent.scenarioID,
          side: agent.side,
        })
      }),
      http.get(
        '/v1/agents/:id/versions',
        ({ params }) =>
          HttpResponse.json({ versions: saved.get(Number(params.id)) }),
      ),
      http.get('/v1/agents/:id/diff', ({ params, request }) => {
        const query = new URL(request.url).searchParams
        const versions = saved.get(Number(params.id))!
        return HttpResponse.json({
          base: versions.find((v) => v.id === Number(query.get('base'))),
          head: versions.find((v) => v.id === Number(query.get('head'))),
        })
      }),
      http.get('/v1/agents/:id/stream', () =>
        new HttpResponse('', {
          headers: { 'Content-Type': 'text/event-stream' },
        })),
      http.post('/v1/agents/:id/mutate', async ({ params, request }) => {
        const body = await request.json() as { value: string }
        drafts.set(Number(params.id), body.value)
        return HttpResponse.json({ ok: true })
      }),
      http.post('/v1/agents/:id/save', async ({ params, request }) => {
        const input = await request.json() as SaveVersionRequest
        const agentID = Number(params.id), versions = saved.get(agentID)!
        const version = {
          ...input,
          agentID,
          id: agentID * 100 + versions.length + 1,
          ordinal: versions.length + 1,
          isEntry: false,
          snapshotSeq: versions.length + 1,
        }
        versions.push(version)
        return HttpResponse.json(version)
      }),
      http.post('/v1/agents/:id/entry/:version', ({ params }) => {
        const agent = seeds.find((a) => a.id === Number(params.id))!
        for (
          const sibling of seeds.filter((a) =>
            a.side === agent.side && a.scenarioID === agent.scenarioID
          )
        ) {
          for (const version of saved.get(sibling.id)!) {
            version.isEntry = version.id === Number(params.version)
          }
        }
        return HttpResponse.json({ ok: true })
      }),
      http.all(
        '/v1/*',
        () =>
          HttpResponse.json({ error: '此预览不执行该操作' }, { status: 403 }),
      ),
    ],
  },
} satisfies Meta
export default meta
export const Interactive: StoryObj = {}
