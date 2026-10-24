/**
 * The one JSON shape predicate the whole plugin shares.
 *
 * Every route, store and panel decoder reads fields off parsed text, and every
 * one of them has to answer the same question first: is this a plain object?
 * `null` and arrays are valid JSON documents and both reach a `doc['field']`
 * read as a TypeError or a silent `undefined`.
 *
 * @module dsh-workbuddy2api-connect/json-value
 */

/** Whether a decoded value is a plain JSON object (arrays and null excluded). */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Parse JSON text into a plain object, or `undefined` when it is anything else. */
export function parseJsonObject(text: string): Record<string, unknown> | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return undefined
  }
  return isJsonObject(parsed) ? parsed : undefined
}
