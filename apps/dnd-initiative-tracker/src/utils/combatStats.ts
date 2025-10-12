import type { CombatStatsSummary, CombatantTimingStats, TurnHistoryEntry } from '../types'

/**
 * Formats a duration into a clock-style string (HH:MM:SS or MM:SS).
 */
export const formatDurationClock = (durationMs: number): string => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return '00:00'
  }

  const totalSeconds = Math.floor(durationMs / 1000)
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60)
  const hours = Math.floor(minutes / 60)
  const minutesComponent = minutes % 60

  const pad = (value: number) => String(value).padStart(2, '0')

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutesComponent)}:${pad(seconds)}`
  }

  return `${pad(minutes)}:${pad(seconds)}`
}

/**
 * Formats a duration into a human readable string such as "2m 15s".
 */
export const formatDurationVerbose = (durationMs: number): string => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return '0s'
  }

  const totalSeconds = Math.floor(durationMs / 1000)
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)

  const parts: string[] = []

  if (hours > 0) {
    parts.push(`${hours}h`)
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`)
  }

  parts.push(`${seconds}s`)

  return parts.join(' ')
}

/**
 * Summarizes a set of turn history entries into aggregate combat statistics.
 */
export const computeCombatStats = (history: TurnHistoryEntry[]): CombatStatsSummary => {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      totalDuration: 0,
      totalTurns: 0,
      averageTurnDuration: 0,
      longestTurnEntry: null,
      fastestTurnEntry: null,
      slowestAverage: null,
      quickestAverage: null,
      combatantStats: [],
    }
  }

  const summaryByCombatant = new Map<string, CombatantTimingStats>()
  let totalDuration = 0
  let longestTurnEntry: TurnHistoryEntry | null = null
  let fastestTurnEntry: TurnHistoryEntry | null = null

  history.forEach((entry) => {
    const duration = entry.duration ?? 0
    totalDuration += duration

    if (!longestTurnEntry || duration > longestTurnEntry.duration) {
      longestTurnEntry = entry
    }

    if (!fastestTurnEntry || duration < fastestTurnEntry.duration) {
      fastestTurnEntry = entry
    }

    const current =
      summaryByCombatant.get(entry.combatantId) ||
      ({
        combatantId: entry.combatantId,
        name: entry.combatantName,
        totalDuration: 0,
        turnCount: 0,
        longestTurn: 0,
        averageDuration: 0,
      } as CombatantTimingStats)

    const nextTotal = current.totalDuration + duration
    const nextTurnCount = current.turnCount + 1
    const nextLongest = Math.max(current.longestTurn, duration)

    summaryByCombatant.set(entry.combatantId, {
      ...current,
      totalDuration: nextTotal,
      turnCount: nextTurnCount,
      longestTurn: nextLongest,
      averageDuration: nextTurnCount > 0 ? nextTotal / nextTurnCount : 0,
    })
  })

  const combatantStats = Array.from(summaryByCombatant.values())

  const slowestAverage = combatantStats.reduce<CombatantTimingStats | null>((accumulator, entry) => {
    if (!accumulator || entry.averageDuration > accumulator.averageDuration) {
      return entry
    }
    return accumulator
  }, null)

  const quickestAverage = combatantStats.reduce<CombatantTimingStats | null>((accumulator, entry) => {
    if (!accumulator || entry.averageDuration < accumulator.averageDuration) {
      return entry
    }
    return accumulator
  }, null)

  combatantStats.sort((a, b) => b.totalDuration - a.totalDuration)

  return {
    totalDuration,
    totalTurns: history.length,
    averageTurnDuration: totalDuration / history.length,
    longestTurnEntry,
    fastestTurnEntry,
    slowestAverage,
    quickestAverage,
    combatantStats,
  }
}
