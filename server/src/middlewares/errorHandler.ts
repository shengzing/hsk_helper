import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError.js";

/**
 * All API errors return `{ error: { code, message, details? } }`.
 * `code` is a stable string the front-end maps to a localized message;
 * `message` is an English fallback for developers and logs.
 */
export function notFoundHandler(req: Request, res: Response) {
    res.status(404).json({
        error: {
            code: "NOT_FOUND",
            message: `Route ${req.method} ${req.path} not found`,
        },
    });
}

export function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
) {
    if (err instanceof HttpError) {
        res.status(err.status).json({
            error: {
                code: err.code,
                message: err.message,
                ...(err.details ? { details: err.details } : {}),
            },
        });
        return;
    }

    // Zod validation errors
    if (err.name === "ZodError") {
        res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Request validation failed",
                details: (err as unknown as { errors: unknown[] }).errors,
            },
        });
        return;
    }

    console.error("[unhandled error]", err);
    res.status(500).json({
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Internal server error",
        },
    });
}

