/**
 * The generated document must be the panel's document, not a minimal one: the
 * scheduled tasks and the pool policy only exist if they are written out.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_GATEWAY_CONFIG, gatewayConfigDocument, inheritGatewayConfig } from '../src/default-config.ts'

describe('default gateway config', () => {
  it('carries the schedule and pool policy the panel ships with', () => {
    const schedule = DEFAULT_GATEWAY_CONFIG['schedule'] as Record<string, unknown>
    const pool = DEFAULT_GATEWAY_CONFIG['pool'] as Record<string, unknown>
    const features = DEFAULT_GATEWAY_CONFIG['features'] as Record<string, unknown>
    expect(schedule['checkin_enabled']).toBe(true)
    expect(schedule['keepalive_enabled']).toBe(true)
    expect(pool['max_in_flight']).toBe(3)
    expect(features['sanitize_blacklist_fingerprints']).toBe(true)
    expect(DEFAULT_GATEWAY_CONFIG['session_sticky']).toBeDefined()
  })

  it('overwrites exactly the four owned fields', () => {
    const document = gatewayConfigDocument({ apiKey: 'k-1', port: 7999, authDir: './mine' })
    expect(document['api_key']).toBe('k-1')
    expect(document['listen']).toBe(':7999')
    expect(document['auth_dir']).toBe('./mine')
    expect(document['state_file']).toBe('./data/state.json')
    // the inherited policies survive the overwrite
    expect((document['schedule'] as Record<string, unknown>)['checkin_enabled']).toBe(true)
    // and the template itself is untouched
    expect(DEFAULT_GATEWAY_CONFIG['api_key']).toBe('')
  })

  it('keeps an existing install settings while owning the four fields', () => {
    const existing = { models: { hidden: ['cn:old'] }, pool: { max_in_flight: 9 }, api_key: 'theirs', listen: ':1' }
    const merged = inheritGatewayConfig(existing, { apiKey: 'ours', port: 7863, authDir: '' })
    expect(merged['api_key']).toBe('ours')
    expect(merged['listen']).toBe(':7863')
    expect((merged['models'] as Record<string, unknown>)['hidden']).toEqual(['cn:old'])
    expect((merged['pool'] as Record<string, unknown>)['max_in_flight']).toBe(9)
  })

  it('falls back to the full default when there is nothing to inherit', () => {
    const merged = inheritGatewayConfig(undefined, { apiKey: 'k', port: 7863, authDir: '' })
    expect((merged['schedule'] as Record<string, unknown>)['checkin_enabled']).toBe(true)
  })
})
