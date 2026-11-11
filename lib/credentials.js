/**
 * Thin wrappers around ctx.credentials for URL/Token keys.
 * Plain string refs — CredentialRef branding is TypeScript-only.
 */
import { TOKEN_CREDENTIAL_KEY, URL_CREDENTIAL_KEY } from "./settings.js";

/**
 * @param {object | null | undefined} credentials
 * @returns {boolean}
 */
export function hasCredentials(credentials) {
  return Boolean(credentials && typeof credentials.describe === "function");
}

/**
 * @param {object | null | undefined} credentials
 * @param {string} key
 */
export async function describeKey(credentials, key) {
  if (!hasCredentials(credentials) || typeof credentials.describe !== "function") {
    return { configured: false, source: null, writable: false, available: false };
  }
  try {
    const info = await credentials.describe(key);
    return {
      configured: Boolean(info?.configured),
      source: info?.source ?? null,
      writable: info?.writable !== false,
      available: true,
      masked: typeof info?.masked === "string" ? info.masked : null,
    };
  } catch {
    return { configured: false, source: null, writable: false, available: true };
  }
}

/**
 * @param {object | null | undefined} credentials
 * @param {string} key
 * @param {string} value
 */
export async function setKey(credentials, key, value) {
  if (!hasCredentials(credentials) || typeof credentials.set !== "function") {
    return { ok: false, error: "credentials service unavailable" };
  }
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return { ok: false, error: "empty values cannot be stored" };
  try {
    await credentials.set(key, trimmed);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * @param {object | null | undefined} credentials
 * @param {string} key
 */
export async function unsetKey(credentials, key) {
  if (!hasCredentials(credentials) || typeof credentials.unset !== "function") {
    return { ok: false, error: "credentials service unavailable" };
  }
  try {
    await credentials.unset(key);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function describeToken(credentials) {
  return describeKey(credentials, TOKEN_CREDENTIAL_KEY);
}

export async function describeUrl(credentials) {
  return describeKey(credentials, URL_CREDENTIAL_KEY);
}

export async function setToken(credentials, value) {
  return setKey(credentials, TOKEN_CREDENTIAL_KEY, value);
}

export async function unsetToken(credentials) {
  return unsetKey(credentials, TOKEN_CREDENTIAL_KEY);
}

export async function setUrl(credentials, value) {
  return setKey(credentials, URL_CREDENTIAL_KEY, value);
}

export async function unsetUrl(credentials) {
  return unsetKey(credentials, URL_CREDENTIAL_KEY);
}

/**
 * Token presence for doctor: store first, else env (local provider also falls
 * back to env when the key is unset — we mirror that for reporting).
 * @param {object | null | undefined} credentials
 * @param {string} envToken
 */
export async function tokenStatus(credentials, envToken) {
  const stored = await describeToken(credentials);
  if (stored.configured) {
    return { present: true, source: "credentials", detail: stored };
  }
  if (envToken) {
    return {
      present: true,
      source: "env",
      detail: { configured: false, source: "env", writable: true, available: stored.available },
    };
  }
  return { present: false, source: null, detail: stored };
}
