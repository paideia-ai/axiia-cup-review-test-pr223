// E2/#82：版本号一律取 ordinal（服务端按 id 次序派生的线性序号）。snapshotSeq
// 是草稿暂存水位——既非线性也非单射（同一智能体可以有两个 0），不是版本号，
// 任何界面都不再读它。
//
// ordinal 在契约里是可选的：服务端的这一半单独发布，dev 上可能短暂还是旧的。
// 缺席时按同一定义在本地补——版本表 append-only、id 自增不复用，所以「id 不大于
// 它的同伴数」就是它的 1 基位次，与服务端算出来的是同一个量。

import type { AgentVersionDTO } from '../api/types'

export function versionOrdinal(
  version: AgentVersionDTO,
  siblings: readonly AgentVersionDTO[] = [],
): number {
  if (version.ordinal != null) return version.ordinal
  const rank = siblings.filter((other) => other.id <= version.id).length
  return rank > 0 ? rank : 1
}

export function versionTag(
  version: AgentVersionDTO,
  siblings: readonly AgentVersionDTO[] = [],
): string {
  return `v${versionOrdinal(version, siblings)}`
}

export function versionLabel(
  version: AgentVersionDTO,
  siblings: readonly AgentVersionDTO[] = [],
): string {
  return `${versionTag(version, siblings)}${
    version.isEntry ? ' ★' : ''
  } · ${version.modelID}`
}

// E3/#82：恢复到工作区后的固定文案——N 为当前已有版本数，下一次保存即 v(N+1)。
export function nextVersionCopy(versionCount: number): string {
  return `保存后将成为 v${versionCount + 1}`
}

// 逐版本战绩：没有有效完赛时与智能体主页统一显示「暂无战绩」。
export function recordCopy(version: AgentVersionDTO): string {
  const played = version.matchCount ?? 0
  if (played === 0) return '暂无战绩'
  return `${played} 战 ${version.winCount ?? 0} 胜`
}

// P10：保存时间。只到「天/小时」粒度——版本卡要的是「哪一版更近」，不是秒。
export function savedAtCopy(
  version: AgentVersionDTO,
  now = Date.now(),
): string {
  const at = version.createdAt
  if (at == null || at <= 0) return ''
  const minutes = Math.floor((now - at * 1000) / 60000)
  if (minutes < 1) return '刚刚保存'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

// P1a：策略行的「最近编辑」。与 savedAtCopy 同一把尺，但主语是策略不是版本。
export function editedCopy(at?: number, now = Date.now()): string {
  if (at == null || at <= 0) return ''
  const minutes = Math.floor((now - at * 1000) / 60000)
  if (minutes < 1) return '刚刚编辑'
  if (minutes < 60) return `${minutes} 分钟前编辑`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前编辑`
  return `${Math.floor(hours / 24)} 天前编辑`
}
