import { type APIRequestContext, expect, request, test } from '@playwright/test'

import {
  adminContext,
  apiSignup,
  baseURL,
  sameOrigin,
  submissionModelID,
} from './helpers'

const scenario = `profile-${Date.now()}`
const privatePrompt = 'PROFILE_OWNER_PRIVATE_先说明证据再提出主张'
const latestPrompt = 'PROFILE_LATEST_PRIVATE_加入成本论证'
let owner: Awaited<ReturnType<typeof apiSignup>>
let agentID: number
let firstVersion: number
let latestVersion: number
const matchIDs: number[] = []

test.setTimeout(120_000)

async function dispatch(context: APIRequestContext, presetKey: string) {
  const response = await context.post('/v1/matches/pve', {
    headers: sameOrigin,
    data: { versionID: firstVersion, presetKey },
  })
  expect(response.ok(), await response.text()).toBe(true)
  const { matchID } = await response.json() as { matchID: number }
  await expect.poll(async () => {
    const detail = await context.get(`/v1/matches/${matchID}`)
    const body = await detail.json() as { summary: { finished: boolean } }
    return body.summary.finished
  }, { timeout: 30_000 }).toBe(true)
  matchIDs.push(matchID)
}

test.beforeAll(async () => {
  expect(process.env.AXIIA_E2E_ISOLATED).toBe('1')
  const admin = await adminContext()
  const source = `const meta = {
    id: '${scenario}', title: '智能体资料页固定局', subject: '测试',
    sideAName: '正方', sideBName: '反方', turnCount: 1,
    stages: [{id:'main', title:'固定局', channels:[{id:'main', label:'公开'}]}],
    presets: [
      {key:'win', side:'b', label:'胜局陪练', modelID:'deepseek-v4-flash', prompt:'NPC_PUBLIC_WIN'},
      {key:'loss', side:'b', label:'负局陪练', modelID:'deepseek-v4-flash', prompt:'NPC_PUBLIC_LOSS'},
      {key:'draw', side:'b', label:'平局陪练', modelID:'deepseek-v4-flash', prompt:'NPC_PUBLIC_DRAW'},
      {key:'error', side:'b', label:'失败陪练', modelID:'deepseek-v4-flash', prompt:'NPC_PUBLIC_ERROR'}
    ], speakerLabels: {a:'正方',b:'反方',judge:'裁判'}
  }
  async function main() {
    const prompt = game.playerPrompt('b')
    if (prompt.includes('ERROR')) throw new Error('Intentional profile fixture failure')
    const winner = prompt.includes('DRAW') ? 'draw' : prompt.includes('LOSS') ? 'b' : 'a'
    game.emit('main', {type:'scene', text:'固定局已经完成。'})
    return {winner, scoreA:winner==='a'?1:0, scoreB:winner==='b'?1:0, reasoning:'确定性测试。'}
  }`
  const upload = await admin.post('/v1/admin/scripts', {
    headers: sameOrigin,
    data: { source },
  })
  expect(upload.ok(), await upload.text()).toBe(true)
  const { sha } = await upload.json() as { sha: string }
  const slot = await admin.patch(`/v1/admin/slots/${scenario}`, {
    headers: sameOrigin,
    data: { scriptSHA: sha },
  })
  expect(slot.ok(), await slot.text()).toBe(true)
  await admin.dispose()

  owner = await apiSignup('profile-owner')
  const ensure = await owner.context.post('/v1/agents/ensure', {
    headers: sameOrigin,
    data: { scenarioID: scenario, side: 'a' },
  })
  expect(ensure.ok()).toBe(true)
  agentID = (await ensure.json()).agentID
  const modelID = await submissionModelID(owner.context)
  const first = await owner.context.post(`/v1/agents/${agentID}/save`, {
    headers: sameOrigin,
    data: { prompt: privatePrompt, modelID },
  })
  expect(first.ok()).toBe(true)
  firstVersion = (await first.json()).id
  for (const key of ['win', 'loss', 'draw', 'error']) {
    await dispatch(owner.context, key)
  }
  const latest = await owner.context.post(`/v1/agents/${agentID}/save`, {
    headers: sameOrigin,
    data: { prompt: latestPrompt, modelID },
  })
  expect(latest.ok()).toBe(true)
  latestVersion = (await latest.json()).id
})

test.afterAll(async () => {
  await owner?.context.dispose()
})

test(
  'current version leads; historical record counts win/loss/draw and excludes failed matches',
  async ({ page }, testInfo) => {
    await page.context().addCookies(
      (await owner.context.storageState()).cookies,
    )
    const records = await owner.context.get(`/v1/agents/${agentID}/versions`)
    const { versions } = await records.json()
    expect(versions.find((v: { id: number }) => v.id === firstVersion))
      .toMatchObject({
        matchCount: 3,
        winCount: 1,
        lossCount: 1,
        drawCount: 1,
      })
    expect(versions.find((v: { id: number }) => v.id === latestVersion))
      .toMatchObject({
        matchCount: 0,
        winCount: 0,
        lossCount: 0,
        drawCount: 0,
      })
    await page.goto(`/agents/${agentID}`)
    await expect(page.getByTestId('profile-record')).toContainText(
      '当前版本 · v2',
    )
    await expect(page.getByTestId('profile-win-rate')).toHaveText('暂无战绩')
    await expect(page.getByTestId('version-card').first()).toContainText(
      latestPrompt,
    )
    await expect(page.getByText('版本对比', { exact: true })).toHaveCount(0)

    await page.getByRole('combobox', { name: '查看版本' }).click()
    await page.getByRole('option', { name: /^v1/ }).click()
    await expect(page.getByTestId('profile-record')).toContainText(
      '历史版本 · v1',
    )
    await expect(page.getByTestId('profile-win-rate')).toHaveText('33.3%')
    await expect(page.getByTestId('version-card').first()).toContainText(
      privatePrompt,
    )
    const history = page.getByTestId('profile-history')
    for (const id of matchIDs) {
      await expect(history.locator(`a[href='/matches/${id}']`)).toBeVisible()
    }
    expect(
      await history.evaluate((node) => {
        const cards = Array.from(
          document.querySelectorAll('[data-testid="version-card"]'),
        )
        return cards.every((card) =>
          Boolean(
            card.compareDocumentPosition(node) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          )
        )
      }),
    ).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath('owner.png'),
      fullPage: true,
    })
  },
)

test(
  'another player sees version statistics without private prompts in API or DOM',
  async ({ page }, testInfo) => {
    const visitor = await apiSignup('profile-visitor')
    try {
      await page.context().addCookies(
        (await visitor.context.storageState()).cookies,
      )
      const projection = await visitor.context.get(
        `/v1/agents/${agentID}/public`,
      )
      expect(projection.ok()).toBe(true)
      const body = await projection.text()
      expect(body).not.toContain(privatePrompt)
      expect(body).not.toContain(latestPrompt)
      expect(
        JSON.parse(body).versions.find((v: { id: number }) =>
          v.id === firstVersion
        ),
      )
        .toMatchObject({
          matchCount: 3,
          winCount: 1,
          lossCount: 1,
          drawCount: 1,
        })
      for (const path of ['draft', 'versions']) {
        expect(
          (await visitor.context.get(`/v1/agents/${agentID}/${path}`)).status(),
        ).toBe(403)
      }
      await page.goto(`/agents/${agentID}`)
      await expect(page.getByTestId('profile-win-rate')).toHaveText('暂无战绩')
      await page.getByRole('combobox', { name: '查看版本' }).click()
      await page.getByRole('option', { name: /^v1/ }).click()
      await expect(page.getByTestId('profile-win-rate')).toHaveText('33.3%')
      await expect(page.locator('body')).not.toContainText(privatePrompt)
      await expect(page.locator('body')).not.toContainText(latestPrompt)
      await page.screenshot({
        path: testInfo.outputPath('public.png'),
        fullPage: true,
      })
    } finally {
      await visitor.context.dispose()
    }
  },
)

test(
  'single-side NPC exposes its prompt and its own result; empty NPC statistics stay empty',
  async ({ page }, testInfo) => {
    await page.context().addCookies(
      (await owner.context.storageState()).cookies,
    )
    const profile = await owner.context.get(
      `/v1/scenarios/${scenario}/npcs/loss`,
    )
    expect(profile.ok()).toBe(true)
    expect(await profile.json()).toMatchObject({
      side: 'b',
      prompt: 'NPC_PUBLIC_LOSS',
      matchCount: 1,
      winCount: 1,
      lossCount: 0,
      drawCount: 0,
      challengeCount: 1,
    })
    await page.goto(`/scenarios/${scenario}/npcs/loss`)
    await expect(page.getByTestId('profile-win-rate')).toHaveText('100%')
    await expect(page.locator('body')).toContainText('NPC_PUBLIC_LOSS')
    await expect(page.getByTestId('profile-history')).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
      await page.evaluate(() =>
        document.documentElement.scrollWidth <= innerWidth
      ),
    ).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath('npc-mobile.png'),
      fullPage: true,
    })

    await page.goto(`/scenarios/${scenario}/npcs/error`)
    await expect(page.getByTestId('profile-win-rate')).toHaveText('暂无战绩')
    await expect(page.locator('body')).toContainText('NPC_PUBLIC_ERROR')
  },
)

test('profile data requires login', async () => {
  const anonymous = await request.newContext({ baseURL })
  try {
    for (
      const path of [
        `/v1/agents/${agentID}/matches?versionID=${firstVersion}`,
        `/v1/scenarios/${scenario}/npcs/loss`,
        `/v1/scenarios/${scenario}/npcs/loss/matches`,
      ]
    ) expect((await anonymous.get(path)).status()).toBe(401)
  } finally {
    await anonymous.dispose()
  }
})
