import { Card, Col, Empty, Row, Skeleton, Space, Statistic, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { api } from "../api";
import type { AttemptReport, RecordSummary } from "../types";
import ReportPage from "./ReportPage";

export default function RecordDetailPage() {
  const { t } = useTranslation();
  const { recordId } = useParams<{ recordId: string }>();
  const [record, setRecord] = useState<RecordSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!recordId) return;
    let cancelled = false;
    (async () => {
      try {
        const { record: r } = await api.getRecord(recordId);
        if (!cancelled) setRecord(r);
      } catch {
        // network error
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [recordId]);

  if (loading) return <div className="page-container"><Skeleton active paragraph={{ rows: 6 }} /></div>;
  if (!record) return <div className="page-container"><Empty description={t("common.not_implemented")} /></div>;

  return (
    <div className="page-container">
      <Typography.Title level={2}>{record.paperTitle}</Typography.Title>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}><Card><Statistic title={t("report.total_score")} value={record.totalScore} /></Card></Col>
        <Col span={6}><Card><Statistic title={t("report.objective_score")} value={record.objectiveScore} /></Card></Col>
        <Col span={6}><Card><Statistic title={t("report.subjective_score")} value={record.subjectiveScore} /></Card></Col>
        <Col span={6}>
          <Card>
            <Space direction="vertical">
              <Tag color="blue">HSK {record.level}</Tag>
              <Tag>{record.mode}</Tag>
              <Tag color={record.status === "graded" ? "green" : "orange"}>{record.status}</Tag>
            </Space>
          </Card>
        </Col>
      </Row>
      {/* Reuse ReportPage for the detailed per-question breakdown */}
      <ReportPage attemptId={record.id} />
    </div>
  );
}
