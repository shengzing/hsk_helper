import { Router } from "express";
import type { AppDatabase } from "../db/connection.js";
import { HttpError } from "../utils/httpError.js";

const VALID_LOCALES = ["en-US", "zh-CN", "hi-IN", "es", "fr-FR", "ar", "bn-BD", "ru-RU", "pt-BR", "ur-PK"];

export function createPreferencesRouter(db: AppDatabase): Router {
    const router = Router();

    // PATCH /api/me/preferences — update user preferences (currently ui_locale)
    router.patch("/preferences", (req, res) => {
        const userId = res.locals.userId as string;
        const body = req.body as Record<string, unknown>;
        const uiLocale = typeof body.ui_locale === "string" ? body.ui_locale : undefined;

        if (uiLocale) {
            if (!VALID_LOCALES.includes(uiLocale)) {
                throw new HttpError(400, "INVALID_LOCALE", `Locale must be one of: ${VALID_LOCALES.join(", ")}`);
            }
            db.prepare(`UPDATE users SET ui_locale = ? WHERE id = ?`).run(uiLocale, userId);
        }

        res.json({ data: { updated: true } });
    });

    return router;
}

