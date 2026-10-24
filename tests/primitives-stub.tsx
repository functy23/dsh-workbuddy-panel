/**
 * Test double for `@deepseek-ai/dsh-client-ui-primitives`.
 *
 * The real package is a PLATFORM SEED module: the browser shell seeds
 * `@deepseek-ai/dsh-client-ui-primitives` into the module table, and its own
 * bare dependencies (clsx, katex, shiki, the micromark family) are satisfied by
 * the shell's install. Our client bundle only ever `require`s it by name at
 * runtime, so in production nothing here is involved.
 *
 * In vitest there is no shell: importing the npm package pulls those bare
 * specifiers in and fails on the first one. This module supplies the members the
 * plugin's components use, rendering the platform's own markup shape (a
 * `<button>`) so the existing assertions on label text and posted requests keep
 * meaning what they meant. It is wired in through `vitest.config.ts`'s alias.
 *
 * It is deliberately small: add a member here only when a component starts
 * using it, because a faithful re-implementation of the platform's controls is
 * not this file's job — the tests that matter render our layout and assert on
 * what reaches the route.
 *
 * @module dsh-workbuddy-connect/tests/primitives-stub
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react'

/** Props of the platform `Button`, narrowed to what this plugin passes. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'outline' | 'toolbar'
  size?: 'md' | 'sm'
  icon?: ReactNode
}

/** The platform button, as a plain element. */
export function Button({ variant, size, icon, children, ...rest }: ButtonProps): ReactNode {
  return (
    <button type="button" data-variant={variant ?? 'ghost'} data-size={size ?? 'md'} {...rest}>
      {icon}
      {children}
    </button>
  )
}

/** One selectable row of a {@link Menu}. */
export interface MenuItem {
  id: string
  label: ReactNode
  disabled?: boolean
  danger?: boolean
}

/** Entry kinds a menu accepts. */
export type MenuEntry =
  | MenuItem
  | { type: 'separator', id: string }
  | { type: 'label', id: string, text: string }

/** Props of the platform `Menu`, narrowed to what this plugin passes. */
export interface MenuProps {
  open: boolean
  onClose(): void
  onSelect(id: string): void
  items: readonly MenuEntry[]
  /** Rows pinned below the scrolling list; rendered after the items. */
  footer?: readonly MenuEntry[]
  /** Rows to mark as selected (the model picker's ticks). */
  selectedIds?: readonly string[]
  /** Extra class on the list card; passed through as a data attribute. */
  listClassName?: string
  align?: 'start' | 'end'
  portal?: boolean
  anchor?: ReactNode
}

/** One menu row, from either the items or the footer list. */
function MenuRow({ entry, selected, onSelect }: {
  entry: MenuEntry
  selected: boolean
  onSelect(id: string): void
}): ReactNode {
  if ('type' in entry) {
    return entry.type === 'separator'
      ? <hr key={entry.id} />
      : <div key={entry.id} data-label="true">{entry.text}</div>
  }
  return (
    <button
      key={entry.id}
      type="button"
      role="menuitem"
      data-checked={selected ? 'true' : undefined}
      disabled={entry.disabled === true}
      onClick={() => { onSelect(entry.id) }}
    >
      {entry.label}
    </button>
  )
}

/**
 * The platform menu: the anchor, plus an open list.
 *
 * The list renders items AND footer rows, and marks the ones named by
 * `selectedIds`, because the model picker's assertions are about which rows the
 * menu offers and which of them read as selected — a stub that dropped those
 * props would let a broken picker pass.
 */
export function Menu({ open, onSelect, items, footer, selectedIds, anchor }: MenuProps): ReactNode {
  const selected = new Set(selectedIds ?? [])
  return (
    <span>
      {anchor}
      {!open ? null : (
        <div role="menu">
          {[...items, ...footer ?? []].map(entry => (
            <MenuRow key={entry.id} entry={entry} selected={selected.has(entry.id)} onSelect={onSelect} />
          ))}
        </div>
      )}
    </span>
  )
}

/**
 * The platform state dot, as a data-attributed span.
 *
 * The real atom paints a 6px currentColor core inside a 10px slot; tests only
 * need to know WHICH state a row claims, so the state is the attribute.
 */
export function StateDot({ state, className }: { state: 'done' | 'warning' | 'error' | 'idle' | 'ongoing', className?: string }): ReactNode {
  return <span data-state-dot={state} className={className} />
}

/** A read-only tag. */
export function Tag({ tone, children }: { tone?: string, children?: ReactNode }): ReactNode {
  return <span data-tone={tone ?? 'outline'}>{children}</span>
}

/**
 * The platform tooltip, as a wrapper that renders its label for assertions.
 *
 * The real one portals a bubble on hover; the plugin's tests assert on the
 * accessible text of the trigger, so the label is rendered as a data attribute
 * and the child stays the only visible content.
 */
export function Tooltip({ label, children, disabled }: {
  label: string
  children?: ReactNode
  side?: string
  delayMs?: number
  disabled?: boolean
}): ReactNode {
  return <span data-tooltip={disabled === true ? undefined : label}>{children}</span>
}

/**
 * The platform's anchored-popover placement hook, as a fixed offset.
 *
 * Position itself is the platform's business (it measures a real DOM); what the
 * plugin's tests need is that an OPEN panel is positioned and a closed one is
 * not measured at all, so this answers a stable style object only while open.
 */
export function useAnchoredPosition(options: { open: boolean }): { left: number, top: number } | null {
  return options.open ? { left: 0, top: 0 } : null
}

/** The platform's outside-pointer dismissal hook: a no-op under a DOM-free renderer. */
export function useDismissOnOutsidePointer(): void {
  // Nothing to subscribe to without a document: the plugin's own Escape handler
  // and the click on the trigger are what the tests drive.
}