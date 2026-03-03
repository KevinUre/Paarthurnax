function buildCspPolicy(config) {
  if (config.cspPolicyOverride) {
    return config.cspPolicyOverride;
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    `connect-src ${config.cspConnectSrc.join(" ")}`,
  ].join("; ");
}

function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (raw === "*") {
    return "*";
  }

  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function isLocalhostOrigin(origin) {
  try {
    const parsed = new URL(origin);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function resolveCorsOrigin(config, origin) {
  if (!origin) {
    return null;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return null;
  }

  if (config.corsOriginList.some((value) => normalizeOrigin(value) === "*")) {
    return "*";
  }

  if (config.corsAllowLocalhost && isLocalhostOrigin(normalizedOrigin)) {
    return normalizedOrigin;
  }

  for (const allowed of config.corsOriginList) {
    if (normalizeOrigin(allowed) === normalizedOrigin) {
      return normalizedOrigin;
    }
  }

  return null;
}

function registerSecurityHooks(app, config) {
  if (config.corsEnabled) {
    app.addHook("onRequest", async (request, reply) => {
      const requestOrigin = request.headers.origin;
      const isAllowedOrigin = resolveCorsOrigin(config, requestOrigin);
      if (requestOrigin && !isAllowedOrigin) {
        return reply.code(403).send({ error: "Origin not allowed by CORS policy" });
      }

      if (isAllowedOrigin) {
        reply.header("Access-Control-Allow-Origin", isAllowedOrigin);
        reply.header("Vary", "Origin");
        reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      }

      if (request.method === "OPTIONS") {
        return reply.code(204).send();
      }
    });
  } else {
    app.addHook("onRequest", async (request, reply) => {
      reply.header("Access-Control-Allow-Origin", "*");
      reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");

      if (request.method === "OPTIONS") {
        return reply.code(204).send();
      }
    });
  }

  if (config.cspEnabled) {
    const cspPolicy = buildCspPolicy(config);
    app.addHook("onRequest", async (_request, reply) => {
      reply.header("Content-Security-Policy", cspPolicy);
    });
  }
}

module.exports = {
  registerSecurityHooks,
};
