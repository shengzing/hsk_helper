import { Card, Col, Empty, Row, Skeleton, Space, Statistic, Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { formatDate } from "../utils/format";
import type { RecordSummary } from "../types";

export default function RecordsPage() {
  const { t } = useTranslation();
  const { locale } = useParams<{ locale: string }>();
  const navigate = useNavigate();
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { records: list } = await api.getRecords();
        if (!cancelled) setRecords(list);
      } catch {
        // network error
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totalAttempts = records.length;
  const avgScore = records.length > 0
    ? Math.round(records.reduce((sum, r) => sum + r.totalScore, 0) / records.length)
    : 0;
  const passed = records.filter((r) => r.totalScore >= 180).length;

  const columns = [
    {
      title: t("common.title"),
      dataIndex: "paperTitle",
      key: "paperTitle",
      render: (v: string, record: RecordSummary) => (
        <a onClick={() => navigate(`/${locale}/records/${record.id}`)}>{v}</a>
      ),
    },
    { title: t("common.level"), dataIndex: "level", key: "level", render: (v: number) => <Tag color="blue">HSK {v}</Tag> },
    { title: t("report.total_score"), dataIndex: "totalScore", key: "totalScore" },
    { title: t("common.status"), dataIndex: "status", key: "status", render: (v: string) => <Tag>{v}</Tag> },
    { title: t("common.created_at"), dataIndex: "startedAt", key: "startedAt", render: (v: string) => formatDate(v, locale) },
  ];

  if (loading) return <div className="page-container"><Skeleton active paragraph={{ rows: 6 }} /></div>;

  return (
    <div className="page-container">
      <Typography.Title level={2}>{t("nav.records")}</Typography.Title>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}><Card><Statistic title={t("report.total_attempts")} value={totalAttempts} /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title={t("report.average_score")} value={avgScore} /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title={t("report.passed")} value={passed} /></Card></Col>
      </Row>
      {records.length === 0 ? (
        <Empty description={t("common.empty")} />
      ) : (
        <Card>
          <Table dataSource={records} columns={columns} rowKey="id" size="small" pagination={{ pageSize: 20 }} />
        </Card>
      )}
    </div>
  );
}
