/**
 * Shared helpers for doctor / tests (kept importable without spinning routes).
 */
export { healthzUrlFrom, probeConnection, probeHealthz, probeMcpInitialize } from "./probe.js";

/**
 * @param {object | undefined} tools
 * @param {string} serverName
 * @returns {string[]}
 */
export function listBridgeToolsPlaceholder(tools, serverName) {
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
    /* best-effort */
  }
  return names.sort();
}
