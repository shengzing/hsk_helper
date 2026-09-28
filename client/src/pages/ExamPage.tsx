import { AppstoreOutlined, ArrowLeftOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { Button, Card, Drawer, Grid, Modal, Result, Spin, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import AnswerSheet from "../components/exam/AnswerSheet";
import QuestionReviewPanel from "../components/exam/QuestionReviewPanel";
import MaterialPanel from "../components/exam/MaterialPanel";
import SectionTimer from "../components/exam/SectionTimer";
import QuestionRenderer from "../components/questions/QuestionRenderer";
import { api } from "../api";
import { AttemptProvider, useAttemptStore } from "../stores/attemptStore";
import type { PaperSection } from "../types";
import type { AnswerValue } from "../types";

/** Creates attempt from paperId, then renders exam content */
export default function ExamPage() {
  const { paperId } = useParams<{ paperId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { locale } = useParams<{ locale: string }>();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paperId) return;
    let cancelled = false;
    (async () => {
      try {
        const { attempt } = await api.createAttempt(paperId);
        if (!cancelled) setAttemptId(attempt.id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to start attempt");
      }
    })();
    return () => { cancelled = true; };
  }, [paperId]);

  if (error) {
    return (
      <div className="page-container">
        <Result
          status="error"
          title={t("error.server_error")}
          subTitle={error}
          extra={
            <Button onClick={() => navigate(`/${locale}/banks`)}>
              {t("common.back")}
            </Button>
          }
        />
      </div>
    );
  }

  if (!attemptId) {
    return (
      <div className="page-container" style={{ textAlign: "center", padding: 64 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <AttemptProvider attemptId={attemptId}>
      <ExamContent />
    </AttemptProvider>
  );
}

function ExamContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { locale } = useParams<{ locale: string }>();
  const isChinese = locale?.startsWith("zh") ?? false;
  const store = useAttemptStore();
  const screens = Grid.useBreakpoint();
  const [answerDrawerOpen, setAnswerDrawerOpen] = useState(false);
  const isDesktop = screens.lg === true;

  useEffect(() => {
    if (!store.attempt || store.submitted) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [store.attempt, store.submitted]);

  if (store.loading) {
    return (
      <div className="page-container" style={{ textAlign: "center", padding: 64 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (store.error) {
    return (
      <div className="page-container">
        <Result status="error" title={t("error.server_error")} subTitle={store.error} />
      </div>
    );
  }

  if (!store.attempt || !store.paper) {
    return (
      <div className="page-container">
        <Result status="warning" title={t("common.empty")} />
      </div>
    );
  }

  const attemptId = store.attempt.id;
  const paper = store.paper;



  const questionEntries = paper.sections.flatMap((section) =>
    section.groups.flatMap((group) =>
      group.questions.map((question) => ({ section, group, question })),
    ),
  );
  const currentEntry = questionEntries[store.currentIndex];
  const currentQuestion = currentEntry?.question;
  const currentQuestionNumber = currentQuestion?.displayOrder ?? store.currentIndex + 1;
  const currentPartNumber = currentQuestion
    ? currentEntry?.group.payload?.parts?.find((part) =>
        part.questionNumbers.includes(currentQuestion.displayOrder)
      )?.partNumber
      ?? currentEntry?.group.payload?.partNumber
      ?? null
    : null;
  const answerSheet = (
    <AnswerSheet
      paper={paper}
      answers={store.answers}
      currentIndex={store.currentIndex}
      reviewResults={store.submitted ? store.reviewResults : undefined}
      onSelect={(index) => {
        store.goToIndex(index);
        if (!isDesktop) setAnswerDrawerOpen(false);
      }}
    />
  );

  function handleSubmit() {
    Modal.confirm({
      title: t("exam.submit_confirm"),
      onOk: () => store.submit(),
    });
  }

  function getCurrentSection(): PaperSection | null {
    let acc = 0;
    for (const section of paper.sections) {
      const sectionLength = section.groups.reduce(
        (sum, group) => sum + group.questions.length,
        0,
      );
      if (store.currentIndex < acc + sectionLength) return section;
      acc += sectionLength;
    }
    return paper.sections[0] ?? null;
  }

  const currentSection = getCurrentSection();
  const sectionTitleKey = currentSection?.code === "listening" ? "exam.section_listening"
    : currentSection?.code === "reading" ? "exam.section_reading"
    : "exam.section_writing";

  return (
    <div className="quiz-layout">
      {/* Left: answer sheet */}
      {isDesktop ? (
        <Card className="answer-card" title={t("exam.answer_sheet")}>
          {answerSheet}
        </Card>
      ) : (
        <Drawer
          title={t("exam.answer_sheet")}
          open={answerDrawerOpen}
          onClose={() => setAnswerDrawerOpen(false)}
          width={320}
        >
          {answerSheet}
        </Drawer>
      )}

      {/* Right: question area */}
      <div className="exam-area">
        <Card className="paper-header">
          <div className="paper-header-info">
            <Typography.Text strong>
              {t(sectionTitleKey)}
              {currentPartNumber !== null && ` — 第 ${currentPartNumber} 部分`}
              {` — 第 ${currentQuestionNumber} 题`}
              {!isChinese && (
                <span className="exam-translation">
                  {currentPartNumber !== null && t("exam.part_translation", { number: currentPartNumber })}
                  {currentPartNumber !== null && " — "}
                  {t("exam.question_translation", { number: currentQuestionNumber })}
                </span>
              )}
            </Typography.Text>
            <div className="paper-meta">
              {store.saving ? t("common.loading") : t("exam.auto_saved")}
            </div>
          </div>
          <div className="quiz-actions">
            {!isDesktop && (
              <Button icon={<AppstoreOutlined />} onClick={() => setAnswerDrawerOpen(true)}>
                {t("exam.answer_sheet")}
              </Button>
            )}
            <SectionTimer remainingSeconds={store.remainingSeconds} />
            {store.submitted ? (
              <Button type="primary" onClick={() => navigate(`/${locale}/attempts/${attemptId}/report`)}>
                {t("report.title")}
              </Button>
            ) : (
              <Button type="primary" onClick={handleSubmit}>
                {t("common.submit")}
              </Button>
            )}
          </div>
        </Card>

        {currentEntry?.group.instruction && currentQuestion?.questionType !== "essay" && (
          <MaterialPanel
            key={currentEntry.group.id}
            group={currentEntry.group}
            attemptId={attemptId}
            currentQuestionNumber={currentQuestion?.displayOrder}
            disabled={store.submitted}
          />
        )}

        <Card className="question-card">
          {currentQuestion && (
            <>
              <div className="question-header">
                <Typography.Text className="question-title">
                  {`第 ${currentQuestion.displayOrder} 题`}
                  {!isChinese && (
                    <span className="exam-translation">
                      {t("exam.question_translation", { number: currentQuestion.displayOrder })}
                    </span>
                  )}
                </Typography.Text>
                <span className="question-meta">
                  {t("common.score")}: {currentQuestion.score}
                </span>
              </div>
              <QuestionRenderer
                question={currentQuestion}
                value={store.answers[currentQuestion.id] ?? null}
                onChange={(v: AnswerValue) => store.setAnswer(currentQuestion.id, v)}
                disabled={store.submitted}
              />
              {store.submitted && store.reviewResults[currentQuestion.id] && (
                <QuestionReviewPanel review={store.reviewResults[currentQuestion.id]} />
              )}
            </>
          )}
        </Card>

        <div className="question-nav">
          <Button
            icon={<ArrowLeftOutlined />}
            disabled={store.currentIndex === 0}
            onClick={() => store.goToIndex(store.currentIndex - 1)}
          >
            {t("exam.prev")}
          </Button>
          <Button
            type="primary"
            disabled={store.currentIndex >= questionEntries.length - 1}
            onClick={() => store.goToIndex(store.currentIndex + 1)}
          >
            {t("exam.next")} <ArrowRightOutlined />
          </Button>
        </div>
      </div>
    </div>
  );
}
