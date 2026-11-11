# dsh-dr-panda-mcp

[English](./README.md) · **中文**

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 **carrier 插件**，把已部署的 [DrPanda MCP](https://github.com/linyu19872008/dr-panda-mcp) 通过 Streamable HTTP 桥进 Harness。

本仓库**不内嵌** DrPanda，只挂官方 `@deepseek-ai/dsh-mcp-client`。

## 安装

```bash
dsh plugin --profile web add github:linyu19872008/dsh-dr-panda-mcp
```

重启 DSH，打开 **插件 → dsh-dr-panda-mcp**（或 **设置 → DrPanda MCP**）：

1. 填写 **MCP URL**（默认 `http://127.0.0.1:8111/mcp`）
2. 粘贴 DrPanda「我的」页面创建的 **Bearer Token**
3. 点 **保存**，再点 **测试连接**
4. 调用 `mcp__drpanda__systems_status`（失败时先调 `drpanda_mcp_doctor`）

Token 写入 DSH credentials 键 `DR_PANDA_MCP_TOKEN`（不会进 patch）。URL 同步到 `DR_PANDA_MCP_URL`，变更走官方 bridge 热重连。

## 前置条件

1. 带内置 `@deepseek-ai/dsh-mcp-client` 的 DeepSeek Harness  
2. 已运行的 [dr-panda-mcp](https://github.com/linyu19872008/dr-panda-mcp)  
3. 「我的」页面生成的 MCP Token（网页 Session 不能代替）

## 高级 / CI（环境变量）

无 UI 场景可用：

| 变量 | 默认 | 含义 |
| --- | --- | --- |
| `DR_PANDA_MCP_URL` | `http://127.0.0.1:8111/mcp` | MCP 端点 |
| `DR_PANDA_MCP_TOKEN` | _(空)_ | Bearer Token（UI 已存值优先于 env） |
| `DR_PANDA_MCP_SERVER` | `drpanda` | 工具命名空间 |

在插件页清除已存 Token 后，才会重新回退到环境变量。

## 开发

```bash
npm test
npm run check
```

## 许可

MIT
