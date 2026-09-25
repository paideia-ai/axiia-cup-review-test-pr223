import { expect, type Locator, type Page, test } from '@playwright/test'

import {
  config,
  finishedMatch,
  inventory,
  notificationsFixture,
  scenario,
  scenarioList,
  unlockedScenario,
  versions,
} from '../../src/testing/v34-fixtures'

import {
  agentPreviewInventory,
  agentPreviewScenarios,
  previewAgent,
} from '../../src/testing/scenario-agent-fixtures'

interface FixtureOptions {
  guest?: boolean
  empty?: boolean
  inventoryFailed?: boolean
  multiple?: boolean
  noEntry?: boolean
  opponents?: boolean
  unlocked?: boolean
  scenarioFailed?: boolean
}

const scenarioPath = `/scenarios/${scenario.summary.id}`

async function fixtures(page: Page, options: FixtureOptions = {}) {
  const ensures: { page: Page; side: string }[] = []
  const unexpected: string[] = []
  const errors: string[] = []
  const observeErrors = (tab: Page) =>
    tab.on('pageerror', (error) => errors.push(error.message))
  observeErrors(page)
  page.context().on('page', observeErrors)
  await page.context().route('**/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.slice(3)
    const json = (body: unknown, status = 200) =>
      route.fulfill({ json: body, status })
    if (path === '/auth/me') {
      return options.guest
        ? json({ error: 'unauthorized', message: '请登录' }, 401)
        : json({
          account: {
            id: 'navigation-test',
            email: 'nav@example.test',
            displayName: '导航测试',
            isAdmin: true,
          },
          elevated: true,
          firstBattleDone: false,
        })
    }
    if (path === '/landing') {
      return json({ demoMatches: [], topPlayers: [], totalMatches: 0 })
    }
    if (path === '/models') return json({ models: config.models })
    if (path === '/rewards') {
      return json({
        balance: 1000,
        dailyAllowance: 1000,
        battleCost: 100,
        dailyRuns: 10,
        pveWinRefundPercent: 50,
        pvpWinRefundPercent: 80,
        pointsPerYuan: 100,
        nextGrantAt: 0,
        claimableRewards: [{ matchID: 9001, points: 50, kind: 'pve' }],
      })
    }
    if (path === '/rewards/quote') {
      return json({
        cost: 100,
        perBattleCost: 100,
        repeatRoleSurcharge: false,
        battleCosts: [100],
      })
    }
    if (path === '/rewards/matches/9001') {
      return json({
        matchID: 9001,
        points: 50,
        status: 'claimable',
        kind: 'pve',
      })
    }
    if (path === '/config') return json(config)
    if (path === '/scenarios') return json(scenarioList)
    if (path === `/scenarios/${scenario.summary.id}`) {
      return options.scenarioFailed
        ? json({ error: 'unavailable', message: '场景暂不可用' }, 503)
        : json(options.unlocked ? unlockedScenario : scenario)
    }
    if (path.endsWith('/opponents')) {
      return json({
        opponents: options.opponents
          ? [{ agentID: 102, displayName: '我的甘龙', isSelf: true }]
          : [],
      })
    }
    if (path === '/my/agents') {
      if (options.inventoryFailed) return json({ error: 'unavailable' }, 503)
      if (options.empty) return json({ scenarios: [] })
      const data = structuredClone(inventory)
      if (options.multiple) {
        data.scenarios[0].sides.a.unshift({ agentID: 103, versionCount: 0 })
      }
      if (options.noEntry) {
        data.scenarios[0].sides.a.forEach((agent) =>
          agent.entryVersionID = null
        )
      }
      return json(data)
    }
    if (path === '/agents/ensure') {
      const { side } = request.postDataJSON()
      ensures.push({ page: request.frame().page(), side })
      return json({ agentID: side === 'b' ? 102 : 101 })
    }
    if (/^\/agents\/\d+\/draft$/.test(path)) {
      return json({
        fields: {},
        scenarioID: scenario.summary.id,
        side: path.includes('/102/') ? 'b' : 'a',
      })
    }
    if (/^\/agents\/\d+\/matches$/.test(path) && request.method() === 'GET') {
      return json({ matches: [], open: false })
    }
    if (/^\/agents\/\d+\/versions$/.test(path)) {
      return json({ versions, entryVersionID: 1002 })
    }
    if (path === '/matches') return json({ matches: [finishedMatch.summary] })
    if (path === '/matches/9001') return json(finishedMatch)
    if (path === '/notifications') return json(notificationsFixture)
    if (/^\/notifications\/\d+\/read$/.test(path)) return json({ ok: true })
    if (
      path === '/notifications/bell' || /^\/agents\/\d+\/stream$/.test(path)
    ) {
      return route.fulfill({
        contentType: 'text/event-stream',
        body: 'retry: 60000\ndata: {"unreadCount":1}\n\n',
      })
    }
    if (path === '/tournaments') {
      return json({ tournaments: [{ id: 1, phase: 'qualifier', round: 1 }] })
    }
    if (path === '/tournaments/1/standings') {
      return json({
        entries: [{
          playerID: 'navigation-test',
          playerName: '导航测试',
          rank: 1,
          wins: 1,
          losses: 0,
          buchholz: 0,
          winRate: 100,
          submissionIDs: [1002],
        }],
      })
    }
    if (path === '/versions/1002/ref') {
      return json({ versionID: 1002, agentID: 101 })
    }
    unexpected.push(`${request.method()} ${path}`)
    return json({ error: 'unexpected_fixture_request', message: path }, 500)
  })
  return { ensures, unexpected, errors }
}

async function openPanel(page: Page, tab: 'pvp' | 'hotseat') {
  await page.getByRole('button', { name: '用 v2 出战' }).click()
  await page.getByRole('tab', {
    name: tab === 'pvp' ? /玩家约战/ : /左右手互搏/,
  }).click()
}

for (const width of [1440, 390]) {
  test(`history whole row and independent agent links at ${width}px`, async ({ page }) => {
    const { unexpected, errors } = await fixtures(page)
    await page.setViewportSize({ width, height: 900 })
    await page.context().route('**/v1/matches', (route) =>
      route.fulfill({
        json: {
          matches: [
            finishedMatch.summary,
            { ...finishedMatch.summary, id: 9002, participants: undefined },
            {
              ...finishedMatch.summary,
              id: 9003,
              participants: {
                a: { agentID: 101, isMine: true },
                b: { agentID: 102, isMine: true },
              },
            },
          ],
        },
      }))
    await page.goto('/matches')
    const cards = page.locator('.history-card')
    await expect(cards).toHaveCount(3)
    await expect(page.locator('a a')).toHaveCount(0)
    // Real browser hit testing catches dead padding and overlays blocking an
    // agent link; dispatching synthetic clicks directly on links misses both.
    for (const card of await cards.all()) {
      const hits = await card.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return [
          [rect.left + 4, rect.top + 4],
          [rect.right - 4, rect.bottom - 4],
          [rect.left + rect.width / 2, rect.bottom - 4],
        ].map(([x, y]) =>
          element.ownerDocument.elementFromPoint(x, y)?.closest('a')
            ?.getAttribute('href')
        )
      })
      const destination = await card.locator('[data-tm="L.match-card"]')
        .getAttribute('href')
      expect(hits).toEqual([destination, destination, destination])
    }
    for (const link of await page.locator('[data-tm="L.owned-agent"]').all()) {
      await expect(link).toBeVisible()
      expect(
        await link.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          return element.ownerDocument.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          )?.closest('a') === element
        }),
      ).toBe(true)
    }
    const card = cards.first()
    const rect = (await card.boundingBox())!
    await page.mouse.click(rect.x + rect.width - 4, rect.y + rect.height - 4)
    await expect(page).toHaveURL(/\/matches\/9001$/)
    await page.goBack()
    const agent = card.locator('[data-tm="L.owned-agent"]')
    await agent.click()
    await expect(page).toHaveURL(/\/agents\/101$/)
    await page.goBack()
    const popupPromise = page.context().waitForEvent('page')
    await agent.click({ modifiers: ['ControlOrMeta'] })
    const popup = await popupPromise
    await expect(popup).toHaveURL(/\/agents\/101$/)
    await expect(page).toHaveURL(/\/matches$/)
    await popup.close()
    await page.bringToFront()
    await card.locator('[data-tm="L.match-card"]').focus()
    await page.keyboard.press('Tab')
    await expect(agent).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/agents\/101$/)
    expect(unexpected).toEqual([])
    expect(errors).toEqual([])
  })
}

async function showJourney(page: Page) {
  await page.evaluate(() => {
    history.replaceState({ ...history.state, usr: { express: true } }, '')
  })
  await page.reload()
}

const cases: {
  name: string
  path: string
  marker?: string
  selector?: string
  destination: RegExp
  options?: FixtureOptions
  prepare?: (page: Page) => Promise<void>
}[] = [
  {
    name: 'landing registration',
    path: '/',
    marker: 'A.cta-register',
    destination: /\/register$/,
    options: { guest: true },
  },
  {
    name: 'header registration',
    path: '/',
    marker: 'A.header-register-button',
    destination: /\/register$/,
    options: { guest: true },
  },
  {
    name: 'landing login',
    path: '/',
    marker: 'A.cta-login',
    destination: /\/login$/,
    options: { guest: true },
  },
  {
    name: 'landing enter',
    path: '/',
    marker: 'A.cta-enter',
    destination: /\/scenarios$/,
  },
  {
    name: 'header enter',
    path: '/',
    marker: 'A.header-enter-button',
    destination: /\/scenarios$/,
  },
  {
    name: 'new version',
    path: '/agents/101',
    marker: 'EA.edit-button',
    destination: /\/agents\/101\/build$/,
  },
  {
    name: 'scenario single agent',
    path: scenarioPath,
    marker: 'DA.view-mine-button',
    destination: /\/agents\/101$/,
  },
  {
    name: 'scenario multiple agents',
    path: scenarioPath,
    marker: 'DA.view-mine-button',
    destination: /\/agents\/101$/,
    options: { multiple: true },
  },
  {
    name: 'scenario multiple agents without entry',
    path: scenarioPath,
    marker: 'DA.view-mine-button',
    destination: /\/agents\/103$/,
    options: { multiple: true, noEntry: true },
  },
  {
    name: 'express build',
    path: '/express',
    marker: 'X.build-button',
    destination:
      /\/agents\/101\/build\?scenario=shangyang-court&side=a&express=1$/,
  },
  {
    name: 'express error escape',
    path: '/express',
    marker: 'X.error-browse-button',
    destination: /\/scenarios$/,
    options: { scenarioFailed: true },
  },
  {
    name: 'battle panel inventory',
    path: '/agents/101',
    marker: 'OS.hotseat-go-my-agents',
    destination: /\/my-agents$/,
    prepare: (page) => openPanel(page, 'hotseat'),
  },
  {
    name: 'battle panel practice opposite',
    path: '/agents/101',
    marker: 'OS.gate-practice-opposite',
    destination: /\/my-agents$/,
    options: { opponents: true },
    prepare: (page) => openPanel(page, 'pvp'),
  },
  {
    name: 'battle panel create opposite',
    path: '/agents/101',
    marker: 'OS.gate-create-opposite',
    destination: /\/agents\/102$/,
    prepare: (page) => openPanel(page, 'pvp'),
  },
  {
    name: 'first battle rematch',
    path: '/matches/9001',
    marker: 'FA.journey-rematch-button',
    destination: /\/agents\/101$/,
    prepare: showJourney,
  },
  {
    name: 'continue accepted first battle',
    path: '/agents/101/build?scenario=shangyang-court&side=a&express=1',
    selector: 'a[href="/matches/9001?express=1"]',
    destination: /\/matches\/9001\?express=1$/,
    prepare: async (page) => {
      await page.evaluate(() =>
        sessionStorage.setItem(
          'axiia:first-battle-attempt:v1:navigation-test:101',
          JSON.stringify({
            versionID: 1002,
            presetKey: 'test',
            status: 'accepted',
            matchID: 9001,
          }),
        )
      )
      await page.reload()
    },
  },
  {
    name: 'first battle opposite',
    path: '/matches/9001',
    marker: 'FA.journey-opposite-button',
    destination: /\/agents\/102$/,
    prepare: showJourney,
  },
  {
    name: 'first battle progress',
    path: '/matches/9001',
    marker: 'FA.journey-progress-button',
    destination: /\/agents\/101$/,
    prepare: showJourney,
  },
  {
    name: 'match history card',
    path: '/matches',
    marker: 'L.match-card',
    destination: /\/matches\/9001$/,
  },
  {
    name: 'notification details',
    path: '/notifications',
    marker: 'I.detail-link',
    destination: /\/matches\/9001$/,
  },
  {
    name: 'tournament card',
    path: '/tournaments',
    marker: 'G.tournament-card',
    destination: /\/tournaments\/1$/,
  },
  {
    name: 'tournament submitted version',
    path: '/tournaments/1',
    selector: 'a[href="/versions/1002"]:visible',
    destination: /\/agents\/101$/,
  },
  {
    name: 'header rewards',
    path: '/my-agents',
    selector: 'a[href="/rewards"]',
    destination: /\/rewards$/,
  },
  {
    name: 'reward match details',
    path: '/rewards',
    selector: 'a[href="/matches/9001"]',
    destination: /\/matches\/9001$/,
  },
]

async function checkNewTab(
  page: Page,
  link: Locator,
  destination: RegExp,
  ctrl: boolean,
) {
  const original = page.url()
  // A background-tab close does not consistently restore focus in headless
  // Chromium. Model the user returning to the source before the next gesture.
  await page.bringToFront()
  const popupPromise = page.context().waitForEvent('page')
  await link.click(
    ctrl ? { modifiers: ['ControlOrMeta'] } : { button: 'middle' },
  )
  const popup = await popupPromise
  await popup.bringToFront()
  await expect(popup).toHaveURL(destination)
  await expect(popup.getByRole('heading').first()).toBeVisible()
  if (
    new URL(popup.url()).searchParams.get('express') === '1' &&
    new URL(popup.url()).pathname.startsWith('/matches/')
  ) {
    await expect(popup.locator('[data-tm="FA.journey-rematch-button"]'))
      .toBeVisible()
  }
  await expect(page).toHaveURL(original)
  await expect(link).toBeVisible()
  await popup.close()
  await page.bringToFront()
}

for (const entry of cases) {
  test(`${entry.name}: native link, middle-click, Ctrl/Cmd-click, normal click`, async ({ page }) => {
    const { ensures, unexpected, errors } = await fixtures(page, entry.options)
    await page.goto(entry.path)
    await entry.prepare?.(page)
    const link = page.locator(entry.selector ?? `[data-tm="${entry.marker}"]`)
      .first()
    await expect(link).toHaveAttribute('href', /^\//)
    expect(await link.evaluate((el) => el.tagName)).toBe('A')
    await expect(link.locator('button, a, input')).toHaveCount(0)
    await link.hover()
    expect(ensures).toHaveLength(0)

    await checkNewTab(page, link, entry.destination, false)
    await checkNewTab(page, link, entry.destination, true)
    expect(ensures.every((request) => request.page !== page)).toBe(true)
    await link.click()
    await expect(page).toHaveURL(entry.destination)
    expect(unexpected).toEqual([])
    expect(errors).toEqual([])
  })
}

test('right-click preserves the source and does not resolve an agent', async ({ page }) => {
  const { ensures } = await fixtures(page)
  await page.goto('/express')
  const link = page.locator('[data-tm="X.build-button"]')
  await expect(link).toHaveAttribute('href', /^\/agents\/entry\?/)
  await link.click({ button: 'right' })
  await expect(page).toHaveURL(/\/express$/)
  expect(ensures).toHaveLength(0)
  // End this gesture independently: sending Escape in a headless browser can
  // dismiss the application's dialog rather than a native context menu.
})

test('inventory fallback directly creates an agent', async ({ page }) => {
  await fixtures(page, { inventoryFailed: true })
  await page.context().route(
    '**/v1/agents',
    (route) => route.fulfill({ json: { agentID: 101 } }),
  )
  await page.goto('/my-agents')
  await page.getByRole('button', { name: '新建商鞅智能体' }).click()
  await expect(page).toHaveURL(/\/agents\/101$/)
  await expect(page.getByRole('textbox', { name: '智能体名称' })).toBeFocused()
})

test('Shift-click opens a separate page; Meta-click is not intercepted', async ({ page }) => {
  await fixtures(page)
  await page.goto('/agents/101')
  const link = page.getByRole('link', { name: '新建版本' })
  await expect(link).toBeVisible()
  const intercepted = await link.evaluate((element) => {
    let prevented = true
    window.addEventListener('click', (event) => {
      prevented = event.defaultPrevented
      event.preventDefault()
    }, { once: true })
    element.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        metaKey: true,
      }),
    )
    return prevented
  })
  expect(intercepted).toBe(false)
  await page.bringToFront()
  const popupPromise = page.context().waitForEvent('page')
  await link.click({ modifiers: ['Shift'] })
  const popup = await popupPromise
  await expect(popup).toHaveURL(/\/agents\/101\/build$/)
  await expect(page).toHaveURL(/\/agents\/101$/)
  await popup.close()
  await link.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/agents\/101\/build$/)
})

test('entry errors can retry, and back does not repeat get-or-create', async ({ page }) => {
  const { ensures } = await fixtures(page, { empty: true })
  let attempts = 0
  await page.context().route('**/v1/agents/ensure', async (route) => {
    attempts++
    if (attempts === 1) {
      return route.fulfill({
        status: 503,
        json: { error: 'unavailable', message: '请稍后重试' },
      })
    }
    await route.fallback()
  })
  await page.goto('/express')
  await page.locator('[data-tm="X.build-button"]').click()
  await expect(page.getByRole('alert')).toHaveText('请稍后重试')
  expect(attempts).toBe(1)
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await expect(page).toHaveURL(/\/agents\/101\?express=1$/)
  await expect(page.getByRole('textbox', { name: '智能体名称' })).toBeFocused()
  await expect(page.getByRole('link', { name: '新建版本' })).toHaveAttribute(
    'href',
    '/agents/101/build?scenario=shangyang-court&side=a&express=1',
  )
  expect(attempts).toBe(2)
  expect(ensures).toHaveLength(1)
  await page.goBack()
  await expect(page).toHaveURL(/\/express$/)
  expect(attempts).toBe(2)
})

test('a signed-out entry keeps its complete destination through login', async ({ page }) => {
  const { ensures } = await fixtures(page, { guest: true })
  const destination =
    '/agents/entry?scenario=shangyang-court&side=b&target=build&express=1'
  await page.goto(destination)
  await expect(page).toHaveURL(/\/login\?next=/)
  expect(new URL(page.url()).searchParams.get('next')).toBe(destination)
  expect(ensures).toHaveLength(0)
})

test('invalid entry parameters never call get-or-create', async ({ page }) => {
  const { ensures } = await fixtures(page)
  for (
    const query of [
      'side=a',
      'scenario=shangyang-court&side=c',
      'scenario=shangyang-court&side=a&target=unknown',
    ]
  ) {
    await page.goto(`/agents/entry?${query}`)
    await expect(page).toHaveURL(/\/scenarios$/)
  }
  expect(ensures).toHaveLength(0)
})

for (const detail of agentPreviewScenarios) {
  for (const side of ['a', 'b'] as const) {
    test(`${detail.summary.id} ${side}: direct home, scoped siblings, refresh and full inventory`, async ({ page }) => {
      const { ensures, unexpected, errors } = await fixtures(page)
      await page.context().route('**/v1/**', async (route) => {
        const path = new URL(route.request().url()).pathname.slice(3)
        if (path === '/my/agents') {
          return route.fulfill({ json: agentPreviewInventory })
        }
        if (path === '/scenarios') {
          return route.fulfill({
            json: {
              scenarios: agentPreviewScenarios.map((item) => item.summary),
            },
          })
        }
        const scenario = agentPreviewScenarios.find((item) =>
          path === `/scenarios/${item.summary.id}`
        )
        if (scenario) return route.fulfill({ json: scenario })
        const match = /^\/agents\/(\d+)\/(draft|versions)$/.exec(path)
        const agent = match ? previewAgent(Number(match[1])) : null
        if (agent && match) {
          return route.fulfill({
            json: match[2] === 'draft'
              ? { fields: {}, scenarioID: agent.scenarioID, side: agent.side }
              : {
                versions: agent.versions,
                entryVersionID: agent.agent.entryVersionID,
              },
          })
        }
        return route.fallback()
      })
      const inventory = agentPreviewInventory.scenarios.find((item) =>
        item.scenarioID === detail.summary.id
      )!
      const agents = inventory.sides[side]
      const selected = agents[side === 'a' ? 1 : 0]
      if (side === 'b') await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(`/scenarios/${detail.summary.id}`)
      const link = page.locator('[data-tm="DA.view-mine-button"]').nth(
        side === 'a' ? 0 : 1,
      )
      await expect(link).toHaveAttribute('href', `/agents/${selected.agentID}`)
      await expect(link).toContainText(`（${agents.length}）`)
      await link.click()
      await expect(page).toHaveURL(new RegExp(`/agents/${selected.agentID}$`))
      const siblings = page.getByRole('navigation', { name: '同角色智能体' })
        .getByRole('link')
      await expect(siblings).toHaveCount(agents.length)
      expect(
        await siblings.evaluateAll((links) =>
          links.map((link) => link.getAttribute('href'))
        ),
      )
        .toEqual(agents.map((agent) => `/agents/${agent.agentID}`))
      await page.reload()
      await expect(siblings).toHaveCount(agents.length)
      const other = agents[side === 'a' ? 0 : 1]
      await page.locator(
        `[data-tm="EA.sibling-pill"][href="/agents/${other.agentID}"]`,
      ).click()
      await expect(page).toHaveURL(new RegExp(`/agents/${other.agentID}$`))
      await expect(
        page.locator(
          `[data-tm="EA.sibling-pill"][href="/agents/${other.agentID}"]`,
        ),
      ).toHaveAttribute('aria-current', 'page')
      await page.locator('[data-tm="EA.back-link"]').click()
      await expect(page).toHaveURL(new RegExp(`/agents/${selected.agentID}$`))
      await page.locator('[data-tm="EA.back-link"]').click()
      await expect(page).toHaveURL(
        new RegExp(`/scenarios/${detail.summary.id}$`),
      )
      // The page back link follows the actual source; main navigation still
      // opens the complete inventory regardless of the current scenario.
      await page.getByRole('link', { name: '我的智能体', exact: true }).click()
      await expect(page).toHaveURL(/\/my-agents$/)
      await expect(page.locator('[data-tm="MA.scenario-group"]')).toHaveCount(5)
      expect(ensures).toHaveLength(0)
      expect(unexpected).toEqual([])
      expect(errors).toEqual([])
    })
  }
}
