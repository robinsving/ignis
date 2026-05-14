// In-memory session map keyed by cookie value.
//
// Each entry tracks the user's vault names, last-activity timestamp, and bytes used.
// On disk, vaults are stored under a session-prefixed name so two sessions can both have a vault called "Notes".

const crypto = require("crypto");
const config = require("../config");

const COOKIE_NAME = "ignis-demo";
const PREFIX_SEPARATOR = "__";

// sessionId -> { lastActivity, vaults: Set<userVaultName>, bytesUsed }
const sessions = new Map();

function newSessionId() {
  return crypto.randomBytes(12).toString("hex");
}

function prefixFor(sessionId) {
  return "demo-" + sessionId + PREFIX_SEPARATOR;
}

function makeStorageName(sessionId, userVaultName) {
  return prefixFor(sessionId) + userVaultName;
}

function tryParseUserVaultName(sessionId, storageName) {
  const prefix = prefixFor(sessionId);

  if (storageName && storageName.startsWith(prefix)) {
    return storageName.slice(prefix.length);
  }

  return null;
}

function parseCookies(req) {
  const header = req.headers.cookie;

  if (!header) {
    return {};
  }

  const out = {};

  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");

    if (eq < 0) {
      continue;
    }

    out[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
  }

  return out;
}

function setSessionCookie(res, sessionId) {
  const maxAgeSeconds = Math.floor(config.demoTimeoutMs / 1000);

  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`,
  );
}

// Resolve the session for a request. If none exists, create one (unless options.peek is true).
function getOrCreateSession(req, res, options = {}) {
  const cookies = parseCookies(req);
  const existing = cookies[COOKIE_NAME];

  if (existing && sessions.has(existing)) {
    return existing;
  }

  if (existing && !sessions.has(existing)) {
    // Cookie outlived in-memory session. reuse the id to keep the prefix.
    sessions.set(existing, {
      lastActivity: Date.now(),
      vaults: new Set(),
      bytesUsed: 0,
    });
    return existing;
  }

  if (options.peek) {
    return null;
  }

  if (sessions.size >= config.demoMaxSessions) {
    return null;
  }

  const sessionId = newSessionId();

  sessions.set(sessionId, {
    lastActivity: Date.now(),
    vaults: new Set(),
    bytesUsed: 0,
  });

  setSessionCookie(res, sessionId);
  return sessionId;
}

function touchSession(sessionId) {
  const s = sessions.get(sessionId);

  if (s) {
    s.lastActivity = Date.now();
  }
}

module.exports = {
  COOKIE_NAME,
  PREFIX_SEPARATOR,
  sessions,
  prefixFor,
  makeStorageName,
  tryParseUserVaultName,
  parseCookies,
  setSessionCookie,
  getOrCreateSession,
  touchSession,
};
