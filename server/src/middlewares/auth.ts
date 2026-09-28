import type { NextFunction, Request, Response } from "express";
import type { AppDatabase } from "../db/connection.js";
import type { ClientUser } from "../types.js";
import { SESSION_COOKIE_NAME, getSessionAuthContext } from "../services/authService.js";
import { readCookie } from "../utils/cookies.js";

export function authenticate(db: AppDatabase) {
    return (req: Request, res: Response, next: NextFunction) => {
        const authContext = getSessionAuthContext(db, readCookie(req, SESSION_COOKIE_NAME));

        if (!authContext) {
            res.status(401).json({
                error: {
                    code: "UNAUTHORIZED",
                    message: "Authentication required",
                },
            });
            return;
        }

        res.locals.user = authContext.user;
        res.locals.userId = authContext.user.id;
        next();
    };
}

export function requireAdmin(_db: AppDatabase) {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = res.locals.user as ClientUser | undefined;
        if (!user?.isAdmin) {
            res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "Admin permission required",
                },
            });
            return;
        }
        next();
    };
}

/**
 * Optional auth: attaches user if a valid session exists, but does not 401.
 */
export function optionalAuth(db: AppDatabase) {
    return (req: Request, res: Response, next: NextFunction) => {
        const authContext = getSessionAuthContext(db, readCookie(req, SESSION_COOKIE_NAME));
        if (authContext) {
            res.locals.user = authContext.user;
            res.locals.userId = authContext.user.id;
        }
        next();
    };
}
