import { Router } from "express";
import type { AppDatabase } from "../db/connection.js";
import {
    createUser,
    deleteUser,
    isAdminDeletable,
    listUsers,
    updateUser,
    userExists,
    usernameExists,
} from "../repositories/adminUserRepository.js";
import { HttpError } from "../utils/httpError.js";

const VALID_LOCALES = ["en-US", "zh-CN", "hi-IN", "es", "fr-FR", "ar", "bn-BD", "ru-RU", "pt-BR", "ur-PK"];

interface CreateUserInput {
    username: string;
    email: string;
    password: string;
    displayName: string;
    expiresAt: string;
    isAdmin: boolean;
    uiLocale: string;
}

interface UpdateUserInput extends Partial<Omit<CreateUserInput, "username" | "password">> {
    username: string;
    email: string;
    displayName: string;
    expiresAt: string;
    isAdmin: boolean;
    status: string;
    uiLocale: string;
    password?: string;
}

function parseCreateBody(body: Record<string, unknown>): CreateUserInput {
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const expiresAt = typeof body.expiresAt === "string" ? body.expiresAt : "";
    const isAdmin = body.isAdmin === true;
    const uiLocale = typeof body.uiLocale === "string" && VALID_LOCALES.includes(body.uiLocale) ? body.uiLocale : "zh-CN";
    return { username, email, password, displayName, expiresAt, isAdmin, uiLocale };
}

function parseUpdateBody(body: Record<string, unknown>): UpdateUserInput {
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : undefined;
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const expiresAt = typeof body.expiresAt === "string" ? body.expiresAt : "";
    const isAdmin = body.isAdmin === true;
    const status = typeof body.status === "string" ? body.status : "active";
    const uiLocale = typeof body.uiLocale === "string" && VALID_LOCALES.includes(body.uiLocale) ? body.uiLocale : "zh-CN";
    return { username, email, password, displayName, expiresAt, isAdmin, status, uiLocale };
}

export function createAdminUserRouter(db: AppDatabase): Router {
    const router = Router();

    router.get("/", (_req, res) => {
        res.json({ data: listUsers(db) });
    });

    router.post("/", (req, res) => {
        const input = parseCreateBody(req.body as Record<string, unknown>);
        if (!input.username || !input.displayName || !input.expiresAt || input.password.length < 6) {
            throw new HttpError(400, "INVALID_INPUT", "Username, displayName, expiresAt are required; password must be at least 6 characters");
        }
        if (usernameExists(db, input.username)) {
            throw new HttpError(409, "USERNAME_EXISTS", "Username already exists");
        }
        const id = createUser(db, input);
        res.status(201).json({ data: listUsers(db).find((u) => u.id === id) ?? null });
    });

    router.put("/:userId", (req, res) => {
        const userId = req.params.userId;
        const input = parseUpdateBody(req.body as Record<string, unknown>);
        if (!userExists(db, userId)) {
            throw new HttpError(404, "USER_NOT_FOUND", "User not found");
        }
        if (!input.username || !input.displayName || !input.expiresAt) {
            throw new HttpError(400, "INVALID_INPUT", "Username, displayName, expiresAt are required");
        }
        if (input.password && input.password.length < 6) {
            throw new HttpError(400, "INVALID_PASSWORD", "Password must be at least 6 characters");
        }
        if (usernameExists(db, input.username, userId)) {
            throw new HttpError(409, "USERNAME_EXISTS", "Username already exists");
        }
        updateUser(db, userId, input);
        res.json({ data: listUsers(db).find((u) => u.id === userId) ?? null });
    });

    router.delete("/:userId", (req, res) => {
        const userId = req.params.userId;
        const currentUserId = res.locals.userId as string;
        if (!userExists(db, userId)) {
            throw new HttpError(404, "USER_NOT_FOUND", "User not found");
        }
        if (userId === currentUserId) {
            throw new HttpError(400, "CANNOT_DELETE_SELF", "Cannot delete the currently logged-in user");
        }
        if (!isAdminDeletable(db, userId)) {
            throw new HttpError(400, "LAST_ADMIN", "System must retain at least one admin");
        }
        deleteUser(db, userId);
        res.json({ data: null });
    });

    return router;
}
