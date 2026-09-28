import { Button, Result } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { detectLocale } from "../i18n/locales";

export default function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const locale = detectLocale();

  return (
    <Result
      status="404"
      title="404"
      subTitle={t("error.not_found")}
      extra={
        <Button type="primary" onClick={() => navigate(`/${locale}/banks`)}>
          {t("nav.banks")}
        </Button>
      }
    />
  );
}
