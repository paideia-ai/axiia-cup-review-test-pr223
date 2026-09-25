import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NavigationMemoryProvider } from '../context/navigation-memory'
import { versionHistoryHandlers } from '../testing/version-history-fixtures'
import { AgentViewPage } from './agent-view'
import { MatchDetailPage } from './match-detail'
import { MatchesPage } from './matches'

function Surface({ entry = '/agents/101' }: { entry?: string }) {
  return (
    <MemoryRouter initialEntries={[entry]}>
      <NavigationMemoryProvider scope='version-history-story'>
        <Routes>
          <Route path='/agents/:agentId' element={<AgentViewPage />} />
          <Route path='/matches' element={<MatchesPage />} />
          <Route path='/matches/:matchId' element={<MatchDetailPage />} />
        </Routes>
      </NavigationMemoryProvider>
    </MemoryRouter>
  )
}

const meta = {
  title: 'Agents/Version history',
  component: Surface,
  parameters: { msw: versionHistoryHandlers },
} satisfies Meta<typeof Surface>
export default meta
type Story = StoryObj<typeof meta>

export const Preview: Story = {}

export const FromVersionToReportAndBack: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole('combobox', { name: '查看版本' }),
    )
    await userEvent.click(
      await within(document.body).findByRole('option', { name: 'v1' }),
    )
    await expect(canvas.getByRole('heading', { name: '历史版本 · v1' }))
      .toBeVisible()
    const selectedCard = canvas.getAllByTestId('version-card')[0]
    await expect(within(selectedCard).getByText('正在查看')).toBeVisible()
    await expect(
      within(selectedCard).getByRole('link', {
        name: '1 战 0 胜，查看 v1 的对局记录',
      }),
    ).toHaveAttribute('href', '/matches?version=1001')
    const view = await canvas.findByRole('link', {
      name: '1 战 0 胜，查看 v1 的对局记录',
    })
    await expect(view).toHaveTextContent('1 战 0 胜')
    await expect(canvas.queryByText('查看', { exact: true })).toBeNull()
    await expect(view).toHaveAttribute('href', '/matches?version=1001')
    await userEvent.click(view)
    await canvas.findByRole('link', { name: /对战 #9001/ })
    await expect(canvas.getAllByRole('link', { name: /对战 #/ })).toHaveLength(
      1,
    )
    await expect(canvas.getByRole('button', { name: '清除版本 #1001 筛选' }))
      .toBeVisible()
    await userEvent.click(canvas.getByRole('link', { name: /对战 #9001/ }))
    await canvas.findByRole('heading', { name: '对战 #9001' })
    const back = canvas.getByRole('link', { name: '← 对战列表' })
    await expect(back).toHaveAttribute('href', '/matches?version=1001')
    await userEvent.click(back)
    await canvas.findByRole('link', { name: /对战 #9001/ })
    await expect(canvas.getAllByRole('link', { name: /对战 #/ })).toHaveLength(
      1,
    )
  },
}

export const BothSidesAndCombinedFilters: Story = {
  args: { entry: '/matches?version=1002&mine=1&scenario=shangyang-court' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('link', { name: /对战 #9002/ })
    // Match either side; include unfinished games; self-play appears only once.
    await expect(canvas.getAllByRole('link', { name: /对战 #/ })).toHaveLength(
      3,
    )
    await expect(canvas.getByRole('link', { name: /对战 #9003/ })).toBeVisible()
    await expect(canvas.getByRole('link', { name: /对战 #9005/ })).toBeVisible()
    await expect(canvas.queryByRole('link', { name: /对战 #9001/ })).toBeNull()
    await expect(canvas.queryByRole('link', { name: /对战 #9004/ })).toBeNull()
    await userEvent.click(
      canvas.getByRole('button', { name: '清除版本 #1002 筛选' }),
    )
    await expect(canvas.getAllByRole('link', { name: /对战 #/ })).toHaveLength(
      4,
    )
    await expect(canvas.getByRole('checkbox', { name: '仅自己对局' }))
      .toBeChecked()
    await expect(canvas.getByRole('combobox')).toHaveTextContent('商鞅庭辩')
    await userEvent.click(canvas.getByRole('checkbox', { name: '仅自己对局' }))
    await expect(canvas.getAllByRole('link', { name: /对战 #/ })).toHaveLength(
      5,
    )
  },
}

export const VersionWithoutGames: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole('link', {
        name: '暂无战绩，查看 v3 的对局记录',
      }),
    )
    await canvas.findByText('该版本还没有对战记录。')
    await expect(canvas.queryByRole('link', { name: /对战 #/ })).toBeNull()
    await userEvent.click(
      canvas.getByRole('button', { name: '清除版本 #1003 筛选' }),
    )
    await expect(canvas.getAllByRole('link', { name: /对战 #/ })).toHaveLength(
      5,
    )
  },
}

export const VersionWithNoMatchingScenario: Story = {
  args: { entry: '/matches?version=1002&scenario=other' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText(
      '该版本没有符合当前筛选条件的对战。试试切换场景或取消「仅自己对局」。',
    )
    await expect(canvas.queryByRole('link', { name: /对战 #/ })).toBeNull()
  },
}
