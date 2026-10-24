/**
 * The gateway configuration this plugin writes on a fresh install.
 *
 * Copied field-for-field from a working workbuddy2api-panel install: every policy
 * the panel ships with (pool weights, breakers, cooldowns, the schedule of
 * check-in / keepalive / growth tasks, sticky sessions, prompt passthrough) is
 * part of the default. A minimal document - just listen address and key - runs,
 * but silently drops all of that: the scheduled tasks never fire and the pool
 * behaves like its zero values.
 *
 * Only four fields are the plugin business, and gatewayConfigDocument()
 * overwrites them: api_key, listen, auth_dir, state_file.
 *
 * @module dsh-workbuddy-panel/default-config
 */

/** The document a fresh install starts from. */
export const DEFAULT_GATEWAY_CONFIG: Readonly<Record<string, unknown>> =   {
    "api_key": "",
    "auth_dir": "./auths",
    "cn": {
      "chat_base": ""
    },
    "cooldown": {
      "soft_rate": "600s",
      "soft_rate_max": "2h"
    },
    "dns_servers": [],
    "features": {
      "sanitize_blacklist_fingerprints": true
    },
    "global": {
      "billing_base": "",
      "chat_base": "",
      "enabled": true
    },
    "listen": ":7863",
    "logging": {
      "request_archive_enabled": true,
      "request_archive_max_mb": 100,
      "request_client_info": true,
      "request_retention_days": 7
    },
    "models": {
      "_comment": "hidden: 不对外暴露的模型黑名单。裸名=两域都藏；\"cn:xxx\"/\"global:xxx\"=只藏该域。/v1/models 列表过滤 + chat 点名拒绝，面板保存后热生效。",
      "hidden": []
    },
    "panel": {
      "package_detail_limit": 5
    },
    "pool": {
      "account_order": {
        "domestic": [],
        "international": []
      },
      "breaker_cooldown": "30m",
      "breaker_cooldown_max": "6h",
      "breaker_threshold": 3,
      "cost_explore_interval": "30m",
      "credit_floor": 100,
      "cross_domain_fallback": false,
      "degrade_cooldown": "10m",
      "degrade_cooldown_max": "2h",
      "degrade_threshold": 5,
      "expiring_soon": "168h",
      "idle_weight_max": 5,
      "idle_weight_per_hour": 0.5,
      "max_in_flight": 3,
      "max_in_flight_global": 2,
      "prefer_expiring": true,
      "strategy": {
        "domestic": "weighted_random",
        "international": "weighted_random"
      }
    },
    "prompt": {
      "file": "",
      "mode": "passthrough"
    },
    "schedule": {
      "activity_enabled": true,
      "activity_hours": [
        10
      ],
      "balance_refresh_enabled": true,
      "balance_refresh_minutes": 5,
      "blackcat_enabled": true,
      "blackcat_hours": [
        23
      ],
      "checkin_enabled": true,
      "checkin_hours": [
        9,
        21
      ],
      "growth_enabled": true,
      "growth_hours": [
        1
      ],
      "include_disabled_in_tasks": false,
      "keepalive_enabled": true,
      "keepalive_hours": [
        22
      ],
      "task_sweep_enabled": true,
      "task_sweep_minutes": 15,
      "travel_enabled": true,
      "travel_hours": [
        9,
        21
      ]
    },
    "server": {
      "read_timeout": "300s"
    },
    "session_sticky": {
      "enabled": true,
      "gc_interval": "5m",
      "ttl": "30m"
    },
    "state_file": "./data/state.json",
    "upstash": {
      "token": "",
      "url": ""
    },
    "upstream": {
      "chat_fingerprint": "",
      "cli_version": "",
      "client_name": "",
      "client_version": "",
      "device_token": "",
      "device_token_file": "",
      "header_timeout_seconds": 120,
      "idle_timeout_seconds": 300,
      "passthrough_ip": false,
      "timeout_seconds": 120,
      "ua_client_name": "",
      "user_agent": ""
    }
  }

/** What the plugin decides for one install. */
export interface GatewayConfigOptions {
  /** The admin key the route will use. */
  apiKey: string
  /** Loopback port. */
  port: number
  /** Accounts directory; empty keeps the workdir default. */
  authDir: string
}

/** Deep copy of the default document with the four owned fields applied. */
export function gatewayConfigDocument(options: GatewayConfigOptions): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(DEFAULT_GATEWAY_CONFIG)) as Record<string, unknown>
  return {
    ...copy,
    api_key: options.apiKey,
    listen: ':' + String(options.port),
    auth_dir: options.authDir === '' ? './auths' : options.authDir,
    state_file: './data/state.json',
  }
}

/**
 * Merge an existing gateway document over the defaults.
 *
 * Inheriting is what makes pointing the plugin at an existing gateway lossless:
 * the user own pool weights, hidden models and upstream settings survive, while
 * the four owned fields still follow this install.
 */
export function inheritGatewayConfig(
  existing: Record<string, unknown> | undefined,
  options: GatewayConfigOptions,
): Record<string, unknown> {
  // The base is the existing document, NOT the default one: spreading the
  // defaults over it would replace whole sections (models.hidden, pool weights)
  // with the template values. Only the four owned fields are set here.
  const base = existing === undefined
    ? gatewayConfigDocument(options)
    : JSON.parse(JSON.stringify(existing)) as Record<string, unknown>
  return {
    ...base,
    api_key: options.apiKey,
    listen: ':' + String(options.port),
    auth_dir: options.authDir === '' ? './auths' : options.authDir,
    state_file: './data/state.json',
  }
}
