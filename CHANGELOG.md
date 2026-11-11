# Changelog

## 0.2.0

- Plugin detail page + Settings → DrPanda MCP form for MCP URL and Bearer Token.
- Token stored as DSH credential `DR_PANDA_MCP_TOKEN`; URL synced to `DR_PANDA_MCP_URL` for official `expandTemplates` hot-reconnect.
- Test connection button (healthz + MCP initialize).
- Bridge patch uses credentials + `expandTemplates`; env vars remain CI/fallback.
- README primary path is the UI; export instructions moved to Advanced.

## 0.1.0

- Initial carrier bundle: mounts `@deepseek-ai/dsh-mcp-client` over Streamable HTTP.
- Host tool `drpanda_mcp_doctor` probes env, `/healthz`, and MCP `initialize`.
- Env knobs: `DR_PANDA_MCP_URL`, `DR_PANDA_MCP_TOKEN`, `DR_PANDA_MCP_SERVER`.
