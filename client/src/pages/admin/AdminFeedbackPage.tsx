import { Alert, Button, Card, Input, Modal, Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { Feedback } from "../../types";

export default function AdminFeedbackPage() {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Feedback | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void loadFeedback(); }, []);

  async function loadFeedback() {
    setLoading(true);
    try {
      const { feedback: list } = await api.adminGetFeedback();
      setFeedback(list);
    } catch {
      setError("error.server_error");
    }
    finally { setLoading(false); }
  }

  async function handleReply() {
    if (!selected) return;
    try {
      await api.adminReplyFeedback(selected.id, reply);
      setError(null);
      setSelected(null);
      setReply("");
      await loadFeedback();
    } catch {
      setError("error.server_error");
    }
  }

  async function handleClose(id: string) {
    try {
      await api.adminCloseFeedback(id);
      setError(null);
      await loadFeedback();
    } catch {
      setError("error.server_error");
    }
  }

  function statusLabel(status: string): string {
    if (status === "open") return t("admin.status_open");
    if (status === "replied") return t("admin.status_replied");
    if (status === "resolved") return t("admin.status_resolved");
    return t("admin.status_closed");
  }

  const columns = [
    { title: t("common.title"), dataIndex: "title", key: "title" },
    { title: t("admin.user"), dataIndex: "username", key: "username" },
    { title: t("common.status"), dataIndex: "status", key: "status", render: (v: string) => <Tag color={v === "open" ? "blue" : v === "resolved" ? "green" : "default"}>{statusLabel(v)}</Tag> },
    {
      title: t("common.actions"),
      key: "actions",
      render: (_: unknown, record: Feedback) => (
        <>
          <Button size="small" onClick={() => { setSelected(record); setReply(record.reply ?? ""); }}>{t("admin.reply")}</Button>
          {record.status !== "closed" && (
            <Button size="small" style={{ marginLeft: 4 }} onClick={() => handleClose(record.id)}>{t("admin.close")}</Button>
          )}
        </>
      ),
    },
  ];

  return (
    <div className="admin-page" style={{ padding: 24 }}>
      <Typography.Title level={3} style={{ marginBottom: 16 }}>{t("admin.feedback")}</Typography.Title>
      <Card>
        {error && <Alert type="error" showIcon message={t(error)} style={{ marginBottom: 16 }} />}
        <Table dataSource={feedback} columns={columns} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 20 }} />
      </Card>
      <Modal
        title={`${t("admin.reply")} — ${selected?.title ?? ""}`}
        open={!!selected}
        onOk={handleReply}
        onCancel={() => setSelected(null)}
      >
        {selected && (
          <>
            <Typography.Paragraph type="secondary">{selected.content}</Typography.Paragraph>
            <Input.TextArea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} placeholder={t("admin.reply")} />
          </>
        )}
      </Modal>
    </div>
  );
}
