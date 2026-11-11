/**
 * HTTP routes for the connection form (plugin detail + Settings).
 */
import { assignBridge, computeBridgeValues, reloadBridge, syncUrlCredential } from "./bridge.js";
import {
  describeToken,
  hasCredentials,
  setToken,
  unsetToken,
} from "./credentials.js";
import { probeConnection } from "./probe.js";
import {
  PACKAGE_ID,
  PROBE_ROUTE,
  SETTINGS_ROUTE,
  TOKEN_CREDENTIAL_KEY,
  URL_CREDENTIAL_KEY,
  envString,
  normalizeSettings,
  readSettings,
  writeSettings,
} from "./settings.js";

/**
 * @param {import('node:http').ServerResponse} response
 * @param {number} status
 * @param {unknown} body
 */
function respond(response, status, body) {
  try {
    const payload = JSON.stringify(body);
    response.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "content-length": Buffer.byteLength(payload),
    });
    response.end(payload);
  } catch {
    /* socket may be gone */
  }
}

/**
 * @param {import('node:http').IncomingMessage} request
 * @returns {Promise<unknown>}
 */
function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const max = 64 * 1024;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > max) {
        reject(new Error("body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

/**
 * @param {object} ctx
 * @param {object} scoped
 */
function connectionService(ctx, scoped) {
  for (const scope of [scoped, ctx]) {
    try {
      if (typeof scope?.get === "function") {
        const found = scope.get("connection");
        if (found !== null && found !== undefined) return found;
      }
    } catch {
      /* absent is normal */
    }
  }
  return null;
}

/**
 * @param {object} ctx
 * @param {object} scoped
 * @param {import('node:http').IncomingMessage} request
 * @returns {boolean | null}
 */
function browserSession(ctx, scoped, request) {
  const connection = connectionService(ctx, scoped);
  const auth = connection?.browserAuth;
  if (!auth || typeof auth.isAuthenticated !== "function") return null;
  let secure = false;
  try {
    secure = scoped.get("webServer")?.protocol === "https:";
  } catch {
    secure = false;
  }
  try {
    return auth.isAuthenticated(request, secure) === true;
  } catch {
    return false;
  }
}

/**
 * @param {object} options
 * @param {object} options.ctx
 * @param {object} options.bridgeValues
 * @param {() => object | null | undefined} options.getCredentials
 * @param {() => string} options.selfVersion
 * @param {(message: string) => void} options.warn
 */
export function registerRoutes(options) {
  const { ctx, bridgeValues, getCredentials, selfVersion, warn } = options;
  if (typeof ctx?.inject !== "function") return;

  try {
    ctx.inject(["webServer"], (scoped) => {
      try {
        if (typeof scoped?.webServer?.register !== "function") return;

        const guarded = (handler) => (request, response) => {
          if (request.method === "POST" && browserSession(ctx, scoped, request) === false) {
            respond(response, 401, {
              error: "this change has to come from the DSH window",
              hint: "The request carried no signed session cookie.",
            });
            return;
          }
          handler(request, response);
        };

        const buildView = async () => {
          const file = readSettings();
          const settings = file.settings ?? normalizeSettings(null).settings;
          const credentials = getCredentials();
          const token = await describeToken(credentials);
          const envToken = Boolean(envString(TOKEN_CREDENTIAL_KEY));
          const resolved = computeBridgeValues(file.settings);
          return {
            package: PACKAGE_ID,
            version: selfVersion(),
            settings,
            resolved,
            credentials: {
              available: hasCredentials(credentials),
              urlKey: URL_CREDENTIAL_KEY,
              tokenKey: TOKEN_CREDENTIAL_KEY,
              token: {
                configured: token.configured,
                source: token.configured ? "credentials" : envToken ? "env" : null,
                available: token.available,
              },
            },
            notes: file.notes,
          };
        };

        const settingsHandler = async (request, response) => {
          try {
            if (request.method === "GET") {
              respond(response, 200, { ok: true, ...(await buildView()) });
              return;
            }
            if (request.method !== "POST") {
              respond(response, 405, { error: "method not allowed" });
              return;
            }

            const body = /** @type {Record<string, unknown>} */ (await readJson(request));
            const patch = body.settings && typeof body.settings === "object" ? body.settings : body;
            const clearToken = body.clearToken === true;
            const tokenValue =
              typeof body.token === "string"
                ? body.token
                : typeof patch.token === "string"
                  ? patch.token
                  : "";

            const written = writeSettings({
              mcpUrl: patch.mcpUrl,
              serverName: patch.serverName,
              toolCallTimeoutMs: patch.toolCallTimeoutMs,
            });
            const next = computeBridgeValues(written.settings);
            assignBridge(bridgeValues, next);

            const credentials = getCredentials();
            const urlSync = await syncUrlCredential(credentials, next.url);

            let tokenResult = { ok: true, action: "unchanged" };
            if (clearToken) {
              tokenResult = { ...(await unsetToken(credentials)), action: "cleared" };
            } else if (tokenValue.trim()) {
              tokenResult = { ...(await setToken(credentials, tokenValue.trim())), action: "set" };
            }

            // URL credential update triggers expandTemplates hot-reconnect.
            // Also try fiber reload for serverName / timeout (!!js fields).
            const reload = reloadBridge(ctx);

            respond(response, 200, {
              ok: tokenResult.ok !== false && urlSync.ok !== false,
              ...(await buildView()),
              write: {
                urlCredential: urlSync,
                token: tokenResult,
                reload,
              },
            });
          } catch (error) {
            warn(`settings handler failed: ${String(error)}`);
            respond(response, 500, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        };

        const probeHandler = async (request, response) => {
          try {
            if (request.method !== "POST") {
              respond(response, 405, { error: "method not allowed" });
              return;
            }
            const body = /** @type {Record<string, unknown>} */ (await readJson(request));
            const file = readSettings();
            const resolved = computeBridgeValues(file.settings);
            const url =
              typeof body.url === "string" && body.url.trim() ? body.url.trim() : resolved.url;

            // Prefer an explicit token from the form (unsaved draft), else env
            // for probe-only. Stored credentials are resolved by the bridge at
            // runtime; for probe we accept draft/env only (never read store values
            // back into the response path).
            let token =
              typeof body.token === "string" && body.token.trim()
                ? body.token.trim()
                : envString(TOKEN_CREDENTIAL_KEY);

            // If UI left token blank but store is configured, probe with a
            // placeholder skip — ask the client to send token only when rotating.
            // Try resolve from credentials for accurate probe without echoing it.
            if (!token) {
              const credentials = getCredentials();
              if (credentials && typeof credentials.resolve === "function") {
                try {
                  const hit = await credentials.resolve(TOKEN_CREDENTIAL_KEY);
                  if (hit?.value) token = String(hit.value);
                } catch {
                  /* ignore */
                }
              }
            }

            const result = await probeConnection({
              url,
              token,
              version: selfVersion(),
            });
            respond(response, 200, { ok: result.state === "connected", ...result });
          } catch (error) {
            warn(`probe handler failed: ${String(error)}`);
            respond(response, 500, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        };

        scoped.webServer.register({
          kind: "exact",
          path: SETTINGS_ROUTE,
          handler: guarded((req, res) => {
            void settingsHandler(req, res);
          }),
        });
        scoped.webServer.register({
          kind: "exact",
          path: PROBE_ROUTE,
          handler: guarded((req, res) => {
            void probeHandler(req, res);
          }),
        });
      } catch (error) {
        warn(`could not register HTTP routes: ${String(error)}`);
      }
    });
  } catch (error) {
    warn(`could not inject webServer: ${String(error)}`);
  }
}
