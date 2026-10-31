/**
 * Whatever the token field received, turned into gateway credentials.
 *
 * Three shapes arrive at the same door, and only two of them are JSON:
 *
 * 1. one or more raw JWT access tokens — newline- or space-separated, with or
 *    without a `Bearer ` prefix, with or without quotes. This is what a user
 *    actually has: they copied it out of a console, not out of an export file.
 * 2. a cockpit export: an array of `{ uid, access_token, refresh_token, expires_at }`.
 * 3. an `auths/*.json` document: nested `{ auth: { accessToken, ... }, account: { uid } }`
 *    or the flat variant of the same keys.
 *
 * All three become one record, because the gateway has exactly two ways to accept
 * a credential and they differ in one field:
 *
 * - the panel API (`import/cockpit`) demands a non-empty `refresh_token`;
 * - the `auths/` directory does not — a token-only credential loads with
 *   `has_refresh_token: false` and the scheduler leaves its refresh alone.
 *
 * Choosing the door is the service's job. This module only answers "what is this
 * text?", and refuses with a reason a human can act on instead of `not JSON`.
 *
 * @module dsh-workbuddy2api-gateway/token-import
 */
import type { GatewayCredential } from './gateway-contract.ts'


/** Characters a uid may use. The gateway re-checks this before building a path. */
const UID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u

/** A word that introduces a token rather than being one. */
const PREFIX_WORD = /^(?:bearer|access[_-]?token|token|authorization)$/iu

/** A millisecond timestamp is larger than any sane second timestamp. */
const MILLISECOND_FLOOR = 1e12

/** One credential, normalized across every input shape. */
export type ImportedCredential = GatewayCredential

/** One input this module could not use, with the reason to show. */
export interface RejectedInput {
  /** The offending text, truncated for display. */
  input: string
  reason: string
}

/** What the pasted text turned out to be. */
export interface ParsedImport {
  credentials: readonly ImportedCredential[]
  rejected: readonly RejectedInput[]
}

/** A non-empty trimmed string field, or undefined. */
function str(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/** A finite number field, or undefined. */
function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Whether a domain belongs to the international realm. */
export function isGlobalDomain(domain: string): boolean {
  const lowered = domain.trim().toLowerCase()
  return lowered === 'workbuddy.ai' || lowered.endsWith('.workbuddy.ai')
}

/** Normalize an epoch value that may be seconds or milliseconds. */
function epochSeconds(value: number | undefined): number {
  if (value === undefined || value <= 0) return 0
  return Math.floor(value >= MILLISECOND_FLOOR ? value / 1000 : value)
}

/** Strip the punctuation a copy-paste tends to bring along. */
function unwrapToken(raw: string): string {
  let text = raw.trim()
  while (text.length > 0) {
    const first = text[0]
    const last = text[text.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'") || (first === '`' && last === '`')) {
      text = text.slice(1, -1).trim()
      continue
    }
    break
  }
  const prefixed = /^(?:bearer|access_token|accessToken|token)\s*[=:]\s*/iu.exec(text)
  if (prefixed !== null) text = text.slice(prefixed[0].length).trim()
  return text.replace(/[;,]+$/u, '').trim()
}

/**
 * Decode a JWT payload without verifying it.
 *
 * Verification is the gateway's job — it is the only party that talks to the
 * issuer. What the panel needs from the claims is display and routing only:
 * which account this is, what to call it, and when it stops working.
 */
export function decodeJwtClaims(token: string): Record<string, unknown> | undefined {
  const segments = token.split('.')
  if (segments.length !== 3) return undefined
  const payload = segments[1]
  if (payload === undefined || payload === '') return undefined
  let decoded: string
  try {
    decoded = Buffer.from(payload, 'base64url').toString('utf8')
  } catch {
    return undefined
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(decoded)
  } catch {
    return undefined
  }
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : undefined
}

/** Realm and domain from an issuer URL (`https://www.codebuddy.cn/auth/realms/copilot`). */
function realmOfIssuer(issuer: string | undefined): { realm: 'cn' | 'global', domain: string } {
  if (issuer === undefined) return { realm: 'cn', domain: '' }
  let host = ''
  try {
    host = new URL(issuer).host.toLowerCase()
  } catch {
    return { realm: 'cn', domain: '' }
  }
  // The international realm lives on workbuddy.ai; everything else (including the
  // codebuddy.cn console) is domestic. The domain stays empty for a domestic
  // token: the gateway falls back to the endpoint host, which is the value the
  // official client sends, while a guessed host would be a wrong tenant claim.
  return isGlobalDomain(host) ? { realm: 'global', domain: host } : { realm: 'cn', domain: '' }
}

/** Build a credential from a bare JWT, or say why it is not one. */
export function credentialFromToken(raw: string): ImportedCredential | string {
  const token = unwrapToken(raw)
  if (token === '') return 'empty token'
  const claims = decodeJwtClaims(token)
  if (claims === undefined) {
    return 'not a JWT: expected three dot-separated segments whose middle one is JSON'
  }
  const uid = str(claims['sub'])
  if (uid === undefined) return 'the token has no sub claim, so it does not name an account'
  if (!UID_PATTERN.test(uid)) return 'the sub claim is not a usable uid'
  const issuer = realmOfIssuer(str(claims['iss']))
  return {
    uid,
    nickname: str(claims['nickname']) ?? str(claims['preferred_username']) ?? str(claims['email']) ?? uid.slice(0, 8),
    accessToken: token,
    refreshToken: '',
    expiresAt: epochSeconds(num(claims['exp'])),
    realm: issuer.realm,
    domain: issuer.domain,
  }
}

/**
 * The `auths/*.json` document for one credential.
 *
 * Exactly the shape the gateway itself writes after a refresh (`SaveAtomic`), so
 * a generated file and a hand-edited one stay indistinguishable — including the
 * empty `refreshToken` that tells the pool not to attempt a renewal.
 */
export function authFileDocument(credential: ImportedCredential): Record<string, unknown> {
  return {
    auth: {
      accessToken: credential.accessToken,
      refreshToken: credential.refreshToken,
      expiresAt: credential.expiresAt,
      domain: credential.domain,
      realm: credential.realm,
    },
    account: {
      uid: credential.uid,
      enterpriseId: '',
      nickname: credential.nickname,
    },
  }
}

/** Read one object in any of the accepted record shapes. */
function credentialFromObject(value: Record<string, unknown>): ImportedCredential | string {
  // Nested auth-file shape: { auth: { ... }, account: { ... } }.
  const nestedAuth = value['auth']
  const auth = typeof nestedAuth === 'object' && nestedAuth !== null && !Array.isArray(nestedAuth)
    ? nestedAuth as Record<string, unknown>
    : value
  const nestedAccount = value['account']
  const account = typeof nestedAccount === 'object' && nestedAccount !== null && !Array.isArray(nestedAccount)
    ? nestedAccount as Record<string, unknown>
    : value
  const accessToken = str(auth['accessToken']) ?? str(auth['access_token']) ?? str(value['accessToken'])
    ?? str(value['access_token']) ?? str(value['token'])
  if (accessToken === undefined) return 'no access token in this object'
  // A bare token in a JSON string field still has to prove it is one.
  const claims = decodeJwtClaims(unwrapToken(accessToken))
  const uid = str(account['uid']) ?? str(value['uid']) ?? (claims === undefined ? undefined : str(claims['sub']))
  if (uid === undefined) return 'no uid, and the access token carries no sub claim'
  if (!UID_PATTERN.test(uid)) return 'uid may only use letters, digits, - and _'
  const domain = str(auth['domain']) ?? str(value['domain']) ?? ''
  const declaredRealm = str(auth['realm']) ?? str(value['realm'])
  const realm: 'cn' | 'global' = declaredRealm === 'global' || declaredRealm === 'cn'
    ? declaredRealm
    : isGlobalDomain(domain)
      ? 'global'
      : realmOfIssuer(claims === undefined ? undefined : str(claims['iss'])).realm
  const claimExpiry = claims === undefined ? undefined : num(claims['exp'])
  return {
    uid,
    nickname: str(account['nickname']) ?? str(value['nickname'])
      ?? (claims === undefined ? undefined : str(claims['nickname']) ?? str(claims['preferred_username']))
      ?? uid.slice(0, 8),
    accessToken: unwrapToken(accessToken),
    refreshToken: str(auth['refreshToken']) ?? str(auth['refresh_token']) ?? str(value['refresh_token']) ?? '',
    expiresAt: epochSeconds(num(auth['expiresAt']) ?? num(value['expires_at']) ?? num(value['expiresAt']) ?? claimExpiry),
    realm,
    // A domestic credential keeps the endpoint-host fallback; a global one needs
    // the domain claim to look like the desktop client's.
    domain: realm === 'global' && domain === '' ? 'www.workbuddy.ai' : domain,
  }
}

/** Read a decoded JSON document in any accepted shape. */
function fromDocument(value: unknown, rejected: RejectedInput[]): ImportedCredential[] {
  if (typeof value === 'string') {
    const credential = credentialFromToken(value)
    if (typeof credential === 'string') rejected.push({ input: value.slice(0, 24), reason: credential })
    else return [credential]
    return []
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry === 'string') {
        const credential = credentialFromToken(entry)
        if (typeof credential === 'string') {
          rejected.push({ input: entry.slice(0, 24), reason: credential })
          return []
        }
        return [credential]
      }
      if (typeof entry !== 'object' || entry === null) {
        rejected.push({ input: JSON.stringify(entry)?.slice(0, 24) ?? 'null', reason: 'not a credential' })
        return []
      }
      const credential = credentialFromObject(entry as Record<string, unknown>)
      if (typeof credential === 'string') {
        rejected.push({ input: JSON.stringify(entry).slice(0, 24), reason: credential })
        return []
      }
      return [credential]
    })
  }
  if (typeof value === 'object' && value !== null) {
    const credential = credentialFromObject(value as Record<string, unknown>)
    if (typeof credential === 'string') {
      rejected.push({ input: JSON.stringify(value).slice(0, 24), reason: credential })
      return []
    }
    return [credential]
  }
  rejected.push({ input: String(value).slice(0, 24), reason: 'not a credential' })
  return []
}

/**
 * Parse whatever the token field holds.
 *
 * JSON is tried first and only then the token list, because a cockpit export and
 * a JWT are told apart by their first character, and a user pasting the wrong one
 * of the two should get "the token has no sub claim", not "payload is not JSON".
 */
export function parseImport(text: string): ParsedImport {
  const trimmed = text.trim()
  if (trimmed === '') return { credentials: [], rejected: [] }
  const rejected: RejectedInput[] = []
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
    try {
      const document: unknown = JSON.parse(trimmed)
      return { credentials: fromDocument(document, rejected), rejected }
    } catch {
      // Fall through: a JWT is never valid JSON, and a truncated export is still
      // worth a per-token diagnosis.
    }
  }
  const credentials: ImportedCredential[] = []
  // Line first, then whitespace: "Bearer <token>" is one credential spread over
  // two words, and stripping the prefix per line is what keeps the word "Bearer"
  // from being reported as a malformed token.
  for (const line of trimmed.split(/\r?\n/u)) {
    const withoutPrefix = unwrapToken(line)
    if (withoutPrefix === '') continue
    for (const chunk of withoutPrefix.split(/[\s,]+/u)) {
      if (PREFIX_WORD.test(chunk)) continue
      const credential = credentialFromToken(chunk)
      if (typeof credential === 'string') rejected.push({ input: chunk.slice(0, 24), reason: credential })
      else credentials.push(credential)
    }
  }
  return { credentials, rejected }
}
