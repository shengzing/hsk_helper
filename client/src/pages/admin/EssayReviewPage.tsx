import { Alert, Button, Card, Col, Form, Input, InputNumber, Row, Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { EssayReviewItem } from "../../types";

export default function EssayReviewPage() {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<EssayReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<EssayReviewItem | null>(null);
  const [score, setScore] = useState<number | undefined>();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadReviews();
  }, []);

  async function loadReviews() {
    setLoading(true);
    try {
      const { reviews: list } = await api.adminGetEssayReviews();
      setReviews(list);
    } catch {
      setError("error.server_error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!selected) return;
    try {
      await api.adminUpdateEssayReview(selected.resultId, {
        score,
        reviewComment: comment,
        completed: true,
      });
      setSelected(null);
      setScore(undefined);
      setComment("");
      await loadReviews();
    } catch {
      setError("error.server_error");
    }
  }

  const columns = [
    {
      title: "ID",
      dataIndex: "resultId",
      key: "resultId",
      width: 120,
    },
    {
      title: t("common.type"),
      dataIndex: "questionType",
      key: "questionType",
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: t("common.status"),
      dataIndex: "status",
      key: "status",
      render: (v: string) => <Tag color={v === "manual_pending" ? "orange" : "default"}>{v}</Tag>,
    },
    {
      title: t("report.your_answer"),
      dataIndex: "answer",
      key: "answer",
      render: (v: string) => (
        <Typography.Text ellipsis style={{ maxWidth: 200 }}>{v}</Typography.Text>
      ),
    },
    {
      title: t("common.actions"),
      key: "actions",
      render: (_: unknown, record: EssayReviewItem) => (
        <Button size="small" onClick={() => {
          setSelected(record);
          setScore(record.score);
          setComment(record.reviewComment ?? "");
        }}>
          {t("admin.review")}
        </Button>
      ),
    },
  ];

  return (
    <div className="admin-page" style={{ padding: 24 }}>
      <Typography.Title level={3} style={{ marginBottom: 16 }}>{t("admin.essay_reviews")}</Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        {error && <Alert type="error" showIcon message={t(error)} style={{ marginBottom: 16 }} />}
        <Table
          dataSource={reviews}
          columns={columns}
          rowKey="resultId"
          loading={loading}
          size="small"
          pagination={{ pageSize: 20 }}
        />
      </Card>

      {selected && (
        <Card title={`${t("admin.review")} — ${selected.resultId}`}>
          <Row gutter={24}>
            <Col span={16}>
              <Typography.Paragraph>{selected.answer}</Typography.Paragraph>
            </Col>
            <Col span={8}>
              <Form layout="vertical">
                <Form.Item label={t("common.score")}>
                  <InputNumber
                    value={score}
                    onChange={(v) => setScore(v ?? undefined)}
                    min={0}
                    max={100}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <Form.Item label={t("report.explanation")}>
                  <Input.TextArea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                  />
                </Form.Item>
                <Button type="primary" onClick={handleSubmit}>{t("common.submit")}</Button>
              </Form>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
}
