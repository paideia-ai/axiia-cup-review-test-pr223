import type { Meta, StoryObj } from '@storybook/react-vite'
import { http, HttpResponse } from 'msw'
import { expect, userEvent, within } from 'storybook/test'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import type {
  AgentVersionDTO,
  MatchSummary,
  NPCProfileResponse,
} from '../api/types'
import { inventory, scenario } from '../testing/v34-fixtures'
import { AgentViewPage } from './agent-view'
import { NPCViewPage } from './npc-view'

const versions: AgentVersionDTO[] = [
  {
    id: 1001,
    agentID: 101,
    ordinal: 1,
    snapshotSeq: 4,
    isEntry: true,
    modelID: 'fixture-model',
    prompt: '历史策略：先提出反对理由。',
    matchCount: 10,
    winCount: 2,
    drawCount: 3,
    lossCount: 5,
  },
  {
    id: 1002,
    agentID: 101,
    ordinal: 2,
    snapshotSeq: 8,
    isEntry: false,
    modelID: 'fixture-model',
    prompt: '当前策略：先澄清争点，再逐一回应。',
    matchCount: 20,
    winCount: 13,
    drawCount: 1,
    lossCount: 6,
  },
]
const npc: NPCProfileResponse = {
  scenarioID: scenario.summary.id,
  scenarioTitle: scenario.summary.title,
  key: 'ganlong-steady',
  side: 'b',
  sideName: '甘龙',
  label: '稳健守旧派',
  modelID: 'fixture-model',
  prompt: 'NPC 策略：先询问新制度的实施代价。',
  versionTag: 'abc123def456',
  matchCount: 10,
  winCount: 4,
  drawCount: 2,
  lossCount: 4,
  challengeCount: 15,
}
function match(
  id: number,
  winner: string | null,
  versionID = 1002,
): MatchSummary {
  return {
    id,
    scenarioID: scenario.summary.id,
    scenarioTitle: scenario.summary.title,
    kind: 'pve',
    dispatched: true,
    finished: true,
    scored: true,
    winner,
    participants: {
      a: {
        agentID: 101,
        versionID,
        ownerDisplayName: '测试玩家',
        isMine: true,
      },
      b: { presetKey: 'ganlong-steady', isMine: false },
    },
  }
}
const handlers = [
  http.get(
    '/v1/models',
    () =>
      HttpResponse.json({
        models: [{ id: 'fixture-model', label: '测试模型' }],
      }),
  ),
  http.get('/v1/my/agents', () => HttpResponse.json(inventory)),
  http.get('/v1/scenarios/:id', () => HttpResponse.json(scenario)),
  http.get(
    '/v1/agents/101/draft',
    () =>
      HttpResponse.json({
        fields: {},
        scenarioID: scenario.summary.id,
        side: 'a',
      }),
  ),
  http.get(
    '/v1/agents/101/versions',
    () => HttpResponse.json({ versions, entryVersionID: 1001 }),
  ),
  http.get('/v1/agents/101/matches', ({ request }) => {
    const versionID = Number(new URL(request.url).searchParams.get('versionID'))
    return HttpResponse.json({
      matches: [
        match(
          versionID === 1001 ? 8999 : 9001,
          versionID === 1001 ? 'b' : 'a',
          versionID,
        ),
      ],
      open: false,
    })
  }),
  http.get(
    '/v1/agents/202/draft',
    () =>
      HttpResponse.json({ error: 'forbidden', message: '仅限主人' }, {
        status: 403,
      }),
  ),
  http.get('/v1/agents/202/public', () =>
    HttpResponse.json({
      agentID: 202,
      scenarioID: scenario.summary.id,
      scenarioTitle: scenario.summary.title,
      side: 'a',
      sideName: '商鞅',
      name: '冷静派',
      ownerName: '另一位玩家',
      versions: versions.map((v) => ({
        ...v,
        agentID: 202,
        prompt: 'PUBLIC_RESPONSE_SECRET_MUST_NOT_RENDER',
      })),
    })),
  http.get(
    '/v1/agents/202/matches',
    () => HttpResponse.json({ matches: [], open: false }),
  ),
  http.get('/v1/scenarios/:id/npcs/:key', () => HttpResponse.json(npc)),
  http.get(
    '/v1/scenarios/:id/npcs/:key/matches',
    () =>
      HttpResponse.json({
        matches: [
          match(9002, 'b'),
          match(9001, 'draw'),
          match(9000, null),
          { ...match(8999, null), dispatched: false, scored: false },
        ],
        open: true,
      }),
  ),
]
function Page({ entry }: { entry: string }) {
  return (
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path='/agents/:agentId' element={<AgentViewPage />} />
        <Route
          path='/scenarios/:scenarioId/npcs/:presetKey'
          element={<NPCViewPage />}
        />
        <Route path='/matches/:id' element={<p>战报详情</p>} />
      </Routes>
    </MemoryRouter>
  )
}
const meta = {
  title: 'Agents/Current version profile',
  component: Page,
  parameters: { msw: handlers, a11y: { test: 'error' } },
} satisfies Meta<typeof Page>
export default meta
type Story = StoryObj<typeof meta>

export const OwnerCurrentVersion: Story = {
  args: { entry: '/agents/101' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByTestId('profile-win-rate'))
      .toHaveTextContent('65%')
    await expect(canvas.getByRole('heading', { name: '当前版本 · v2' }))
      .toBeVisible()
    await expect(canvas.getByText(versions[1].prompt)).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '版本对比' })).toBeNull()
    await expect(await canvas.findByRole('link', { name: /对战 #9001/ }))
      .toBeVisible()
    const history = canvas.getByTestId('profile-history')
    const cards = canvas.getAllByTestId('version-card')
    await expect(cards[0]).toHaveTextContent('正在查看')
    await expect(cards[0]).toHaveTextContent(versions[1].prompt)
    await expect(
      cards.at(-1)!.compareDocumentPosition(history) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    await userEvent.click(canvas.getByRole('combobox', { name: '查看版本' }))
    await userEvent.click(
      await within(document.body).findByRole('option', {
        name: 'v1 · 参赛版本',
      }),
    )
    await expect(canvas.getByTestId('profile-win-rate')).toHaveTextContent(
      '20%',
    )
    await expect(
      canvas.getByRole('heading', { name: '历史版本 · v1 · 参赛版本' }),
    ).toBeVisible()
    await expect(canvas.getAllByTestId('version-card')[0]).toHaveTextContent(
      versions[0].prompt,
    )
    await expect(await canvas.findByRole('link', { name: /对战 #8999/ }))
      .toBeVisible()
    await expect(canvas.queryByRole('link', { name: /对战 #9001/ })).toBeNull()
  },
}

export const OtherPlayerPrivacy: Story = {
  args: { entry: '/agents/202' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByTestId('profile-win-rate'))
      .toHaveTextContent('65%')
    await expect(canvas.getByText('提示词只有智能体主人可见。')).toBeVisible()
    await expect(canvasElement.textContent).not.toContain(
      'PUBLIC_RESPONSE_SECRET_MUST_NOT_RENDER',
    )
    await expect(
      canvas.queryByRole('button', { name: /复制|出战|参赛版本|版本对比/ }),
    ).toBeNull()
    await expect(canvas.queryByRole('link', { name: '新建版本' })).toBeNull()
    await expect(await canvas.findByText('暂无可查看的对战记录')).toBeVisible()
  },
}

export const NPCPublicPromptAndOwnResult: Story = {
  args: { entry: '/scenarios/shangyang-court/npcs/ganlong-steady' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByTestId('profile-win-rate'))
      .toHaveTextContent('40%')
    await expect(canvas.getByText(npc.prompt)).toBeVisible()
    await expect(canvas.getByText('被挑战 15 次（含未完赛）')).toBeVisible()
    await expect(canvas.getByRole('heading', { name: '甘龙「稳健守旧派」' }))
      .toBeVisible()
    const won = await canvas.findByRole('link', { name: /对战 #9002/ })
    await expect(won).toHaveTextContent('胜')
    await expect(canvas.getByRole('link', { name: /对战 #9001/ }))
      .toHaveTextContent('平')
    await expect(canvas.getByRole('link', { name: /对战 #9000/ }))
      .toHaveTextContent('未计分')
    const failedBeforeDispatch = canvas.getByRole('link', {
      name: /对战 #8999/,
    })
    await expect(failedBeforeDispatch).toHaveTextContent('未计分')
    await expect(failedBeforeDispatch).not.toHaveTextContent('排队中')
    await userEvent.click(won)
    await expect(await canvas.findByText('战报详情')).toBeVisible()
  },
}

export const ZeroGames: Story = {
  args: { entry: '/scenarios/shangyang-court/npcs/ganlong-steady' },
  parameters: {
    msw: [
      http.get('/v1/scenarios/:id/npcs/:key', () =>
        HttpResponse.json({
          ...npc,
          matchCount: 0,
          winCount: 0,
          drawCount: 0,
          lossCount: 0,
          challengeCount: 0,
        })),
      http.get(
        '/v1/scenarios/:id/npcs/:key/matches',
        () => HttpResponse.json({ matches: [], open: true }),
      ),
      ...handlers,
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByTestId('profile-win-rate'))
      .toHaveTextContent('暂无战绩')
    await expect(canvas.getByTestId('profile-win-rate')).not.toHaveTextContent(
      '0%',
    )
  },
}

export const HistoryRetry: Story = {
  args: { entry: '/agents/101' },
  parameters: {
    msw: [
      http.get(
        '/v1/agents/101/matches',
        () =>
          HttpResponse.json({ error: 'unavailable', message: '稍后重试' }, {
            status: 503,
          }),
      ),
      ...handlers,
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('暂时无法加载对战记录。'))
      .toBeVisible()
    await expect(canvas.getByRole('button', { name: '重试' })).toBeEnabled()
    await expect(canvas.getByTestId('profile-win-rate')).toHaveTextContent(
      '65%',
    )
  },
}

export const HistoryPagination: Story = {
  args: { entry: '/agents/101' },
  parameters: {
    msw: [
      http.get('/v1/agents/101/matches', ({ request }) => {
        const before = new URL(request.url).searchParams.get('before')
        return HttpResponse.json({
          matches: before ? [match(8980, 'draw')] : Array.from(
            { length: 20 },
            (_, index) => match(9000 - index, 'a'),
          ),
          open: false,
        })
      }),
      ...handlers,
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('link', { name: /对战 #9000/ }))
      .toBeVisible()
    await expect(canvas.getByRole('button', { name: '上一页' })).toBeDisabled()
    await userEvent.click(canvas.getByRole('button', { name: '下一页' }))
    await expect(await canvas.findByRole('link', { name: /对战 #8980/ }))
      .toBeVisible()
    await expect(canvas.queryByRole('link', { name: /对战 #9000/ })).toBeNull()
    await expect(canvas.getByRole('button', { name: '下一页' })).toBeDisabled()
    await userEvent.click(canvas.getByRole('button', { name: '上一页' }))
    await expect(await canvas.findByRole('link', { name: /对战 #9000/ }))
      .toBeVisible()
  },
}
