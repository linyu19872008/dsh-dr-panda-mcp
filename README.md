# dsh-dr-panda-mcp

**English** · [中文](./README.zh.md)

DeepSeek Harness **carrier plugin** for [DrPanda MCP](https://github.com/linyu19872008/dr-panda-mcp) — a read-only production troubleshooting service.

This package does **not** embed DrPanda. It mounts the official in-box `@deepseek-ai/dsh-mcp-client` bridge against your already-running DrPanda `/mcp` endpoint over Streamable HTTP.

```text
DeepSeek Harness
  └─ dsh-dr-panda-mcp (this plugin)
       ├─ drpanda_mcp_doctor          (host diagnostic tool)
       └─ @deepseek-ai/dsh-mcp-client
            transport: streamable-http
            url:       $DR_PANDA_MCP_URL
            headers:   Authorization: Bearer $DR_PANDA_MCP_TOKEN
                 └─ dr-panda-mcp (Python service you deploy separately)
```

## What the agent gets

After the bridge connects, tools appear as `mcp__drpanda__*`, for example:

| Tool | Purpose |
| --- | --- |
| `mcp__drpanda__systems_status` | List environments / targets and recent probe results |
| `mcp__drpanda__mysql_query` / `mysql_explain` | Read-only MySQL |
| `mcp__drpanda__cls_search` / `cls_context` | CLS log search |
| `mcp__drpanda__gitlab_search_code` | Code search |
| `mcp__drpanda__kafka_lag` / `rabbit_queues` | Queue backlog |
| `mcp__drpanda__mongo_*` / `es_*` / `redis_*` / `nacos_*` / `jenkins_*` | Other registered targets |

Plus one host tool: `drpanda_mcp_doctor` — use it when the bridge tools are missing or return 401.

## Requirements

1. **DeepSeek Harness** with the in-box `@deepseek-ai/dsh-mcp-client` (Desktop or `dsh web`).
2. A running **[dr-panda-mcp](https://github.com/linyu19872008/dr-panda-mcp)** instance (web console + `/mcp`).
3. An MCP Bearer token from DrPanda → **My account** (web session cookies are not accepted by `/mcp`).

## Install

```bash
dsh plugin --profile web add github:linyu19872008/dsh-dr-panda-mcp
```

Or from a local checkout:

```bash
dsh plugin --profile web add ./dsh-dr-panda-mcp
```

Then export credentials for the DSH process and restart:

```bash
export DR_PANDA_MCP_URL=http://127.0.0.1:8111/mcp
export DR_PANDA_MCP_TOKEN='<token from DrPanda My account>'
# optional:
# export DR_PANDA_MCP_SERVER=drpanda

dsh web
```

Verify:

```bash
dsh --profile web --dump-config | grep -A20 drpanda-mcp
```

Ask the agent to call `drpanda_mcp_doctor`, then `mcp__drpanda__systems_status`.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `DR_PANDA_MCP_URL` | `http://127.0.0.1:8111/mcp` | Streamable HTTP MCP endpoint |
| `DR_PANDA_MCP_TOKEN` | _(empty)_ | Bearer token (required for real calls) |
| `DR_PANDA_MCP_SERVER` | `drpanda` | Tool namespace (`mcp__<name>__*`) |

Override the bridge row from your profile patch if you prefer not to use env vars:

```yaml
- id: drpanda-mcp-bridge
  config:
    serverName: drpanda
    transport: streamable-http
    url: https://mcp.example.com/mcp
    headers:
      Authorization: !!js '`Bearer ${process.env.DR_PANDA_MCP_TOKEN}`'
    toolCallTimeoutMs: 180000
    failOnStartupError: false
```

Never commit a live token into `cordis.patch.yml`.

## How this relates to DrPanda

| Repo | Role |
| --- | --- |
| [linyu19872008/dr-panda-mcp](https://github.com/linyu19872008/dr-panda-mcp) | Python MCP + web console (PyPI: `dr-panda-mcp`) |
| **this repo** | DSH one-click install + bridge config + doctor |

Installing this plugin does **not** deploy DrPanda. Deploy the service first, register targets in the console, then connect Harness.

## Development

```bash
npm test
npm run check
```

## License

MIT
