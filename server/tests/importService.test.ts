import { describe, it, expect, beforeEach } from "vitest";
import { createJob } from "../src/services/importService.js";
import {
  createImportJob,
  getImportJob,
  listImportJobs,
  updateImportJob,
} from "../src/repositories/importRepository.js";
import { createTestDbWithUsers, type TestDb } from "./helpers/db.js";

describe("Import service and repository", () => {
  let db: TestDb;
  const adminId = "user-admin";

  beforeEach(() => {
    db = createTestDbWithUsers();
  });

  describe("createImportJob", () => {
    it("creates a pending import job", () => {
      const id = createImportJob(db, {
        bankId: "hsk-level-6",
        sourceDir: "docs/61438",
        operatorId: adminId,
        note: "H61438 import",
      });
      expect(id).toMatch(/^import-/);
      const job = getImportJob(db, id);
      expect(job).toBeDefined();
      expect(job!.status).toBe("pending");
      expect(job!.bank_id).toBe("hsk-level-6");
      expect(job!.source_dir).toBe("docs/61438");
      expect(job!.operator_id).toBe(adminId);
      expect(job!.note).toBe("H61438 import");
    });

    it("job ID is unique", () => {
      const id1 = createImportJob(db, { bankId: "hsk-level-1", operatorId: adminId });
      const id2 = createImportJob(db, { bankId: "hsk-level-1", operatorId: adminId });
      expect(id1).not.toBe(id2);
    });
  });

  describe("getImportJob", () => {
    it("returns undefined for non-existent job", () => {
      expect(getImportJob(db, "import-nonexistent")).toBeUndefined();
    });
  });

  describe("listImportJobs", () => {
    it("returns all jobs ordered by created_at DESC", () => {
      createImportJob(db, { bankId: "hsk-level-1", operatorId: adminId, note: "first" });
      createImportJob(db, { bankId: "hsk-level-2", operatorId: adminId, note: "second" });
      const jobs = listImportJobs(db);
      expect(jobs.length).toBeGreaterThanOrEqual(2);
    });

    it("returns empty list when no jobs exist", () => {
      expect(listImportJobs(db)).toEqual([]);
    });
  });

  describe("updateImportJob", () => {
    it("updates status", () => {
      const id = createImportJob(db, { bankId: "hsk-level-3", operatorId: adminId });
      updateImportJob(db, id, { status: "parsing" });
      expect(getImportJob(db, id)!.status).toBe("parsing");
    });

    it("updates parsed_json and paper_id", () => {
      const id = createImportJob(db, { bankId: "hsk-level-4", operatorId: adminId });
      updateImportJob(db, id, {
        status: "parsed",
        paperId: "paper-h61438",
        parsedJson: '{"sections":[]}',
      });
      const job = getImportJob(db, id);
      expect(job!.status).toBe("parsed");
      expect(job!.paper_id).toBe("paper-h61438");
      expect(job!.parsed_json).toBe('{"sections":[]}');
    });

    it("updates validation_errors_json", () => {
      const id = createImportJob(db, { bankId: "hsk-level-5", operatorId: adminId });
      updateImportJob(db, id, {
        status: "failed",
        validationErrorsJson: '["missing answer key"]',
      });
      expect(getImportJob(db, id)!.validation_errors_json).toBe('["missing answer key"]');
    });

    it("no-op when no fields provided", () => {
      const id = createImportJob(db, { bankId: "hsk-level-6", operatorId: adminId });
      const before = getImportJob(db, id);
      updateImportJob(db, id, {});
      const after = getImportJob(db, id);
      expect(after!.status).toBe(before!.status);
    });
  });

  describe("createJob (service-level)", () => {
    it("creates job via service", () => {
      const id = createJob(db, {
        bankId: "hsk-level-6",
        sourceDir: "docs/61551",
        operatorId: adminId,
        note: "H61551 import",
      });
      expect(id).toMatch(/^import-/);
      const job = getImportJob(db, id);
      expect(job!.bank_id).toBe("hsk-level-6");
      expect(job!.source_dir).toBe("docs/61551");
    });
  });
});
