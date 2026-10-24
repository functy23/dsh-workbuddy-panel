/**
 * Reading the gateway's own usage ledger.
 *
 * The gateway writes one bucket per (hour, realm, account, model) into
 * `data/usage.json`; that file is the only place a token count and a credit
 * charge exist side by side, which is exactly what the overview needs to offer
 * "tokens or credits" as one switch over the same history.
 *
 * Two rules keep this honest:
 *
 * 1. **A missing or unreadable ledger is empty, not an error.** The file appears
 *    on the gateway's first request and is rewritten constantly; a read that
 *    races a write must not fail the whole status document.
 * 2. **The series is dense.** Every day of the window is present, zero-filled,
 *    because a heat map with holes draws a different story than a quiet week.
 *
 * @module dsh-workbuddy2api-gateway/usage
 */

import { readFileSync } from 'node:fs'

/** One day of usage. */
export interface UsageDay {
  /** ISO date (`YYYY-MM-DD`). */
  date: string
  /** Requests recorded that day. */
  calls: number
  /** Total tokens that day. */
  tokens: number
  /** Credits charged that day. */
  credits: number
}

/** What the overview renders. */
export interface UsageSummary {
  /** The window, oldest first, dense (missing days are zero-filled). */
  days: readonly UsageDay[]
  calls: number
  tokens: number
  credits: number
  /** Days with any recorded request. */
  activeDays: number
  /** Hour of day (0-23) with the most tokens, when there is one. */
  peakHour?: number
  /** Model id used by the most requests, when there is one. */
  topModel?: string
  /** Whether any bucket was read at all. */
  empty: boolean
}

/** Days the heat map shows (12 weeks, matching the widget this mirrors). */
export const HEATMAP_DAYS = 210

/** One bucket as the gateway writes it. */
interface UsageBucket {
  s?: unknown
  m?: unknown
  q?: unknown
  t?: unknown
  ct?: unknown
  cr?: unknown
}

/** A finite non-negative number, else zero. */
function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

/** The bucket's day, from its `h:YYYY-MM-DDTHH` slot. */
function dayOf(bucket: UsageBucket): { date: string, hour: number } | undefined {
  const slot = bucket.s
  if (typeof slot !== 'string') return undefined
  const date = slot.slice(2, 12)
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) return undefined
  const hour = Number.parseInt(slot.slice(13, 15), 10)
  return { date, hour: Number.isFinite(hour) ? hour : 0 }
}

/** The empty answer a missing ledger gets. */
function emptySummary(today: string): UsageSummary {
  const days: UsageDay[] = []
  const end = Date.parse(today + 'T00:00:00Z')
  for (let offset = HEATMAP_DAYS - 1; offset >= 0; offset -= 1) {
    const date = new Date(end - offset * 86_400_000).toISOString().slice(0, 10)
    days.push({ date, calls: 0, tokens: 0, credits: 0 })
  }
  return { days, calls: 0, tokens: 0, credits: 0, activeDays: 0, empty: true }
}

/**
 * Read and aggregate the ledger.
 *
 * @param path - the gateway's `data/usage.json`.
 * @param today - `YYYY-MM-DD` anchor for the window (injectable for tests).
 */
export function readUsage(path: string, today = new Date().toISOString().slice(0, 10)): UsageSummary {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return emptySummary(today)
  }
  const buckets = (parsed as { buckets?: unknown })?.buckets
  if (!Array.isArray(buckets) || buckets.length === 0) return emptySummary(today)

  const perDay = new Map<string, UsageDay>()
  const perHour = new Map<number, number>()
  const perModel = new Map<string, number>()
  let calls = 0
  let tokens = 0
  let credits = 0

  for (const raw of buckets) {
    if (typeof raw !== 'object' || raw === null) continue
    const bucket = raw as UsageBucket
    const placed = dayOf(bucket)
    if (placed === undefined) continue
    const bucketTokens = num(bucket.ct) || num(bucket.t)
    const bucketCalls = num(bucket.q)
    const bucketCredits = num(bucket.cr)
    calls += bucketCalls
    tokens += bucketTokens
    credits += bucketCredits
    const day = perDay.get(placed.date) ?? { date: placed.date, calls: 0, tokens: 0, credits: 0 }
    day.calls += bucketCalls
    day.tokens += bucketTokens
    day.credits += bucketCredits
    perDay.set(placed.date, day)
    perHour.set(placed.hour, (perHour.get(placed.hour) ?? 0) + bucketTokens)
    if (typeof bucket.m === 'string' && bucket.m !== '') {
      perModel.set(bucket.m, (perModel.get(bucket.m) ?? 0) + bucketCalls)
    }
  }

  const days: UsageDay[] = []
  const end = Date.parse(today + 'T00:00:00Z')
  for (let offset = HEATMAP_DAYS - 1; offset >= 0; offset -= 1) {
    const date = new Date(end - offset * 86_400_000).toISOString().slice(0, 10)
    days.push(perDay.get(date) ?? { date, calls: 0, tokens: 0, credits: 0 })
  }

  let peakHour: number | undefined
  let peakTokens = 0
  for (const [hour, hourTokens] of perHour) {
    if (hourTokens > peakTokens) {
      peakTokens = hourTokens
      peakHour = hour
    }
  }
  let topModel: string | undefined
  let topCalls = 0
  for (const [model, modelCalls] of perModel) {
    if (modelCalls > topCalls) {
      topCalls = modelCalls
      topModel = model
    }
  }

  return {
    days,
    calls,
    tokens,
    credits,
    activeDays: [...perDay.values()].filter(day => day.calls > 0).length,
    ...peakHour === undefined ? {} : { peakHour },
    ...topModel === undefined ? {} : { topModel },
    empty: false,
  }
}

/** Books the footer sentence can compare against, smallest first. */
const BOOKS: readonly { label: string, tokens: number }[] = [
  { label: '《格林童话》', tokens: 132_467 },
  { label: '《活着》', tokens: 115_000 },
  { label: '《三体》', tokens: 202_000 },
  { label: '《红楼梦》', tokens: 700_000 },
  { label: '《战争与和平》', tokens: 587_000 },
]

/**
 * Turn a token total into the one sentence the widget ends with.
 *
 * The comparison is the whole point of the line: "1.9B tokens" means nothing,
 * while "≈ 14,092 copies of a book" is something a person can picture.
 */
export function describeUsage(summary: UsageSummary, tokens: number): { book?: string, copies?: number } {
  if (tokens <= 0) return {}
  const book = BOOKS[0]
  if (book === undefined) return {}
  const copies = Math.max(1, Math.round(tokens / book.tokens))
  return { book: book.label, copies }
}
