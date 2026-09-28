import { Alert, Button, Card, Empty, Form, Input, Select, Space, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { formatDate } from "../utils/format";
import type { Feedback } from "../types";

interface FeedbackFormValues {
  type: string;
  title: string;
  content: string;
}

export default function FeedbackPage() {
  const { t } = useTranslation();
  const { locale } = useParams<{ locale: string }>();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm<FeedbackFormValues>();

  useEffect(() => {
    void loadFeedback();
  }, []);

  async function loadFeedback() {
    setLoading(true);
    try {
      const { feedback: list } = await api.getFeedback();
      setFeedback(list);
      setError(null);
    } catch {
      setError("error.server_error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: FeedbackFormValues) {
    setSubmitting(true);
    try {
      await api.createFeedback(values);
      form.resetFields();
      setError(null);
      await loadFeedback();
    } catch {
      setError("error.server_error");
    } finally {
      setSubmitting(false);
    }
  }

  function statusLabel(status: string): string {
    if (status === "open") return t("admin.status_open");
    if (status === "replied") return t("admin.status_replied");
    if (status === "resolved") return t("admin.status_resolved");
    return t("admin.status_closed");
  }

  function typeLabel(type: string): string {
    if (type === "bug") return t("feedback.type_bug");
    if (type === "suggestion") return t("feedback.type_suggestion");
    if (type === "question_error") return t("feedback.type_question_error");
    return t("feedback.type_other");
  }

  const typeOptions = [
    { value: "bug", label: t("feedback.type_bug") },
    { value: "suggestion", label: t("feedback.type_suggestion") },
    { value: "question_error", label: t("feedback.type_question_error") },
    { value: "other", label: t("feedback.type_other") },
  ];

  return (
    <div className="page-container">
      <div className="page-heading">
        <Space direction="vertical" size={0}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            {t("nav.feedback")}
          </Typography.Title>
          <Typography.Text type="secondary">{t("feedback.subtitle")}</Typography.Text>
        </Space>
        <Tag color="blue">{feedback.length}</Tag>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message={t(error)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card title={t("feedback.submit")} style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ type: "other" }}
        >
          <Form.Item name="type" label={t("feedback.type")} rules={[{ required: true }]}>
            <Select options={typeOptions} />
          </Form.Item>
          <Form.Item
            name="title"
            label={t("common.title")}
            rules={[{ required: true, min: 2, max: 100 }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="content"
            label={t("feedback.content")}
            rules={[{ required: true, min: 5 }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            {t("common.submit")}
          </Button>
        </Form>
      </Card>

      <Card title={t("feedback.my_feedback")} loading={loading}>
        {feedback.length === 0 ? (
          <Empty description={t("common.empty")} />
        ) : (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            {feedback.map((item) => (
              <Card key={item.id} size="small">
                <div className="feedback-item-header">
                  <Typography.Text strong>{item.title}</Typography.Text>
                  <Space wrap>
                    <Tag>{typeLabel(item.type)}</Tag>
                    <Tag
                      color={
                        item.status === "open"
                          ? "blue"
                          : item.status === "resolved"
                            ? "green"
                            : "default"
                      }
                    >
                      {statusLabel(item.status)}
                    </Tag>
                  </Space>
                </div>
                <Typography.Paragraph style={{ marginTop: 8 }}>
                  {item.content}
                </Typography.Paragraph>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {formatDate(item.createdAt, locale)}
                </Typography.Text>
                {item.reply && (
                  <div className="feedback-reply">
                    <Typography.Text type="secondary">
                      {t("feedback.reply")}:
                    </Typography.Text>
                    <Typography.Paragraph style={{ marginTop: 4 }}>
                      {item.reply}
                    </Typography.Paragraph>
                  </div>
                )}
              </Card>
            ))}
          </Space>
        )}
      </Card>
    </div>
  );
}
