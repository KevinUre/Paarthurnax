const path = require("node:path");
require("dotenv").config();

function getEnvBoolean(name, defaultValue) {
  const rawValue = process.env[name];
  if (rawValue === undefined) {
    return defaultValue;
  }

  const value = rawValue.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

const config = {
  port: Number(process.env.PORT) || 3000,
  dbPath: path.join(__dirname, "..", "data", "data.db"),
  corsEnabled: getEnvBoolean("CORS_ENABLED", true),
  corsAllowLocalhost: getEnvBoolean(
    "CORS_ALLOW_LOCALHOST",
    process.env.NODE_ENV !== "production"
  ),
  corsOriginList: (process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  cspEnabled: getEnvBoolean("CSP_ENABLED", process.env.NODE_ENV === "production"),
  cspConnectSrc: (
    process.env.CSP_CONNECT_SRC || "'self' http://localhost:5173 ws://localhost:5173"
  )
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean),
  cspPolicyOverride: process.env.CSP_POLICY,
  accessTokenTtlMinutes: Number(process.env.ACCESS_TOKEN_TTL_MINUTES) || 30,
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 14,
};

module.exports = {
  config,
};
