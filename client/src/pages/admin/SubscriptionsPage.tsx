import { Alert, Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { AdminSubscription, AdminUser } from "../../types";

export default function SubscriptionsPage() {
  const { t } = useTranslation();
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [subsRes, usersRes] = await Promise.all([
        api.adminGetSubscriptions(),
        api.adminGetUsers(),
      ]);
      setSubscriptions(subsRes.subscriptions);
      setUsers(usersRes.users);
    } catch {
      setError("error.server_error");
    } finally {
      setLoading(false);
    }
  }

  function statusColor(status: string): string {
    return status === "active" ? "green" : status === "paused" ? "orange" : "default";
  }

  async function handleCreate() {
    const values = await form.validateFields();
    try {
      await api.adminCreateSubscriptions({
        userIds: values.userIds,
        bankId: values.bankId,
        startsAt: values.startsAt,
        expiresAt: values.expiresAt,
        note: values.note,
      });
      setModalOpen(false);
      form.resetFields();
      await loadData();
    } catch {
      setError("error.server_error");
    }
  }

  async function handleStatusChange(subId: string, status: string) {
    try {
      await api.adminUpdateSubscription(subId, { status });
      await loadData();
    } catch {
      setError("error.server_error");
    }
  }

  const bankOptions = [
    { value: "hsk-level-1", label: "HSK 1" },
    { value: "hsk-level-2", label: "HSK 2" },
    { value: "hsk-level-3", label: "HSK 3" },
    { value: "hsk-level-4", label: "HSK 4" },
    { value: "hsk-level-5", label: "HSK 5" },
    { value: "hsk-level-6", label: "HSK 6" },
  ];

  const columns = [
    {
      title: t("admin.user"),
      dataIndex: "username",
      key: "username",
    },
    {
      title: t("common.level"),
      dataIndex: "bankLevel",
      key: "bankLevel",
      render: (level: number) => <Tag color="blue">HSK {level}</Tag>,
    },
    {
      title: t("common.status"),
      dataIndex: "status",
      key: "status",
      render: (status: string) => <Tag color={statusColor(status)}>{status}</Tag>,
    },
    {
      title: t("bank.started_at"),
      dataIndex: "startsAt",
      key: "startsAt",
    },
    {
      title: t("bank.expires_at"),
      dataIndex: "expiresAt",
      key: "expiresAt",
    },
    {
      title: t("common.actions"),
      key: "actions",
      render: (_: unknown, record: AdminSubscription) => (
        <Select
          size="small"
          value={record.status}
          style={{ width: 120 }}
          onChange={(v) => handleStatusChange(record.id, v)}
          options={[
            { value: "active", label: t("bank.status_active") },
            { value: "paused", label: t("bank.status_paused") },
            { value: "canceled", label: t("bank.status_canceled") },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="admin-page" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>{t("admin.subscriptions")}</Typography.Title>
        <Button type="primary" onClick={() => setModalOpen(true)}>{t("admin.create_subscription")}</Button>
      </div>

      <Card>
        {error && <Alert type="error" showIcon message={t(error)} style={{ marginBottom: 16 }} />}
        <Table
          dataSource={subscriptions}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title={t("admin.create_subscription")}
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="userIds" label={t("admin.user")} rules={[{ required: true }]}>
            <Select
              mode="multiple"
              options={users.map((u) => ({ value: u.id, label: `${u.username} (${u.displayName})` }))}
            />
          </Form.Item>
          <Form.Item name="bankId" label={t("common.level")} rules={[{ required: true }]}>
            <Select options={bankOptions} />
          </Form.Item>
          <Form.Item name="startsAt" label={t("bank.started_at")} rules={[{ required: true }]}>
            <Input placeholder="2026-01-01" />
          </Form.Item>
          <Form.Item name="expiresAt" label={t("bank.expires_at")}>
            <Input placeholder="2027-01-01" />
          </Form.Item>
          <Form.Item name="note" label={t("admin.note")}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
