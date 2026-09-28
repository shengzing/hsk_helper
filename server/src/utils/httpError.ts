/**
 * Standard HTTP error with a stable machine-readable code.
 * The front-end maps `code` to a localized message;
 * `message` is an English fallback for developers.
 */
export class HttpError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string,
        public readonly details?: Record<string, unknown>
    ) {
        super(message);
        this.name = "HttpError";
    }
}

export function badRequest(code: string, message: string, details?: Record<string, unknown>): HttpError {
    return new HttpError(400, code, message, details);
}

export function unauthorized(code: string, message: string, details?: Record<string, unknown>): HttpError {
    return new HttpError(401, code, message, details);
}

export function forbidden(code: string, message: string, details?: Record<string, unknown>): HttpError {
    return new HttpError(403, code, message, details);
}

export function notFound(code: string, message: string, details?: Record<string, unknown>): HttpError {
    return new HttpError(404, code, message, details);
}

export function conflict(code: string, message: string, details?: Record<string, unknown>): HttpError {
    return new HttpError(409, code, message, details);
}

