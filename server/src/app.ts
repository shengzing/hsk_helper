import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppDatabase } from "./db/connection.js";
import { authenticate } from "./middlewares/auth.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { createAuthRouter } from "./routes/auth.js";
import { createLocalesRouter } from "./routes/locales.js";
import { createApiRouter } from "./routes/index.js";

const clientDist = fileURLToPath(new URL("../../client/dist", import.meta.url));
const clientIndex = join(clientDist, "index.html");

export function createApp(db: AppDatabase) {
    const app = express();

    app.use(
        cors({
            origin: process.env.CORS_ORIGIN ?? true,
            credentials: true,
        })
    );
    app.use(express.json());

    // Health check
    app.get("/health", (_req, res) => {
        res.json({ status: "ok" });
    });

    // Public routes (no auth required)
    app.use("/api/auth", createAuthRouter(db));
    app.use("/api/locales", createLocalesRouter(db));

    // Authenticated routes
    app.use("/api", authenticate(db), createApiRouter(db));

    // Serve client build if it exists (production)
    if (existsSync(clientIndex)) {
        app.use(
            express.static(clientDist, {
                index: "index.html",
                setHeaders(res, filePath) {
                    if (filePath === clientIndex) {
                        res.setHeader("Cache-Control", "no-cache");
                    } else if (filePath.startsWith(join(clientDist, "assets"))) {
                        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
                    }
                },
            })
        );

        app.get("*", (req, res, next) => {
            if (req.path === "/api" || req.path.startsWith("/api/")) {
                next();
                return;
            }
            res.sendFile(clientIndex);
        });
    }

    // Error handling (must be last)
    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
