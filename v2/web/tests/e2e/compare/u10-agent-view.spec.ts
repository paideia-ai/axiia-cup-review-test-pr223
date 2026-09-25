// U10 · u10-agent-view.feature 的可执行镜像。
// 2026-09-09：EA 是咳嗦三页层级中的高信息管理中心。
import {
  type APIRequestContext,
  type Browser,
  expect,
  type Page,
  request,
  test,
} from '@playwright/test'

import { baseURL, registrationCode, sameOrigin } from '../helpers'

const SCENARIO = 'shangyang-court'
const SCENARIO_TITLE = '商鞅变法·朝堂辩法'
const PASSWORD = 'playwrightpw-123456'
const PROMPT_V1 = 'U10-PRIVATE-v1：先立木取信，再逐条说明变法收益。'
const PROMPT_V2 = `U10-PRIVATE-v2：${
  '把祖制论证转成可验证的执行问题；'.repeat(28)
}`
const PROMPT_G = 'U10-PRIVATE-甘龙：先查改革成本由谁承担。'
const PROMPT_B = 'U10-PRIVATE-激进：先破不法古，再给出三步执行表。'

let ownerEmail = ''
let agentA = 0
let agentB = 0
let agentG = 0
let versionA1 = 0
let versionA2 = 0

async function api(
  context: APIRequestContext,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  data?: unknown,
) {
  const response = await context.fetch(`${baseURL}/v1${path}`, {
    method,
    headers: { ...sameOrigin, 'Content-Type': 'application/json' },
    ...(data === undefined ? {} : { data }),
  })
  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = await response.text()
  }
  return { status: response.status(), body }
}

test.beforeAll(async () => {
  expect(baseURL, 'AXIIA_BASE_URL must be set').not.toBe('')
  expect(registrationCode, 'AXIIA_REGISTRATION_CODE must be set').not.toBe('')
  const context = await request.newContext({ baseURL })
  ownerEmail = `playwright-u10-keso-${Date.now()}@axiia.test`
  const signed = await api(context, 'POST', '/auth/signup', {
    code: registrationCode,
    email: ownerEmail,
    phone: null,
    password: PASSWORD,
    displayName: 'U10 所有者',
  })
  expect(signed.status).toBe(200)

  const models = await api(context, 'GET', '/models') as {
    status: number
    body: { models: Array<{ id: string }> }
  }
  expect(models.status).toBe(200)
  const modelID = models.body.models[0].id

  const ensure = async (side: 'a' | 'b') => {
    const response = await api(context, 'POST', '/agents/ensure', {
      scenarioID: SCENARIO,
      side,
    }) as { status: number; body: { agentID: number } }
    expect(response.status).toBe(200)
    return response.body.agentID
  }
  const save = async (id: number, prompt: string) => {
    const response = await api(context, 'POST', `/agents/${id}/save`, {
      prompt,
      modelID,
      method: 'raw',
    }) as { status: number; body: { id: number } }
    expect(response.status).toBe(200)
    return response.body.id
  }

  agentA = await ensure('a')
  await api(context, 'PATCH', `/agents/${agentA}`, { name: '贪婪' })
  versionA1 = await save(agentA, PROMPT_V1)
  versionA2 = await save(agentA, PROMPT_V2)

  agentG = await ensure('b')
  await save(agentG, PROMPT_G)

  const created = await api(context, 'POST', '/agents', {
    scenarioID: SCENARIO,
    side: 'a',
    name: '激进',
  }) as { status: number; body: { agentID: number } }
  expect(created.status).toBe(200)
  agentB = created.body.agentID
  await save(agentB, PROMPT_B)
  await context.dispose()
})

async function loginOwner(page: Page) {
  const response = await page.request.post('/v1/auth/login', {
    headers: sameOrigin,
    data: { email: ownerEmail, password: PASSWORD },
  })
  expect(response.ok()).toBe(true)
}

async function openOwner(page: Page, id = agentA) {
  await loginOwner(page)
  await page.goto(`/agents/${id}`)
  await expect(page.getByRole('heading', { level: 1 }))
    .toBeVisible({ timeout: 30_000 })
}

async function outsider(browser: Browser) {
  const context = await browser.newContext({ baseURL })
  const email = `playwright-u10-outsider-${Date.now()}@axiia.test`
  const response = await context.request.post('/v1/auth/signup', {
    headers: sameOrigin,
    data: {
      code: registrationCode,
      email,
      phone: null,
      password: PASSWORD,
      displayName: 'U10 外部玩家',
    },
  })
  expect(response.ok()).toBe(true)
  return context
}

test('身份和同角色栏集中在主页', async ({ page }) => {
  await test.step('假如 所有者有商鞅「贪婪」两版、同侧商鞅「激进」一版和甘龙一版', async () => {
    await openOwner(page)
  })

  await test.step('当 所有者打开商鞅「贪婪」主页', async () => {
    await page.goto(`/agents/${agentA}`)
  })

  await test.step('那么 标题显示名称，副行显示场景、侧、版本数和真实 agent id', async () => {
    await expect(page.getByRole('heading', { name: '商鞅「贪婪」' }))
      .toBeVisible()
    const subtitle = page.locator('[data-tm="EA.subtitle"]')
    await expect(subtitle).toContainText(SCENARIO_TITLE)
    await expect(subtitle).toContainText('甲方')
    await expect(subtitle).toContainText('2 个版本')
    await expect(subtitle).toContainText(`#${agentA}`)
  })

  await test.step('并且 同角色栏显示当前与兄弟智能体、当前项被选中，末尾可新建', async () => {
    const rail = page.getByRole('navigation', { name: '同角色智能体' })
    await expect(rail.getByRole('link', { name: '商鞅「贪婪」' }))
      .toHaveAttribute('aria-current', 'page')
    await expect(rail.getByRole('link', { name: '商鞅「激进」' }))
      .toHaveAttribute('href', `/agents/${agentB}`)
    await expect(rail.getByRole('button', { name: '新建商鞅智能体' }))
      .toBeVisible()
  })

  await test.step('当 所有者打开只有一个智能体的甘龙主页', async () => {
    await page.goto(`/agents/${agentG}`)
  })

  await test.step('那么 同角色栏仍然显示，而不是因单例消失', async () => {
    const rail = page.getByRole('navigation', { name: '同角色智能体' })
    await expect(rail).toBeVisible()
    await expect(
      rail.getByRole('link', { name: new RegExp(`甘龙 #${agentG}`) }),
    )
      .toHaveAttribute('aria-current', 'page')
    await expect(rail.getByRole('button', { name: '新建甘龙智能体' }))
      .toBeVisible()
  })

  await test.step('并且 主页不重复显示双侧完成度徽章', async () => {
    await expect(page.getByLabel('两侧参赛状态')).toHaveCount(0)
    await expect(page.getByText('参赛资格已就绪')).toHaveCount(0)
  })
})

test('版本卡提供紧凑而完整的真实动作', async ({ page }) => {
  await test.step('当 所有者打开商鞅「贪婪」主页', async () => {
    await openOwner(page)
  })

  await test.step('那么 两张版本卡显示版本号、真实 id、模型、战绩和提示词', async () => {
    const cards = page.getByTestId('version-card')
    await expect(cards).toHaveCount(2)
    await expect(cards.locator('[data-tm="E.version-tag"]')).toHaveText([
      'v2',
      'v1',
    ])
    await expect(page.getByText(`#${versionA1}`, { exact: true }))
      .toBeVisible()
    await expect(page.getByText(`#${versionA2}`, { exact: true }))
      .toBeVisible()
    await expect(cards.getByText('暂无战绩')).toHaveCount(2)
  })

  await test.step('并且 每版提供复制、参赛选择和真实出战入口', async () => {
    for (const ordinal of [1, 2]) {
      await expect(page.getByRole('button', {
        name: `复制 v${ordinal} 提示词`,
      })).toBeVisible()
      await expect(page.getByRole('button', {
        name: `将 v${ordinal} 设为商鞅参赛版本`,
      })).toBeVisible()
      await expect(page.getByRole('button', { name: `用 v${ordinal} 出战` }))
        .toBeVisible()
    }
  })

  await test.step('并且 长正文才提供展开按钮，不再提供“基于该版本迭代”', async () => {
    await expect(page.getByRole('button', { name: '展开 v2 全文' }))
      .toBeVisible()
    await expect(page.getByRole('button', { name: '展开 v1 全文' }))
      .toHaveCount(0)
    await expect(page.getByRole('button', { name: /基于.*迭代/ }))
      .toHaveCount(0)
  })

  await test.step('当 所有者点 v2 出战', async () => {
    await page.getByRole('button', { name: '用 v2 出战' }).click()
  })

  await test.step('那么 打开真实 OsPanel，并钉住 v2，不派发模拟对局', async () => {
    const panel = page.getByRole('dialog', {
      name: new RegExp(`出战 · ${SCENARIO_TITLE}`),
    })
    await expect(panel).toBeVisible()
    await expect(panel.getByText(/出战版本：.*v2/)).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/agents/${agentA}$`))
    await panel.getByRole('button', { name: '关闭' }).click()
  })
})

test('新版本、重命名和归档集中在主页，暂不展示版本对比', async ({ page }) => {
  await openOwner(page)

  await test.step('那么 展示当前版本战绩且不提供版本对比', async () => {
    await expect(page.getByRole('heading', { name: '当前版本 · v2' }))
      .toBeVisible()
    await expect(page.getByRole('button', { name: '版本对比' })).toHaveCount(0)
  })

  await test.step('当 所有者打开更多菜单', async () => {
    await page.getByRole('button', { name: '智能体更多操作' }).click()
  })

  await test.step('那么 可以重命名和归档，但已有版本的智能体不可删除', async () => {
    await expect(page.getByRole('menuitem', { name: '重命名' })).toBeEnabled()
    await expect(page.getByRole('menuitem', { name: '删除智能体' }))
      .toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: '归档智能体' }))
      .toBeEnabled()
    await page.keyboard.press('Escape')
  })

  await test.step('当 所有者点“新建版本”', async () => {
    await page.getByRole('link', { name: '新建版本' }).click()
  })

  await test.step('那么 进入低信息构建器，构建器没有版本卡', async () => {
    await expect(page).toHaveURL(new RegExp(`/agents/${agentA}/build$`))
    await expect(page.getByLabel('策略提示词')).toBeEnabled({
      timeout: 30_000,
    })
    await expect(page.getByTestId('version-card')).toHaveCount(0)
  })
})

test('公开投影保留战绩但绝不泄漏提示词与 diff', async ({ browser }) => {
  const context = await outsider(browser)
  const page = await context.newPage()

  await test.step('当 另一位玩家打开商鞅「贪婪」主页', async () => {
    await page.goto(`/agents/${agentA}`)
    await expect(page.getByRole('heading', { name: '商鞅「贪婪」' }))
      .toBeVisible({ timeout: 30_000 })
  })

  await test.step('那么 展示名、场景与逐版本战绩可见', async () => {
    await expect(page.getByText(SCENARIO_TITLE)).toBeVisible()
    await expect(page.getByRole('heading', { name: '逐版本战绩' }))
      .toBeVisible()
    await expect(page.locator('[data-tm="EA.public-version-item"]'))
      .toHaveCount(2)
  })

  await test.step('但是 所有者的提示词、复制、参赛、出战、重命名、新版本和版本对比不可见', async () => {
    for (const secret of [PROMPT_V1, 'U10-PRIVATE-v2', PROMPT_B]) {
      await expect(
        page.getByText(
          new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        ),
      )
        .toHaveCount(0)
    }
    await expect(page.getByRole('button', {
      name: /复制.*提示词|设为.*参赛版本|出战|智能体更多操作|新建版本|版本对比/,
    })).toHaveCount(0)
  })

  await test.step('并且 draft、versions、diff 接口拒绝非所有者，public 接口不含提示词', async () => {
    for (
      const path of [
        `/v1/agents/${agentA}/draft`,
        `/v1/agents/${agentA}/versions`,
        `/v1/agents/${agentA}/diff?base=${versionA1}&head=${versionA2}`,
      ]
    ) {
      const response = await context.request.get(path)
      expect(response.ok(), `${path} is owner-only`).toBe(false)
      expect(await response.text()).not.toContain('U10-PRIVATE')
    }
    const publicResponse = await context.request.get(
      `/v1/agents/${agentA}/public`,
    )
    expect(publicResponse.ok()).toBe(true)
    expect(await publicResponse.text()).not.toContain('U10-PRIVATE')
  })

  await context.close()
})

test('跨页面等待参赛改标时，全局只允许一个侧级写入并刷新当前主页', async ({ page }) => {
  let releaseEntry!: () => void
  const entryGate = new Promise<void>((resolve) => {
    releaseEntry = resolve
  })
  let sawEntry!: () => void
  const entrySeen = new Promise<void>((resolve) => {
    sawEntry = resolve
  })

  await test.step('假如 商鞅「贪婪」的 v2 改标请求被延迟', async () => {
    await openOwner(page)
    await page.route(
      new RegExp(`/v1/agents/${agentA}/entry/${versionA2}$`),
      async (route) => {
        sawEntry()
        await entryGate
        await route.continue()
      },
    )
    await page.getByRole('button', {
      name: '将 v2 设为商鞅参赛版本',
    }).click()
    await entrySeen
  })

  await test.step('当 我离开主页再打开同侧商鞅「激进」', async () => {
    await page.getByRole('link', { name: '我的智能体', exact: true }).click()
    await expect(page).toHaveURL(/\/my-agents$/)
    await page.locator(
      `a[data-testid="agent-row"][data-agent-id="${agentB}"]`,
    ).click()
    await expect(page.getByRole('heading', { name: '商鞅「激进」' }))
      .toBeVisible()
  })

  await test.step('那么 新主页的参赛按钮保持禁用，不能发出第二个同侧写入', async () => {
    await expect(page.getByRole('button', {
      name: '将 v1 设为商鞅参赛版本',
    })).toBeDisabled()
  })

  await test.step('当 延迟请求完成', () => {
    releaseEntry()
  })

  await test.step('那么 当前主页自动刷新且参赛按钮恢复', async () => {
    await expect(page.getByRole('button', {
      name: '将 v1 设为商鞅参赛版本',
    })).toBeEnabled()
    await expect.poll(async () => {
      const response = await page.request.get(
        `/v1/agents/${agentA}/versions`,
      )
      const payload = await response.json() as { entryVersionID: number }
      return payload.entryVersionID
    }).toBe(versionA2)
  })
})

test('慢重命名离开主页后不会劫持路由，并使清单失效重载', async ({ page }) => {
  const nextName = '竞态安全'
  let releaseRename!: () => void
  const renameGate = new Promise<void>((resolve) => {
    releaseRename = resolve
  })
  let sawRename!: () => void
  const renameSeen = new Promise<void>((resolve) => {
    sawRename = resolve
  })

  await test.step('假如 重命名请求被延迟且输入在提交后锁定', async () => {
    await openOwner(page)
    await page.route(
      new RegExp(`/v1/agents/${agentA}$`),
      async (route) => {
        if (route.request().method() !== 'PATCH') {
          await route.continue()
          return
        }
        sawRename()
        await renameGate
        await route.continue()
      },
    )
    await page.getByRole('button', { name: '智能体更多操作' }).click()
    await page.getByRole('menuitem', { name: '重命名' }).click()
    const input = page.getByLabel('智能体名称')
    await input.fill(nextName)
    await page.getByRole('button', { name: '保存名称' }).click()
    await renameSeen
    await expect(input).toBeDisabled()
  })

  await test.step('当 我在请求完成前离开到「我的智能体」', async () => {
    await page.getByRole('link', { name: '我的智能体', exact: true }).click()
    await expect(page).toHaveURL(/\/my-agents$/)
  })

  await test.step('当 延迟请求完成', () => {
    releaseRename()
  })

  await test.step('那么 路由不被劫持且清单自动显示新名称', async () => {
    await expect(page).toHaveURL(/\/my-agents$/)
    const row = page.locator(
      `a[data-testid="agent-row"][data-agent-id="${agentA}"]`,
    )
    await expect(row).toContainText(nextName)
    await expect(row).not.toContainText('商鞅')
  })
})
