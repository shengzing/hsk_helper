import { Alert, Button, Card, Form, Input, Modal, Select, Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { AdminUser } from "../../types";

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const { users: list } = await api.adminGetUsers();
      setUsers(list);
    } catch {
      setError("error.server_error");
    }
    finally { setLoading(false); }
  }

  async function handleCreate() {
    const values = await form.validateFields();
    try {
      await api.adminCreateUser(values);
      setError(null);
      setModalOpen(false);
      form.resetFields();
      await loadUsers();
    } catch {
      setError("error.server_error");
    }
  }

  async function handleToggleStatus(user: AdminUser) {
    const newStatus = user.status === "active" ? "disabled" : "active";
    try {
      await api.adminUpdateUser(user.id, { status: newStatus });
      setError(null);
      await loadUsers();
    } catch {
      setError("error.server_error");
    }
  }

  const columns = [
    { title: t("auth.username"), dataIndex: "username", key: "username" },
    { title: t("auth.email"), dataIndex: "email", key: "email", render: (v: string | null) => v || "—" },
    { title: t("admin.display_name"), dataIndex: "displayName", key: "displayName" },
    { title: t("admin.role"), dataIndex: "isAdmin", key: "isAdmin", render: (v: boolean) => v ? <Tag color="purple">{t("admin.role_admin")}</Tag> : <Tag>{t("admin.role_user")}</Tag> },
    { title: t("common.status"), dataIndex: "status", key: "status", render: (v: string) => <Tag color={v === "active" ? "green" : "red"}>{v === "active" ? t("bank.status_active") : t("admin.status_disabled")}</Tag> },
    { title: t("admin.expires_at"), dataIndex: "expiresAt", key: "expiresAt" },
    {
      title: t("common.actions"),
      key: "actions",
      render: (_: unknown, record: AdminUser) => (
        <Button size="small" onClick={() => handleToggleStatus(record)}>
          {record.status === "active" ? t("admin.disable") : t("admin.enable")}
        </Button>
      ),
    },
  ];

  return (
    <div className="admin-page" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>{t("admin.users")}</Typography.Title>
        <Button type="primary" onClick={() => setModalOpen(true)}>{t("admin.create_user")}</Button>
      </div>
      <Card>
        {error && <Alert type="error" showIcon message={t(error)} style={{ marginBottom: 16 }} />}
        <Table dataSource={users} columns={columns} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 20 }} />
      </Card>
      <Modal title={t("admin.create_user")} open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="username" label={t("auth.username")} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label={t("auth.email")}>
            <Input type="email" />
          </Form.Item>
          <Form.Item name="displayName" label={t("admin.display_name")} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="isAdmin" label={t("admin.role")}>
            <Select options={[{ value: false, label: t("admin.role_user") }, { value: true, label: t("admin.role_admin") }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
