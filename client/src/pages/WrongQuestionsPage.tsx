import { Card, Col, Empty, Row, Select, Skeleton, Space, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import type { SectionCode, WrongQuestion } from "../types";

export default function WrongQuestionsPage() {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<WrongQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<number | undefined>();
  const [filterSection, setFilterSection] = useState<SectionCode | undefined>();
  const [filterType, setFilterType] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { wrongQuestions: wq } = await api.getWrongQuestions();
        if (!cancelled) setQuestions(wq);
      } catch {
        // network error
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = questions.filter((q) => {
    if (filterLevel && q.level !== filterLevel) return false;
    if (filterSection && q.sectionCode !== filterSection) return false;
    if (filterType && q.questionType !== filterType) return false;
    return true;
  });

  const levels = [...new Set(questions.map((q) => q.level))].sort();
  const sections = [...new Set(questions.map((q) => q.sectionCode))];
  const types = [...new Set(questions.map((q) => q.questionType))];

  function sectionLabel(code: SectionCode): string {
    return code === "listening" ? t("exam.section_listening")
      : code === "reading" ? t("exam.section_reading")
      : t("exam.section_writing");
  }

  function answerText(answer: unknown): string {
    if (!answer) return "—";
    const a = answer as Record<string, unknown>;
    return String(a.value ?? JSON.stringify(a));
  }

  if (loading) {
    return <div className="page-container"><Skeleton active paragraph={{ rows: 6 }} /></div>;
  }

  return (
    <div className="page-container">
      <Typography.Title level={2}>{t("nav.wrong_questions")}</Typography.Title>

      <Card className="wrong-filter-card" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Select
              placeholder={t("common.level")}
              allowClear
              style={{ width: "100%" }}
              value={filterLevel}
              onChange={(v) => setFilterLevel(v)}
              options={levels.map((l) => ({ value: l, label: `HSK ${l}` }))}
            />
          </Col>
          <Col span={8}>
            <Select
              placeholder={t("common.type")}
              allowClear
              style={{ width: "100%" }}
              value={filterSection}
              onChange={(v) => setFilterSection(v)}
              options={sections.map((s) => ({ value: s, label: sectionLabel(s) }))}
            />
          </Col>
          <Col span={8}>
            <Select
              placeholder={t("common.type")}
              allowClear
              style={{ width: "100%" }}
              value={filterType}
              onChange={(v) => setFilterType(v)}
              options={types.map((tp) => ({ value: tp, label: tp }))}
            />
          </Col>
        </Row>
      </Card>

      {filtered.length === 0 ? (
        <Empty description={t("common.empty")} />
      ) : (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {filtered.map((q) => (
            <Card key={q.id} size="small">
              <Space style={{ marginBottom: 8 }}>
                <Tag color="blue">HSK {q.level}</Tag>
                <Tag>{sectionLabel(q.sectionCode)}</Tag>
                <Tag color="purple">{q.questionType}</Tag>
              </Space>
              <div className="wrong-question-info">
                <div>
                  <Typography.Text type="secondary">{t("report.your_answer")}:</Typography.Text>{" "}
                  {answerText(q.yourAnswer)}
                </div>
                <div>
                  <Typography.Text type="secondary">{t("report.correct_answer")}:</Typography.Text>{" "}
                  {answerText(q.correctAnswer)}
                </div>
              </div>
              {q.explanation && <div className="explanation">{q.explanation}</div>}
            </Card>
          ))}
        </Space>
      )}
    </div>
  );
}
