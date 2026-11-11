import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  buildReport,
  healthzUrlFrom,
  listBridgeTools,
  resolveConfig,
} from "../lib/index.js";
import { probeHealthz, probeMcpInitialize } from "../lib/probe.js";
import {
  DEFAULT_URL,
  normalizeSettings,
  resolveUrl,
  settingsPath,
  writeSettings,
} from "../lib/settings.js";

const originalHome = process.env.DSH_HOME;
const temps = [];

afterEach(() => {
  for (const dir of temps.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  if (originalHome === undefined) delete process.env.DSH_HOME;
  else process.env.DSH_HOME = originalHome;
  delete process.env.DR_PANDA_MCP_URL;
  delete process.env.DR_PANDA_MCP_TOKEN;
  delete process.env.DR_PANDA_MCP_SERVER;
});

function tempHome() {
  const dir = mkdtempSync(join(tmpdir(), "dpm-"));
  temps.push(dir);
  process.env.DSH_HOME = dir;
  return dir;
}

describe("normalizeSettings", () => {
  it("clamps invalid values", () => {
    const { settings, notes } = normalizeSettings({
      mcpUrl: "not-a-url",
      serverName: "bad name",
      toolCallTimeoutMs: 1,
    });
    assert.equal(settings.mcpUrl, DEFAULT_URL);
    assert.equal(settings.serverName, "drpanda");
    assert.equal(settings.toolCallTimeoutMs, 120000);
    assert.ok(notes.length >= 2);
  });
});

describe("resolveUrl", () => {
  it("prefers settings over env", () => {
    process.env.DR_PANDA_MCP_URL = "http://env.example/mcp";
    const got = resolveUrl({
      version: 1,
      mcpUrl: "http://settings.example/mcp",
      serverName: "drpanda",
      toolCallTimeoutMs: 120000,
    });
    assert.equal(got.url, "http://settings.example/mcp");
    assert.equal(got.source, "settings");
  });

  it("falls back to env then default", () => {
    assert.equal(resolveUrl(null).source, "default");
    process.env.DR_PANDA_MCP_URL = "http://env.example/mcp";
    assert.equal(resolveUrl(null).url, "http://env.example/mcp");
  });
});

describe("settings persistence", () => {
  it("round-trips through DSH_HOME", () => {
    const home = tempHome();
    const written = writeSettings({
      mcpUrl: "http://127.0.0.1:9000/mcp",
      serverName: "drpanda",
      toolCallTimeoutMs: 90000,
    });
    assert.equal(written.settings.mcpUrl, "http://127.0.0.1:9000/mcp");
    assert.equal(settingsPath(home), join(home, "dsh-dr-panda-mcp.settings.json"));
    const cfg = resolveConfig();
    assert.equal(cfg.url, "http://127.0.0.1:9000/mcp");
  });
});

describe("resolveConfig", () => {
  it("defaults url and serverName when env is empty", () => {
    tempHome();
    const cfg = resolveConfig();
    assert.equal(cfg.url, "http://127.0.0.1:8111/mcp");
    assert.equal(cfg.serverName, "drpanda");
  });
});

describe("healthzUrlFrom", () => {
  it("rewrites /mcp to /healthz", () => {
    assert.equal(healthzUrlFrom("http://127.0.0.1:8111/mcp"), "http://127.0.0.1:8111/healthz");
  });
});

describe("listBridgeTools", () => {
  it("filters by namespace prefix", () => {
    const tools = {
      list() {
        return [{ name: "mcp__drpanda__systems_status" }, { name: "mcp__other__x" }];
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
  });

  it("probeMcpInitialize maps 401", async () => {
    const result = await probeMcpInitialize("http://example.test/mcp", "bad", "0.2.0", async () => ({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    }));
    assert.equal(result.state, "unauthorized");
  });
});

describe("buildReport", () => {
  it("includes next steps", async () => {
    tempHome();
    process.env.DR_PANDA_MCP_TOKEN = "tok";
    const report = await buildReport({
      tools: { list: () => [] },
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });
    assert.match(report, /Next steps/);
    assert.match(report, /DR_PANDA_MCP_TOKEN: set/);
  });
});
