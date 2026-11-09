# dsh-dr-panda-mcp

[English](./README.md) · **中文**

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 **carrier 插件**，把已部署的 [DrPanda MCP](https://github.com/linyu19872008/dr-panda-mcp)（只读生产排查服务）通过 Streamable HTTP 桥进 Harness。

本仓库**不内嵌** DrPanda。它只在 profile 里挂官方自带的 `@deepseek-ai/dsh-mcp-client`，指向你自己的 `/mcp`。

```text
DeepSeek Harness
  └─ dsh-dr-panda-mcp（本插件）
       ├─ drpanda_mcp_doctor          （诊断工具）
       └─ @deepseek-ai/dsh-mcp-client
            transport: streamable-http
            url:       $DR_PANDA_MCP_URL
            headers:   Authorization: Bearer $DR_PANDA_MCP_TOKEN
                 └─ dr-panda-mcp（需单独部署的 Python 服务）
```

## Agent 能用到什么

桥接通后，工具名形如 `mcp__drpanda__*`，例如：

| 工具 | 用途 |
| --- | --- |
| `mcp__drpanda__systems_status` | 列出环境 / 目标与最近探活 |
| `mcp__drpanda__mysql_query` / `mysql_explain` | 只读 MySQL |
| `mcp__drpanda__cls_search` / `cls_context` | CLS 日志检索 |
| `mcp__drpanda__gitlab_search_code` | 代码搜索 |
| `mcp__drpanda__kafka_lag` / `rabbit_queues` | 消息堆积 |
| `mcp__drpanda__mongo_*` / `es_*` / `redis_*` / `nacos_*` / `jenkins_*` | 其它已登记目标 |

另有宿主工具 `drpanda_mcp_doctor`：桥接工具缺失或 401 时先调它。

## 前置条件

1. **DeepSeek Harness**（内置 `@deepseek-ai/dsh-mcp-client`）。
2. 已运行的 **[dr-panda-mcp](https://github.com/linyu19872008/dr-panda-mcp)**（网页控制台 + `/mcp`）。
3. 在 DrPanda「我的」页面创建的 MCP Bearer Token（网页登录 Session **不能**代替）。

## 安装

```bash
dsh plugin --profile web add github:linyu19872008/dsh-dr-panda-mcp
```

或本地仓：

```bash
dsh plugin --profile web add ./dsh-dr-panda-mcp
```

为 DSH 进程导出凭证并重启：

```bash
export DR_PANDA_MCP_URL=http://127.0.0.1:8111/mcp
export DR_PANDA_MCP_TOKEN='<在「我的」页面创建的 Token>'

dsh web
```

核对：

```bash
dsh --profile web --dump-config | grep -A20 drpanda-mcp
```

让 Agent 先调 `drpanda_mcp_doctor`，再调 `mcp__drpanda__systems_status`。

## 配置

| 变量 | 默认 | 含义 |
| --- | --- | --- |
| `DR_PANDA_MCP_URL` | `http://127.0.0.1:8111/mcp` | Streamable HTTP 端点 |
| `DR_PANDA_MCP_TOKEN` | _(空)_ | Bearer Token（正式调用必需） |
| `DR_PANDA_MCP_SERVER` | `drpanda` | 工具命名空间 |

不要把真实 Token 写进仓库里的 `cordis.patch.yml`。

## 与 DrPanda 本体的关系

| 仓库 | 职责 |
| --- | --- |
| [linyu19872008/dr-panda-mcp](https://github.com/linyu19872008/dr-panda-mcp) | Python MCP + 网页控制台（PyPI：`dr-panda-mcp`） |
| **本仓库** | DSH 一键安装、bridge 配置、doctor |

安装本插件**不会**部署 DrPanda。请先部署服务、在控制台登记目标，再连 Harness。

## 开发

```bash
npm test
npm run check
```

## 许可

MIT
