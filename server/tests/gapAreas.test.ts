import { describe, it, expect } from "vitest";

/**
 * Gap area tests — documents features not yet implemented.
 * These tests use describe.skip to signal what needs coverage
 * once the business code lands.
 *
 * Last reviewed: 2026-09-23 (round 5)
 */

describe.skip("Records API (not implemented)", () => {
  it("GET /api/records returns user's attempt history");
  it("records include paper title, score, date, mode");
  it("records are scoped to the authenticated user");
  it("non-authenticated request returns 401");
});

describe.skip("Knowledge API (not implemented)", () => {
  it("GET /api/knowledge returns knowledge points");
  it("knowledge is scoped by bank/level");
  it("knowledge items include vocabulary, grammar, tips");
  it("non-subscribed user cannot access knowledge");
});

describe.skip("PDF import parsing (T016/T017 — pending full implementation)", () => {
  it("POST /api/admin/imports creates an import job");
  it("POST /api/admin/imports/:id/parse parses PDF and extracts questions");
  it("parsed output includes sections, questions, answers, assets");
  it("Zod validation catches invalid question payloads");
  it("answer key validation rejects missing/duplicate/out-of-range keys");
  it("audio transcode records duration and checksum");
  it("publish endpoint creates paper + questions + sections in one transaction");
});

describe.skip("Anti-scraping / question image security", () => {
  it("question image payloads are only returned through authenticated paper detail");
  it("image assets require valid attempt + subscription");
  it("answer images are not exposed before submission");
  it("paper detail does not expose reference_essay or accepted_values");
});

describe.skip("Import validation integrity (T018)", () => {
  it("answer keys match option pools");
  it("section question counts match official structure");
  it("duplicate question IDs are rejected");
  it("audio file existence is verified");
  it("checksum is recorded after transcode");
});
