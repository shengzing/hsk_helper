import { Alert, Button, Card, Form, Input, InputNumber, Modal, Select, Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { AdminPaper } from "../../types";

export default function AdminPapersPage() {
  const { t } = useTranslation();
  const [papers, setPapers] = useState<AdminPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => { void loadPapers(); }, []);

  async function loadPapers() {
    setLoading(true);
    try {
      const { papers: list } = await api.adminGetPapers();
      setPapers(list);
    } catch {
      setError("error.server_error");
    }
    finally { setLoading(false); }
  }

  async function handleCreate() {
    const values = await form.validateFields();
    try {
      await api.adminCreatePaper({
        bankId: values.bankId,
        title: values.title,
        paperType: values.paperType,
        year: values.year,
        session: values.session,
        durationSeconds: values.durationMinutes * 60,
        totalScore: values.totalScore,
        passingScore: values.passingScore,
      });
      setError(null);
      setModalOpen(false);
      form.resetFields();
      await loadPapers();
    } catch {
      setError("error.server_error");
    }
  }

  async function handleStatusChange(paperId: string, status: string) {
    try {
      await api.adminUpdatePaper(paperId, { status: status as "draft" | "published" });
      setError(null);
      await loadPapers();
    } catch {
      setError("error.server_error");
    }
  }

  const columns = [
    { title: t("common.title"), dataIndex: "title", key: "title" },
    { title: t("common.level"), dataIndex: "bankLevel", key: "bankLevel", render: (v: number) => <Tag color="blue">HSK {v}</Tag> },
    { title: t("common.type"), dataIndex: "paperType", key: "paperType", render: (v: string) => <Tag>{v === "past" ? t("paper.type_past") : t("paper.type_mock")}</Tag> },
    { title: t("common.questions"), dataIndex: "questionCount", key: "questionCount" },
    {
      title: t("common.status"),
      key: "status",
      render: (_: unknown, record: AdminPaper) => (
        <Select
          size="small"
          value={record.status}
          style={{ width: 120 }}
          onChange={(v) => handleStatusChange(record.id, v)}
          options={[
            { value: "draft", label: t("paper.status_draft") },
            { value: "published", label: t("paper.status_published") },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="admin-page" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>{t("admin.papers")}</Typography.Title>
        <Button type="primary" onClick={() => setModalOpen(true)}>{t("admin.create_paper")}</Button>
      </div>
      <Card>
        {error && <Alert type="error" showIcon message={t(error)} style={{ marginBottom: 16 }} />}
        <Table dataSource={papers} columns={columns} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 20 }} />
      </Card>
      <Modal title={t("admin.create_paper")} open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label={t("common.title")} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="bankId" label={t("common.level")} rules={[{ required: true }]} initialValue="hsk-level-1">
            <Select options={[1, 2, 3, 4, 5, 6].map(level => ({ value: `hsk-level-${level}`, label: `HSK ${level}` }))} />
          </Form.Item>
          <Form.Item name="paperType" label={t("common.type")} initialValue="past">
            <Select options={[{ value: "past", label: t("paper.type_past") }, { value: "mock", label: t("paper.type_mock") }]} />
          </Form.Item>
          <Form.Item name="durationMinutes" label={t("common.duration")} rules={[{ required: true }]} initialValue={90}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="totalScore" label={t("report.total_score")} rules={[{ required: true }]} initialValue={100}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="passingScore" label={t("admin.passing_score")} rules={[{ required: true }]} initialValue={60}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="year" label={t("admin.year")}>
            <InputNumber min={2000} max={2100} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="session" label={t("admin.session")}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
