/**
 * The overview's head: one usage card in the Claude Style idiom.
 *
 * The layout is the widget this plugin's owner asked for, transplanted onto this
 * plugin's own numbers: six figures over a twelve-week heat map and one closing
 * sentence. Two additions are ours, because this plugin watches a metered
 * gateway rather than a chat client:
 *
 * 1. **Left credits** sits beside the usage figures — the pool's spendable
 *    balance is the number a user of this plugin actually plans around.
 * 2. **Tokens or credits** is a switch over the SAME history: the gateway's
 *    ledger records both per bucket, so flipping the metric redraws the figures,
 *    the heat map intensity and the closing sentence without a second read.
 *
 * A missing ledger is not an error state: the card renders zeroed, and the
 * sentence says so plainly instead of inventing a comparison.
 *
 * @module dsh-workbuddy2api-gateway/client/usage-card
 */

import { useMemo, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { Translate } from './copy.ts'
import type { UsageDay, UsageSummary } from '../usage.ts'
/** A quiet segmented control in the Claude idiom: a track, a lift, no chrome. */
function Seg<T extends string>({ label, value, options, onChange }: {
  label: string
  value: T
  options: readonly { value: T, label: string }[]
  onChange(value: T): void
}): ReactElement {
  const active = Math.max(0, options.findIndex(option => option.value === value))
  return (
    <div
      className="cs-seg"
      role="radiogroup"
      aria-label={label}
      style={{ '--cs-seg-count': String(options.length), '--cs-seg-index': String(active) } as CSSProperties}
    >
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className="cs-segItem"
          data-active={option.value === value ? 'true' : 'false'}
          onClick={() => { onChange(option.value) }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Weeks the widget draws: 53 columns, matching the widget it mirrors. */
const WINDOW_DAYS = 210

/** What the card plots. */
type Metric = 'tokens' | 'credits'

/** How much of the window is shown. */
type Range = 'all' | '30' | '7'

/** Props. */
export interface UsageCardProps {
  t: Translate
  usage: UsageSummary
  /** Spendable credits by realm, when the panel reports them. */
  creditsLeft?: { cn?: number, global?: number }
}

/** Short token figure: 1.9B, 84.2M, 12.3K. */
export function compactTokens(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B'
  if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M'
  if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K'
  return String(Math.round(value))
}

/** Group a count with separators. */
function grouped(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

/** "下午 10 点" from an hour number. */
export function hourLabel(hour: number | undefined, t: Translate): string {
  if (hour === undefined) return '—'
  if (hour === 0) return t('hourMidnight')
  if (hour < 6) return t('hourAm', String(hour))
  if (hour < 12) return t('hourAm', String(hour))
  if (hour === 12) return t('hourNoon')
  if (hour < 18) return t('hourPm', String(hour - 12))
  return t('hourPm', String(hour - 12))
}

/** One figure in the grid. */
function Stat({ label, value, small }: { label: string, value: string, small?: boolean }): ReactElement {
  return (
    <div className="cs-stat">
      <span className="cs-statLabel">{label}</span>
      <span className={small === true ? 'cs-statValue cs-statValueSmall' : 'cs-statValue'} title={value}>{value}</span>
    </div>
  )
}

/** One heat cell's intensity bucket (0 = nothing). */
function level(value: number, peak: number): number {
  if (value <= 0 || peak <= 0) return 0
  const ratio = value / peak
  if (ratio > 0.75) return 4
  if (ratio > 0.5) return 3
  if (ratio > 0.25) return 2
  return 1
}

/** Slice the window to the chosen range. */
function window(days: readonly UsageDay[], range: Range): readonly UsageDay[] {
  if (range === '7') return days.slice(-7)
  if (range === '30') return days.slice(-30)
  return days
}

/** The card. */
export function UsageCard({ t, usage, creditsLeft }: UsageCardProps): ReactElement {
  const [metric, setMetric] = useState<Metric>('tokens')
  const [range, setRange] = useState<Range>('all')

  // The widget always shows a year of weeks, whatever window the host reports:
  // a shorter ledger is padded with quiet days rather than drawn as fat squares.
  const padded = useMemo(() => {
    const missing = WINDOW_DAYS - usage.days.length
    if (missing <= 0) return usage.days
    const quiet: UsageDay[] = []
    for (let index = missing; index > 0; index -= 1) {
      quiet.push({ date: 'quiet-' + String(index), calls: 0, tokens: 0, credits: 0 })
    }
    return [...quiet, ...usage.days]
  }, [usage.days])
  const view = useMemo(() => window(padded, range), [padded, range])
  // The heat map keeps the whole year on screen whatever range is selected: a
  // seven-day slice would otherwise collapse into a single column of tall cells.
  const heat = padded
  const totals = useMemo(() => {
    let calls = 0
    let tokens = 0
    let credits = 0
    for (const day of view) {
      calls += day.calls
      tokens += day.tokens
      credits += day.credits
    }
    return { calls, tokens, credits, activeDays: view.filter(day => day.calls > 0).length }
  }, [view])

  const plotted = metric === 'tokens' ? totals.tokens : totals.credits
  const peak = useMemo(
    () => heat.reduce((max, day) => Math.max(max, metric === 'tokens' ? day.tokens : day.credits), 0),
    [heat, metric],
  )

  // Twelve columns of seven, oldest first: the shape reads as "weeks" even when
  // the window is shorter, because a partially filled final column is honest
  // about the data ending today.
  // The grid is column-flow, so the cells form complete weeks by themselves; the
  // window is padded to a whole number of weeks so the last column is never ragged.
  const cells = useMemo(() => {
    const lead: UsageDay[] = []
    const missing = (7 - (heat.length % 7)) % 7
    for (let index = 0; index < missing; index += 1) {
      lead.push({ date: 'pad-' + String(index), calls: 0, tokens: 0, credits: 0 })
    }
    return [...lead, ...heat]
  }, [heat])

  const book = metric === 'tokens' && totals.tokens > 0
    ? { copies: Math.max(1, Math.round(totals.tokens / 132_467)), name: t('usageBook') }
    : undefined
  const creditParts: string[] = []
  if (creditsLeft?.cn !== undefined) creditParts.push(t('creditsRealmCn') + ' ' + grouped(Math.round(creditsLeft.cn)))
  if (creditsLeft?.global !== undefined) creditParts.push(t('creditsRealmGlobal') + ' ' + grouped(Math.round(creditsLeft.global)))
  const creditText = creditParts.length === 0 ? '—' : creditParts.join(' · ')

  return (
    <section className="cs-usage" aria-label={t('usageTitle')}>
      <div className="cs-usageHead">
        <span className="cs-usageTitle">{t('usageTitle')}</span>
        <span className="cs-spacer" />
        <Seg
          label={t('usageMetric')}
          value={metric}
          onChange={(value) => { setMetric(value) }}
          options={[
            { value: 'tokens', label: t('usageTokens') },
            { value: 'credits', label: t('usageCredits') },
          ]}
        />
        <Seg
          label={t('usageRange')}
          value={range}
          onChange={(value) => { setRange(value) }}
          options={[
            { value: 'all', label: t('usageRangeAll') },
            { value: '30', label: t('usageRange30') },
            { value: '7', label: t('usageRange7') },
          ]}
        />
      </div>

      <div className="cs-usageGrid">
        <Stat label={t('usageCalls')} value={grouped(totals.calls)} />
        <Stat
          label={metric === 'tokens' ? t('usageTokensTotal') : t('usageCreditsTotal')}
          value={metric === 'tokens' ? compactTokens(totals.tokens) : grouped(Math.round(totals.credits))}
        />
        <Stat small label={t('creditsLeftLabel')} value={creditText} />
        <Stat label={t('usageActiveDays')} value={String(totals.activeDays)} />
        <Stat label={t('usagePeakHour')} value={hourLabel(usage.peakHour, t)} />
        <Stat label={t('usageTopModel')} value={usage.topModel ?? '—'} />
      </div>

      <div
        className="cs-heat"
        role="img"
        aria-label={t('usageHeat')}
      >
        {cells.map(day => {
          const value = metric === 'tokens' ? day.tokens : day.credits
          return (
            <span
              key={day.date}
              className="cs-heatCell"
              data-level={level(value, peak)}
              title={t('usageHeatTip', day.date, metric === 'tokens'
                ? compactTokens(day.tokens) + ' ' + t('usageTokensUnit')
                : grouped(Math.round(day.credits)) + ' ' + t('usageCreditsUnit'))}
            />
          )
        })}
      </div>

      <p className="cs-usageFoot">
        {usage.empty
          ? t('usageEmptyHint')
          : book === undefined
            ? t('usageFootCredits', grouped(Math.round(totals.credits)))
            : t('usageFootTokens', grouped(book.copies), book.name)}
        {plotted === 0 && !usage.empty ? ' ' + t('usageFootRange', grouped(0)) : null}
      </p>
    </section>
  )
}
