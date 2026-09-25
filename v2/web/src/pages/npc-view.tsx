import { Link, useParams } from 'react-router-dom'

import { npcs } from '../api/client'
import { AgentMatchHistory, ProfileRecord } from '../components/agent-profile'
import { BackLink } from '../components/back-link'
import { PageLoading } from '../components/page-loading'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { usePageQuery } from '../lib/use-page-query'

export function NPCViewPage() {
  const { scenarioId = '', presetKey = '' } = useParams()
  const profile = usePageQuery({
    queryKey: ['catalog', 'npc', scenarioId, presetKey],
    queryFn: () => npcs.profile(scenarioId, presetKey),
  })
  const npc = profile.data
  return (
    <div className='space-y-6'>
      <BackLink
        to={`/scenarios/${encodeURIComponent(scenarioId)}`}
        label='场景'
        className='text-sm text-(--foreground-subtle)'
      />
      {profile.error
        ? (
          <div className='space-y-3'>
            <p role='alert'>暂时无法加载这个 NPC。</p>
            <Button variant='secondary' onClick={profile.reload}>重试</Button>
          </div>
        )
        : !npc
        ? <PageLoading variant='detail' />
        : (
          <>
            <header>
              <div className='mb-2 flex items-center gap-2 text-xs text-(--foreground-subtle)'>
                智能体主页 <Badge tone='info'>官方 NPC</Badge>
              </div>
              <h1 className='wrap-anywhere text-2xl font-black tracking-tight text-(--foreground)'>
                {npc.sideName}「{npc.label}」
              </h1>
              <p className='mt-2 text-sm text-(--foreground-subtle)'>
                <Link
                  to={`/scenarios/${encodeURIComponent(npc.scenarioID)}`}
                  className='underline underline-offset-4'
                >
                  {npc.scenarioTitle}
                </Link>{' '}
                · {npc.sideName}
              </p>
            </header>
            <ProfileRecord
              record={npc}
              label={`当前版本 · ${npc.versionTag}`}
              modelID={npc.modelID}
            >
              <p className='text-xs text-(--foreground-subtle)'>
                被挑战 {npc.challengeCount} 次（含未完赛）
              </p>
            </ProfileRecord>
            <Card>
              <CardContent className='space-y-3 pt-5'>
                <h2 className='text-base font-semibold text-(--foreground)'>
                  提示词
                </h2>
                <p className='text-xs text-(--foreground-subtle)'>
                  NPC 的当前策略公开可读。
                </p>
                <pre className='whitespace-pre-wrap wrap-anywhere font-sans text-sm leading-7 text-(--foreground)'>{npc.prompt || '此 NPC 未配置提示词。'}</pre>
              </CardContent>
            </Card>
            <AgentMatchHistory
              key={`${scenarioId}:${presetKey}:${npc.versionTag}`}
              target={{ kind: 'npc', scenarioID: scenarioId, presetKey }}
              side={npc.side}
            />
          </>
        )}
    </div>
  )
}
