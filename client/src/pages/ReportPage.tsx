import { Card, Col, Empty, Row, Skeleton, Space, Statistic, Tag, Typography } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { api } from "../api";
import type { AttemptReport } from "../types";

interface ReportPageProps {
  attemptId?: string;
}

function answerText(answer: unknown): string {
  if (!answer) return "—";
  const a = answer as Record<string, unknown>;
  if (a.type === "choice" || a.type === "fill" || a.type === "text" || "value" in a) {
    return String(a.value);
  }
  if (a.type === "boolean") return a.value ? "✓" : "✗";
  if (a.type === "order" || a.type === "word_order") return (a.value as string[]).join(", ");
  if (a.type === "essay") return (a.value as string).slice(0, 80) + "...";
  return JSON.stringify(a.value);
}

export default function ReportPage({ attemptId: propAttemptId }: ReportPageProps) {
  const { t } = useTranslation();
  const { attemptId: routeAttemptId } = useParams<{ attemptId: string }>();
  const attemptId = propAttemptId ?? routeAttemptId;
  const [report, setReport] = useState<AttemptReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!attemptId) return;
    let cancelled = false;
    (async () => {
      try {
        const { report: r } = await api.getReport(attemptId);
        if (!cancelled) setReport(r);
      } catch {
        // error handled by null report
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [attemptId]);

  if (loading) {
    return <div className="page-container"><Skeleton active paragraph={{ rows: 8 }} /></div>;
  }

  if (!report) {
    return (
      <div className="page-container">
        <Empty description={t("common.not_implemented")} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <Typography.Title level={2}>{t("report.title")}</Typography.Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title={t("report.total_score")}
              value={report.totalScore}
              suffix={`/ ${report.passingScore}`}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t("report.objective_score")} value={report.objectiveScore} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t("report.subjective_score")} value={report.subjectiveScore} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t("common.status")}
              value={report.passed ? "PASS" : "FAIL"}
              valueStyle={{ color: report.passed ? "#3f8600" : "#cf1322" }}
            />
          </Card>
        </Col>
      </Row>

      {report.sections.map((section) => (
        <Card
          key={section.sectionId}
          title={
            <Space>
              <Tag color="blue">
                {section.code === "listening" ? t("exam.section_listening")
                  : section.code === "reading" ? t("exam.section_reading")
                  : t("exam.section_writing")}
              </Tag>
              <Typography.Text>{section.scaledScore}</Typography.Text>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          {section.results.map((result) => (
            <div key={result.id} className="report-question-row">
              <div className="report-question-header">
                <Space>
                  {result.isCorrect
                    ? <CheckCircleOutlined style={{ color: "#52c41a" }} />
                    : <CloseCircleOutlined style={{ color: "#ff4d4f" }} />}
                  <Typography.Text strong>#{result.paperQuestionId}</Typography.Text>
                  <Tag>{result.questionType}</Tag>
                  <Typography.Text type="secondary">
                    {result.finalScore} / {result.rawScore}
                  </Typography.Text>
                </Space>
              </div>
              <div className="report-answers">
                <div>
                  <Typography.Text type="secondary">{t("report.your_answer")}:</Typography.Text>{" "}
                  {answerText(result.answer)}
                </div>
                <div>
                  <Typography.Text type="secondary">{t("report.correct_answer")}:</Typography.Text>{" "}
                  {answerText(result.correctAnswer)}
                </div>
              </div>
              {result.explanation && (
                <div className="explanation">{result.explanation}</div>
              )}
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
