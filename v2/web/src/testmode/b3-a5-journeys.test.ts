import { describe, expect, it } from 'vitest'

import {
  B3_A5_FIXTURE_DEFAULTS,
  B3_A5_JOURNEYS,
  B3_A5_MANUAL_PATH,
} from './data/b3-a5-journeys'
import { CLAUSES } from './data'
import { fixtureVariables, resolveFixtureUrl } from './fixtures'
import { TM } from './registry/index'

const CONFIRMED = [
  'U01-C32',
  'U10-C01',
  'U10-C02',
  'U10-C03',
  'U10-C04',
  'U10-C05',
  'U10-C06',
  'U10-C08',
  'U10-C09',
  'U10-C10',
  'U10-C11',
  'U10-C11b',
  'U10-C12',
  'U10-C13',
  'U10-C14',
  'U03-C11',
  'U05-C01',
  'U05-C02',
  'U05-C02b',
  'U05-C03',
  'U05-C04',
  'U05-C06',
  'U05-C08',
  'U05-C09',
  'U05-C09b',
  'U05-C10',
  'U05-C13',
  'U05-C14',
].sort()

const NOT_READY = [
  'U10-C07',
  'U05-C03b',
  'U05-C07',
  'U05-C11',
  'U05-C12',
  'U05-C05',
  'LACK-06',
]

const STEP_IDS = [
  ...Array.from(
    { length: 9 },
    (_, index) => `HV-B3-OWNER-EA-S${String(index + 1).padStart(2, '0')}`,
  ),
  ...Array.from(
    { length: 2 },
    (_, index) => `HV-B3-PUBLIC-NPC-S${String(index + 1).padStart(2, '0')}`,
  ),
  ...Array.from(
    { length: 5 },
    (_, index) => `HV-A5-OS-CORE-S${String(index + 1).padStart(2, '0')}`,
  ),
  'HV-A5-HOTSEAT-LIFECYCLE-S01',
  'HV-A5-HOTSEAT-LIFECYCLE-S03',
  'HV-A5-HOTSEAT-LIFECYCLE-S02',
  ...Array.from(
    { length: 2 },
    (_, index) => `HV-A5-PVP-BOUNDARIES-S${String(index + 1).padStart(2, '0')}`,
  ),
]

const PROFILE_IDS = [
  'b3-owner-rich',
  'b3-owner-missing-side',
  'b3-public-viewer',
  'b3-npc-gap',
  'a5-core-rich-owner',
  'a5-core-missing-side',
  'a5-core-pvp-locked',
  'a5-core-mobile-overflow',
  'a5-hotseat',
  'a5-pvp-exhausted',
  'a5-pvp-challenger',
  'a5-pvp-invitee',
].sort()

describe('B3 / A5 固定版本人测交接', () => {
  it('5 条旅程的 21 步只覆盖 28 条规范句已确认、无冲突且可交接的条款', () => {
    expect(B3_A5_JOURNEYS).toHaveLength(5)
    const steps = B3_A5_JOURNEYS.flatMap((journey) => journey.steps)
    expect(steps).toHaveLength(21)
    expect(steps.map((step) => step.id)).toEqual(STEP_IDS)

    const clauseIds = steps.flatMap((step) => step.clauseIds)
    expect(clauseIds).toHaveLength(28)
    expect([...new Set(clauseIds)].sort()).toEqual(CONFIRMED)
    expect(clauseIds.filter((id) => NOT_READY.includes(id))).toEqual([])
  })

  it('每一步固定条款版本，并有网址、预期、截图和同 id 手册深链', () => {
    for (const journey of B3_A5_JOURNEYS) {
      expect(journey.manual).toBe(B3_A5_MANUAL_PATH)
      expect(journey.manualAnchor).toBe(journey.id)
      expect(journey.prerequisites?.length).toBeGreaterThan(0)
      expect(journey.evidenceRequirements?.length).toBeGreaterThan(0)
      expect(journey.completion).toBeTruthy()
      expect(journey.fixtureProfiles?.length).toBeGreaterThan(0)

      for (const step of journey.steps) {
        expect(step.testUrl).toMatch(/^\{\{appBaseUrl\}\}\//)
        expect(step.route).toMatch(/^\//)
        expect(step.action).toBeTruthy()
        expect(step.expected).toBeTruthy()
        expect(step.screenshotEvidence?.length).toBeGreaterThan(0)
        expect(step.fixtureRefs?.length).toBeGreaterThan(0)
        expect(step.manualUrl).toBe(`${B3_A5_MANUAL_PATH}#${step.id}`)
        expect(Object.keys(step.versionPins ?? {}).sort()).toEqual(
          [...step.clauseIds].sort(),
        )
        for (const id of step.clauseIds) {
          expect(CLAUSES[id], `spec-index 缺 ${id}`).toBeTruthy()
          expect(CLAUSES[id].impl, `${id} 不应再显示为待裁决`).not.toBe(
            'pending_ruling',
          )
          expect(step.versionPins?.[id], `${step.id} 没固定 ${id}`).toBeTruthy()
        }
        if (step.marker) {
          expect(TM[step.marker], `${step.id} 的标记 ${step.marker} 未登记`)
            .toBeTruthy()
        }
      }
    }
  })

  it('角色 profile 分开互斥状态，步骤引用与模板变量全部可解析', () => {
    const profiles = B3_A5_JOURNEYS.flatMap((journey) =>
      journey.fixtureProfiles ?? []
    )
    expect(profiles.map((profile) => profile.id).sort()).toEqual(PROFILE_IDS)
    expect(
      profiles.filter((profile) => profile.readiness === 'refresh-required')
        .map((profile) => profile.id).sort(),
    ).toEqual([
      'a5-core-mobile-overflow',
      'a5-pvp-challenger',
      'a5-pvp-exhausted',
    ])
    const mobileRole = profiles.find((profile) =>
      profile.id === 'a5-core-mobile-overflow'
    )
    expect(mobileRole).toMatchObject({
      label: '测试角色 G · A5 移动端多卡横向滚动',
      accountAlias: 'A5 人测·配额被约方',
    })
    expect(B3_A5_FIXTURE_DEFAULTS.a5CoreMobileAgentId).toBe(
      B3_A5_FIXTURE_DEFAULTS.a5PvpExhaustedAgentId,
    )

    for (const journey of B3_A5_JOURNEYS) {
      const profileById = new Map(
        (journey.fixtureProfiles ?? []).map((profile) => [profile.id, profile]),
      )
      for (const step of journey.steps) {
        const referenced = (step.fixtureRefs ?? []).map((id) => {
          const profile = profileById.get(id)
          expect(profile, `${step.id} 引用了不存在的 profile ${id}`)
            .toBeTruthy()
          return profile!
        })
        const available = new Set(
          referenced.flatMap((profile) =>
            profile.fields.map((field) => field.name)
          ),
        )
        const used = fixtureVariables(
          step.testUrl,
          ...(step.links ?? []).map((link) => link.url),
          step.action,
          step.expected,
        ).filter((name) => name !== 'appBaseUrl')
        for (const capture of step.captures ?? []) {
          available.add(capture.variable)
        }
        expect(
          used.filter((name) => !available.has(name)),
          `${step.id} 有未归角色 profile 的变量`,
        ).toEqual([])
      }
    }
  })

  it('二级网址可直接解析，hotseat 对局只在运行时捕获，NPC 不伪造 ID', () => {
    const steps = Object.fromEntries(
      B3_A5_JOURNEYS.flatMap((journey) =>
        journey.steps.map((step) => [step.id, step])
      ),
    )

    expect(steps['HV-B3-OWNER-EA-S01'].links?.map((link) => link.label))
      .toEqual([
        '玩家对局列表',
        '已完成战报',
        '我的智能体',
        '主智能体工作区',
      ])
    expect(steps['HV-A5-HOTSEAT-LIFECYCLE-S02'].links).toContainEqual({
      label: '本轮进行中对局',
      url: '{{appBaseUrl}}/matches/{{a5HotseatActiveMatchId}}',
    })
    expect(steps['HV-A5-HOTSEAT-LIFECYCLE-S01'].captures).toEqual([
      expect.objectContaining({ variable: 'a5HotseatActiveMatchId' }),
    ])

    const npcStep = steps['HV-B3-PUBLIC-NPC-S02']
    expect(npcStep.knownGap?.detail).toContain('修订提案待审阅')
    expect(npcStep.marker).toBe('DA.page')
    expect(npcStep.expected).toContain('分别展示两个阵营胜率')
    expect(npcStep.knownGap?.instruction).toContain('不要拼造 ID')
    expect(
      fixtureVariables(
        npcStep.testUrl,
        npcStep.action,
        npcStep.expected,
        ...(npcStep.links ?? []).map((link) => link.url),
      ),
    ).not.toContain('npcAgentId')
  })

  it('进行中观战检查先于完局过期检查，保持原条款和步骤 ID', () => {
    const journey = B3_A5_JOURNEYS.find((item) =>
      item.id === 'HV-A5-HOTSEAT-LIFECYCLE'
    )!
    const position = (id: string) =>
      journey.steps.findIndex((step) =>
        step.id === `HV-A5-HOTSEAT-LIFECYCLE-${id}`
      )
    expect(position('S01')).toBeLessThan(position('S03'))
    expect(position('S03')).toBeLessThan(position('S02'))
    expect(journey.steps[position('S03')].clauseIds).toContain('U05-C10')
    expect(journey.steps[position('S02')].clauseIds).toContain('U05-C09b')
  })

  it('安全业务 ID 已预填；运行时对局绝不预填', () => {
    expect(B3_A5_FIXTURE_DEFAULTS).toMatchObject({
      appBaseUrl: 'https://axiia-cup-2-web.isofucius.cn',
      b3OwnerAgentId: expect.any(String),
      b3OwnerTournamentId: expect.any(String),
      a5CoreAgentId: expect.any(String),
      a5HotseatAgentId: expect.any(String),
      a5PvpExhaustedOpponentVersionId: expect.any(String),
      a5PvpOpponentVersionId: expect.any(String),
    })
    expect(B3_A5_FIXTURE_DEFAULTS).not.toHaveProperty(
      'a5HotseatActiveMatchId',
    )
    expect(Object.keys(B3_A5_FIXTURE_DEFAULTS)).not.toContain('password')
    expect(Object.keys(B3_A5_FIXTURE_DEFAULTS)).not.toContain('token')
  })

  it('所有预置网址立即可开，只有本轮 activeMatchId 必须等 S01', () => {
    for (const journey of B3_A5_JOURNEYS) {
      for (const step of journey.steps) {
        const links = [
          ...(step.testUrl ? [step.testUrl] : []),
          ...(step.links ?? []).map((link) => link.url),
        ]
        for (const url of links) {
          const result = resolveFixtureUrl(url, B3_A5_FIXTURE_DEFAULTS)
          if (url.includes('{{a5HotseatActiveMatchId}}')) {
            expect(result.href, `${step.id} 不应伪造运行时链接`).toBeNull()
            expect(result.missing).toEqual(['a5HotseatActiveMatchId'])
          } else {
            expect(result.href, `${step.id} 的预置网址打不开`).toMatch(
              /^https:\/\//,
            )
            expect(result.missing).toEqual([])
          }
        }
      }
    }
  })
})
