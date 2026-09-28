import { MailOutlined, LockOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Layout, Spin, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { detectLocale } from "../i18n/locales";

export default function RegisterPage() {
  const { t } = useTranslation();
  const { user, loading, register } = useAuth();
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

  async function onFinish(values: { email: string; password: string; displayName?: string }) {
    setSubmitting(true);
    setError("");
    try {
      await register(values.email, values.password, values.displayName);
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
          <Typography.Title level={2}>{t("auth.register")}</Typography.Title>
          <Typography.Text type="secondary">{t("auth.register_subtitle")}</Typography.Text>
        </div>
        {error && <Alert type="error" showIcon message={error} className="login-alert" />}
        <Form layout="vertical" requiredMark={false} onFinish={onFinish}>
          <Form.Item
            name="email"
            label={t("auth.email")}
            rules={[
              { required: true, message: t("auth.email_required") },
              { type: "email", message: t("auth.email_invalid") },
            ]}
          >
            <Input prefix={<MailOutlined />} autoComplete="email" size="large" />
          </Form.Item>
          <Form.Item
            name="displayName"
            label={t("auth.display_name")}
          >
            <Input prefix={<UserOutlined />} autoComplete="nickname" size="large" />
          </Form.Item>
          <Form.Item
            name="password"
            label={t("auth.password")}
            rules={[
              { required: true, message: t("auth.password_required") },
              { min: 6, message: t("auth.password_too_short") },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} autoComplete="new-password" size="large" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label={t("auth.confirm_password")}
            dependencies={["password"]}
            rules={[
              { required: true, message: t("auth.confirm_password_required") },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t("auth.password_mismatch")));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} autoComplete="new-password" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            {t("auth.register")}
          </Button>
        </Form>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Typography.Text type="secondary">
            {t("auth.have_account")}{" "}
          </Typography.Text>
          <a onClick={() => navigate(`/${locale}/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`)}>
            {t("auth.login")}
          </a>
        </div>
      </Card>
    </Layout>
  );
}
