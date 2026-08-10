# Usage

Open **Settings → Usage** to see token activity from the provider CLIs installed on each connected
environment. T3 Code currently reports usage for Claude Code, Codex, and OpenCode.

The page reads each provider's local session data and groups it by day, provider, and model. It can
therefore include work started outside T3 Code. Prompt text, responses, and tool output are not sent
to the client; environments return only aggregated usage totals.

Cost is an API-equivalent estimate, not necessarily the amount charged by a subscription plan. When
a provider records a cost, T3 Code uses it. Otherwise it estimates cost from the available model rate
table and marks models it cannot price.

When multiple connected environments point to the same provider data on one machine, T3 Code counts
that source once to avoid duplicate totals.
