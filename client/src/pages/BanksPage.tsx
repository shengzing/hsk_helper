import { BookOutlined, CheckCircleOutlined, WarningOutlined } from "@ant-design/icons";
import { Card, Col, Empty, Row, Skeleton, Space, Statistic, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api";
import type { Subscription } from "../types";

export default function BanksPage() {
  const { t } = useTranslation();
  const { locale } = useParams<{ locale: string }>();
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [recordCount, setRecordCount] = useState(0);
  const [wrongQuestionCount, setWrongQuestionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [subsResponse, recordsResponse, wrongResponse] = await Promise.all([
          api.getMySubscriptions(),
          api.getRecords(),
          api.getWrongQuestions(),
        ]);
        if (cancelled) return;
        setSubscriptions(subsResponse.subscriptions);
        setRecordCount(recordsResponse.records.length);
        setWrongQuestionCount(wrongResponse.wrongQuestions.length);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setError(t("error.unauthorized"));
        } else {
          setError(t("error.network_error"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  function statusColor(status: string): string {
    return status === "active" ? "green" : status === "paused" ? "orange" : "red";
  }

  function handleClick(bankId: string) {
    navigate(`/${locale}/banks/${bankId}/papers`);
  }

  const sortedSubscriptions = [...subscriptions].sort(
    (a, b) => b.paperCount - a.paperCount
  );

  if (loading) {
    return (
      <div className="page-container">
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <Typography.Text type="danger">{error}</Typography.Text>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-heading">
        <Space direction="vertical" size={0}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            {t("bank.title")}
          </Typography.Title>
          <Typography.Text type="secondary">{t("bank.subtitle")}</Typography.Text>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={t("bank.title")}
              value={subscriptions.length}
              prefix={<BookOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={t("report.total_attempts")}
              value={recordCount}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={t("nav.wrong_questions")}
              value={wrongQuestionCount}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {subscriptions.length === 0 ? (
        <Empty description={t("bank.no_subscriptions")} />
      ) : (
        <Row gutter={[16, 16]}>
          {sortedSubscriptions.map((sub) => (
            <Col key={sub.bankId} xs={24} sm={12} lg={8}>
              <Card
                hoverable
                className="bank-card"
                onClick={() => handleClick(sub.bankId)}
                title={
                  <Space>
                    <Tag color="blue">{t("bank.level_label", { level: sub.level })}</Tag>
                  </Space>
                }
              >
                <Typography.Text strong>{sub.name}</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  {sub.paperCount > 0 ? (
                    <Tag color="cyan">
                      {t("paper.paper_count")}: {sub.paperCount}
                    </Tag>
                  ) : (
                    <Tag color="red">{t("paper.no_papers")}</Tag>
                  )}
                </div>
                <div className="card-subtitle" style={{ marginTop: 8 }}>
                  <Space direction="vertical" size={4}>
                    <Space>
                      <span>{t("common.status")}:</span>
                      <Tag color={statusColor(sub.status)}>
                        {t(`bank.status_${sub.status}`)}
                      </Tag>
                    </Space>
                    <span>{t("bank.expires_at")}: {sub.expiresAt ?? "—"}</span>
                  </Space>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
