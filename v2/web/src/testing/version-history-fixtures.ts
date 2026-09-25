import { http, HttpResponse } from 'msw'
import type { MatchSummary } from '../api/types'
import {
  config,
  finishedMatch,
  inventory,
  scenario,
  scenarioList,
  versions,
} from './v34-fixtures'

const now = Math.floor(Date.now() / 1000)
export const historyVersions = [
  {
    ...versions[0],
    matchCount: 1,
    winCount: 0,
    lossCount: 1,
    drawCount: 0,
    createdAt: now - 23 * 86400,
  },
  {
    ...versions[1],
    matchCount: 2,
    winCount: 1,
    lossCount: 1,
    drawCount: 0,
    createdAt: now - 2 * 86400,
  },
  {
    ...versions[1],
    id: 1003,
    ordinal: 3,
    isEntry: false,
    matchCount: 0,
    winCount: 0,
    lossCount: 0,
    drawCount: 0,
    createdAt: now - 3600,
  },
]

export const versionHistory: MatchSummary[] = [
  {
    ...finishedMatch.summary,
    id: 9001,
    winner: 'b',
    participants: {
      a: { agentID: 101, versionID: 1001, isMine: true },
      b: { presetKey: 'ganlong-steady', isMine: false },
    },
  },
  {
    ...finishedMatch.summary,
    id: 9002,
    winner: 'a',
    participants: {
      a: { agentID: 101, versionID: 1002, isMine: true },
      b: { agentID: 202, versionID: 2002, isMine: false },
    },
  },
  {
    ...finishedMatch.summary,
    id: 9003,
    winner: 'a',
    participants: {
      a: { agentID: 202, versionID: 2002, isMine: false },
      b: { agentID: 101, versionID: 1002, isMine: true },
    },
  },
  { ...finishedMatch.summary, id: 9004, participants: undefined },
  {
    ...finishedMatch.summary,
    id: 9005,
    finished: false,
    scored: false,
    winner: null,
    participants: {
      a: { agentID: 101, versionID: 1002, isMine: true },
      b: { agentID: 101, versionID: 1002, isMine: true },
    },
  },
]

export const versionHistoryHandlers = [
  http.get('/v1/agents/101/matches', ({ request }) => {
    const versionID = Number(new URL(request.url).searchParams.get('versionID'))
    return HttpResponse.json({
      matches: versionHistory.filter((match) =>
        Object.values(match.participants ?? {}).some((participant) =>
          participant.versionID === versionID
        )
      ).sort((a, b) => b.id - a.id),
      open: true,
    })
  }),
  http.get(
    '/v1/matches',
    () => HttpResponse.json({ matches: versionHistory, open: true }),
  ),
  http.get('/v1/matches/:id', ({ params }) => {
    const summary = versionHistory.find((row) => row.id === Number(params.id))
    return summary
      ? HttpResponse.json({ ...finishedMatch, summary })
      : new HttpResponse(null, { status: 404 })
  }),
  http.get('/v1/config', () => HttpResponse.json(config)),
  http.get('/v1/scenarios', () => HttpResponse.json(scenarioList)),
  http.get('/v1/scenarios/:id', () => HttpResponse.json(scenario)),
  http.get('/v1/models', () => HttpResponse.json({ models: config.models })),
  http.get('/v1/my/agents', () =>
    HttpResponse.json({
      ...inventory,
      scenarios: [{
        ...inventory.scenarios[0],
        sides: {
          a: [{ ...inventory.scenarios[0].sides.a[0], versionCount: 3 }],
          b: [],
        },
      }],
    })),
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
    () =>
      HttpResponse.json({ versions: historyVersions, entryVersionID: 1002 }),
  ),
]
