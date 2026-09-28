import { createTestDb, type TestDb } from "./helpers/db.js";

describe("Seed data", () => {
  let db: TestDb;

  beforeAll(() => {
    db = createTestDb();
  });

  it("creates 6 HSK level banks (levels 1-6)", () => {
    const banks = db
      .prepare("SELECT level FROM question_banks ORDER BY level")
      .all() as { level: number }[];
    expect(banks).toHaveLength(6);
    expect(banks.map((b) => b.level)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("sets all banks to published status", () => {
    const banks = db
      .prepare("SELECT DISTINCT status FROM question_banks")
      .all() as { status: string }[];
    expect(banks).toHaveLength(1);
    expect(banks[0].status).toBe("published");
  });

  it("creates 10 supported locales", () => {
    const count = db
      .prepare("SELECT COUNT(*) as count FROM supported_locales")
      .get() as { count: number };
    expect(count.count).toBe(10);
  });

  it("marks zh-CN as the default locale", () => {
    const zhCN = db
      .prepare("SELECT is_default FROM supported_locales WHERE id = 'zh-CN'")
      .get() as { is_default: number };
    expect(zhCN.is_default).toBe(1);
  });

  it("sets ar and ur-PK direction to rtl", () => {
    const rtl = db
      .prepare("SELECT id FROM supported_locales WHERE direction = 'rtl' ORDER BY id")
      .all() as { id: string }[];
    expect(rtl.map((r) => r.id)).toEqual(["ar", "ur-PK"]);
  });

  it("creates default admin user with is_admin = 1", () => {
    const admin = db
      .prepare("SELECT username, is_admin FROM users WHERE username = 'admin'")
      .get() as { username: string; is_admin: number };
    expect(admin).toBeDefined();
    expect(admin.is_admin).toBe(1);
  });

  it("creates default student user with is_admin = 0", () => {
    const student = db
      .prepare("SELECT username, is_admin FROM users WHERE username = 'student'")
      .get() as { username: string; is_admin: number };
    expect(student).toBeDefined();
    expect(student.is_admin).toBe(0);
  });

  it("creates active subscription for student to HSK4", () => {
    const sub = db
      .prepare(
        "SELECT status, bank_id FROM bank_subscriptions WHERE user_id = 'user-student' AND bank_id = 'hsk-level-4'"
      )
      .get() as { status: string; bank_id: string };
    expect(sub).toBeDefined();
    expect(sub.status).toBe("active");
  });

  it("creates H61438 paper under HSK level 6", () => {
    const paper = db
      .prepare(
        "SELECT bank_id, duration_seconds, total_score, passing_score, status FROM past_exam_papers WHERE id = 'paper-h61438'"
      )
      .get() as {
        bank_id: string;
        duration_seconds: number;
        total_score: number;
        passing_score: number;
        status: string;
      };
    expect(paper).toBeDefined();
    expect(paper.bank_id).toBe("hsk-level-6");
    expect(paper.duration_seconds).toBe(8400);
    expect(paper.total_score).toBe(300);
    expect(paper.passing_score).toBe(180);
    expect(paper.status).toBe("published");
  });

  it("creates 3 sections for H61438 (listening, reading, writing)", () => {
    const sections = db
      .prepare(
        "SELECT code, display_order FROM paper_sections WHERE paper_id = 'paper-h61438' ORDER BY display_order"
      )
      .all() as { code: string; display_order: number }[];
    expect(sections).toHaveLength(3);
    expect(sections.map((s) => s.code)).toEqual(["listening", "reading", "writing"]);
  });

  it("creates admin operation log for seed subscription", () => {
    const log = db
      .prepare(
        "SELECT action, operator_id, object_type, object_id FROM admin_operation_logs WHERE object_id = 'sub-student-hsk4'"
      )
      .get() as {
        action: string;
        operator_id: string;
        object_type: string;
        object_id: string;
      };
    expect(log).toBeDefined();
    expect(log.action).toBe("create");
    expect(log.operator_id).toBe("user-admin");
    expect(log.object_type).toBe("subscription");
  });
});
