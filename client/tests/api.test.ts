import { describe, expect, it, vi } from "vitest";
import { api } from "../src/api";

function mockFetch(payload: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => payload,
  });
}

describe("API response normalization", () => {
  it("unwraps the nested admin stats envelope", async () => {
    const fetchMock = mockFetch({
      data: {
        stats: {
          totalUsers: 2,
          totalBanks: 6,
          totalPapers: 1,
          totalKnowledgeDocs: 25,
          activeSubscriptions: 2,
          completedAttempts: 1,
          openFeedback: 1,
        },
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { stats } = await api.adminGetStats();
    expect(stats.totalUsers).toBe(2);
    expect(stats.openFeedback).toBe(1);
    vi.unstubAllGlobals();
  });

  it("maps admin feedback user fields to the frontend shape", async () => {
    const fetchMock = mockFetch({
      data: [
        {
          id: "fb-1",
          user_id: "user-student",
          userUsername: "student",
          userDisplayName: "张小程",
          type: "suggestion",
          title: "希望增加错题重练功能",
          content: "错题本里的题目如果能直接重练就更好了。",
          status: "open",
          created_at: "2026-09-23T00:00:00.000Z",
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const { feedback } = await api.adminGetFeedback();
    expect(feedback[0].username).toBe("student");
    expect(feedback[0].displayName).toBe("张小程");
    expect(feedback[0].reply).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("maps wrong question bank level to the frontend shape", async () => {
    const fetchMock = mockFetch({
      data: [
        {
          id: "wq-1",
          bankId: "hsk-level-6",
          bankLevel: 6,
          sectionCode: "listening",
          questionType: "single_choice",
          paperQuestionId: "pq-1",
          yourAnswer: null,
          correctAnswer: { value: "C" },
          createdAt: "2026-09-24T00:00:00.000Z",
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const { wrongQuestions } = await api.getWrongQuestions();
    expect(wrongQuestions[0].level).toBe(6);
    expect(wrongQuestions[0].sectionCode).toBe("listening");
    expect(wrongQuestions[0].correctAnswer).toEqual({ value: "C" });
    vi.unstubAllGlobals();
  });

  it("maps record bank level to the frontend shape", async () => {
    const fetchMock = mockFetch({
      data: {
        records: [
          {
            id: "attempt-1",
            paperId: "paper-h61438",
            paperTitle: "HSK 六级真题 H61438",
            bankLevel: 6,
            mode: "exam",
            status: "submitted",
            startedAt: "2026-09-24T00:00:00.000Z",
            submittedAt: "2026-09-24T01:00:00.000Z",
            durationUsedSeconds: 3600,
            totalScore: 180,
            objectiveScore: 180,
            subjectiveScore: 0,
          },
        ],
        stats: { totalAttempts: 1, passed: 1, avgScore: 180 },
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { records, stats } = await api.getRecords();
    expect(records[0].level).toBe(6);
    expect(stats.totalAttempts).toBe(1);
    vi.unstubAllGlobals();
  });
});
