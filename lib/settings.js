/**
 * Persistent non-secret settings for dsh-dr-panda-mcp.
 *
 * Token is NOT stored here — it lives in dsh-credentials under
 * DR_PANDA_MCP_TOKEN. URL is mirrored into DR_PANDA_MCP_URL for the
 * official MCP client's expandTemplates hot-reconnect path.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const PACKAGE_ID = "dsh-dr-panda-mcp";
export const SETTINGS_FILE = "dsh-dr-panda-mcp.settings.json";
export const SETTINGS_VERSION = 1;

export const DEFAULT_URL = "http://127.0.0.1:8111/mcp";
export const DEFAULT_SERVER = "drpanda";
export const DEFAULT_TIMEOUT_MS = 120000;
export const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
export const TIMEOUT_RANGE = Object.freeze({ min: 5000, max: 600000 });

export const URL_CREDENTIAL_KEY = "DR_PANDA_MCP_URL";
export const TOKEN_CREDENTIAL_KEY = "DR_PANDA_MCP_TOKEN";
export const BRIDGE_SERVICE = "drpandaBridge";
export const BRIDGE_ROW_ID = "drpanda-mcp-bridge";

export const SETTINGS_ROUTE = "/dsh-dr-panda-mcp/settings";
export const PROBE_ROUTE = "/dsh-dr-panda-mcp/probe";

/** @param {NodeJS.ProcessEnv} [env] */
export function dshHome(env = process.env) {
  const fromEnvironment = String(env?.DSH_HOME ?? "").trim();
  return fromEnvironment === "" ? join(homedir(), ".dsh") : fromEnvironment;
}

/** @param {string} [home] */
export function settingsPath(home = dshHome()) {
  return join(home, SETTINGS_FILE);
}

/** @param {string} key */
export function envString(key) {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

export function defaultSettings() {
  return {
    version: SETTINGS_VERSION,
    mcpUrl: DEFAULT_URL,
    serverName: DEFAULT_SERVER,
    toolCallTimeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

/**
 * @param {unknown} raw
 * @returns {{ settings: ReturnType<typeof defaultSettings>, notes: string[] }}
 */
export function normalizeSettings(raw) {
  const notes = [];
  const base = defaultSettings();
  const input = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};

  let mcpUrl = typeof input.mcpUrl === "string" ? input.mcpUrl.trim() : base.mcpUrl;
  if (!mcpUrl) mcpUrl = base.mcpUrl;
  try {
    const parsed = new URL(mcpUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      notes.push("mcpUrl must be http(s); falling back to default.");
      mcpUrl = base.mcpUrl;
    }
  } catch {
    notes.push("mcpUrl is not a valid URL; falling back to default.");
    mcpUrl = base.mcpUrl;
  }

  let serverName = typeof input.serverName === "string" ? input.serverName.trim() : base.serverName;
  if (!serverName || !SERVER_NAME_PATTERN.test(serverName)) {
    notes.push(`serverName invalid; using ${base.serverName}.`);
    serverName = base.serverName;
  }

  let toolCallTimeoutMs = Number(input.toolCallTimeoutMs);
  if (!Number.isFinite(toolCallTimeoutMs)) toolCallTimeoutMs = base.toolCallTimeoutMs;
  toolCallTimeoutMs = Math.round(toolCallTimeoutMs);
  if (toolCallTimeoutMs < TIMEOUT_RANGE.min || toolCallTimeoutMs > TIMEOUT_RANGE.max) {
    notes.push(`toolCallTimeoutMs out of range; using ${base.toolCallTimeoutMs}.`);
    toolCallTimeoutMs = base.toolCallTimeoutMs;
  }

  return {
    settings: {
      version: SETTINGS_VERSION,
      mcpUrl,
      serverName,
      toolCallTimeoutMs,
    },
    notes,
  };
}

/**
 * Resolve effective URL with priority: settings file > env > default.
 * When `settings` is null, treat as "no file" and skip to env.
 * @param {ReturnType<typeof defaultSettings> | null} settings
 */
export function resolveUrl(settings) {
  if (settings && typeof settings.mcpUrl === "string" && settings.mcpUrl.trim()) {
    return { url: settings.mcpUrl.trim(), source: "settings" };
  }
  const fromEnv = envString(URL_CREDENTIAL_KEY);
  if (fromEnv) return { url: fromEnv, source: "env" };
  return { url: DEFAULT_URL, source: "default" };
}

/**
 * @param {ReturnType<typeof defaultSettings> | null} settings
 */
export function resolveServerName(settings) {
  if (settings && SERVER_NAME_PATTERN.test(settings.serverName)) {
    return { serverName: settings.serverName, source: "settings" };
  }
  const fromEnv = envString("DR_PANDA_MCP_SERVER");
  if (fromEnv && SERVER_NAME_PATTERN.test(fromEnv)) {
    return { serverName: fromEnv, source: "env" };
  }
  return { serverName: DEFAULT_SERVER, source: "default" };
}

/**
 * @param {ReturnType<typeof defaultSettings> | null} settings
 */
export function resolveTimeout(settings) {
  if (settings && Number.isFinite(settings.toolCallTimeoutMs)) {
    return { toolCallTimeoutMs: settings.toolCallTimeoutMs, source: "settings" };
  }
  return { toolCallTimeoutMs: DEFAULT_TIMEOUT_MS, source: "default" };
}

/** @param {string} [path] */
export function readSettings(path = settingsPath()) {
  try {
    if (!existsSync(path)) return { settings: null, notes: [], missing: true };
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const { settings, notes } = normalizeSettings(parsed);
    return { settings, notes, missing: false };
  } catch (error) {
    return {
      settings: null,
      notes: [`failed to read settings: ${error instanceof Error ? error.message : String(error)}`],
      missing: true,
    };
  }
}

/**
 * @param {unknown} raw
 * @param {string} [path]
 */
export function writeSettings(raw, path = settingsPath()) {
  const { settings, notes } = normalizeSettings(raw);
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  renameSync(temp, path);
  return { settings, notes };
}
