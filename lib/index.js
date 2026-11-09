/**
 * dsh-dr-panda-mcp — host half of the carrier bundle.
 *
 * The actual MCP integration is declarative: `cordis.patch.yml` mounts the
 * official in-box `@deepseek-ai/dsh-mcp-client` against a running DrPanda
 * Streamable HTTP endpoint. This module registers one diagnostic tool,
 * `drpanda_mcp_doctor`, so the agent (and the operator) can see why
 * `mcp__drpanda__*` tools are missing or failing.
 *
 * Rules (same as every healthy DSH plugin):
 * 1. `apply()` never throws — a sync throw fails the loader fiber.
 * 2. Only inject services that every profile provides (`tools`).
 * 3. Zero runtime deps — no `@deepseek-ai/*` imports (those live in app.asar).
 *
 * Named exports only: a stray default export can collapse the Cordis
 * namespace and drop `inject` / `apply`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const name = "dsh-dr-panda-mcp";

const PACKAGE_ID = "dsh-dr-panda-mcp";
const TOOL_NAME = "drpanda_mcp_doctor";
const DEFAULT_URL = "http://127.0.0.1:8111/mcp";
const DEFAULT_SERVER = "drpanda";
const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const PROBE_TIMEOUT_MS = 8000;

const packageRoot = dirname(fileURLToPath(new URL("..", import.meta.url)));

/**
 * @param {string} key
 * @returns {string}
 */
function envString(key) {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * @returns {{ url: string, token: string, serverName: string, notes: string[] }}
 */
export function resolveConfig() {
  const notes = [];
  const url = envString("DR_PANDA_MCP_URL") || DEFAULT_URL;
  const token = envString("DR_PANDA_MCP_TOKEN");
  const rawServer = envString("DR_PANDA_MCP_SERVER");
  let serverName = DEFAULT_SERVER;
  if (rawServer) {
    if (SERVER_NAME_PATTERN.test(rawServer)) {
      serverName = rawServer;
    } else {
      notes.push(
        `DR_PANDA_MCP_SERVER=${JSON.stringify(rawServer)} is invalid; using ${JSON.stringify(DEFAULT_SERVER)}.`,
      );
    }
  }
  if (!envString("DR_PANDA_MCP_URL")) {
    notes.push(`DR_PANDA_MCP_URL is unset; defaulting to ${DEFAULT_URL}.`);
  }
  if (!token) {
    notes.push(
      "DR_PANDA_MCP_TOKEN is unset. Create a Bearer token in the DrPanda web console (My account) and export it before starting DSH.",
    );
  }
  return { url, token, serverName, notes };
}

/**
 * Derive the console /healthz URL from an /mcp endpoint.
 * @param {string} mcpUrl
 * @returns {string | null}
 */
export function healthzUrlFrom(mcpUrl) {
  try {
    const parsed = new URL(mcpUrl);
    const path = parsed.pathname.replace(/\/+$/, "");
    if (path.endsWith("/mcp")) {
      parsed.pathname = `${path.slice(0, -4)}/healthz` || "/healthz";
    } else {
      parsed.pathname = "/healthz";
    }
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * @returns {string}
 */
function selfVersion() {
  try {
    const raw = readFileSync(join(packageRoot, "package.json"), "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed.version === "string" ? parsed.version : "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * @param {unknown} ctx
 * @returns {(message: string) => void}
 */
function makeLogger(ctx) {
  return (message) => {
    try {
      ctx?.logger?.warn?.(`${PACKAGE_ID}: ${message}`);
    } catch {
      /* logging is best-effort */
    }
  };
}

/**
 * List registered bridge tools that match the expected namespace.
 * @param {object | undefined} tools
 * @param {string} serverName
 * @returns {string[]}
 */
export function listBridgeTools(tools, serverName) {
  const prefix = `mcp__${serverName}__`;
  const names = [];
  try {
    const list = typeof tools?.list === "function" ? tools.list() : null;
    if (Array.isArray(list)) {
      for (const item of list) {
        const name = typeof item === "string" ? item : item?.name;
        if (typeof name === "string" && name.startsWith(prefix)) names.push(name);
      }
    }
  } catch {
    /* listing is best-effort */
  }
  return names.sort();
}

/**
 * Probe /healthz without sending the MCP token.
 * @param {string} healthzUrl
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{ ok: boolean, status: number | null, body: string, error: string | null }>}
 */
export async function probeHealthz(healthzUrl, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") {
    return { ok: false, status: null, body: "", error: "fetch is unavailable in this runtime" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetchImpl(healthzUrl, {
      method: "GET",
      signal: controller.signal,
      headers: { accept: "application/json, text/plain;q=0.9,*/*;q=0.8" },
    });
    const body = (await response.text()).slice(0, 500);
    return { ok: response.ok, status: response.status, body, error: null };
  } catch (error) {
    return {
      ok: false,
      status: null,
      body: "",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send a minimal MCP initialize POST to verify Bearer auth + /mcp reachability.
 * @param {string} mcpUrl
 * @param {string} token
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{ ok: boolean, status: number | null, detail: string }>}
 */
export async function probeMcpInitialize(mcpUrl, token, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") {
    return { ok: false, status: null, detail: "fetch is unavailable in this runtime" };
  }
  if (!token) {
    return { ok: false, status: null, detail: "skipped: DR_PANDA_MCP_TOKEN is empty" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetchImpl(mcpUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: PACKAGE_ID, version: selfVersion() },
        },
      }),
    });
    const text = (await response.text()).slice(0, 400);
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        status: response.status,
        detail: `auth failed (${response.status}). Regenerate the MCP token in DrPanda → My account and update DR_PANDA_MCP_TOKEN.`,
      };
    }
    if (response.status === 503) {
      return {
        ok: false,
        status: 503,
        detail: "DrPanda returned 503 — finish the first-run setup wizard, then retry.",
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        detail: `HTTP ${response.status}: ${text || "(empty body)"}`,
      };
    }
    return { ok: true, status: response.status, detail: "initialize accepted" };
  } catch (error) {
    return {
      ok: false,
      status: null,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {object} options
 * @param {object} [options.tools]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<string>}
 */
export async function buildReport({ tools, fetchImpl = globalThis.fetch } = {}) {
  const { url, token, serverName, notes } = resolveConfig();
  const lines = [];
  lines.push(`# ${PACKAGE_ID} doctor`);
  lines.push("");
  lines.push(`- plugin version: ${selfVersion()}`);
  lines.push(`- serverName: ${serverName} (tools → mcp__${serverName}__*)`);
  lines.push(`- DR_PANDA_MCP_URL: ${url}`);
  lines.push(`- DR_PANDA_MCP_TOKEN: ${token ? `set (${token.length} chars)` : "UNSET"}`);
  lines.push("");

  if (notes.length > 0) {
    lines.push("## Config notes");
    for (const note of notes) lines.push(`- ${note}`);
    lines.push("");
  }

  const bridged = listBridgeTools(tools, serverName);
  lines.push("## Bridge tools currently registered");
  if (bridged.length === 0) {
    lines.push(
      `- none matching mcp__${serverName}__*. The official bridge may still be connecting, or the DrPanda service is unreachable / unauthorized.`,
    );
  } else {
    for (const name of bridged) lines.push(`- ${name}`);
  }
  lines.push("");

  const healthz = healthzUrlFrom(url);
  lines.push("## Probes");
  if (healthz) {
    const health = await probeHealthz(healthz, fetchImpl);
    if (health.ok) {
      lines.push(`- GET ${healthz} → ${health.status} OK`);
    } else if (health.status !== null) {
      lines.push(`- GET ${healthz} → ${health.status} ${health.body || health.error || ""}`.trimEnd());
    } else {
      lines.push(`- GET ${healthz} → failed: ${health.error}`);
      lines.push(
        "  Hint: start DrPanda first (`uvx dr-panda-mcp` or your deploy), then restart DSH or wait for reconnect.",
      );
    }
  } else {
    lines.push(`- could not derive /healthz from URL ${JSON.stringify(url)}`);
  }

  const mcp = await probeMcpInitialize(url, token, fetchImpl);
  if (mcp.ok) {
    lines.push(`- POST ${url} initialize → ${mcp.status} OK (${mcp.detail})`);
  } else if (mcp.status !== null) {
    lines.push(`- POST ${url} initialize → ${mcp.status}: ${mcp.detail}`);
  } else {
    lines.push(`- POST ${url} initialize → ${mcp.detail}`);
  }
  lines.push("");

  lines.push("## Next steps");
  lines.push("1. Deploy / start [dr-panda-mcp](https://github.com/linyu19872008/dr-panda-mcp) and finish setup.");
  lines.push('2. In the web console, open "My account" and create an MCP Bearer token.');
  lines.push("3. Export env vars for the DSH process:");
  lines.push("   export DR_PANDA_MCP_URL=http://127.0.0.1:8111/mcp");
  lines.push("   export DR_PANDA_MCP_TOKEN=<token>");
  lines.push("4. Restart DSH (`dsh web`) so the bridge reloads.");
  lines.push(`5. Call systems_status via mcp__${serverName}__systems_status.`);
  lines.push("");

  return lines.join("\n");
}

/**
 * @param {object} ctx
 * @param {(message: string) => void} warn
 */
function registerDoctor(ctx, warn) {
  if (typeof ctx?.inject !== "function") return;
  try {
    ctx.inject(["tools"], (scoped) => {
      try {
        if (typeof scoped?.tools?.register !== "function") return;
        const dispose = scoped.tools.register({
          name: TOOL_NAME,
          description:
            "Diagnose the DrPanda MCP bridge bundled by dsh-dr-panda-mcp: URL/token env, /healthz reachability, /mcp Bearer auth, and which mcp__drpanda__* tools are registered. Use when production-troubleshooting tools are missing or return 401.",
          parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          output: {
            schema: {
              type: "object",
              properties: { report: { type: "string" } },
              required: ["report"],
              additionalProperties: false,
            },
            render(_args, value) {
              const report =
                typeof value?.report === "string" ? value.report : JSON.stringify(value, null, 2);
              return [{ type: "text", text: report }];
            },
          },
          async execute() {
            const report = await buildReport({ tools: scoped.tools });
            return { report };
          },
        });
        try {
          if (typeof dispose === "function" && typeof scoped.on === "function") {
            scoped.on("dispose", dispose);
          }
        } catch {
          /* disposal is best-effort */
        }
      } catch (error) {
        warn(`could not register ${TOOL_NAME}: ${String(error)}`);
      }
    });
  } catch (error) {
    warn(`could not inject the tools service: ${String(error)}`);
  }
}

/**
 * Plugin entry. Never throws.
 * @param {object} ctx
 */
export function apply(ctx) {
  try {
    const warn = makeLogger(ctx);
    const { notes } = resolveConfig();
    for (const note of notes) warn(note);
    registerDoctor(ctx, warn);
  } catch {
    /* apply() must not throw */
  }
}
