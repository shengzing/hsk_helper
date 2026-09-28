import { Badge } from "antd";
import { useTranslation } from "react-i18next";
import type { AnswerMap, PaperDetail, SectionCode } from "../../types";

interface AnswerSheetProps {
  paper: PaperDetail;
  answers: AnswerMap;
  currentIndex: number;
  onSelect: (index: number) => void;
  reviewResults?: Record<string, { isCorrect: boolean }> | null;
}

interface FlatQuestion {
  id: string;
  globalIndex: number;
  sectionIndex: number;
  sectionCode: SectionCode;
  displayOrder: number;
  partNumber: number | null;
  answered: boolean;
  isCorrect: boolean | null;
}

function rangeLabel(questions: FlatQuestion[]): string {
  if (questions.length === 0) return "";
  const first = questions[0].displayOrder;
  const last = questions[questions.length - 1].displayOrder;
  return first === last ? `第 ${first} 题` : `第 ${first}-${last} 题`;
}

export default function AnswerSheet({
  paper,
  answers,
  currentIndex,
  onSelect,
  reviewResults,
}: AnswerSheetProps) {
  const { t } = useTranslation();

  const flatQuestions: FlatQuestion[] = [];
  paper.sections.forEach((section, sectionIndex) => {
    section.groups.forEach((group) => {
      const partByQuestionNumber = new Map<number, number>();
      group.payload?.parts?.forEach((part) => {
        part.questionNumbers.forEach((number) => {
          partByQuestionNumber.set(number, part.partNumber);
        });
      });

      group.questions.forEach((question) => {
        flatQuestions.push({
          id: question.id,
          globalIndex: flatQuestions.length,
          sectionIndex,
          sectionCode: section.code,
          displayOrder: question.displayOrder,
          partNumber: partByQuestionNumber.get(question.displayOrder)
            ?? group.payload?.partNumber
            ?? null,
          answered: Boolean(answers[question.id]),
          isCorrect: reviewResults?.[question.id]?.isCorrect ?? null,
        });
      });
    });
  });

  const groupedSections = paper.sections.map((section, sectionIndex) => {
    const sectionQuestions = flatQuestions.filter(
      (question) => question.sectionIndex === sectionIndex
    );
    const partNumbers = [
      ...new Set(
        sectionQuestions
          .map((question) => question.partNumber)
          .filter((partNumber): partNumber is number => partNumber !== null)
      ),
    ].sort((a, b) => a - b);

    const groups = partNumbers.length > 0
      ? partNumbers.map((partNumber) => ({
          key: `part-${partNumber}`,
          label: `第 ${partNumber} 部分`,
          questions: sectionQuestions.filter(
            (question) => question.partNumber === partNumber
          ),
        }))
      : [{
          key: "all",
          label: rangeLabel(sectionQuestions) || t("common.empty"),
          questions: sectionQuestions,
        }];

    return { section, groups };
  });

  const answeredCount = flatQuestions.filter((question) => question.answered).length;
  const total = flatQuestions.length;

  function sectionLabel(code: SectionCode): string {
    return code === "listening" ? t("exam.section_listening")
      : code === "reading" ? t("exam.section_reading")
      : t("exam.section_writing");
  }

  return (
    <div className="answer-sheet">
      <div className="answer-sheet-header">
        <strong>{t("exam.answer_sheet")}</strong>
        <Badge
          count={`${answeredCount}/${total}`}
          style={{ backgroundColor: "#1677ff" }}
        />
      </div>
      <div className="answer-groups">
        {groupedSections.map(({ section, groups }) => {
          const sectionQuestions = flatQuestions.filter(
            (question) => question.sectionCode === section.code
          );
          const sectionAnswered = sectionQuestions.filter(
            (question) => question.answered
          ).length;
          return (
            <section className="answer-group" key={section.id}>
              <div className="answer-group-header">
                <span className="answer-group-title">{sectionLabel(section.code)}</span>
                <span className="answer-group-meta">
                  {sectionAnswered}/{sectionQuestions.length}
                </span>
              </div>
              {groups.map((group) => {
                const groupAnswered = group.questions.filter(
                  (question) => question.answered
                ).length;
                return (
                  <div className="answer-subgroup" key={`${section.id}-${group.key}`}>
                    <div className="answer-subgroup-header">
                      <span>
                        {group.label}
                        {group.key !== "all" && group.questions.length > 0 && (
                          <span className="answer-subgroup-range">
                            {rangeLabel(group.questions)}
                          </span>
                        )}
                      </span>
                      <span className="answer-group-meta">
                        {groupAnswered}/{group.questions.length}
                      </span>
                    </div>
                    <div className="answer-grid">
                      {group.questions.map((question) => (
                        <button
                          key={question.id}
                          className={`answer-item ${question.answered ? "answered" : ""} ${question.globalIndex === currentIndex ? "current" : ""} ${question.isCorrect === true ? "correct" : ""} ${question.isCorrect === false ? "wrong" : ""}`}
                          onClick={() => onSelect(question.globalIndex)}
                          aria-current={question.globalIndex === currentIndex ? "true" : undefined}
                        >
                          {question.globalIndex + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
      <div className="answer-sheet-legend">
        <span className="legend-item">
          <span className="legend-dot answered" /> {t("exam.answered")}
        </span>
        <span className="legend-item">
          <span className="legend-dot" /> {t("exam.unanswered")}
        </span>
        {reviewResults && (
          <>
            <span className="legend-item">
              <span className="legend-dot correct" /> {t("report.correct")}
            </span>
            <span className="legend-item">
              <span className="legend-dot wrong" /> {t("report.wrong")}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
