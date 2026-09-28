import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface ImportedGroup {
    key: string;
    instruction: string;
    material?: string;
    questionNumbers: number[];
    payload?: {
        partNumber?: number;
        parts?: Array<{
            partNumber: number;
            instruction: string;
            questionNumbers: number[];
        }>;
    };
}

interface ImportedSection {
    code: "listening" | "reading" | "writing";
    questions: Array<{ number: number; explanation?: string }>;
    groups: ImportedGroup[];
}

interface ImportedPaper {
    session: string;
    sections: ImportedSection[];
}

const expectedReadingGroups = [
    "grammar",
    "cloze",
    "blank-71-75",
    "blank-76-80",
    "comprehension-81-84",
    "comprehension-85-88",
    "comprehension-89-92",
    "comprehension-93-96",
    "comprehension-97-100",
];

const papers = ["h61332", "h61438", "h61551", "h61552"].map((session) => {
    const path = fileURLToPath(
        new URL(`../../data/imported/${session}.json`, import.meta.url)
    );
    return JSON.parse(readFileSync(path, "utf8")) as ImportedPaper;

});

describe("Imported HSK document structure", () => {
    it("splits reading into nine typed groups with complete question coverage", () => {
        for (const paper of papers) {
            const reading = paper.sections.find((section) => section.code === "reading");
            expect(reading).toBeDefined();
            expect(reading!.groups.map((group) => group.key)).toEqual(
                expectedReadingGroups
            );

            const questionNumbers = reading!.groups
                .flatMap((group) => group.questionNumbers)
                .sort((a, b) => a - b);
            expect(questionNumbers).toEqual(
                Array.from({ length: 50 }, (_, index) => 51 + index)
            );
            expect(reading!.questions).toHaveLength(50);
        }
    });

    it("stores shared materials for blank and comprehension groups", () => {
        for (const paper of papers) {
            const reading = paper.sections.find((section) => section.code === "reading");
            const sharedGroups = reading!.groups.filter(
                (group) => group.key.startsWith("blank-") || group.key.startsWith("comprehension-")
            );

            expect(sharedGroups).toHaveLength(7);
            for (const group of sharedGroups) {
                expect(group.material?.length ?? 0).toBeGreaterThan(100);
            }
        }
    });

    it("preserves the original HSK part structure", () => {
        for (const paper of papers) {
            const listening = paper.sections.find(
                (section) => section.code === "listening"
            );
            const reading = paper.sections.find((section) => section.code === "reading");

            expect(listening!.groups[0].payload?.parts?.map((part) => part.partNumber))
                .toEqual([1, 2, 3]);
            expect(
                listening!.groups[0].payload?.parts?.flatMap((part) => part.questionNumbers)
            ).toEqual(Array.from({ length: 50 }, (_, index) => index + 1));

            expect(reading!.groups.map((group) => group.payload?.partNumber)).toEqual([
                1, 2, 3, 3, 4, 4, 4, 4, 4,
            ]);
        }
    });

    it("keeps listening and writing groups linked to all questions", () => {
        for (const paper of papers) {
            const listening = paper.sections.find(
                (section) => section.code === "listening"
            );
            const writing = paper.sections.find((section) => section.code === "writing");

            expect(listening!.groups).toHaveLength(1);
            expect(listening!.groups[0].questionNumbers).toEqual(
                Array.from({ length: 50 }, (_, index) => index + 1)
            );
            expect(writing!.groups).toHaveLength(1);
            expect(writing!.groups[0].questionNumbers).toEqual([101]);
            expect(writing!.groups[0].material?.length ?? 0).toBeGreaterThan(100);
        }
    });

    it("uses the high-quality Markdown source for H61332", () => {
        const paper = papers.find((item) => item.session === "h61332");
        expect(paper).toBeDefined();

        const reading = paper!.sections.find((section) => section.code === "reading");
        const objectiveQuestions = reading!.questions;
        expect(objectiveQuestions).toHaveLength(50);

        for (const question of objectiveQuestions) {
            expect(question.number).toBeGreaterThanOrEqual(51);
            expect(question.number).toBeLessThanOrEqual(100);
            if (question.number >= 61 && question.number <= 100) {
                expect(question.stem.length).toBeGreaterThan(5);
            }
        }

        const serialized = JSON.stringify(paper);
        expect(serialized).not.toContain("generic/");
        expect(serialized).not.toContain("H61332 -");
        expect(serialized).not.toContain("H61332-");
    });

    it("isolates each blank-fill stem to its own question number", () => {
        for (const paper of papers) {
            const reading = paper.sections.find((section) => section.code === "reading");
            const blanks = reading!.questions.filter((q) => q.number >= 71 && q.number <= 80);
            for (const question of blanks) {
                for (let other = 71; other <= 80; other += 1) {
                    if (other === question.number) continue;
                    const halfMarker = "(" + other + ")";
                    const fullMarker = "（" + other + "）";
                    expect(question.stem).not.toContain(halfMarker);
                    expect(question.stem).not.toContain(fullMarker);
                }
                const ownHalf = "(" + question.number + ")";
                const ownFull = "（" + question.number + "）";
                expect(
                    question.stem.includes(ownHalf) || question.stem.includes(ownFull)
                ).toBe(true);
            }
        }
    });

    it("supports optional explanation field on every question", () => {
        for (const paper of papers) {
            for (const section of paper.sections) {
                for (const question of section.questions) {
                    if (question.explanation !== undefined) {
                        expect(typeof question.explanation).toBe("string");
                    }
                }
            }
        }
    });
});

