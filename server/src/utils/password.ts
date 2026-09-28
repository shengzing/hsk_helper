import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function createPasswordSecret(password: string): { hash: string; salt: string } {
    const salt = randomBytes(16).toString("hex");
    return { hash: scryptSync(password, salt, 64).toString("hex"), salt };
}

export function verifyPasswordSecret(
    password: string,
    hash: string | null,
    salt: string | null
): boolean {
    if (!hash || !salt) return false;
    const expected = Buffer.from(hash, "hex");
    const actual = scryptSync(password, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

