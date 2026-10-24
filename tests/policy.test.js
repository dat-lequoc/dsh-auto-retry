import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULTS, delayFor, matchPattern } from '../lib/policy.js'

test('default patterns match the reported Codex and Kiro failures', () => {
  const codex = 'Codex error: Our servers are currently overloaded. Please try again later.\n[Codex diagnostics: {"httpStatus":200}]'
  const kiro = 'Kiro service exception error: {"message":"Encountered an unexpected error when processing the request, please try again."}'
  const codexGeneric = 'Codex error: An error occurred while processing your request. You can retry your request, or contact us through our help center at help.openai.com if the error persists. Please include the request ID 649eef57-c20d-4711-ac37-2a390e8c0ee9 in your message.\n[Codex diagnostics: {"httpStatus":200}]'
  assert.ok(matchPattern(codex, DEFAULTS.patterns))
  assert.ok(matchPattern(kiro, DEFAULTS.patterns))
  assert.ok(matchPattern(codexGeneric, DEFAULTS.patterns))
  assert.equal(matchPattern('401 Unauthorized', DEFAULTS.patterns), undefined)
})

test('blank patterns never match everything', () => {
  assert.equal(matchPattern('anything', ['', '   ']), undefined)
})

test('backoff follows the schedule and repeats the last delay', () => {
  const schedule = [5, 30, 60]
  assert.deepEqual([1, 2, 3, 4, 9].map(n => delayFor(n, schedule)), [5000, 30000, 60000, 60000, 60000])
})
