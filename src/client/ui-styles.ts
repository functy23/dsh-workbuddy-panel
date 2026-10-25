/**
 * Two stylesheets for the WorkBuddy surfaces: the settings page (and the
 * Models-page provider card, which shares its classes) and the plans panel
 * (the sidebar footer card plus the dashboard it opens).
 *
 * Returned as strings rather than injected here so the modules stay free of DOM
 * side effects at import time: `./index.tsx` installs each once, keyed by its
 * own `data-plugin-css` id. The metrics are the harness's own settings pages'
 * — read out of the 0.1.7 bundles so these surfaces sit beside General and
 * Models without looking foreign: a row is 16px of padding over a 0.5px
 * border-l2 hairline, its title 14/22 label-primary, its description 12/18
 * label-tertiary, the control on the right. Inputs are 32px with an 8px radius,
 * a card is a 0.5px border-l4 outline with a 16px radius, a nested panel is a
 * bg-module-platform fill.
 *
 * Two design rules hold throughout, both learned from the reference
 * implementation this is ported from (dsh-commandcode-provider):
 *
 * - **No literal colours.** Every value is a `--dsw-alias-*` token with a
 *   neutral fallback, so the page follows the active theme, light or dark.
 *   Literal colours get this wrong in exactly one mode: `brand-primary`
 *   inverts between them, so a hardcoded white thumb vanishes in dark mode.
 * - **The content column is a fixed 720px稿纸.** The page is a stack of
 *   groups of hairline-separated rows — no card surfaces — which is what makes
 *   it read as a settings page rather than as a dashboard.
 *
 * The `wb2-` prefix is kept (rather than the reference's `cc-`) because these
 * rules are GLOBAL CSS: another plugin's stylesheet with the same prefix would
 * silently restyle these surfaces, and the reference plugin is installed on
 * this machine.
 *
 * @module dsh-workbuddy-connect/client/ui-styles
 */

/** Idempotency key for the settings-page stylesheet. */
export const PAGE_CSS_ID = 'dsh-workbuddy2api-connect-page'

/** Idempotency key for the panel stylesheet. */
export const PANEL_CSS_ID = 'dsh-workbuddy2api-connect-panel'

/**
 * The settings-page stylesheet: a 720px column of groups, each a heading over
 * hairline-separated rows, plus the fields, toggles, segmented controls,
 * account cards and dialogs the page composes from it.
 */
export const PAGE_CSS = `
.wb2-section{max-width:720px;color:var(--dsw-alias-label-primary);flex-direction:column;display:flex;gap:16px}
.wb2-spacer{flex:1}
/* Groups: a heading over hairline-separated rows, no card surface. */
.wb2-group{flex-direction:column;display:flex;margin-top:28px}
.wb2-groupHead{align-items:center;gap:8px;display:flex;min-height:20px;padding-bottom:2px}
.wb2-groupTitle{margin:0;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}
.wb2-groupDesc{margin:0 0 12px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.wb2-rows>.wb2-groupDesc{margin:0;padding:4px 0 0}
.wb2-rows{flex-direction:column;display:flex}
.wb2-row{align-items:center;gap:8px;display:flex;padding:10px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.wb2-rows>.wb2-row:last-child{border-bottom:0}
.wb2-rowNested{padding-left:16px}
.wb2-rowFlush{padding:0;border-bottom:0}
.wb2-rowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:32px;display:flex}
.wb2-rowTitleLine{align-items:center;gap:8px;display:flex;min-width:0}
.wb2-rowTitle{min-width:0;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px;display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}
.wb2-rowDesc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.wb2-rowDesc p{margin:0}
.wb2-rowDesc p+p{margin-top:4px}
.wb2-rowError{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.wb2-rowControl{flex:none;align-items:center;justify-content:flex-end;gap:8px;display:inline-flex;max-width:60%}
/* The platform's link button: a compact capsule with no fill until hovered. */
.wb2-linkButton{box-sizing:border-box;flex:none;align-items:center;display:inline-flex;height:28px;padding:0 10px;border:0;border-radius:14px;background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;line-height:18px;white-space:nowrap;cursor:pointer}
.wb2-linkButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.wb2-linkButton:disabled{cursor:default;opacity:.4}
.wb2-linkButton:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
/* Tags: the platform Tag's capsule (11/17, weight 500). */
/* A label paired with a value on one baseline (the total-credit line). */
.wb2-factLabel{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.wb2-factValue{color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}
/* The stacked field (the Models-page provider card and the account forms):
 * the platform SettingsForm field's metrics. */
.wb2-fieldHead{align-items:center;gap:8px;display:flex}
.wb2-label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}
.wb2-input{box-sizing:border-box;height:32px;min-width:0;padding:0 10px;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;background:var(--dsw-alias-bg-layer-1);font:inherit;color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}
.wb2-input::placeholder{color:var(--dsw-alias-label-dimmed)}
.wb2-input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}
.wb2-input:disabled{opacity:.6;cursor:default}
.wb2-hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}
/* An informational outcome (a save that took an older host's route): the same
 * metrics as the error line and the other colour, so it reads as a note. */
.wb2-notice{color:var(--dsw-alias-state-warn-label,var(--dsw-alias-label-tertiary));margin:0;font-size:12px;line-height:18px}
/* The checkbox, drawn rather than native: color-scheme is set once at BOOT and
 * is not re-applied when the theme is switched in-session, so a native box can
 * paint light chrome on a dark page. The mark rides brand-primary, so it takes
 * the theme's foreground for that fill. */
.wb2-check{box-sizing:border-box;appearance:none;flex-shrink:0;width:16px;height:16px;margin:0;border:1px solid var(--dsw-alias-border-l3);border-radius:4px;background:0 0;position:relative}
.wb2-check:checked{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.wb2-check:checked::after{content:'';position:absolute;top:3px;left:5px;width:3px;height:7px;border:solid var(--dsw-alias-label-primary-foreground,#fff);border-width:0 1.5px 1.5px 0;transform:rotate(45deg)}
.wb2-check:disabled{cursor:default;opacity:.4}
.wb2-checkRow{align-items:center;gap:8px;display:inline-flex;min-width:0}
.wb2-checkRow:hover{cursor:pointer}
.wb2-checkName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* The platform Switch: a 36x20 capsule padding its track by 2px, sliding a
 * 16px thumb across the 32px content box. corner-shape:round on both the track
 * and the thumb keeps the capsule from squaring its ends around a round thumb. */
.wb2-toggle{box-sizing:border-box;appearance:none;flex-shrink:0;width:36px;height:20px;margin:0;padding:2px;border:0;border-radius:10px;corner-shape:round;background:var(--dsw-alias-border-l3);cursor:pointer;position:relative}
.wb2-toggle:checked{background:var(--dsw-alias-brand-primary)}
.wb2-toggle::after{content:'';display:block;width:16px;height:16px;border-radius:50%;corner-shape:round;background:var(--dsw-alias-label-primary-foreground);transition:transform .12s ease}
.wb2-toggle:checked::after{transform:translateX(16px)}
.wb2-toggle:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.wb2-toggle:disabled{cursor:default;opacity:.5}
/* The platform SegmentedControl: a translucent track with one raised pill that
 * slides under the picked segment. Segments are equal grid tracks, so the
 * indicator's width and offset follow from the count and index alone — no DOM
 * measurement. */
.wb2-segmented{position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:2px;padding:4px;border-radius:var(--dsw-radius-md,9px);background:var(--dsw-alias-interactive-bg-hover)}
.wb2-segmentIndicator{position:absolute;top:4px;left:4px;width:calc((100% - 8px - 2px * (var(--wb2-segment-count) - 1)) / var(--wb2-segment-count));height:calc(100% - 8px);border-radius:var(--dsw-radius-sm,6px);background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-soft,0 1px 2px rgba(0,0,0,.12));transform:translateX(calc(var(--wb2-segment-index) * (100% + 2px)));transition:transform .16s ease;pointer-events:none}
.wb2-segment{box-sizing:border-box;position:relative;z-index:1;height:28px;padding:0 16px;border:0;border-radius:var(--dsw-radius-sm,6px);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;font-weight:500;line-height:20px;white-space:nowrap;cursor:pointer;transition:color .12s ease}
.wb2-segment:hover:not(:disabled),.wb2-segment[aria-checked=true]{color:var(--dsw-alias-label-primary)}
.wb2-segment:disabled{cursor:default;opacity:.4}
/* ------------------------------------------------- the model picker menu */
/* The multi-select trigger: the platform's selector capsule (the reference
 * implementation's .cc-selector, same numbers). */
.wb2-modelSelectAnchor{flex-direction:column;align-items:stretch;gap:6px;display:inline-flex;min-width:160px}
.wb2-selector{box-sizing:border-box;align-items:center;gap:12px;display:inline-flex;height:36px;padding:0 14px;border:0;border-radius:18px;corner-shape:round;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px;text-align:left;cursor:pointer}
.wb2-selector:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.wb2-selector:disabled{cursor:default;opacity:.4}
.wb2-selector:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
.wb2-selectorText{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb2-selectorCaret{flex-shrink:0;border-right:1.5px solid var(--dsw-alias-label-tertiary);border-bottom:1.5px solid var(--dsw-alias-label-tertiary);width:6px;height:6px;margin-bottom:3px;transform:rotate(45deg)}
/* The portaled list needs its own floor: the models are long names, and a menu
 * clamped to the trigger's width would ellipsis the part that tells two of them
 * apart. */
.wb2-modelMenu{min-width:240px}
/* The search box sits INSIDE the Menu anchor, so typing in it never trips the
 * Menu's outside-click close. */
.wb2-modelSearch{width:100%}
.wb2-modelSearch::-webkit-search-cancel-button{cursor:pointer}
/* A model the filter excludes: the platform's muted dot, the same mark the
 * reference implementation's account default-state column uses. */
.wb2-modelFiltered{flex-shrink:0;width:6px;height:6px;border-radius:50%;corner-shape:round;background:var(--dsw-alias-label-dimmed,var(--dsw-alias-label-tertiary))}
/* Three dots from one element: the dot itself plus two box-shadow copies (the
 * reference implementation's .cc-kebab). */
.wb2-kebab{width:3px;height:3px;border-radius:50%;corner-shape:round;background:currentColor;box-shadow:0 -5px 0 currentColor,0 5px 0 currentColor}
/* ------------------------------------------------ account meters (cc port) */
/* ------------------------------------------- the add-account affordance */
/* The Models page's dashed add button, opening a filled panel in its place. */
/* ------------------------------------------------------ staged edit bar (cc port) */
/* The floating save bar, pinned to the bottom of the page's scrollport and slid
 * out of view when there is nothing to save. Ported from the reference
 * implementation's .cc-saveBar: a 44px capsule, 22px radius, concentric 36px
 * buttons, and a leading tone dot. */
.wb2-saveBarDock{position:sticky;bottom:0;z-index:20;height:0;pointer-events:none}
.wb2-saveBar{--wb2-saveBar-tone:var(--dsw-alias-state-warn-primary,#d97706);position:absolute;left:50%;bottom:20px;box-sizing:border-box;width:max-content;max-width:calc(100% - 24px);align-items:center;gap:10px;display:flex;height:44px;padding:4px 4px 4px 16px;border:0;border-radius:22px;corner-shape:round;background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-prominent,0 12px 32px -8px rgba(0,0,0,.24),0 2px 8px rgba(0,0,0,.08));opacity:0;visibility:hidden;transform:translate(-50%,12px);transition:opacity .16s ease,transform .16s ease,visibility 0s linear .16s}
.wb2-saveBarShown{opacity:1;visibility:visible;transform:translate(-50%,0);pointer-events:auto;transition:opacity .2s ease,transform .24s cubic-bezier(.2,.9,.3,1.1),visibility 0s}
.wb2-saveBarError{--wb2-saveBar-tone:var(--dsw-alias-state-error-primary)}
.wb2-saveBarSuccess{--wb2-saveBar-tone:var(--dsw-alias-state-success-primary,#16a34a);padding-right:18px}
.wb2-saveBarIcon{flex-shrink:0;align-items:center;justify-content:center;display:inline-flex;width:16px;height:16px;color:var(--wb2-saveBar-tone)}
.wb2-saveBarPulse{width:8px;height:8px;border-radius:50%;corner-shape:round;background:var(--wb2-saveBar-tone)}
.wb2-saveBarText{min-width:0;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}
.wb2-saveBarError .wb2-saveBarText{color:var(--dsw-alias-state-error-primary)}
.wb2-saveBarActions{flex-shrink:0;align-items:center;gap:4px;display:flex;margin-left:8px}
.wb2-saveBarButton{box-sizing:border-box;height:36px;padding:0 16px;border:0;border-radius:18px;corner-shape:round;font:inherit;font-size:14px;line-height:22px;white-space:nowrap;cursor:pointer}
.wb2-saveBarButton:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
.wb2-saveBarButton:disabled{cursor:default;opacity:.4}
.wb2-saveBarGhost{background:0 0;color:var(--dsw-alias-label-primary)}
.wb2-saveBarGhost:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.wb2-saveBarPrimary{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));color:var(--dsw-alias-label-primary-foreground,#fff)}
.wb2-saveBarPrimary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary)))}
/* ------------------------------------------------------------- accounts */
/* One card per PRODUCT, every account of that product as a row inside it.
 * The card is the platform's outlined surface (0.5px border-l4, 16px radius),
 * because it groups rows rather than being a row itself; the rows inside carry
 * no chrome at all, only a hairline between them. */
.wb2-productCards{flex-direction:column;gap:12px;display:flex}
.wb2-productCard{box-sizing:border-box;flex-direction:column;display:flex;padding:12px 14px 4px;border:.5px solid var(--dsw-alias-border-l4);border-radius:16px;min-width:0}
.wb2-productHead{align-items:center;gap:8px;display:flex;min-width:0;padding-bottom:8px}
.wb2-productName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}
.wb2-productCount{flex:none;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.wb2-productTotal{flex:none;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;font-variant-numeric:tabular-nums;white-space:nowrap}
.wb2-productDetail{margin:0 0 8px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.wb2-accountList{flex-direction:column;display:flex;min-width:0}
/* One account: a name line and ONE grey line under it. No disclosure, no
 * per-account card — the pool is one subject and its rows are comparable only
 * when they share a frame. The hairline separates rows, and the last row drops
 * it so the card's own border is the only line at the bottom. */
.wb2-accountRow{flex-direction:column;gap:2px;display:flex;min-width:0;padding:10px 2px;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.wb2-accountList>.wb2-accountRow:last-child{border-bottom:0}
/* The account the pool is actually serving from: the reference
 * implementation's own active-row mark, kept as a left accent rather than a
 * border so it does not shift the row's text by a pixel when it flips. */
.wb2-accountRowActive{padding-left:8px;box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary)}
.wb2-accountHead{align-items:center;gap:8px;display:flex;min-width:0;min-height:22px}
.wb2-accountName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}
/* The grey meta line: every figure the row states, separated by a middot. It
 * wraps rather than truncates — a figure the reader cannot see is worse than a
 * second line — and its numbers are tabular so rows line up down the column. */
.wb2-accountMeta{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.wb2-usagePlanStatus{flex:none;margin:0;white-space:nowrap;color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.wb2-iconButton{flex-shrink:0;align-items:center;justify-content:center;display:inline-flex;width:28px;height:28px;padding:0;background:0 0;border:0;border-radius:6px;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.wb2-iconButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.wb2-iconButton:disabled{cursor:default;opacity:.4}
.wb2-iconButton:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
.wb2-inlineForm,.wb2-confirmBar{flex-direction:column;gap:8px;display:flex}
.wb2-inlineActions{align-items:center;gap:8px;display:flex;flex-wrap:wrap}
.wb2-confirmBar{border:.5px solid var(--dsw-alias-state-error-primary);border-radius:12px;padding:12px 14px}
.wb2-confirmText{color:var(--dsw-alias-label-primary);margin:0;font-size:14px;line-height:22px}
/* Adding an account: the Models page's dashed add button, opening a filled
 * panel in its place. */
/* Account report: stat tiles are filled panels, like the platform's editors. */
/* The per-product total tiles sit under the account cards, so they need the
 * same air the add button gets — flush against the last card they read as part
 * of it. The reference implementation has no equivalent row, so this spacing is
 * ours to set. */
.wb2-usageStat{min-width:0;flex-direction:column;gap:2px;display:flex;padding:10px 12px;border-radius:12px;background:var(--dsw-alias-bg-module-platform)}
.wb2-usageStatLabel{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.wb2-usageStatValue{color:var(--dsw-alias-label-primary);font-size:16px;font-weight:500;line-height:24px;font-variant-numeric:tabular-nums}
.wb2-usageStatSub{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Tabs across the top of the page: one per product. */
/* --------------------------------------------------------------- models */
/* Realm heading between model rows: domestic block first, international second. */
.wb2-modelGroup{align-items:center;gap:8px;display:flex;margin:16px 0 2px;color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600;line-height:18px}
.wb2-modelGroup:first-child{margin-top:4px}
.wb2-modelRow{align-items:center;gap:8px;display:flex;padding:10px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
/* The row's left half: the mark, the name, its promotions and its rate. Grows to take the space the fixed control column leaves. */
.wb2-modelMain{align-items:center;gap:8px;display:flex;flex:1;min-width:0}
.wb2-modelName{min-width:0;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* The row's right-hand column, as a fixed grid so the rows line up top to
 * bottom: one column per slot (probe result, Detect button, context figure),
 * each sized to its widest occupancy. Flow layout could not hold a column — a
 * row without a Detect button would pull its context figure left, and the
 * figures would read as ragged down the page even though every row is
 * individually correct.
 *
 * The two fixed tracks are the widths of the button and of the context figure
 * at their widest real content, so a row can be missing either without shifting
 * the other. The first track is auto so the result badge takes what it needs;
 * justify-items:end keeps every cell flush right, which is what makes the
 * column's edge straight. */
.wb2-modelControl{flex:none;align-items:center;display:grid;grid-template-columns:auto 76px minmax(120px,auto);gap:8px;justify-items:end}
.wb2-modelProbeResult{display:inline-flex;justify-content:flex-end;min-width:0}
.wb2-modelProbeAction{display:inline-flex;justify-content:flex-end}
.wb2-modelContext{display:inline-flex;justify-content:flex-end;align-items:center;text-align:right;white-space:nowrap}
/* --------------------------------------------------------------- dialogs */
/* The overlay portals to document.body (see WorkBuddySettingsPage), so its
   z-index is compared in the ROOT stacking context — against the host's own
   chrome, not just this page. The host stacks its shell and chat surfaces up
   to z-index 1100 and reserves layers beyond that; the original 60 sat behind
   the Settings surface the dialog was opened from, so the click meant to
   dismiss the dialog landed on Settings instead — and closing Settings
   unmounted the dialog with it. Pinned near the top of the 32-bit range: a
   modal this plugin opens must never interleave with host chrome. */
.wb2-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--dsw-alias-bg-mask,rgba(0,0,0,.45))}
@keyframes cs-overlay-in{from{opacity:0}to{opacity:1}}
@keyframes cs-dialog-in{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}
.wb2-overlay{animation:cs-overlay-in .16s ease}
.wb2-dialog{box-sizing:border-box;width:100%;max-width:380px;display:flex;flex-direction:column;gap:14px;padding:20px;border-radius:16px;border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-prominent,0 12px 32px -8px rgba(0,0,0,.24));animation:cs-dialog-in .2s cubic-bezier(.22,1,.36,1)}
.wb2-dialogTitle{margin:0;color:var(--dsw-alias-label-primary);font-size:16px;line-height:24px;font-weight:500;text-align:center}
.wb2-dialogBody{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;text-align:center}
.wb2-dialogActions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
.wb2-qrFrame{display:flex;align-items:center;justify-content:center;margin:0 auto;padding:12px;border-radius:12px;background:#fff}
.wb2-tokenArea{box-sizing:border-box;width:100%;min-height:96px;padding:10px;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;resize:vertical}
/* The address of a page no strategy could open: a copy target, so it stays
 * selectable and reads in the same field style as the other inputs. */
.wb2-linkFallback{display:flex;flex-direction:column;gap:8px}
.wb2-linkFallback .wb2-input{font-size:12px}
.wb2-tokenArea:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}
/* Identifiers (route ids, model ids, account uids) are compared and copied, so
 * they get the monospace treatment and stay selectable. */
.wb2-rowDimmed{opacity:.6}
/* ------------------------------------------------- Claude-style surfaces
   The overview widget, its heat map, and the card treatment the account and
   model sections share: soft fills, no hard outlines, figures that lead. */
/* Segmented control: the track is the theme's chip surface, the active pill is
   the theme's overlay surface with a soft shadow. Copied from dsh-claude-style's
   .dsh-claude-segments / .dsh-claude-segment pair; the fallbacks keep the track
   visible when the theme is not installed. */
.cs-seg{flex:none;align-self:flex-start;align-items:center;gap:2px;padding:2px;border-radius:7px;background:var(--dsh-claude-chip,var(--dsw-alias-bg-layer-2,#ffffff14));display:inline-flex;position:relative}
.cs-seg::before{content:"";position:absolute;top:2px;left:2px;height:calc(100% - 4px);width:calc((100% - 4px - 2px * (var(--cs-seg-count,2) - 1)) / var(--cs-seg-count,2));border-radius:7px;background:var(--dsw-alias-bg-overlay,#ffffff24);box-shadow:0 1px 2px #14141314;transform:translateX(calc(var(--cs-seg-index,0) * (100% + 2px)));transition:transform .18s cubic-bezier(.2,.8,.2,1)}
.cs-segFull{display:flex;width:100%}
.cs-segDisabled{opacity:.55;pointer-events:none}
.cs-segItem{appearance:none;margin:0;border:0;cursor:pointer;position:relative;z-index:1;flex:1 1 0;white-space:nowrap;text-align:center;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:14px;font-weight:500;line-height:18px;padding:3px 12px;border-radius:7px;transition:background-color .16s ease,color .16s ease}
.cs-segItem:hover:not([data-active="true"]){color:var(--dsw-alias-label-primary)}
.cs-segItem[data-active="true"]{color:var(--dsw-alias-label-primary);background:transparent;box-shadow:none}
.cs-segItem:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.cs-usage{display:flex;flex-direction:column;gap:12px;padding:12px 14px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);border:0}
.cs-usageHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cs-usageTitle{font-size:13px;font-weight:500;color:var(--dsw-alias-label-secondary)}
.cs-spacer{flex:1}
.cs-usageGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.cs-stat{display:flex;flex-direction:column;gap:6px;padding:12px 14px;border-radius:12px;background:var(--dsw-alias-interactive-bg-hover)}
.cs-statLabel{font-size:12px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.cs-statValue{font-size:20px;line-height:1.25;font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cs-statValueSmall{font-size:14px;line-height:1.35;font-weight:600;white-space:normal;overflow:visible;text-overflow:clip}
/* Heat map: one 7-row column-flow grid, 1fr columns, 3px gaps, square cells.
   Copied from dsh-claude-style's .dsh-claude-home-heat / -heat-cell. */
.cs-heat{display:grid;grid-auto-flow:column;grid-template-rows:repeat(7,1fr);grid-auto-columns:1fr;gap:2px;align-content:start;--cs-heat-ink:var(--dsw-alias-brand-primary,#3b6ecf)}
.cs-heatCell{position:relative;width:100%;aspect-ratio:1;border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent)}
.cs-heatCell[data-level="1"]{background:color-mix(in srgb,var(--cs-heat-ink) 20%,transparent)}
.cs-heatCell[data-level="2"]{background:color-mix(in srgb,var(--cs-heat-ink) 40%,transparent)}
.cs-heatCell[data-level="3"]{background:color-mix(in srgb,var(--cs-heat-ink) 65%,transparent)}
.cs-heatCell[data-level="4"]{background:color-mix(in srgb,var(--cs-heat-ink) 100%,transparent)}
.cs-usageFoot{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
/* Section switch, copied from dsh-claude-style's page-in/page-out pair: an 8px
   horizontal shift carrying a 3px blur, .25s in and .12s out on
   cubic-bezier(.22,1,.36,1). The direction lives in --cs-page-shift, so the
   enter and leave rules share one keyframe each.
     forward: old page leaves to -8px while the new one enters from +8px
     back:    the mirror image */
.cs-page{position:relative}
/* The tab body is the flex column that actually spaces the cards: the section's
   own gap only reaches ITS children, and the body sits between them. */
.cs-pageBody{display:flex;flex-direction:column;gap:16px}
.cs-pageBody[data-enter="forward"],.cs-pageBody[data-leave="back"]{--cs-page-shift:8px}
.cs-pageBody[data-enter="back"],.cs-pageBody[data-leave="forward"]{--cs-page-shift:-8px}
.cs-pageBody[data-enter]{animation:cs-page-in .25s cubic-bezier(.22,1,.36,1)}
.cs-pageBody[data-leave]{position:absolute;inset:0 0 auto;pointer-events:none;animation:cs-page-out .12s cubic-bezier(.22,1,.36,1) forwards}
@keyframes cs-page-in{0%{opacity:0;transform:translate(var(--cs-page-shift));filter:blur(3px)}to{opacity:1;transform:none;filter:blur(0)}}
@keyframes cs-page-out{0%{opacity:1;transform:none;filter:blur(0)}to{opacity:0;transform:translate(var(--cs-page-shift));filter:blur(3px)}}
@media (prefers-reduced-motion:reduce){.cs-pageBody[data-enter],.cs-pageBody[data-leave]{animation:none}}
/* Account table: the gateway panel's account page is a table, and so is this —
   one row per account, columns in the same order (identity, state, credits,
   counters, usage, last success, actions). */
.cs-creditBadge{display:inline-flex;align-items:center;gap:4px;background:none;border:0;padding:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;white-space:nowrap}
.cs-creditBadge b{font-weight:600;color:var(--dsw-alias-label-primary)}
.cs-tableWrap{overflow-x:auto}
.cs-table{width:100%;border-collapse:collapse;font-size:13px}
.cs-table th{text-align:left;font-weight:500;color:var(--dsw-alias-label-tertiary);font-size:12px;padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l2);white-space:nowrap}
.cs-table td{padding:9px 8px;border-bottom:.5px solid var(--dsw-alias-border-l2);vertical-align:middle}
.cs-table tr:last-child td{border-bottom:0}
.cs-cellWho{display:flex;flex-direction:column;gap:2px;min-width:120px}
.cs-cellWho .cs-nm{display:flex;align-items:center;gap:6px;font-size:14px;font-weight:500;color:var(--dsw-alias-label-primary);min-width:0}
.cs-cellWho .cs-nm > span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cs-uid{color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums}
.cs-cellState{display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:104px}
.cs-note{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:15px}
.cs-cellCred{min-width:110px;font-variant-numeric:tabular-nums}
.cs-cellCred .of{color:var(--dsw-alias-label-tertiary)}
.cs-credBar{height:4px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);overflow:hidden;margin-top:5px}
.cs-credBar > i{display:block;height:100%;border-radius:999px;background:var(--dsw-alias-brand-primary)}
.cs-num{font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--dsw-alias-label-primary)}
.cs-num .dim{color:var(--dsw-alias-label-tertiary)}
.cs-acts{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;min-width:150px;max-width:210px}
/* Account row, copied from dsh-workbuddy-connect-functy's AccountRow: one line of
   identity (state dot, name, state text, actions) and one line of facts. Not a
   card: the pool is a list, and a list of cards cannot be scanned. */
.cs-accountRow{display:flex;flex-direction:column;gap:2px;min-width:0;padding:10px 2px;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.cs-accountRow:last-child{border-bottom:0}
.cs-accountHead{align-items:center;gap:8px;display:flex;min-width:0;min-height:22px}
.cs-accountName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}
.cs-accountMeta{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.cs-accountActions{display:flex;flex:none;gap:6px;align-items:center}
/* dialog extras: a full-width cancel, a centred hint, the add row, and the
   emphasised open-in-browser button the international realm gets. */
.cs-titleRow{display:flex;align-items:center;gap:8px}
/* the settings row's glyph, painted over the host's placeholder gear */
[data-wb2a-nav]{position:relative}
[data-wb2a-nav] > svg{display:none}
[data-wb2a-nav]::before{content:"";flex:none;width:16px;height:16px;background-color:currentColor;-webkit-mask-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><g fill='none' stroke='black' stroke-width='58' stroke-linecap='round'><path d='M256 238v38'/><path d='M256 276c0 44-42 64-78 86'/><path d='M256 276c0 44 42 64 78 86'/></g><circle cx='256' cy='178' r='82' fill='black'/><circle cx='144' cy='390' r='68' fill='black'/><circle cx='368' cy='390' r='68' fill='black'/></svg>");mask-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><g fill='none' stroke='black' stroke-width='58' stroke-linecap='round'><path d='M256 238v38'/><path d='M256 276c0 44-42 64-78 86'/><path d='M256 276c0 44 42 64 78 86'/></g><circle cx='256' cy='178' r='82' fill='black'/><circle cx='144' cy='390' r='68' fill='black'/><circle cx='368' cy='390' r='68' fill='black'/></svg>");-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center}
display:flex;align-items:center;gap:8px}
.cs-glyph{flex:none;color:var(--dsw-alias-label-secondary)}
.cs-addRow{display:flex;padding-top:10px}
.cs-dialogFull{display:flex;width:100%}
.cs-dialogFull > button{flex:1;width:100%}
.cs-center{text-align:center}
.cs-openButton,.cs-openButton:link,.cs-openButton:visited,.cs-openButton:hover{display:flex;align-items:center;justify-content:center;height:36px;border-radius:9px;background:var(--dsw-alias-brand-primary);color:#ffffff!important;-webkit-text-fill-color:#ffffff;text-decoration:none;font-size:14px;font-weight:500}
.cs-openButton:hover{filter:brightness(1.06)}
.cs-cardActions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:2px}
.cs-page .wb2-group{background:var(--dsw-alias-bg-layer-2);border:0;border-radius:12px;padding:10px 14px;margin-top:0}
.cs-page .wb2-group .wb2-row{border-bottom-color:var(--dsw-alias-border-l2)}
.cs-page .wb2-card{background:var(--dsw-alias-bg-layer-2);border:0;border-radius:12px}
.wb2-mono{font-family:var(--dsw-alias-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;color:var(--dsw-alias-label-secondary);word-break:break-all}
@media (prefers-reduced-motion:reduce){.wb2-toggle::after,.wb2-segmentIndicator,.wb2-segment{transition:none}}
`

/** The panel stylesheet. */
export const PANEL_CSS = `
/* ------------------------------------------------- sidebar footer card */
/* The shell's foot area renders this list ABOVE the Settings seat, so the card
   is the sidebar's bottom-most content. The shell supplies no chrome: the entry
   is the button. It is deliberately quiet — a surface that sits beside Settings
   should read as part of the column, not as a call to action — with one hover
   step and a hairline border.

   The shell's container is a flex ROW whose occupants each declare a full-width
   line, so as a row it would overflow the column: this card cannot shrink and a
   sibling sized 100% would absorb the whole overflow. Both were written for a
   full-width line, which is what a column gives them. Matched by the CSS-module
   class STEM — never a hashed name — so a renamed shell degrades to its own row
   rather than breaking, and anchored under "footArea" rather than the bare
   "footerActions" stem because that stem is NOT the shell's alone:
   dsh-client-ui-user-questions renders the ask-user-question dialog's button
   row with it, and the unanchored rule stacked that dialog's side-by-side
   buttons on every page. The descendant combinator (rather than a child one)
   deliberately survives a wrapper element appearing between the two. */
[class*="_footArea"] [class*="_footerActions"]{flex-direction:column}
.wb2-foot{box-sizing:border-box;flex:0 0 auto;width:100%;min-width:0;font:inherit;color:var(--dsw-alias-label-secondary);text-align:left;cursor:pointer;background:0 0;border:1px solid transparent;border-radius:10px;flex-direction:column;gap:6px;margin:0 0 4px;padding:8px;display:flex}
.wb2-foot:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l2)}
.wb2-foot:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.wb2-footTop{align-items:center;gap:8px;min-width:0;display:flex}
.wb2-footName{white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-primary);min-width:0;overflow:hidden;font-size:13px;font-weight:500;line-height:20px}
/* ONE line per product: the label names the figure, the figure sits flush right.
 * nowrap on both halves is load-bearing — the label carries the product name and
 * "剩余额度", and a wrap would put the number on a line of its own, which is
 * exactly the stacked layout this replaced. */
.wb2-footRow{align-items:baseline;gap:8px;min-width:0;display:flex}
/* The "used / total + bar" style stacks its head line over a full-width bar; the
 * default style is the single line above. Two shapes rather than two skins of one
 * markup, because the bar must span the card, not the space left beside a figure. */
.wb2-footRowUsage{flex-direction:column;gap:4px;align-items:stretch}
.wb2-footHead{align-items:baseline;gap:8px;min-width:0;display:flex}
.wb2-footLabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
.wb2-footAmount{flex:none;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums;white-space:nowrap}
.wb2-footBar{display:block;width:100%;background:var(--dsw-alias-bg-layer-2);border-radius:999px;height:5px;overflow:hidden}
.wb2-footFill{display:block;background:var(--dsw-alias-brand-primary);border-radius:999px;height:100%;transition:width .3s ease}
/* ------------------------------------------------------- composer badge */
/* The credit figure in the composer dock, to the RIGHT of the harness's own
 * context readout.
 *
 * Two CSS facts make that placement work, and both are needed:
 *
 * - The dock renders the slot's entries FIRST and appends its own context meter
 *   after them, and the slot outlet uses display:contents, so this element is a
 *   direct flex item of the dock. DOM order alone would therefore put the badge
 *   LEFT of the meter; the flex order below is what moves it after.
 * - The dock centres its items, so being last is not the same as being at the
 *   edge. margin-left:auto absorbs the free space on the badge's left only, which
 *   pins it to the row's right end with the meter beside it.
 *
 * The trigger copies the context meter's (.JObwrW_trigger) metrics: same radius
 * token, same secondary text size, same 1px/8px padding and 6px gap, and the same
 * hover/[aria-expanded] fill — the two sit side by side in one row, so any drift
 * between them reads as one of the two being broken. */
.wb2-creditBadgeRoot{flex:none;display:inline-flex;align-items:center;order:1;margin-left:auto;position:relative}
.wb2-creditBadge{border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-tertiary);font-family:inherit;font-size:var(--dsh-content-font-size-secondary,13px);font-variant-numeric:tabular-nums;line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));white-space:nowrap;cursor:pointer;background:0 0;border:none;flex:none;align-items:center;gap:6px;padding:1px 8px;display:inline-flex}
.wb2-creditBadge:hover,.wb2-creditBadge[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.wb2-creditBadge:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.wb2-creditBadgeName{color:inherit}
.wb2-creditBadgeValue{color:var(--dsw-alias-label-secondary)}
.wb2-creditBadge[aria-expanded=true] .wb2-creditBadgeValue{color:var(--dsw-alias-label-primary)}
/* The expanded panel: the context popover's own material (.JObwrW_panel) —
 * the menu surface plus its backdrop filter, the prominent elevation token, the
 * same 12px/-lg radius, the same min(264px, …) width, and the same 12px padding
 * and 12px type. Fixed-positioned from the trigger (and portalled) so it survives
 * scrolling and the composer's own overflow. */
.wb2-badgePanel{position:fixed;z-index:1100;box-sizing:border-box;border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);width:min(264px,100vw - 24px);backdrop-filter:var(--dsw-menu-backdrop-filter);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);cursor:default;border:0;padding:12px;font-size:12px;line-height:20px}
/* One product's block, with the pool's own line above its accounts. Separated by
 * a margin rather than a rule: the context popover's two sections are set apart
 * the same way, and a hairline here would draw a card the row above does not. */
.wb2-badgeGroup+.wb2-badgeGroup{margin-top:12px}
.wb2-badgeGroupHead{display:flex;align-items:center;gap:6px}
.wb2-badgeGroupName{color:var(--dsw-alias-label-tertiary)}
.wb2-badgeGroupTotal{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);margin-left:auto;font-weight:500}
.wb2-badgeBar{corner-shape:round;background:var(--dsw-alias-interactive-bg-hover);border-radius:999px;height:4px;margin:10px 0 12px;display:flex;overflow:hidden}
.wb2-badgeBarFill{background:var(--dsw-alias-brand-primary);border-radius:1px;min-width:2px;height:100%;display:block}
.wb2-badgeRows{margin:6px 0 0}
.wb2-badgeRow{justify-content:space-between;align-items:center;gap:12px;padding:2px 0;display:flex}
.wb2-badgeRow dt{color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.wb2-badgeRow dd{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);margin:0;white-space:nowrap}
/* The expanded panel: the context popover's own material (.JObwrW_panel) —
 * the menu surface plus its backdrop filter, the prominent elevation token, the
 * same 12px/-lg radius, the same min(264px, …) width, and the same 12px padding
 * and 12px type. Fixed-positioned from the trigger (and portalled) so it survives
 * scrolling and the composer's own overflow. */
/* One product's block, with the pool's own line above its accounts. Separated by
 * a margin rather than a rule: the context popover's two sections are set apart
 * the same way, and a hairline here would draw a card the row above does not. */
/* -------------------------------------------------------- the rail icon */
.wb2-railButton{box-sizing:border-box;width:36px;height:36px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:1px solid transparent;border-radius:8px;flex:none;justify-content:center;align-items:center;margin:0 0 4px;padding:0;display:inline-flex}
.wb2-railButton:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.wb2-railButton:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
/* The quota ring: one glyph serves the rail button, the card's head and the
   dashboard header. Circumference 2πr = 45.55 at r = 7.25. */
.wb2-glyph{flex:none;justify-content:center;align-items:center;display:inline-flex;color:var(--dsw-alias-brand-primary)}
/* ----------------------------------------------------------- dashboard */
.wb2-main{background:var(--dsw-alias-bg-layer-1);width:100%;height:100%;overflow:auto;display:block}
.wb2-mainInner{max-width:760px;margin:0 auto;padding:24px 20px 40px;flex-direction:column;gap:14px;display:flex;color:var(--dsw-alias-label-primary)}
.wb2-header{align-items:center;gap:10px;display:flex;flex-wrap:wrap}
.wb2-headerText{flex-direction:column;gap:2px;display:flex;min-width:0}
.wb2-titleLg{margin:0;font-size:18px;font-weight:600;line-height:1.4}
.wb2-subtitle{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}
.wb2-notice{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:12px 14px;flex-direction:column;gap:4px;display:flex}
.wb2-noticeError{border-color:var(--dsw-alias-state-error-primary)}
.wb2-noticeTitle{margin:0;font-size:13px;font-weight:600;line-height:1.5}
.wb2-noticeError .wb2-noticeTitle{color:var(--dsw-alias-state-error-primary)}
.wb2-noticeHint{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55}
/* One product's card: the account head, its quota windows, its totals. */
.wb2-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:14px;padding:16px 18px;flex-direction:column;gap:16px;display:flex}
.wb2-cardHead{align-items:center;gap:10px;display:flex;flex-wrap:wrap}
.wb2-avatar{flex:none;width:28px;height:28px;color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-module-platform);border-radius:50%;justify-content:center;align-items:center;font-size:12px;font-weight:600;line-height:1;display:inline-flex}
.wb2-cardIdentity{flex-direction:column;gap:1px;min-width:0;display:flex}
.wb2-cardTitle{font-size:13px;font-weight:600;line-height:1.4}
.wb2-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
/* One account's bench: a labelled bar over its remaining wait. */
@media (prefers-reduced-motion:reduce){.wb2-barFill,.wb2-footFill{transition:none}}
`
