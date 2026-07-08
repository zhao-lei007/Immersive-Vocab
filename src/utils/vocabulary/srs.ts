// 简化间隔重复调度：答对间隔翻倍（1→2→4→8...天），答错重置
const DAY_MS = 24 * 60 * 60 * 1000
/** 答错后 10 分钟重新到期 */
const FORGOT_RETRY_MS = 10 * 60 * 1000
const MAX_INTERVAL_DAYS = 365

export interface SrsSchedule {
  dueAt: number
  intervalDays: number
}

/** 新词立即进入待复习队列 */
export function initialSrsSchedule(now: number): SrsSchedule {
  return { dueAt: now, intervalDays: 0 }
}

export function nextSrsSchedule(
  currentIntervalDays: number,
  remembered: boolean,
  now: number,
): SrsSchedule {
  if (!remembered) {
    return { dueAt: now + FORGOT_RETRY_MS, intervalDays: 0 }
  }

  const nextIntervalDays = currentIntervalDays <= 0
    ? 1
    : Math.min(currentIntervalDays * 2, MAX_INTERVAL_DAYS)
  return { dueAt: now + nextIntervalDays * DAY_MS, intervalDays: nextIntervalDays }
}
