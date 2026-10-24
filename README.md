# dsh-auto-retry

Automatically retries a failed model request in DeepSeek Harness when its error message matches one of your patterns, so transient provider errors no longer end the turn and wait for you to type "continue".

The built-in `@deepseek-ai/dsh-llm-retry` retries only by error code (`RATE_LIMIT`, `SERVER`, `TIMEOUT`, ...). Many transient failures arrive with a generic code instead, for example:

```
Codex error: Our servers are currently overloaded. Please try again later.
Codex error: An error occurred while processing your request. You can retry your request, ...
Kiro service exception error: {"message":"Encountered an unexpected error when processing the request, please try again."}
```

This plugin matches on the message text and retries those on a backoff schedule. Errors the built-in policy already handles keep its behavior.

## Install

```sh
dsh plugin --profile web add github:dat-lequoc/dsh-auto-retry
```

## Configure

Settings → Plugins → Auto Retry → configure the row. Changes apply to the next failure without a restart.

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Turn automatic retry on or off. |
| `patterns` | `servers are currently overloaded`, `unexpected error when processing the request`, `too many pending requests`, `an error occurred while processing your request` | Case-insensitive substrings of the error message. |
| `delaysSeconds` | `[5, 30, 60, 120, 300]` | Wait before each retry; the last value repeats. |
| `maxRetries` | `10` | Retries per failed step; `0` retries until success or you stop the turn. |

The same fields can be set in your profile `cordis.patch.yml`:

```yaml
- id: dsh-auto-retry
  config:
    patterns:
      - servers are currently overloaded
    delaysSeconds: [5, 30, 60]
    maxRetries: 0
```

Keep patterns specific. A broad pattern such as `error` also retries failures that cannot recover (bad credentials, invalid requests), and every retry is another billed request.

## How it works

The plugin listens on the agent loop's `agent/request-error` waterfall, after the built-in retry. It records each attempt with the standard `llm/retry` / `llm/retry-started` session events, so the chat shows the usual retry countdown, and stopping the turn cancels the wait.

## Development

```sh
pnpm install
pnpm test
```

## License

MIT
