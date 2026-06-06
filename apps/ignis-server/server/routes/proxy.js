const express = require("express");
const dns = require("dns").promises;
const net = require("net");
const settings = require("../settings");

const router = express.Router();

const MAX_RESPONSE_BYTES = 50 * 1024 * 1024;

function isPrivateIp(ip) {
  const type = net.isIP(ip);

  if (type === 4) {
    const o = ip.split(".").map(Number);

    return (
      o[0] === 0 ||
      o[0] === 10 ||
      o[0] === 127 ||
      (o[0] === 169 && o[1] === 254) ||
      (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
      (o[0] === 192 && o[1] === 168) ||
      (o[0] === 100 && o[1] >= 64 && o[1] <= 127)
    );
  }

  if (type === 6) {
    const a = ip.toLowerCase();

    if (a === "::1" || a === "::") {
      return true;
    }

    if (/^fe[89ab]/.test(a) || a.startsWith("fc") || a.startsWith("fd")) {
      return true;
    }

    const mapped = a.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);

    if (mapped) {
      return isPrivateIp(mapped[1]);
    }

    return false;
  }

  return false;
}

function httpError(status, message) {
  const e = new Error(message);
  e.statusCode = status;
  return e;
}

// Reject non-http(s) schemes and hosts that resolve to a private or link-local address.
async function assertPublicUrl(urlStr) {
  let parsed;

  try {
    parsed = new URL(urlStr);
  } catch {
    throw httpError(400, "Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw httpError(400, "Only http and https URLs are allowed");
  }

  const host = parsed.hostname;

  if (net.isIP(host)) {
    if (isPrivateIp(host)) {
      throw httpError(403, "Host not allowed");
    }

    return;
  }

  let addrs;

  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw httpError(502, "DNS resolution failed");
  }

  for (const a of addrs) {
    if (isPrivateIp(a.address)) {
      throw httpError(403, "Host resolves to a private address");
    }
  }
}

// POST /api/proxy - forward a request to an external URL to bypass CORS.
router.post("/", async (req, res) => {
  const { url, method, headers, body, binary } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Missing url" });
  }

  const proxyMode = settings.get("proxyMode");

  if (proxyMode === "disabled") {
    return res.status(403).json({ error: "Proxy is disabled" });
  }

  try {
    await assertPublicUrl(url);
  } catch (e) {
    return res.status(e.statusCode || 400).json({ error: e.message });
  }

  if (proxyMode === "allowlist") {
    const allowlist = settings.get("proxyAllowlist");
    const host = new URL(url).hostname;

    if (!allowlist.includes(host)) {
      return res
        .status(403)
        .json({ error: `Host not in proxy allowlist: ${host}` });
    }
  }

  try {
    // Forward the caller's headers as-is.
    const fetchOpts = {
      method: method || "GET",
      headers: headers || {},
    };

    if (body && method !== "GET" && method !== "HEAD") {
      if (binary && typeof body === "string") {
        fetchOpts.body = Buffer.from(body, "base64");
      } else {
        fetchOpts.body = body;
      }
    }

    const upstream = await fetch(url, fetchOpts);

    const declaredLength = Number(upstream.headers.get("content-length"));

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_RESPONSE_BYTES
    ) {
      return res.status(413).json({ error: "Upstream response too large" });
    }

    const respArrayBuf = await upstream.arrayBuffer();

    if (respArrayBuf.byteLength > MAX_RESPONSE_BYTES) {
      return res.status(413).json({ error: "Upstream response too large" });
    }

    const respBody = Buffer.from(respArrayBuf);

    // Strip hop-by-hop / encoding headers since the body is already decompressed.
    const skipHeaders = new Set([
      "content-encoding",
      "transfer-encoding",
      "content-length",
      "connection",
    ]);
    const respHeaders = {};

    upstream.headers.forEach((val, key) => {
      if (!skipHeaders.has(key)) {
        respHeaders[key] = val;
      }
    });

    res.json({
      status: upstream.status,
      headers: respHeaders,
      body: respBody.toString("base64"),
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

module.exports = router;
module.exports.isPrivateIp = isPrivateIp;
