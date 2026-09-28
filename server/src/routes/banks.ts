import { Router } from "express";
import type { AppDatabase } from "../db/connection.js";
import { listMyBanks } from "../services/subscriptionService.js";
import { listPapersForBank } from "../services/paperService.js";

export function createBankRouter(db: AppDatabase): Router {
    const router = Router();

    // GET /api/banks — list banks the user has active subscription for
    router.get("/", (_req, res) => {
        const userId = res.locals.userId as string;
        res.json({ data: listMyBanks(db, userId) });
    });

    // GET /api/banks/:bankId/papers — list published papers in a bank
    router.get("/:bankId/papers", (req, res) => {
        const userId = res.locals.userId as string;
        const bankId = req.params.bankId;
        const papers = listPapersForBank(db, bankId, userId);
        res.json({ data: papers });
    });

    return router;
}

