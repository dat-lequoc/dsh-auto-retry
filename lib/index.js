/**
 * dsh-auto-retry: retry a failed model request when its error message matches
 * a configured pattern, on a fixed backoff schedule (5s, 30s, 60s, ...).
 *
 * It runs on the agent loop's `agent/request-error` waterfall, the same
 * extension point as the built-in `@deepseek-ai/dsh-llm-retry`. Failures the
 * built-in policy already retries (RATE_LIMIT, SERVER, ...) reach this listener
 * only after that budget is spent; everything else (PI_AI_ERROR, Kiro service
 * exceptions) is decided here. Each attempt is recorded with the built-in
 * `llm/retry` / `llm/retry-started` events under this plugin's own policy key,
 * so the chat shows the usual retry countdown and token accounting stays right.
 */

import { randomUUID } from 'node:crypto'
import z from '@deepseek-ai/schemastery'
import { DEFAULTS, delayFor, matchPattern, policyKey } from './policy.js'

export const name = 'dsh-auto-retry'

// Every field is volatile: edits apply to the next failure without a reload,
// and the Settings service exposes them to the Plugins page form.
export const Config = z.object({
  enabled: z.boolean().default(DEFAULTS.enabled)
    .description('Retry matching failures automatically.').volatile(),
  patterns: z.array(z.string()).default(DEFAULTS.patterns)
    .description('Case-insensitive substrings of the error message that trigger a retry.').volatile(),
  delaysSeconds: z.array(z.natural().max(86_400)).default(DEFAULTS.delaysSeconds)
    .description('Seconds to wait before each retry; the last value repeats.').volatile(),
  maxRetries: z.natural().default(DEFAULTS.maxRetries)
    .description('Retries per failed step; 0 retries without a limit.').volatile(),
})

const read = value => (typeof value?.get === 'function' ? value.get() : value)

function settingsOf(config) {
  return {
    enabled: read(config.enabled) ?? DEFAULTS.enabled,
    patterns: read(config.patterns) ?? DEFAULTS.patterns,
    delaysSeconds: read(config.delaysSeconds) ?? DEFAULTS.delaysSeconds,
    maxRetries: read(config.maxRetries) ?? DEFAULTS.maxRetries,
  }
}

/** Resolve true after the delay, or false as soon as the signal aborts. */
function sleep(ms, signal) {
  if (signal.aborted) return Promise.resolve(false)
  return new Promise((resolve) => {
    const onAbort = () => { clearTimeout(timer); resolve(false) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(true) }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export function apply(ctx, config = {}) {
  const lifetime = new AbortController()
  const active = new Set()
  // Per-session retry chain for the currently failing step. The turn closes on
  // restart, so an in-memory chain never has to resume across processes.
  const chains = new WeakMap()

  async function recover({ agent, turn, step, provider, failure, signal }, next) {
    const settings = settingsOf(config)
    if (!settings.enabled || signal.aborted || !matchPattern(failure.message, settings.patterns)) return next()

    const key = policyKey(settings)
    const previous = chains.get(agent.session)
    const same = previous !== undefined && previous.turn === turn && previous.step === step
      && previous.provider === provider && previous.key === key
    const retry = same ? previous.retry + 1 : 1
    if (settings.maxRetries > 0 && retry > settings.maxRetries) return next()

    const fused = AbortSignal.any([signal, lifetime.signal])
    if (fused.aborted) return undefined
    const retryId = same ? previous.retryId : randomUUID()
    const delayMs = delayFor(retry, settings.delaysSeconds)
    // Durable before the wait, exactly like the built-in executor.
    agent.session.append('llm/retry', {
      retryId, turn, step, provider, policyKey: key, retry, delayMs, failure,
      ...settings.maxRetries > 0 ? { mode: 'normal', maxRetries: settings.maxRetries } : { mode: 'always' },
    })
    chains.set(agent.session, { turn, step, provider, key, retry, retryId })
    if (!await sleep(delayMs, fused)) return undefined
    agent.session.append('llm/retry-started', { retryId, turn, step, retry })
    return { kind: 'retry' }
  }

  ctx.on('agent/request-error', (payload, next) => {
    // A waterfall may hold this callback past disposal; never start a new wait then.
    if (lifetime.signal.aborted) return Promise.resolve(undefined)
    const tracked = recover(payload, next).finally(() => active.delete(tracked))
    active.add(tracked)
    return tracked
  })

  ctx.effect(() => async () => {
    lifetime.abort(new Error('dsh-auto-retry disposed'))
    await Promise.allSettled([...active])
  }, 'dsh-auto-retry: abort and drain active waits')
}
