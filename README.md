# dsh-dr-panda-mcp

**English** · [中文](./README.zh.md)

DeepSeek Harness **carrier plugin** for [DrPanda MCP](https://github.com/linyu19872008/dr-panda-mcp) — a read-only production troubleshooting service.

This package does **not** embed DrPanda. It mounts the official in-box `@deepseek-ai/dsh-mcp-client` bridge against your already-running DrPanda `/mcp` endpoint over Streamable HTTP.

```text
DeepSeek Harness
  └─ dsh-dr-panda-mcp (this plugin)
       ├─ plugin page / Settings → DrPanda MCP   (URL + Token form)
       ├─ drpanda_mcp_doctor
       └─ @deepseek-ai/dsh-mcp-client
            url/token via DSH credentials (hot-reload)
                 └─ dr-panda-mcp (deploy separately)
```

## Install

```bash
dsh plugin --profile web add github:linyu19872008/dsh-dr-panda-mcp
```

Restart DSH, then open **Plugins → dsh-dr-panda-mcp** (or **Settings → DrPanda MCP**):

1. Set **MCP URL** (default `http://127.0.0.1:8111/mcp`)
2. Paste a **Bearer Token** from DrPanda → **My account**
3. Click **Save**, then **Test connection**
4. Call `mcp__drpanda__systems_status` (or `drpanda_mcp_doctor` if something fails)

Token is stored as DSH credential `DR_PANDA_MCP_TOKEN` (not in the patch file). URL is synced to `DR_PANDA_MCP_URL` so changes hot-reconnect through the official MCP client.

## What the agent gets

| Tool | Purpose |
| --- | --- |
| `mcp__drpanda__systems_status` | Environments / targets / capabilities |
| `mcp__drpanda__mysql_*` / `mongo_*` / `es_*` / `redis_*` | Datastores |
| `mcp__drpanda__cls_*` / `gitlab_*` | Logs & code |
| `mcp__drpanda__kafka_*` / `rabbit_*` | Queues |
| `mcp__drpanda__nacos_*` / `jenkins_*` | Config & CI |

Plus host tool `drpanda_mcp_doctor`.

## Requirements

1. DeepSeek Harness with in-box `@deepseek-ai/dsh-mcp-client`
2. A running [dr-panda-mcp](https://github.com/linyu19872008/dr-panda-mcp) instance
3. An MCP Bearer token from DrPanda → My account

## Advanced / CI (environment variables)

Optional overrides when you cannot use the UI (headless CI, etc.):

| Variable | Default | Meaning |
| --- | --- | --- |
| `DR_PANDA_MCP_URL` | `http://127.0.0.1:8111/mcp` | MCP endpoint (also used as credential key) |
| `DR_PANDA_MCP_TOKEN` | _(empty)_ | Bearer token (credential key; UI store outranks env) |
| `DR_PANDA_MCP_SERVER` | `drpanda` | Tool namespace |

```bash
export DR_PANDA_MCP_URL=http://127.0.0.1:8111/mcp
export DR_PANDA_MCP_TOKEN='<token>'
dsh web
```

A token saved in the UI **outranks** the environment until you clear it on the plugin page.

## Development

```bash
npm test
npm run check
```

## License

MIT
