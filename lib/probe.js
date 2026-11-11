/**
 * Connectivity probes shared by doctor and the Settings "Test connection" button.
 */
import { PACKAGE_ID } from "./settings.js";

const PROBE_TIMEOUT_MS = 8000;

/**
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
 * @param {string} healthzUrl
 * @param {typeof fetch} [fetchImpl]
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
 * @param {string} mcpUrl
 * @param {string} token
 * @param {string} [clientVersion]
 * @param {typeof fetch} [fetchImpl]
 */
export async function probeMcpInitialize(
  mcpUrl,
  token,
  clientVersion = "unknown",
  fetchImpl = globalThis.fetch,
) {
  if (typeof fetchImpl !== "function") {
    return { ok: false, status: null, detail: "fetch is unavailable in this runtime", state: "error" };
  }
  if (!token) {
    return {
      ok: false,
      status: null,
      detail: "skipped: DR_PANDA_MCP_TOKEN is empty",
      state: "need_setup",
    };
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
          clientInfo: { name: PACKAGE_ID, version: clientVersion },
        },
      }),
    });
    const text = (await response.text()).slice(0, 400);
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        status: response.status,
        state: "unauthorized",
        detail:
          `auth failed (${response.status}). Regenerate the MCP token in DrPanda → My account and update DR_PANDA_MCP_TOKEN.`,
      };
    }
    if (response.status === 503) {
      return {
        ok: false,
        status: 503,
        state: "not_installed",
        detail: "DrPanda returned 503 — finish the first-run setup wizard, then retry.",
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        state: "error",
        detail: `HTTP ${response.status}: ${text || "(empty body)"}`,
      };
    }
    return { ok: true, status: response.status, state: "connected", detail: "initialize accepted" };
  } catch (error) {
    return {
      ok: false,
      status: null,
      state: "unreachable",
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Full connection probe used by the UI button.
 * @param {{ url: string, token: string, version?: string, fetchImpl?: typeof fetch }} options
 */
export async function probeConnection(options) {
  const { url, token, version = "unknown", fetchImpl = globalThis.fetch } = options;
  const healthz = healthzUrlFrom(url);
  const health = healthz
    ? await probeHealthz(healthz, fetchImpl)
    : { ok: false, status: null, body: "", error: "invalid url" };
  const mcp = await probeMcpInitialize(url, token, version, fetchImpl);

  let state = mcp.state || "error";
  if (!token) state = "need_setup";
  else if (!health.ok && mcp.state === "unreachable") state = "unreachable";
  else if (mcp.ok) state = "connected";

  return {
    state,
    url,
    healthz: healthz
      ? { ok: health.ok, status: health.status, error: health.error, body: health.body.slice(0, 200) }
      : null,
    mcp: { ok: mcp.ok, status: mcp.status, detail: mcp.detail, state: mcp.state },
  };
}
