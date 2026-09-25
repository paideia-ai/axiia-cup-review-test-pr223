// U19 executable BDD. Steps mirror sound-feedback.feature on product baseline
// 18515a3. HTTP is fixture-controlled; the SPA, EventSource and Web Audio are real.
import { expect, type Page, type Route, test } from '@playwright/test'

import type {
  AgentVersionDTO,
  MatchDetail,
  MatchEventDTO,
  RewardsResponse,
} from '../../src/api/types'
import {
  config,
  finishedMatch,
  inventory,
  scenario,
} from '../../src/testing/v34-fixtures'

interface AudioStart {
  milliseconds: number
  when: number
  duration: number
  loop: boolean
  channels: number
  gain: number | null
  hidden: boolean
  focused: boolean
}
interface SoundWorld {
  prompt: string
  versions: AgentVersionDTO[]
  firstBattleDone: boolean
  saveFails: boolean
  dispatchFails: boolean
  saves: number
  dispatches: number
  mutations: number
  claimed: boolean
  match: MatchDetail
  streams: Route[]
  streamRequests: number
  listMatches: boolean
  listRequests: number
  unhandled: string[]
}
const worlds = new WeakMap<Page, SoundWorld>()
const MATCH_ID = 9001

async function installWorld(page: Page): Promise<SoundWorld> {
  const world: SoundWorld = {
    prompt: '先给出可验证的承诺，再回应对方的顾虑。',
    versions: [],
    firstBattleDone: true,
    saveFails: false,
    dispatchFails: false,
    saves: 0,
    dispatches: 0,
    mutations: 0,
    claimed: false,
    match: structuredClone(finishedMatch),
    streams: [],
    streamRequests: 0,
    listMatches: false,
    listRequests: 0,
    unhandled: [],
  }
  worlds.set(page, world)
  await page.addInitScript(() => {
    const scope = globalThis as typeof globalThis & {
      __axiiaAudioStarts: AudioStart[]
      __axiiaAudioContextCount: number
    }
    scope.__axiiaAudioStarts = []
    scope.__axiiaAudioContextCount = 0
    const nativeContext = AudioContext
    globalThis.AudioContext = new Proxy(nativeContext, {
      construct(target, args) {
        scope.__axiiaAudioContextCount++
        return Reflect.construct(target, args)
      },
    })
    const gains = new WeakMap<AudioNode, AudioNode>()
    const connect = AudioBufferSourceNode.prototype.connect as (
      this: AudioBufferSourceNode,
      destination: AudioNode,
      output?: number,
      input?: number,
    ) => AudioNode
    AudioBufferSourceNode.prototype.connect = function (
      this: AudioBufferSourceNode,
      destination: AudioNode,
      ...args: [number?, number?]
    ) {
      gains.set(this, destination)
      return connect.call(this, destination, ...args)
    } as typeof AudioBufferSourceNode.prototype.connect
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (
      this: AudioBufferSourceNode,
      ...args: Parameters<AudioBufferSourceNode['start']>
    ) {
      start.apply(this, args)
      scope.__axiiaAudioStarts.push({
        milliseconds: Math.round((this.buffer?.duration ?? 0) * 1000),
        duration: this.buffer?.duration ?? 0,
        loop: this.loop,
        channels: this.buffer?.numberOfChannels ?? 0,
        gain: (gains.get(this) as GainNode | undefined)?.gain?.value ?? null,
        hidden: document.hidden,
        focused: document.hasFocus(),
        when: args[0] ?? this.context.currentTime,
      })
    }
  })
  await page.route('**/v1/**', (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const method = route.request().method()
    const json = (value: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(value),
      })
    if (path === '/v1/auth/me') {
      return json({
        account: {
          id: 'sound-player',
          email: 'sound@example.test',
          displayName: '音效玩家',
          isAdmin: false,
          hasTOTP: false,
        },
        elevated: false,
        firstBattleDone: world.firstBattleDone,
      })
    }
    if (path === '/v1/config') return json(config)
    if (path === '/v1/models') return json({ models: config.models })
    if (path === '/v1/my/agents') return json(inventory)
    if (path === '/v1/scenarios') return json({ scenarios: [scenario.summary] })
    if (path === `/v1/scenarios/${scenario.summary.id}`) return json(scenario)
    if (path.endsWith('/opponents')) return json({ opponents: [] })
    if (path === '/v1/agents/101/draft') {
      return json({
        fields: { prompt: world.prompt },
        scenarioID: scenario.summary.id,
        side: 'a',
      })
    }
    if (path === '/v1/agents/101/matches' && method === 'GET') {
      return json({ matches: [], open: false })
    }
    if (path === '/v1/agents/101/versions') {
      return json({
        versions: world.versions,
        entryVersionID: world.versions[0]?.id ?? null,
      })
    }
    if (path === '/v1/agents/101/mutate' && method === 'POST') {
      world.mutations++
      const body = route.request().postDataJSON() as {
        field: string
        value: string
      }
      if (body.field === 'prompt') world.prompt = body.value
      return json({ ok: true })
    }
    if (path === '/v1/agents/101/save' && method === 'POST') {
      if (world.saveFails) {
        return json({ error: 'fixture_failure', message: '保存测试失败' }, 503)
      }
      world.saves++
      const body = route.request().postDataJSON() as {
        prompt: string
        modelID: string
      }
      const version: AgentVersionDTO = {
        id: 1002 + world.saves,
        agentID: 101,
        prompt: body.prompt,
        modelID: body.modelID,
        isEntry: world.versions.length === 0,
        ordinal: world.versions.length + 1,
        snapshotSeq: 0,
      }
      world.versions.push(version)
      return json(version)
    }
    if (path === '/v1/matches/pve' && method === 'POST') {
      world.dispatches++
      if (world.dispatchFails) {
        return json({ error: 'fixture_failure', message: '派发测试失败' }, 503)
      }
      return json({ matchID: MATCH_ID })
    }
    if (path === '/v1/matches') {
      world.listRequests++
      return json({
        matches: world.listMatches
          ? [{ ...world.match.summary, initiatorIsMe: true }]
          : [],
        open: false,
      })
    }
    if (path === `/v1/matches/${MATCH_ID}`) return json(world.match)
    if (path === `/v1/matches/${MATCH_ID}/stream`) {
      // Hold this native EventSource HTTP response until the test releases its
      // deterministic events after an actual user gesture unlocks audio.
      world.streamRequests++
      world.streams.push(route)
      return
    }
    if (path === '/v1/rewards/quote') {
      return json({
        cost: 100,
        perBattleCost: 100,
        repeatRoleSurcharge: false,
        battleCosts: [100],
      })
    }
    if (path === '/v1/rewards') {
      const wallet: RewardsResponse = {
        balance: world.claimed ? 2050 : 2000,
        battleCost: 100,
        dailyAllowance: 2000,
        dailyRuns: 20,
        pveWinRefundPercent: 50,
        pvpWinRefundPercent: 75,
        pointsPerYuan: 100,
        nextGrantAt: 1789228800,
        claimableRewards: world.claimed
          ? []
          : [{ matchID: MATCH_ID, points: 50, kind: 'pve' }],
      }
      return json(wallet)
    }
    if (path === `/v1/rewards/matches/${MATCH_ID}`) {
      return json({
        matchID: MATCH_ID,
        points: 50,
        kind: 'pve',
        status: world.claimed ? 'claimed' : 'claimable',
      })
    }
    if (path === `/v1/rewards/matches/${MATCH_ID}/claim` && method === 'POST') {
      const alreadyClaimed = world.claimed
      world.claimed = true
      return json({
        matchID: MATCH_ID,
        creditedPoints: alreadyClaimed ? 0 : 50,
        alreadyClaimed,
        balance: 2050,
      })
    }
    if (path === '/v1/notifications/bell' || path === '/v1/agents/101/stream') {
      return route.fulfill({
        contentType: 'text/event-stream',
        body: path.endsWith('/bell')
          ? 'data: {"unreadCount":0}\n\n'
          : ': quiet\n\n',
      })
    }
    world.unhandled.push(`${method} ${path}`)
    return json({ error: 'unexpected_fixture_request', message: path }, 500)
  })
  return world
}

function runningMatch(): MatchDetail {
  return {
    ...structuredClone(finishedMatch),
    summary: {
      ...finishedMatch.summary,
      finished: false,
      scored: false,
      winner: null,
    },
    turns: [finishedMatch.turns[0]],
    verdicts: [],
    currentTurn: 1,
    scoreA: null,
    scoreB: null,
    reasoning: null,
  }
}

async function audioStarts(page: Page) {
  return await page.evaluate(() =>
    (globalThis as typeof globalThis & { __axiiaAudioStarts: AudioStart[] })
      .__axiiaAudioStarts
  )
}
async function expectCues(page: Page, milliseconds: number[]) {
  await expect.poll(async () =>
    (await audioStarts(page)).map((item) => item.milliseconds)
  ).toEqual(milliseconds)
}

async function pressSave(page: Page) {
  const save = page.getByTestId('save-version')
  await expect(save).toBeEnabled()
  await save.focus()
  await save.press('Enter')
}
async function releaseStream(world: SoundWorld, events: MatchEventDTO[]) {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(
    '',
  )
  const routes = world.streams.splice(0)
  await Promise.all(
    routes.map((route) =>
      route.fulfill({ contentType: 'text/event-stream', body }).catch(() => {})
    ),
  )
}

test.use({ channel: 'chromium' })
test.describe.configure({ timeout: 45_000 })
test.beforeEach(({ baseURL }) => {
  expect(['127.0.0.1', 'localhost']).toContain(new URL(baseURL!).hostname)
})
test.afterEach(({ page }) => {
  expect(
    worlds.get(page)?.unhandled ?? [],
    'All API traffic stays in the explicit local fixture',
  ).toEqual([])
})

test('音效偏好在刷新和同浏览器页签之间保持一致', async ({ page, context }) => {
  await test.step('假如 我打开具有确定性账户和积分响应的真实设置页', async () => {
    await installWorld(page)
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: '音效', exact: true }))
      .toBeVisible()
  })
  await test.step('那么 总音效默认开启、音量为百分之二十五且没有单独回复开关', async () => {
    await expect(page.getByRole('switch', { name: '启用音效' })).toBeChecked()
    await expect(page.getByRole('slider', { name: '音量' })).toHaveValue('25')
    await expect(page.getByRole('switch', { name: '模型回复提示音' }))
      .toHaveCount(0)
  })
  await test.step('当 我用键盘调高一格音量，并关闭总音效', async () => {
    await page.getByRole('slider', { name: '音量' }).press('ArrowRight')
    await page.getByRole('button', { name: '关闭音效' }).click()
  })
  await test.step('并且 我刷新页面', async () => {
    await page.reload()
  })
  await test.step('那么 总静音和百分之二十六音量都被保留', async () => {
    await expect(page.getByRole('switch', { name: '启用音效' })).not
      .toBeChecked()
    await expect(page.getByRole('slider', { name: '音量' })).toHaveValue('26')
    await expectCues(page, [])
  })
  await test.step('当 我重新开启音效', async () => {
    await page.getByRole('button', { name: '开启音效' }).click()
  })
  await test.step('那么 页面不显示试听按钮且没有播放声音', async () => {
    await expect(page.getByRole('button', { name: /试听/ })).toHaveCount(0)
    await expectCues(page, [])
  })
  await test.step('当 我在另一个页签关闭总音效', async () => {
    const other = await context.newPage()
    const otherWorld = await installWorld(other)
    await other.goto('/settings')
    await other.getByRole('button', { name: '关闭音效' }).click()
    expect(otherWorld.unhandled).toEqual([])
    await other.close()
  })
  await test.step('那么 第一个页签也显示静音', async () => {
    await expect(page.getByRole('switch', { name: '启用音效' })).not
      .toBeChecked()
  })
})

test('输入有轻点，自动暂存不重复发声，保存与首战派发按顺序确认', async ({ page }) => {
  let world: SoundWorld
  await test.step('假如 我打开首战构建器并允许同源保存和派发成功', async () => {
    world = await installWorld(page)
    world.match = runningMatch()
    world.firstBattleDone = false
    await page.goto('/agents/101/build?express=1')
    await expect(page.getByRole('button', { name: '保存版本' }))
      .toBeEnabled()
  })
  await test.step('当 我编辑策略并等待草稿自动暂存', async () => {
    await page.getByLabel('策略提示词').click()
    await page.getByLabel('策略提示词').fill(
      '新的策略：先提出清晰的小承诺，再用证据检验。',
    )
    await expect.poll(() => world.mutations).toBeGreaterThan(0)
  })
  await test.step('那么 输入播放一次轻点，自动暂存没有追加声音', async () => {
    await expectCues(page, [75])
  })
  await test.step('当 我保存版本，再明确点击开始首战', async () => {
    await pressSave(page)
    await expect(page).toHaveURL(/\/build\?express=1$/)
    expect(world.dispatches).toBe(0)
    await page.getByTestId('start-first-battle').focus()
    await page.keyboard.press('Enter')
  })
  await test.step('那么 真实页面进入新对局，且保存与派发接口各成功一次', async () => {
    await expect(page).toHaveURL(new RegExp(`/matches/${MATCH_ID}$`))
    await expect(page.getByRole('heading', { name: `对战 #${MATCH_ID}` }))
      .toBeVisible()
    expect(world.saves).toBe(1)
    expect(world.dispatches).toBe(1)
  })
  await test.step('并且 按键立即响起点击音，随后保存音和派发音依次确认且没有重叠', async () => {
    await expectCues(page, [75, 110, 260, 110, 340])
    const starts = await audioStarts(page)
    expect(starts[4].when).toBeGreaterThanOrEqual(
      starts[2].when + starts[2].duration,
    )
  })
})

test('失败操作保留点击反馈，只有成功结果播放确认音', async ({ page }) => {
  let world: SoundWorld
  await test.step('假如 首战构建器的保存接口返回失败', async () => {
    world = await installWorld(page)
    world.saveFails = true
    world.firstBattleDone = false
    await page.goto('/agents/101/build?express=1')
  })
  await test.step('当 我点击保存版本', async () => {
    await pressSave(page)
  })
  await test.step('那么 页面展示保存错误，浏览器只有点击反馈而无保存确认', async () => {
    await expect(page.locator('[data-tm="E.error"]')).toContainText(
      '保存测试失败',
    )
    await expectCues(page, [110])
  })
  await test.step('当 保存恢复成功但派发接口返回失败，我再次提交', async () => {
    world.saveFails = false
    world.dispatchFails = true
    await pressSave(page)
    await page.getByTestId('start-first-battle').focus()
    await page.keyboard.press('Enter')
  })
  await test.step('那么 页面保留已保存版本并提示核对未确认的派发', async () => {
    await expect(page).toHaveURL(/\/build\?express=1$/)
    await expect(
      page.getByText(
        '首战请求结果尚未确认，请到「历史」核对对局记录；不要重复派发。',
      ),
    )
      .toBeVisible()
  })
  await test.step('并且 三次点击各有反馈，只追加一次保存确认且没有派发确认', async () => {
    await expectCues(page, [110, 110, 260, 110])
    expect(world.saves).toBe(1)
    expect(world.dispatches).toBe(1)
  })
})

test('实时回复、成功完局和确认领奖各播放一次', async ({ page }) => {
  let world: SoundWorld
  await test.step('假如 我正在观看含历史台词的进行中对局', async () => {
    world = await installWorld(page)
    world.match = runningMatch()
    await page.goto(`/matches/${MATCH_ID}`)
    await expect(page.getByRole('heading', { name: `对战 #${MATCH_ID}` }))
      .toBeVisible()
    await expect.poll(() => world.streamRequests).toBeGreaterThan(0)
  })
  await test.step('当 我点击对战标题解锁声音，页面没有单独回复开关', async () => {
    await page.getByRole('heading', { name: `对战 #${MATCH_ID}` }).click()
    await expect(page.getByRole('switch', { name: '模型回复提示音' }))
      .toHaveCount(0)
  })
  await test.step('并且 原生事件流送达历史行、推理、文本分片、重复完成事件和成功完局', async () => {
    world.match = structuredClone(finishedMatch)
    const chunk = {
      matchID: MATCH_ID,
      seq: 1,
      channel: 'court',
      speaker: 'b',
      call: 'say',
    }
    const completed = {
      turnCompleted: {
        matchID: MATCH_ID,
        seq: 1,
        channel: 'court',
        kind: 'dialogue',
      },
    }
    await releaseStream(world, [
      {
        turnCompleted: {
          matchID: MATCH_ID,
          seq: 0,
          channel: 'court',
          kind: 'dialogue',
        },
      },
      { chunk: { ...chunk, phase: 'thinking', delta: '隐藏推理' } },
      { chunk: { ...chunk, phase: 'text', delta: '制度若不顾旧俗，' } },
      { chunk: { ...chunk, phase: 'text', delta: '也会让执行失去人心。' } },
      completed,
      completed,
      { matchFinished: { matchID: MATCH_ID, winner: 'a' } },
    ])
  })
  await test.step('那么 浏览器只播放一次回复提示音和一次完局音', async () => {
    await expectCues(page, [65, 720])
    await expect(page.getByRole('button', { name: '领取奖励', exact: true }))
      .toBeVisible()
  })
  await test.step('当 我领取服务端确认的胜利奖励', async () => {
    await page.getByRole('button', { name: '领取奖励', exact: true }).click()
  })
  await test.step('那么 页面显示已领取，浏览器追加一次领奖音', async () => {
    await expect(page.getByText('已领取 · +50 积分')).toBeVisible()
    await expectCues(page, [65, 720, 354])
    const reward = (await audioStarts(page)).at(-1)!
    expect(reward.channels).toBe(2)
    expect(reward.gain).toBeCloseTo(.75)
    expect(world.claimed).toBe(true)
  })
})

test('历史战报与失败完局保持安静', async ({ page }) => {
  let world: SoundWorld
  await test.step('假如 我打开已完成的历史战报', async () => {
    world = await installWorld(page)
    await page.goto(`/matches/${MATCH_ID}`)
    await expect(page.getByRole('heading', { name: `对战 #${MATCH_ID}` }))
      .toBeVisible()
  })
  await test.step('当 我开始历史回放', async () => {
    await page.getByRole('button', { name: '回放', exact: true }).click()
    await expect(page.locator('[data-tm="FA.replay-controls"]')).toBeVisible()
  })
  await test.step('那么 浏览器没有播放回复或完局音，也没有订阅历史对局的事件流', async () => {
    await expectCues(page, [])
    expect(world.streamRequests).toBe(0)
  })
  await test.step('当 我打开另一份进行中夹具并通过点击解锁声音', async () => {
    world.match = runningMatch()
    await page.reload()
    await page.getByRole('heading', { name: `对战 #${MATCH_ID}` }).click()
    await expect.poll(() => world.streamRequests).toBeGreaterThan(0)
  })
  await test.step('并且 原生事件流报告对局失败', async () => {
    world.match = {
      ...runningMatch(),
      summary: { ...runningMatch().summary, finished: true },
      error: 'fixture run failed',
    }
    await releaseStream(world, [{ matchFailed: { matchID: MATCH_ID } }])
  })
  await test.step('那么 页面结束直播，浏览器仍没有播放完局音', async () => {
    await expect(page.locator('[data-tm="FA.match-error"]')).toHaveText(
      '对战错误：fixture run failed',
    )
    await expectCues(page, [])
  })
})

test('策略输入、删除、输入法提交与关键按钮反馈受静音控制', async ({ page }) => {
  await test.step('假如 我打开普通构建器，且保存接口返回可观察的失败', async () => {
    const world = await installWorld(page)
    world.saveFails = true
    await page.goto('/agents/101/build')
    await expect(page.getByTestId('save-version')).toBeEnabled()
  })
  await test.step('当 我只悬停保存按钮而未点击或按键', async () => {
    await page.getByTestId('save-version').hover()
  })
  await test.step('那么 浏览器既没有建立音频上下文，也没有播放声音', async () => {
    const contexts = await page.evaluate(() =>
      (globalThis as typeof globalThis & { __axiiaAudioContextCount: number })
        .__axiiaAudioContextCount
    )
    expect(contexts).toBe(0)
    await expectCues(page, [])
  })
  await test.step('当 我在策略框输入一个字符并删除它', async () => {
    await page.getByLabel('策略提示词').press('End')
    await page.getByLabel('策略提示词').press('a')
    await expectCues(page, [75])
    // Deliberate edits are separated beyond the approved 28 ms repeat cap.
    await page.waitForTimeout(60)
    await page.getByLabel('策略提示词').press('Backspace')
  })
  await test.step('那么 浏览器分别播放输入音和删除音', async () => {
    await expectCues(page, [75, 75])
  })
  await test.step('当 我通过原生组合事件模拟输入法候选', async () => {
    await page.getByLabel('策略提示词').evaluate((element) => {
      const input = element as HTMLTextAreaElement
      const set = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )!.set!
      const initial = input.value
      input.dispatchEvent(
        new CompositionEvent('compositionstart', { bubbles: true, data: '' }),
      )
      for (const candidate of ['zhong', '中']) {
        set.call(input, initial + candidate)
        input.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            inputType: 'insertCompositionText',
            data: candidate,
            isComposing: true,
          }),
        )
      }
    })
  })
  await test.step('那么 候选变化保持安静', async () => {
    await expectCues(page, [75, 75])
  })
  await test.step('当 我提交中文候选并发送重复的最终输入事件', async () => {
    await page.waitForTimeout(60)
    await page.getByLabel('策略提示词').evaluate((element) => {
      element.dispatchEvent(
        new CompositionEvent('compositionend', { bubbles: true, data: '中' }),
      )
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertCompositionText',
          data: '中',
          isComposing: false,
        }),
      )
    })
  })
  await test.step('那么 这次输入法提交只追加一次输入音', async () => {
    await expectCues(page, [75, 75, 75])
  })
  await test.step('当 我悬停并用键盘激活保存按钮', async () => {
    await page.mouse.move(0, 0)
    await page.waitForTimeout(260)
    await page.getByTestId('save-version').hover()
    // Keep the pointer away during keyboard activation: disabling/re-enabling
    // the button after failure can otherwise cause another genuine hover.
    await page.mouse.move(0, 0)
    await pressSave(page)
    await expect(page.locator('[data-tm="E.error"]')).toContainText(
      '保存测试失败',
    )
  })
  await test.step('那么 浏览器追加悬停音和点击音，保存失败没有成功确认音', async () => {
    await expectCues(page, [75, 75, 75, 45, 110])
  })
  await test.step('当 我关闭总音效，再次编辑策略并激活保存', async () => {
    await page.getByRole('button', { name: '关闭音效' }).click()
    await page.getByLabel('策略提示词').press('x')
    await pressSave(page)
    await expect(page.locator('[data-tm="E.error"]')).toContainText(
      '保存测试失败',
    )
  })
  await test.step('那么 后续交互保持安静，且没有任何循环背景音乐', async () => {
    await expectCues(page, [75, 75, 75, 45, 110])
    const starts = await audioStarts(page)
    expect(starts.every((start) => !start.loop && start.duration <= 0.72)).toBe(
      true,
    )
  })
})

test('保存返回主页后出战按钮保留悬停与点击反馈', async ({ page }) => {
  await installWorld(page)
  await test.step('假如 我在构建器保存一个新版本并返回智能体主页', async () => {
    await page.goto('/agents/101/build')
    await pressSave(page)
    await expect(page).toHaveURL(/\/agents\/101$/)
    await expectCues(page, [110, 260])
  })
  await test.step('当 我悬停并激活这个版本的出战按钮', async () => {
    const field = page.getByRole('button', { name: '用 v1 出战', exact: true })
    await field.hover()
    await field.click()
  })
  await test.step('那么 悬停和点击各响一次，并打开指定版本的出战面板', async () => {
    await expectCues(page, [110, 260, 45, 110])
    await expect(page.getByRole('dialog')).toContainText(
      '出战版本：★参赛版本 v1',
    )
  })
})

test('弹性短线保留编辑行为，工具栏只保留复制按钮', async ({ page }) => {
  await installWorld(page)
  await page.goto('/agents/101/build')
  const prompt = page.getByLabel('策略提示词')
  const caret = page.locator('.fancy-caret')
  await test.step('当 我编辑提示词，光标使用已选定的弹性短线与柔音', async () => {
    await prompt.press('End')
    await prompt.press('a')
    await expectCues(page, [75])
    await expect(caret).toBeVisible()
    await expect(caret).toHaveCSS('height', '3px')
    await expect(caret).toHaveCSS('width', '13px')
    const toolbar = page.locator('[data-tm="E.copy-prompt-button"]').locator(
      '..',
    )
    await expect(toolbar.getByRole('button')).toHaveCount(1)
    await expect(toolbar.getByRole('button', { name: '复制当前草稿' }))
      .toBeVisible()
    await expect(toolbar.getByRole('slider')).toHaveCount(0)
    await expect(toolbar.getByText('柔音', { exact: true })).toHaveCount(0)
  })
  await test.step('当 我选择、撤销和重做文本，不额外发声', async () => {
    await prompt.press('Shift+ArrowLeft')
    await expect(caret).toBeHidden()
    await prompt.press('ArrowRight')
    await prompt.press('Control+z')
    await prompt.press('Control+Shift+z')
    await expectCues(page, [75])
  })
  await test.step('当 我换行和粘贴，分别使用换行音和一次更轻的粘贴音', async () => {
    await page.waitForTimeout(40)
    await prompt.press('Enter')
    await expectCues(page, [75, 113])
    await page.waitForTimeout(40)
    await prompt.evaluate((element) => {
      const input = element as HTMLTextAreaElement
      input.setRangeText(
        '粘贴测试',
        input.selectionStart,
        input.selectionEnd,
        'end',
      )
      input.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertFromPaste',
          data: '粘贴测试',
        }),
      )
    })
    await expectCues(page, [75, 113, 75])
  })
  await test.step('当 我复制草稿并切换总音效，复制可用且编辑遵守总静音', async () => {
    await page.getByRole('button', { name: '复制当前草稿', exact: true })
      .click()
    await expect(page.getByRole('button', { name: '已复制当前草稿' }))
      .toBeVisible()
    await page.getByRole('button', { name: '关闭音效', exact: true }).click()
    await prompt.press('b')
    await expectCues(page, [75, 113, 75])
    await page.getByRole('button', { name: '开启音效', exact: true }).click()
    await prompt.press('c')
    await expectCues(page, [75, 113, 75, 75])
  })
  await test.step('那么 减少动态和高对比设置仍保留可用光标与窄屏布局', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await prompt.press('End')
    await expect(caret.locator('span')).toHaveCSS('animation-name', 'none')
    await page.emulateMedia({ forcedColors: 'active' })
    await expect(page.locator('.typing-caret-overlay')).toBeHidden()
    await expect(prompt).not.toHaveCSS('caret-color', 'rgba(0, 0, 0, 0)')
    await page.emulateMedia({ forcedColors: 'none' })
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      // Resize and media-query updates can settle after setViewportSize returns.
      await expect.poll(
        () =>
          page.evaluate(() =>
            document.documentElement.scrollWidth - innerWidth
          ),
        { message: `No horizontal overflow at ${width}px` },
      ).toBeLessThanOrEqual(0)
    }
  })
})

// Playwright forces focus on its own CDP session. A separate CDPSession cannot
// undo that override; use the pinned in-process session to test real visibility.
function nativeFocus(page: Page, enabled: boolean) {
  const internal = page as unknown as {
    _connection: {
      toImpl(page: Page): {
        delegate: {
          _mainFrameSession: {
            _client: {
              send(
                method: string,
                params: { enabled: boolean },
              ): Promise<unknown>
            }
          }
        }
      }
    }
  }
  return internal._connection.toImpl(page).delegate._mainFrameSession._client
    .send(
      'Emulation.setFocusEmulationEnabled',
      { enabled },
    )
}

test.describe('后台完局提醒', () => {
  test('后台事件流完局仍提醒一次且返回不重播', async ({ page, context }) => {
    const world = await installWorld(page)
    world.match = runningMatch()
    await page.goto(`/matches/${MATCH_ID}`)
    await page.getByRole('heading', { name: `对战 #${MATCH_ID}` }).click()
    await expect.poll(() => world.streamRequests).toBeGreaterThan(0)
    await test.step('当 我切换到另一个标签页后，对局事件流报告胜利', async () => {
      await nativeFocus(page, false)
      const other = await context.newPage()
      await other.goto('about:blank')
      await other.bringToFront()
      await expect.poll(() =>
        page.evaluate(() => document.hidden && !document.hasFocus())
      ).toBe(true)
      world.match = structuredClone(finishedMatch)
      await releaseStream(world, [{
        matchFinished: { matchID: MATCH_ID, winner: 'a' },
      }])
    })
    await test.step('那么 后台播放一次完成音，回到页面不重播', async () => {
      await expectCues(page, [720])
      expect((await audioStarts(page))[0]).toMatchObject({
        hidden: true,
        focused: false,
      })
      await page.bringToFront()
      await nativeFocus(page, true)
      await expect(page.getByRole('button', { name: '领取奖励', exact: true }))
        .toBeVisible()
      await expectCues(page, [720])
    })
  })

  test('离开对战页后后台轮询仍提醒并尊重总静音', async ({ page, context }) => {
    await page.clock.install()
    const world = await installWorld(page)
    world.match = runningMatch()
    world.listMatches = true
    await page.goto('/settings')
    await expect.poll(() => world.listRequests).toBeGreaterThan(0)
    await page.getByRole('heading', { name: '音效', exact: true }).click()
    await expectCues(page, [])
    await nativeFocus(page, false)
    const other = await context.newPage()
    await other.goto('about:blank')
    await other.bringToFront()
    await expect.poll(() => page.evaluate(() => document.hidden)).toBe(true)
    await test.step('当 页面留在设置页的后台，对局在两次轮询之间完成', async () => {
      world.match = structuredClone(finishedMatch)
      await page.clock.fastForward(31_000)
      await expectCues(page, [720])
      expect((await audioStarts(page)).at(-1)).toMatchObject({
        hidden: true,
        focused: false,
      })
    })
    await test.step('那么 返回页面不重播，总静音下另一个完局也不响', async () => {
      await page.bringToFront()
      await nativeFocus(page, true)
      await page.getByRole('button', { name: '关闭音效', exact: true }).click()
      world.match = runningMatch()
      world.match.summary.id = 9002
      await page.clock.fastForward(31_000)
      world.match.summary.finished = true
      world.match.summary.scored = true
      await nativeFocus(page, false)
      await other.bringToFront()
      await page.clock.fastForward(31_000)
      await expectCues(page, [720])
      await page.bringToFront()
      await nativeFocus(page, true)
      await page.getByRole('button', { name: '开启音效', exact: true }).click()
      await page.clock.fastForward(31_000)
      await expectCues(page, [720])
    })
  })
})

test('多个后台标签页收到同一完局时只提醒一次', async ({ page, context }) => {
  const first = await installWorld(page)
  first.match = runningMatch()
  await page.goto(`/matches/${MATCH_ID}`)
  await page.getByRole('heading', { name: `对战 #${MATCH_ID}` }).click()
  await expect.poll(() => first.streamRequests).toBeGreaterThan(0)
  await nativeFocus(page, false)
  const secondPage = await context.newPage()
  const second = await installWorld(secondPage)
  second.match = runningMatch()
  await secondPage.goto(`/matches/${MATCH_ID}`)
  await secondPage.getByRole('heading', { name: `对战 #${MATCH_ID}` }).click()
  await expect.poll(() => second.streamRequests).toBeGreaterThan(0)
  await nativeFocus(secondPage, false)
  const other = await context.newPage()
  await other.goto('about:blank')
  await other.bringToFront()
  await expect.poll(() => page.evaluate(() => document.hidden)).toBe(true)
  await expect.poll(() => secondPage.evaluate(() => document.hidden)).toBe(true)
  await test.step('当 两个后台标签页同时收到同一对局完成事件', async () => {
    first.match = structuredClone(finishedMatch)
    second.match = structuredClone(finishedMatch)
    const events: MatchEventDTO[] = [{
      matchFinished: { matchID: MATCH_ID, winner: 'a' },
    }]
    await Promise.all([
      releaseStream(first, events),
      releaseStream(second, events),
    ])
  })
  await test.step('那么 原生音频合计只启动一次完成音', async () => {
    await expect.poll(async () => {
      const all = [...await audioStarts(page), ...await audioStarts(secondPage)]
      return all.filter((entry) => entry.milliseconds === 720).length
    }).toBe(1)
    // Wait until both pages consumed the terminal event, not just the first sound.
    await expect(page.getByRole('button', { name: '领取奖励', exact: true }))
      .toBeVisible()
    await expect(
      secondPage.getByRole('button', { name: '领取奖励', exact: true }),
    ).toBeVisible()
    const all = [...await audioStarts(page), ...await audioStarts(secondPage)]
    expect(all.filter((entry) => entry.milliseconds === 720)).toHaveLength(1)
    expect(all.find((entry) => entry.milliseconds === 720)?.hidden).toBe(true)
  })
})
