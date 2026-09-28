// TEST STUB — placeholder for the real imports route (not yet implemented by dev).
// This file exists only so that routes/index.ts can resolve the import and
// tests can run. The development lead should replace this with the real
// implementation per design doc §11.
import { Router } from "express";
import type { AppDatabase } from "../db/connection.js";

export function createImportRouter(_db: AppDatabase): Router {
    return Router();
}
