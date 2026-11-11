/**
 * Mutable bridge values + best-effort hot reload of the mcp-client row.
 *
 * URL/Token hot-reconnect primarily goes through expandTemplates + credentials
 * updates. serverName / toolCallTimeoutMs live on this service (read by !!js);
 * we also try to reload the bridge fiber when those change.
 */
import { setUrl } from "./credentials.js";
import {
  BRIDGE_ROW_ID,
  BRIDGE_SERVICE,
  resolveServerName,
  resolveTimeout,
  resolveUrl,
} from "./settings.js";

/**
 * @typedef {{ url: string, serverName: string, toolCallTimeoutMs: number }} BridgeValues
 */

/**
 * @param {ReturnType<import('./settings.js').defaultSettings> | null} settings
 * @returns {BridgeValues}
 */
export function computeBridgeValues(settings) {
  return {
    url: resolveUrl(settings).url,
    serverName: resolveServerName(settings).serverName,
    toolCallTimeoutMs: resolveTimeout(settings).toolCallTimeoutMs,
  };
}

/**
 * Create a mutable service object and publish it.
 * @param {object} ctx
 * @param {BridgeValues} initial
 */
export function provideBridge(ctx, initial) {
  const values = {
    url: initial.url,
    serverName: initial.serverName,
    toolCallTimeoutMs: initial.toolCallTimeoutMs,
  };
  try {
    ctx.provide(BRIDGE_SERVICE, values);
  } catch {
    /* provide may throw if already registered in odd reloads */
  }
  return values;
}

/**
 * @param {BridgeValues} values
 * @param {BridgeValues} next
 */
export function assignBridge(values, next) {
  values.url = next.url;
  values.serverName = next.serverName;
  values.toolCallTimeoutMs = next.toolCallTimeoutMs;
}

/**
 * Keep DR_PANDA_MCP_URL credential in sync so expandTemplates can hot-reload URL.
 * @param {object | null | undefined} credentials
 * @param {string} url
 */
export async function syncUrlCredential(credentials, url) {
  return setUrl(credentials, url);
}

/**
 * Attempt to reload the official mcp-client row after !!js-backed fields change.
 * @param {object} ctx
 * @returns {{ ok: boolean, method: string | null, restartRequired: boolean, error: string | null }}
 */
export function reloadBridge(ctx) {
  try {
    const loader =
      (typeof ctx?.get === "function" ? ctx.get("loader") : null) ||
      ctx?.loader ||
      ctx?.root?.loader ||
      null;

    const candidates = [];
    if (loader && typeof loader.entries === "function") {
      try {
        candidates.push(...[].concat(loader.entries() || []));
      } catch {
        /* ignore */
      }
    }
    if (loader && Array.isArray(loader.registry)) {
      candidates.push(...loader.registry);
    }

    const match = candidates.find((entry) => {
      const id = entry?.options?.id ?? entry?.id ?? entry?.name;
      return id === BRIDGE_ROW_ID;
    });

    if (match) {
      if (typeof match.reload === "function") {
        match.reload();
        return { ok: true, method: "entry.reload", restartRequired: false, error: null };
      }
      if (typeof match.update === "function") {
        match.update();
        return { ok: true, method: "entry.update", restartRequired: false, error: null };
      }
      if (typeof match.forceUpdate === "function") {
        match.forceUpdate();
        return { ok: true, method: "entry.forceUpdate", restartRequired: false, error: null };
      }
    }

    if (loader && typeof loader.reload === "function") {
      try {
        loader.reload(BRIDGE_ROW_ID);
        return { ok: true, method: "loader.reload(id)", restartRequired: false, error: null };
      } catch {
        /* try next */
      }
    }

    const editor =
      (typeof ctx?.get === "function" ? ctx.get("configEditor") : null) || ctx?.configEditor || null;
    if (editor && typeof editor.reload === "function") {
      editor.reload(BRIDGE_ROW_ID);
      return { ok: true, method: "configEditor.reload", restartRequired: false, error: null };
    }

    // Credential-driven URL/token changes still hot-reconnect via expandTemplates
    // even when fiber reload is unavailable.
    return {
      ok: false,
      method: null,
      restartRequired: true,
      error: "bridge fiber reload API not found; URL/token still hot-reload via credentials",
    };
  } catch (error) {
    return {
      ok: false,
      method: null,
      restartRequired: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
