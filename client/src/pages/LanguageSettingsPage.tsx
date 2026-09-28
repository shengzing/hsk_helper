import { Alert, Card, Radio, Space, Tag, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { SUPPORTED_LOCALES } from "../i18n/locales";
import { api } from "../api";

export default function LanguageSettingsPage() {
  const { t } = useTranslation();
  const { locale } = useParams<{ locale: string }>();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(newLocale: string) {
    setSaving(true);
    try {
      await api.updatePreferences(newLocale);
      setError(null);
      navigate(`/settings/language`.replace("/settings", `/${newLocale}/settings`));
    } catch {
      setError("error.server_error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-container">
      <Typography.Title level={2}>{t("language.title")}</Typography.Title>
      <Typography.Paragraph type="secondary">{t("language.subtitle")}</Typography.Paragraph>
      <Card>
        {error && <Alert type="error" showIcon message={t(error)} style={{ marginBottom: 12 }} />}
        <Radio.Group
          value={locale}
          disabled={saving}
          onChange={(e) => void handleChange(e.target.value)}
        >
          <Space direction="vertical">
            {SUPPORTED_LOCALES.map((l) => (
              <Radio key={l.id} value={l.id}>
                <Space>
                  <span>{l.endonym}</span>
                  <Tag>{l.id}</Tag>
                  <Tag color={l.direction === "rtl" ? "orange" : "blue"}>
                    {l.direction === "rtl" ? t("language.rtl") : t("language.ltr")}
                  </Tag>
                  {l.isDefault && <Tag color="green">default</Tag>}
                </Space>
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      </Card>
    </div>
  );
}
