import { Button, Card, List, Skeleton, Space, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api";
import type { PaperSummary } from "../types";
import { formatMinutes } from "../utils/format";

export default function PapersPage() {
  const { t } = useTranslation();
  const { bankId, locale } = useParams<{ bankId: string; locale: string }>();
  const navigate = useNavigate();
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bankId) return;
    let cancelled = false;
    (async () => {
      try {
        const { papers: list } = await api.getPapers(bankId);
        if (!cancelled) setPapers(list);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 403) {
            setError(t("error.no_subscription"));
          } else {
            setError(t("error.network_error"));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bankId, t]);

  function handleStart(paperId: string) {
    navigate(`/${locale}/papers/${paperId}/exam`);
  }

  if (loading) {
    return <div className="page-container"><Skeleton active paragraph={{ rows: 6 }} /></div>;
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
            {t("paper.title")}
          </Typography.Title>
          <Typography.Text type="secondary">{t("paper.subtitle")}</Typography.Text>
        </Space>
      </div>

      <List
        grid={{ gutter: 16, xs: 1, sm: 2, lg: 3 }}
        dataSource={papers}
        locale={{ emptyText: t("common.empty") }}
        renderItem={(paper) => (
          <List.Item>
            <Card className="paper-card" title={paper.title}>
              <Space direction="vertical" size={6} style={{ width: "100%" }}>
                <Space>
                  <Tag color={paper.paperType === "past" ? "blue" : "purple"}>
                    {paper.paperType === "past" ? t("paper.type_past") : t("paper.type_mock")}
                  </Tag>
                  {paper.year && <Tag>{paper.year}</Tag>}
                  <Tag color={paper.status === "published" ? "green" : "default"}>
                    {paper.status === "published" ? t("paper.status_published") : t("paper.status_draft")}
                  </Tag>
                </Space>
                <div className="paper-info-grid">
                  <span>{t("common.duration")}: {formatMinutes(paper.durationSeconds, locale)}</span>
                  <span>{t("common.score")}: {paper.totalScore}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    type="primary"
                    onClick={() => handleStart(paper.id)}
                    disabled={paper.status !== "published"}
                  >
                    {t("paper.start")}
                  </Button>
                </div>
              </Space>
            </Card>
          </List.Item>
        )}
      />
    </div>
  );
}
