import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Layout, Spin, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { detectLocale } from "../i18n/locales";

export default function LoginPage() {
  const { t } = useTranslation();
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const redirect = searchParams.get("redirect") ?? "";
  const locale = detectLocale();

  if (loading) {
    return <div className="center-loading"><Spin size="large" /></div>;
  }

  if (user) {
    const target = redirect || `/${locale}/banks`;
    return <Navigate to={target} replace />;
  }

  async function onFinish(values: { username: string; password: string }) {
    setSubmitting(true);
    setError("");
    try {
      const loggedIn = await login(values.username, values.password);
      const target = redirect || `/${locale}/banks`;
      navigate(target, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.unknown"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout className="login-layout">
      <Card className="login-card">
        <div className="login-header">
          <Typography.Title level={2}>{t("app.name")}</Typography.Title>
          <Typography.Text type="secondary">{t("app.tagline")}</Typography.Text>
        </div>
        {error && <Alert type="error" showIcon message={error} className="login-alert" />}
        <Form layout="vertical" requiredMark={false} onFinish={onFinish}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input prefix={<UserOutlined />} autoComplete="username" size="large" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            {t("common.confirm")}
          </Button>
        </Form>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Typography.Text type="secondary">
            {t("auth.no_account")}{" "}
          </Typography.Text>
          <a onClick={() => navigate(`/${locale}/register${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`)}>
            {t("auth.register")}
          </a>
        </div>
      </Card>
    </Layout>
  );
}
