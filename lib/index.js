/**
 * dsh-dr-panda-mcp — host half of the carrier bundle.
 *
 * Mounts connection settings + doctor. The MCP tools themselves come from the
 * official `@deepseek-ai/dsh-mcp-client` row in cordis.patch.yml.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assignBridge,
  computeBridgeValues,
  provideBridge,
  syncUrlCredential,
} from "./bridge.js";
import { tokenStatus } from "./credentials.js";
import { healthzUrlFrom, listBridgeToolsPlaceholder, probeConnection } from "./doctor-support.js";
import { registerRoutes } from "./routes.js";
import {
  PACKAGE_ID,
  TOKEN_CREDENTIAL_KEY,
  envString,
  readSettings,
} from "./settings.js";

export const name = PACKAGE_ID;

const TOOL_NAME = "drpanda_mcp_doctor";
const packageRoot = dirname(fileURLToPath(new URL("..", import.meta.url)));

/** Live bridge values object (mutated on settings save). */
let bridgeValues = null;

function selfVersion() {
  try {
    const raw = readFileSync(join(packageRoot, "package.json"), "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed.version === "string" ? parsed.version : "unknown";
  } catch {
    return "unknown";
  }
}

function makeLogger(ctx) {
  return (message) => {
    try {
      ctx?.logger?.warn?.(`${PACKAGE_ID}: ${message}`);
    } catch {
      /* best-effort */
    }
  };
}

function getCredentials(ctx) {
  try {
    if (typeof ctx?.get === "function") {
      const found = ctx.get("credentials");
      if (found) return found;
    }
  } catch {
    /* optional */
  }
  return null;
}

/**
 * @param {object} [tools]
 * @param {string} serverName
 */
export function listBridgeTools(tools, serverName) {
  return listBridgeToolsPlaceholder(tools, serverName);
}

export { healthzUrlFrom } from "./doctor-support.js";

// Re-export settings helpers used by tests
export {
  normalizeSettings,
  resolveUrl,
  DEFAULT_URL,
  DEFAULT_SERVER,
} from "./settings.js";

/**
 * Register doctor tool.
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
            "Diagnose the DrPanda MCP bridge: settings/credentials/env, /healthz, /mcp Bearer auth, and which mcp__drpanda__* tools are registered. Use when production-troubleshooting tools are missing or return 401.",
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
            const report = await buildDoctorReport({
              ctx,
              tools: scoped.tools,
            });
            return { report };
          },
        });
        try {
          if (typeof dispose === "function" && typeof scoped.on === "function") {
            scoped.on("dispose", dispose);
          }
        } catch {
          /* best-effort */
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
 * @param {{ ctx: object, tools?: object }} options
 */
async function buildDoctorReport({ ctx, tools }) {
  const file = readSettings();
  const resolved = computeBridgeValues(file.settings);
  const credentials = getCredentials(ctx);
  const token = await tokenStatus(credentials, envString(TOKEN_CREDENTIAL_KEY));

  // For probe: resolve token value if possible, else env
  let tokenValue = envString(TOKEN_CREDENTIAL_KEY);
  if (!tokenValue && credentials && typeof credentials.resolve === "function") {
    try {
      const hit = await credentials.resolve(TOKEN_CREDENTIAL_KEY);
      if (hit?.value) tokenValue = String(hit.value);
    } catch {
      /* ignore */
    }
  }

  const probe = await probeConnection({
    url: resolved.url,
    token: tokenValue,
    version: selfVersion(),
  });

  const bridged = listBridgeTools(tools, resolved.serverName);
  const lines = [];
  lines.push(`# ${PACKAGE_ID} doctor`);
  lines.push("");
  lines.push(`- plugin version: ${selfVersion()}`);
  lines.push(`- serverName: ${resolved.serverName} (tools → mcp__${resolved.serverName}__*)`);
  lines.push(`- mcpUrl: ${resolved.url}`);
  lines.push(
    `- token: ${token.present ? `present (${token.source})` : "UNSET — open the plugin page and paste a Bearer token"}`,
  );
  lines.push(`- credentials service: ${credentials ? "available" : "unavailable (env-only fallback)"}`);
  lines.push(`- connection state: ${probe.state}`);
  lines.push("");

  if (file.notes.length > 0) {
    lines.push("## Settings notes");
    for (const note of file.notes) lines.push(`- ${note}`);
    lines.push("");
  }

  lines.push("## Bridge tools currently registered");
  if (bridged.length === 0) {
    lines.push(
      `- none matching mcp__${resolved.serverName}__*. Configure URL/Token on the plugin page, or wait for reconnect.`,
    );
  } else {
    for (const name of bridged) lines.push(`- ${name}`);
  }
  lines.push("");

  lines.push("## Probes");
  if (probe.healthz) {
    if (probe.healthz.ok) lines.push(`- healthz → ${probe.healthz.status} OK`);
    else {
      lines.push(
        `- healthz → ${probe.healthz.status ?? "failed"}: ${probe.healthz.error || probe.healthz.body || ""}`.trimEnd(),
      );
    }
  }
  lines.push(
    `- initialize → ${probe.mcp.ok ? "OK" : "failed"}: ${probe.mcp.detail}`,
  );
  lines.push("");

  lines.push("## Next steps");
  lines.push("1. Deploy / start https://github.com/linyu19872008/dr-panda-mcp and finish setup.");
  lines.push('2. In the web console, open "My account" and create an MCP Bearer token.');
  lines.push("3. Open this plugin's page in Harness (or Settings → DrPanda MCP) and save URL + Token.");
  lines.push("4. Advanced/CI: export DR_PANDA_MCP_URL / DR_PANDA_MCP_TOKEN before starting DSH.");
  lines.push(`5. Call mcp__${resolved.serverName}__systems_status.`);
  lines.push("");
  return lines.join("\n");
}

// Keep buildReport name for older tests — thin wrapper
export async function buildReport({ tools, fetchImpl } = {}) {
  const file = readSettings();
  const resolved = computeBridgeValues(file.settings);
  const tokenValue = envString(TOKEN_CREDENTIAL_KEY);
  const probe = await probeConnection({
    url: resolved.url,
    token: tokenValue,
    version: selfVersion(),
    fetchImpl,
  });
  const bridged = listBridgeTools(tools, resolved.serverName);
  return [
    `# ${PACKAGE_ID} doctor`,
    "",
    `- mcpUrl: ${resolved.url}`,
    `- DR_PANDA_MCP_TOKEN: ${tokenValue ? `set (${tokenValue.length} chars)` : "UNSET"}`,
    `- connection state: ${probe.state}`,
    `- bridge tools: ${bridged.length}`,
    "",
    "## Next steps",
    "1. Open the plugin page in Harness and save URL + Token.",
    "",
  ].join("\n");
}

export function resolveConfig() {
  const file = readSettings();
  const resolved = computeBridgeValues(file.settings);
  const notes = [...file.notes];
  if (!envString(TOKEN_CREDENTIAL_KEY) && file.missing) {
    notes.push(
      "DR_PANDA_MCP_TOKEN is unset. Paste a Bearer token on the plugin page (or export the env var).",
    );
  }
  return {
    url: resolved.url,
    token: envString(TOKEN_CREDENTIAL_KEY),
    serverName: resolved.serverName,
    notes,
  };
}

/**
 * @param {object} ctx
 */
export function apply(ctx) {
  try {
    const warn = makeLogger(ctx);
    const file = readSettings();
    for (const note of file.notes) warn(note);

    const initial = computeBridgeValues(file.settings);
    bridgeValues = provideBridge(ctx, initial);
    assignBridge(bridgeValues, initial);

    // Seed URL credential so expandTemplates has a value (enables hot URL reload).
    void syncUrlCredential(getCredentials(ctx), initial.url).then((result) => {
      if (!result.ok && result.error && result.error !== "credentials service unavailable") {
        warn(`could not sync URL credential: ${result.error}`);
      }
    });

    registerRoutes({
      ctx,
      bridgeValues,
      getCredentials: () => getCredentials(ctx),
      selfVersion,
      warn,
    });
    registerDoctor(ctx, warn);
  } catch {
    /* apply() must not throw */
  }
}
