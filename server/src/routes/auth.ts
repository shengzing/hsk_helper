import { Router } from "express";
import type { AppDatabase } from "../db/connection.js";
import {
    SESSION_COOKIE_NAME,
    getSessionUser,
    login,
    logout,
    register,
    RegistrationError,
} from "../services/authService.js";
import { readCookie } from "../utils/cookies.js";

export function createAuthRouter(db: AppDatabase): Router {
    const router = Router();

    router.post("/login", (req, res) => {
        const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
        const password = typeof req.body?.password === "string" ? req.body.password : "";

        if (!username || !password) {
            res.status(400).json({
                error: { code: "INVALID_INPUT", message: "Username and password are required" },
            });
            return;
        }

        try {
            const result = login(db, username, password);
            res.cookie(SESSION_COOKIE_NAME, result.token, {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                maxAge: result.maxAge,
            });
            res.json({ data: result.user });
        } catch {
            res.status(401).json({
                error: { code: "LOGIN_FAILED", message: "Invalid username or password" },
            });
        }
    });

    router.post("/logout", (req, res) => {
        logout(db, readCookie(req, SESSION_COOKIE_NAME));
        res.clearCookie(SESSION_COOKIE_NAME);
        res.json({ data: null });
    });

    router.post("/register", (req, res) => {
        const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
        const password = typeof req.body?.password === "string" ? req.body.password : "";
        const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : undefined;
        const uiLocale = typeof req.body?.uiLocale === "string" ? req.body.uiLocale : undefined;

        if (!email || !password) {
            res.status(400).json({
                error: { code: "INVALID_INPUT", message: "Email and password are required" },
            });
            return;
        }

        try {
            const result = register(db, { email, password, displayName, uiLocale });
            res.cookie(SESSION_COOKIE_NAME, result.token, {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                maxAge: result.maxAge,
            });
            res.status(201).json({ data: result.user });
        } catch (err) {
            if (err instanceof RegistrationError) {
                const status = err.code === "EMAIL_EXISTS" ? 409 : 400;
                res.status(status).json({
                    error: { code: err.code, message: err.message },
                });
                return;
            }
            res.status(500).json({
                error: { code: "REGISTRATION_FAILED", message: "Registration failed" },
            });
        }
    });

    router.get("/me", (req, res) => {
        res.json({ data: getSessionUser(db, readCookie(req, SESSION_COOKIE_NAME)) });
    });

    return router;
}
