import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildReport,
  healthzUrlFrom,
  listBridgeTools,
  probeHealthz,
  probeMcpInitialize,
  resolveConfig,
} from "../lib/index.js";

describe("resolveConfig", () => {
  it("defaults url and serverName when env is empty", () => {
    const prev = {
      url: process.env.DR_PANDA_MCP_URL,
      token: process.env.DR_PANDA_MCP_TOKEN,
      server: process.env.DR_PANDA_MCP_SERVER,
    };
    try {
      delete process.env.DR_PANDA_MCP_URL;
      delete process.env.DR_PANDA_MCP_TOKEN;
      delete process.env.DR_PANDA_MCP_SERVER;
      const cfg = resolveConfig();
      assert.equal(cfg.url, "http://127.0.0.1:8111/mcp");
      assert.equal(cfg.serverName, "drpanda");
      assert.equal(cfg.token, "");
      assert.ok(cfg.notes.some((n) => n.includes("DR_PANDA_MCP_TOKEN")));
    } finally {
      restoreEnv(prev);
    }
  });

  it("rejects invalid server names", () => {
    const prev = { server: process.env.DR_PANDA_MCP_SERVER };
    try {
      process.env.DR_PANDA_MCP_SERVER = "bad name!";
      const cfg = resolveConfig();
      assert.equal(cfg.serverName, "drpanda");
      assert.ok(cfg.notes.some((n) => n.includes("DR_PANDA_MCP_SERVER")));
    } finally {
      if (prev.server === undefined) delete process.env.DR_PANDA_MCP_SERVER;
      else process.env.DR_PANDA_MCP_SERVER = prev.server;
    }
  });
});

describe("healthzUrlFrom", () => {
  it("rewrites /mcp to /healthz", () => {
    assert.equal(healthzUrlFrom("http://127.0.0.1:8111/mcp"), "http://127.0.0.1:8111/healthz");
    assert.equal(
      healthzUrlFrom("https://mcp.example.com/prefix/mcp"),
      "https://mcp.example.com/prefix/healthz",
    );
  });

  it("returns null for invalid URLs", () => {
    assert.equal(healthzUrlFrom("not a url"), null);
  });
});

describe("listBridgeTools", () => {
  it("filters by namespace prefix", () => {
    const tools = {
      list() {
        return [
          { name: "mcp__drpanda__systems_status" },
          { name: "mcp__other__x" },
          "drpanda_mcp_doctor",
        ];
      },
    };
    assert.deepEqual(listBridgeTools(tools, "drpanda"), ["mcp__drpanda__systems_status"]);
  });
});

describe("probes", () => {
  it("probeHealthz reports ok", async () => {
    const result = await probeHealthz("http://example.test/healthz", async () => ({
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
    }));
    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
  });

  it("probeMcpInitialize skips without token", async () => {
    const result = await probeMcpInitialize("http://example.test/mcp", "");
    assert.equal(result.ok, false);
    assert.match(result.detail, /skipped/i);
  });

  it("probeMcpInitialize maps 401", async () => {
    const result = await probeMcpInitialize("http://example.test/mcp", "bad", async () => ({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    }));
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
    assert.match(result.detail, /auth failed/i);
  });
});

describe("buildReport", () => {
  it("includes next steps and env summary", async () => {
    const prev = {
      url: process.env.DR_PANDA_MCP_URL,
      token: process.env.DR_PANDA_MCP_TOKEN,
    };
    try {
      process.env.DR_PANDA_MCP_URL = "http://127.0.0.1:8111/mcp";
      process.env.DR_PANDA_MCP_TOKEN = "tok";
      const report = await buildReport({
        tools: { list: () => [] },
        fetchImpl: async () => {
          throw new Error("offline");
        },
      });
      assert.match(report, /drpanda_mcp_doctor|# dsh-dr-panda-mcp doctor/);
      assert.match(report, /DR_PANDA_MCP_TOKEN: set/);
      assert.match(report, /Next steps/);
    } finally {
      restoreEnv(prev);
    }
  });
});

function restoreEnv(prev) {
  for (const [key, value] of Object.entries({
    DR_PANDA_MCP_URL: prev.url,
    DR_PANDA_MCP_TOKEN: prev.token,
    DR_PANDA_MCP_SERVER: prev.server,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
