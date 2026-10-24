/**
 * The one action button both WorkBuddy surfaces draw.
 *
 * A thin wrapper over the platform's `Button` (a PLATFORM SEED module the shell
 * provides), so a row's controls are literally the platform's controls rather
 * than a local reimplementation with its own colours and metrics. The wrapper
 * exists to pin the two choices this plugin always makes — compact size, and a
 * destructive member of the family for anything that deletes a stored sign-in.
 *
 * @module dsh-workbuddy-connect/client/ui-button
 */

import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactNode } from 'react'

/** Props of one {@link ActionButton}. */
export interface ActionButtonProps {
  label: string
  /** `primary` is the affirmative action in a dialog; `danger` deletes. */
  tone?: 'primary' | 'danger'
  disabled?: boolean
  /** Localized hover text, typically why the button is locked. */
  title?: string
  onClick(): void
}

/** Render one action button. */
export function ActionButton({ label, tone, disabled, title, onClick }: ActionButtonProps): ReactNode {
  return (
    <Button
      variant={tone === 'primary' ? 'primary' : 'ghost'}
      size="sm"
      disabled={disabled === true}
      {...title === undefined ? {} : { title }}
      {...tone === 'danger' ? { className: 'wb2-dangerButton' } : {}}
      onClick={onClick}
    >
      {label}
    </Button>
  )
}
