#!/usr/bin/env npx tsx
/**
 * T019 — Convert audio files to browser-friendly formats using ffmpeg.
 *
 * Usage:
 *   npx tsx scripts/convert-media.ts <input.mp3> [--output <output.mp3>] [--bitrate 128k]
 *
 * Outputs:
 * - Converted audio file (MP3 by default)
 * - Prints JSON metadata: { path, duration_ms, checksum }
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";

function main(): void {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("Usage: convert-media.ts <input> [--output <output>] [--bitrate 128k]");
        process.exit(1);
    }

    const inputPath = resolve(args[0]);
    if (!existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        process.exit(1);
    }

    // Parse args
    const outputIdx = args.indexOf("--output");
    const bitrateIdx = args.indexOf("--bitrate");
    const bitrate = bitrateIdx >= 0 && args[bitrateIdx + 1] ? args[bitrateIdx + 1] : "128k";

    const ext = extname(inputPath).toLowerCase();
    const outputPath = outputIdx >= 0 && args[outputIdx + 1]
        ? resolve(args[outputIdx + 1])
        : inputPath.replace(ext, ".mp3");

    // Convert with ffmpeg
    const cmd = `ffmpeg -y -i "${inputPath}" -codec:a libmp3lame -b:a ${bitrate} "${outputPath}" 2>&1`;
    try {
        execSync(cmd, { stdio: "pipe" });
    } catch (e) {
        console.error("ffmpeg conversion failed. Is ffmpeg installed?");
        console.error((e as Error).message);
        process.exit(1);
    }

    // Get duration
    let durationMs: number | null = null;
    try {
        const probe = execSync(
            `ffprobe -v error -show_entries format=duration -of csv=p=0 "${outputPath}"`,
            { encoding: "utf8" }
        ).trim();
        durationMs = Math.round(parseFloat(probe) * 1000);
    } catch {
        // ffprobe might not be available
    }

    // Compute checksum
    const fileBuffer = readFileSync(outputPath);
    const checksum = createHash("sha256").update(fileBuffer).digest("hex");
    const fileStat = statSync(outputPath);

    const metadata = {
        path: outputPath,
        duration_ms: durationMs,
        file_size: fileStat.size,
        checksum,
        mime_type: "audio/mpeg",
    };

    const metaPath = outputPath.replace(/\.mp3$/, ".meta.json");
    writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

    console.log(JSON.stringify(metadata, null, 2));
    console.log(`\nMetadata written to: ${metaPath}`);
}

main();

