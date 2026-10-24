/** Pure retry decisions, kept separate so they can be tested without a Harness. */

export const DEFAULTS = {
  enabled: true,
  patterns: [
    'servers are currently overloaded',
    'unexpected error when processing the request',
    'too many pending requests',
    // OpenAI's generic transient failure: "... You can retry your request, or contact us ..."
    'an error occurred while processing your request',
  ],
  delaysSeconds: [5, 30, 60, 120, 300],
  maxRetries: 10,
}

/**
 * Find the first pattern contained in the message, ignoring case.
 * Blank patterns are skipped so an empty line can never match every error.
 * @param {string} message - the provider failure message.
 * @param {readonly string[]} patterns - user-configured substrings.
 * @returns {string | undefined} the matching pattern.
 */
export function matchPattern(message, patterns) {
  const text = String(message ?? '').toLowerCase()
  return patterns.find(pattern => pattern.trim() !== '' && text.includes(pattern.trim().toLowerCase()))
}

/**
 * Wait before one retry: the Nth retry uses the Nth delay, and the last delay repeats.
 * @param {number} retry - 1-based retry number.
 * @param {readonly number[]} delaysSeconds - configured schedule.
 * @returns {number} delay in milliseconds.
 */
export function delayFor(retry, delaysSeconds) {
  const list = delaysSeconds.length > 0 ? delaysSeconds : DEFAULTS.delaysSeconds
  return list[Math.min(retry, list.length) - 1] * 1000
}

/**
 * Identify one retry chain's settings; a config edit mid-chain starts a new chain,
 * which keeps `llm/retry` numbering consistent for session readers.
 * @param {{ patterns: readonly string[], delaysSeconds: readonly number[], maxRetries: number }} settings
 * @returns {string}
 */
export function policyKey({ patterns, delaysSeconds, maxRetries }) {
  return JSON.stringify(['dsh-auto-retry', [...patterns].sort(), delaysSeconds, maxRetries])
}
