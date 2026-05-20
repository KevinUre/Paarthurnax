const Fastify = require("fastify");
const { config } = require("./src/config");
const { registerSecurityHooks } = require("./src/security");
const { createDatabase } = require("./src/db");
const { createAuthContext } = require("./src/auth/context");
const pagesRoutes = require("./src/routes/pages");
const authRoutes = require("./src/routes/auth");
const adminRoutes = require("./src/routes/admin");

const app = Fastify({ logger: true });
registerSecurityHooks(app, config);

const { db } = createDatabase(config);
const auth = createAuthContext(db, config);

app.get("/", async () => {
  return { message: "Hello, world!" };
});

app.register(pagesRoutes, { db, auth });
app.register(authRoutes, { db, auth });
app.register(adminRoutes, { db, auth });

app.addHook("onClose", async () => {
  db.close();
});

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  app.log.info({ signal }, "Received shutdown signal");

  try {
    await app.close();
    app.log.info("Backend shutdown complete");
    process.exit(0);
  } catch (error) {
    app.log.error({ error, signal }, "Error during backend shutdown");
    process.exit(1);
  }
}

const start = async () => {
  try {
    app.log.info(
      {
        corsEnabled: config.corsEnabled,
        corsAllowLocalhost: config.corsAllowLocalhost,
        corsOriginList: config.corsOriginList,
        cspEnabled: config.cspEnabled,
        port: config.port,
      },
      "Backend security configuration"
    );
    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
