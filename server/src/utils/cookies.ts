import type { Request } from "express";

export function readCookie(req: Request, name: string): string | undefined {
    const cookie = req.headers.cookie;
    if (!cookie) return undefined;

    for (const part of cookie.split(";")) {
        const separatorIndex = part.indexOf("=");
        if (separatorIndex === -1) continue;
        const key = part.slice(0, separatorIndex).trim();
        if (key === name) {
            return decodeURIComponent(part.slice(separatorIndex + 1).trim());
        }
    }
    return undefined;
}

