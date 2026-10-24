/**
 * The layout pieces every WorkBuddy surface is built from: rows, groups,
 * fields, and the small figures (tiles, bars, rings) the dashboard is made of.
 *
 * Ported from the reference implementation this plugin's UI follows
 * (dsh-commandcode-provider, MIT), with the class prefix changed to \`wb2-\`
 * because these rules are global CSS and the reference plugin is installed on
 * this machine.
 *
 * Why classes instead of inline style objects: the page has to sit beside the
 * harness's own settings pages and follow the active theme. An inline object
 * can carry a token but not a \`:hover\`, a \`:focus-visible\`, a
 * \`::after\`, or a media query, so every interactive affordance ended up
 * reimplemented in JavaScript and every colour was a literal that got dark mode
 * wrong. One stylesheet plus these components is the whole replacement.
 *
 * @module dsh-workbuddy-connect/client/ui-rows
 */

import type { CSSProperties, ReactNode } from 'react'
import { StateDot, Tag } from '@deepseek-ai/dsh-client-ui-primitives'

/** Join class names, dropping the empty ones. */
export function cx(...values: readonly (string | undefined | false)[]): string {
  return values.filter(value => typeof value === 'string' && value !== '').join(' ')
}

/**
 * One settings row, laid out like the harness's own General page: the title and
 * description on the left, the control on the right, a hairline between rows.
 */
export function SettingRow({ title, titleFor, tag, description, error, control, className, controlClassName }: {
  title: ReactNode
  /** Makes the title a `<label>` for this control id. */
  titleFor?: string
  tag?: ReactNode
  description?: ReactNode
  /** Replaces the description while set. */
  error?: string | undefined
  control?: ReactNode
  className?: string
  controlClassName?: string
}): ReactNode {
  return (
    <div className={cx('wb2-row', className)}>
      <div className="wb2-rowText">
        <div className="wb2-rowTitleLine">
          {titleFor !== undefined
            ? <label className="wb2-rowTitle" htmlFor={titleFor}>{title}</label>
            : <span className="wb2-rowTitle">{title}</span>}
          {tag}
        </div>
        {error !== undefined ? <p className="wb2-rowError">{error}</p> : null}
        {error === undefined && description !== undefined ? <div className="wb2-rowDesc">{description}</div> : null}
      </div>
      {control !== undefined ? <div className={cx('wb2-rowControl', controlClassName)}>{control}</div> : null}
    </div>
  )
}

/** A heading over a run of rows — the page's one grouping device. */
export function SettingsGroup({ title, action, description, children }: {
  title: string
  /** A control rendered on the heading's line, e.g. "Add account". */
  action?: ReactNode
  description?: ReactNode
  children: ReactNode
}): ReactNode {
  return (
    <section className="wb2-group">
      <div className="wb2-groupHead">
        <h3 className="wb2-groupTitle">{title}</h3>
        <span className="wb2-spacer" />
        {action}
      </div>
      {description === undefined ? null : <p className="wb2-groupDesc">{description}</p>}
      <div className="wb2-rows">{children}</div>
    </section>
  )
}


/**
 * A capsule tag, drawn by the platform's own `Tag`.
 *
 * This used to be a local `<span>` with four hand-painted palettes. The
 * platform atom already ships exactly these capsules (`outline`, `neutral`,
 * tinted `success` / `warning` / `danger`), so delegating keeps the pills the
 * same width, weight and tone as the tags elsewhere in the settings surface —
 * and removes a palette that could drift out of the theme on its own.
 *
 * The tone names are this plugin's (`plain`/`muted`/`warn`/`error`/`ok`)
 * because they say what the caller MEANS; the mapping below is the one place
 * that translates them into the platform's vocabulary.
 */
export function Badge({ tone = 'plain', title, children }: {
  tone?: 'plain' | 'muted' | 'warn' | 'error' | 'ok'
  title?: string
  children: ReactNode
}): ReactNode {
  const mapped = tone === 'muted'
    ? 'outline'
    : tone === 'warn'
      ? 'warning'
      : tone === 'error'
        ? 'danger'
        : tone === 'ok' ? 'success' : 'neutral'
  const tag = <Tag tone={mapped}>{children}</Tag>
  return title === undefined ? tag : <span title={title}>{tag}</span>
}

/** A labelled figure in a filled panel — the dashboard's stat unit. */
export function StatTile({ label, value, sub }: { label: string, value: string, sub?: string | undefined }): ReactNode {
  return (
    <div className="wb2-usageStat">
      <span className="wb2-usageStatLabel">{label}</span>
      <span className="wb2-usageStatValue">{value}</span>
      {sub === undefined || sub === '' ? null : <span className="wb2-usageStatSub">{sub}</span>}
    </div>
  )
}


/**
 * One account's status dot, drawn by the platform's own `StateDot`.
 *
 * The plugin used to paint its own 8px circle here, which meant a hand-rolled
 * palette that had to be kept in step with the harness by hand. `StateDot` is
 * the atom the rest of the settings surfaces use, so the row's mark is the
 * same mark the session list and the job list draw.
 *
 * The mapping is the platform's vocabulary, not this plugin's: an available
 * account is `done`, a benched one `warning`, a refused one `error`, and a
 * switched-off one `idle`.
 */
export function StatusDot({ tone, title }: { tone: 'ok' | 'warn' | 'error' | 'off', title: string }): ReactNode {
  const state = tone === 'ok' ? 'done' : tone === 'warn' ? 'warning' : tone === 'error' ? 'error' : 'idle'
  return <span title={title}><StateDot state={state} /></span>
}

/**
 * The quota ring: one glyph serves the rail button, the footer card's head and
 * the dashboard header. A faint track plus an arc whose sweep is the
 * consumption, drawn from 12 o'clock. Circumference 2πr = 45.55 at r = 7.25.
 */
export function Ring({ percent, warn, size }: { percent: number, warn: boolean, size: number }): ReactNode {
  const clamped = Math.min(100, Math.max(0, percent))
  const circumference = 45.55
  // Rounded to three decimals: the raw product lands on floats like
  // 34.162499999999994, which is a needless DOM diff churn.
  const dashoffset = Math.round(circumference * (1 - clamped / 100) * 1000) / 1000
  return (
    <span className="wb2-glyph" aria-hidden="true">
      <svg viewBox="0 0 20 20" width={size} height={size} focusable="false">
        <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
        <circle
          cx="10"
          cy="10"
          r="7.25"
          fill="none"
          stroke={warn ? 'var(--dsw-alias-state-error-primary)' : 'currentColor'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={String(circumference)}
          strokeDashoffset={String(dashoffset)}
          transform="rotate(-90 10 10)"
        />
      </svg>
    </span>
  )
}

/**
 * The platform's segmented control: a translucent track with one raised pill
 * sliding under the picked segment.
 *
 * The indicator's width and offset are computed arithmetically from the count
 * and the index (two custom properties), so it slides without measuring the
 * DOM — the platform's own technique.
 */
export function SegmentedField({ label, value, options, disabled, onChange, className }: {
  label: string
  value: string
  options: ReadonlyArray<{ value: string, label: string, title?: string }>
  disabled?: boolean
  onChange(value: string): void
  className?: string
}): ReactNode {
  const index = Math.max(0, options.findIndex(option => option.value === value))
  // The Claude idiom: a quiet track with one absolutely-positioned pill that
  // slides between options (see .cs-seg::before in ui-styles.ts). The selected
  // option carries no background of its own -- the pill is the whole signal.
  return (
    <div
      className={cx('cs-seg', disabled === true && 'cs-segDisabled', className)}
      role="radiogroup"
      aria-label={label}
      style={{ '--cs-seg-count': String(options.length), '--cs-seg-index': String(index) } as CSSProperties}
    >
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className="cs-segItem"
          data-active={value === option.value ? 'true' : 'false'}
          disabled={disabled === true}
          {...option.title === undefined ? {} : { title: option.title }}
          onClick={() => { if (value !== option.value) onChange(option.value) }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** A switch row: the platform Switch's shape, as a labelled control. */
export function ToggleField({ id, checked, disabled, label, onChange }: {
  id: string
  checked: boolean
  disabled?: boolean
  label: string
  onChange(checked: boolean): void
}): ReactNode {
  return (
    <input
      id={id}
      className="wb2-toggle"
      type="checkbox"
      role="switch"
      aria-label={label}
      checked={checked}
      disabled={disabled === true}
      onChange={event => { onChange(event.target.checked) }}
    />
  )
}

/**
 * The "only show the ones I pick" control: the value editor, a switch, a count,
 * and a way back.
 *
 * Modelled on the reference implementation's visible-models row
 * (`VisibleModelsRow` in the Command Code provider): the assignment editor
 * sits in the row's control column, and the switch beside it decides whether
 * that assignment reaches the picker at all. Off is "show everything", on is
 * "show what I picked", and turning it off clears the filter rather than leaving
 * an invisible one behind.
 *
 * The editor arrives through {@link FilterRow.control} rather than being built
 * in: this row owns the switch semantics, not the value's shape — a filter over
 * a checkbox column, a multi-select menu, or a text box all read as the same row.
 */
export function FilterRow({ id, enabled, label, description, summary, clearLabel, control, disabled, onToggle, onClear }: {
  id: string
  enabled: boolean
  label: string
  description: ReactNode
  /** What the current filter shows, e.g. "3 of 12 models". */
  summary: string
  clearLabel: string
  /**
   * The value editor the switch governs, rendered BEFORE the switch.
   *
   * A switch that only turns something on is a switch over nothing: the filter
   * needs a selection to be about, and the selection needs a surface. The
   * reference implementation's row does the same with its multi-select.
   */
  control?: ReactNode
  disabled?: boolean
  onToggle(enabled: boolean): void
  onClear(): void
}): ReactNode {
  return (
    <SettingRow
      title={label}
      titleFor={id}
      description={description}
      className="wb2-rowNested"
      control={
        <>
          {control}
          {!enabled ? null : (
            <>
              <span className="wb2-hint">{summary}</span>
              <button type="button" className="wb2-linkButton" disabled={disabled === true} onClick={onClear}>
                {clearLabel}
              </button>
            </>
          )}
          <ToggleField
            id={id}
            label={label}
            checked={enabled}
            disabled={disabled === true}
            onChange={onToggle}
          />
        </>
      }
    />
  )
}

/** A label paired with a value on one baseline. */
export function Fact({ label, value }: { label: string, value: ReactNode }): ReactNode {
  return (
    <>
      <span className="wb2-factLabel">{label}</span>
      <span className="wb2-factValue">{value}</span>
    </>
  )
}