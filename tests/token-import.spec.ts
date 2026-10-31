/**
 * The token field's contract: what a pasted credential is, and which door it
 * takes. A bare access token is the normal case — it is not JSON, so the parser
 * has to read it rather than hand it to JSON.parse.
 */
import { describe, expect, it } from 'vitest'
import { authFileDocument, credentialFromToken, decodeJwtClaims, parseImport } from '../src/token-import.ts'

/** Build an unsigned JWT with the given claims. */
function jwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return header + '.' + payload + '.c2lnbmF0dXJl'
}

/** A domestic console token, as the add-account dialog receives it. */
const DOMESTIC = jwt({
  iss: 'https://www.codebuddy.cn/auth/realms/copilot',
  sub: '109d22b6-5b71-4a47-ad6a-376f30242363',
  nickname: '低调哥',
  preferred_username: '19235408339',
  exp: 1795395042,
  app_type: 'codebuddy',
})

/** An international token. */
const GLOBAL = jwt({
  iss: 'https://www.workbuddy.ai/auth/realms/copilot',
  sub: 'aac2ac1b-f972-4bfb-8240-b516b2fca78e',
  preferred_username: 'furinity@gmail.com',
  exp: 1824964083,
})

describe('token parsing', () => {
  it('reads a bare domestic access token as one credential', () => {
    const parsed = parseImport(DOMESTIC)
    expect(parsed.rejected).toEqual([])
    expect(parsed.credentials).toHaveLength(1)
    expect(parsed.credentials[0]).toEqual({
      uid: '109d22b6-5b71-4a47-ad6a-376f30242363',
      nickname: '低调哥',
      accessToken: DOMESTIC,
      refreshToken: '',
      expiresAt: 1795395042,
      realm: 'cn',
      // A domestic credential keeps the endpoint-host fallback: a guessed
      // codebuddy.cn domain would be a wrong tenant claim.
      domain: '',
    })
  })

  it('reads a global token with its domain claim', () => {
    const parsed = parseImport(GLOBAL)
    expect(parsed.credentials[0]).toMatchObject({
      uid: 'aac2ac1b-f972-4bfb-8240-b516b2fca78e',
      nickname: 'furinity@gmail.com',
      realm: 'global',
      domain: 'www.workbuddy.ai',
    })
  })

  it('accepts a Bearer prefix, quotes, and several tokens at once', () => {
    const parsed = parseImport('Bearer ' + DOMESTIC + '\n"' + GLOBAL + '"\n')
    expect(parsed.rejected).toEqual([])
    expect(parsed.credentials.map(entry => entry.uid)).toEqual([
      '109d22b6-5b71-4a47-ad6a-376f30242363',
      'aac2ac1b-f972-4bfb-8240-b516b2fca78e',
    ])
  })

  it('reads a cockpit export, converting millisecond expiry to seconds', () => {
    const parsed = parseImport(JSON.stringify([{
      uid: 'u-1',
      nickname: 'A',
      access_token: DOMESTIC,
      refresh_token: 'rt-1',
      expires_at: 1795395042000,
      domain: '',
    }]))
    expect(parsed.rejected).toEqual([])
    expect(parsed.credentials[0]).toMatchObject({
      uid: 'u-1',
      nickname: 'A',
      refreshToken: 'rt-1',
      expiresAt: 1795395042,
      realm: 'cn',
    })
  })

  it('reads a nested auths/*.json document', () => {
    const parsed = parseImport(JSON.stringify({
      auth: { accessToken: DOMESTIC, refreshToken: '', expiresAt: 1795395042, domain: '', realm: 'cn' },
      account: { uid: 'nested-uid', nickname: 'N' },
    }))
    expect(parsed.credentials[0]).toMatchObject({ uid: 'nested-uid', nickname: 'N', refreshToken: '', expiresAt: 1795395042 })
  })

  it('falls back to the token claims for a flat record without a uid', () => {
    const parsed = parseImport(JSON.stringify({ access_token: DOMESTIC }))
    expect(parsed.credentials[0]).toMatchObject({ uid: '109d22b6-5b71-4a47-ad6a-376f30242363', realm: 'cn' })
  })

  it('rejects text that is not a credential, with a reason worth reading', () => {
    const parsed = parseImport('not-a-token')
    expect(parsed.credentials).toEqual([])
    expect(parsed.rejected[0]?.reason).toContain('not a JWT')
  })

  it('rejects a token without a sub claim', () => {
    const parsed = parseImport(jwt({ iss: 'https://www.codebuddy.cn/auth/realms/copilot', exp: 1 }))
    expect(parsed.credentials).toEqual([])
    expect(parsed.rejected[0]?.reason).toContain('no sub claim')
  })

  it('rejects a uid that could escape the auths directory', () => {
    const parsed = parseImport(JSON.stringify({ uid: '../../evil', access_token: DOMESTIC }))
    expect(parsed.credentials).toEqual([])
    expect(parsed.rejected[0]?.reason).toContain('uid may only use')
  })

  it('builds the auths document the gateway itself would write', () => {
    const credential = parseImport(DOMESTIC).credentials[0]
    expect(credential).toBeDefined()
    expect(authFileDocument(credential!)).toEqual({
      auth: { accessToken: DOMESTIC, refreshToken: '', expiresAt: 1795395042, domain: '', realm: 'cn' },
      account: { uid: '109d22b6-5b71-4a47-ad6a-376f30242363', enterpriseId: '', nickname: '低调哥' },
    })
  })

  it('returns nothing for an empty paste', () => {
    expect(parseImport('   ')).toEqual({ credentials: [], rejected: [] })
  })

  it('decodes claims and refuses a malformed payload', () => {
    expect(decodeJwtClaims('a.b.c')).toBeUndefined()
    expect(credentialFromToken('')).toBe('empty token')
  })
})
