/**
 * PM2 production processes for the HSK Helper platform.
 *
 * Usage:
 *   npm run build
 *   set -a; source .env; set +a
 *   pm2 start ecosystem.config.cjs --only hsk-helper
 *   pm2 logs hsk-helper
 *   pm2 restart hsk-helper
 *   pm2 stop hsk-helper
 */
const path = require("node:path");

const ROOT = __dirname;
const env = {
  NODE_ENV: "production",
  PORT: process.env.PORT || "3001",
  DB_PATH: process.env.DB_PATH || path.join(ROOT, "data", "app.db"),
  CORS_ORIGIN: process.env.CORS_ORIGIN || "",
  INITIAL_ADMIN_USERNAME: process.env.INITIAL_ADMIN_USERNAME || "admin",
  INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD || "Admin2026",
  ASSET_ROOT: process.env.ASSET_ROOT || path.join(ROOT, "data", "assets"),
};

module.exports = {
  apps: [
    {
      name: "hsk-helper",
      script: path.join(ROOT, "server", "dist", "server.js"),
      cwd: ROOT,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: "512M",
      env,
    },
  ],
};
