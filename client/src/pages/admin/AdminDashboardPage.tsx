import { Alert, Card, Col, Row, Skeleton, Statistic } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { DashboardStats } from "../../types";

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { stats: s } = await api.adminGetStats();
        if (!cancelled) setStats(s);
      } catch {
        if (!cancelled) setError("error.server_error");
      }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="admin-page"><Skeleton active paragraph={{ rows: 6 }} /></div>;
  if (!stats) return <div className="admin-page"><Alert type="error" showIcon message={t(error ?? "error.server_error")} /></div>;

  return (
    <div className="admin-page" style={{ padding: 24 }}>
      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title={t("admin.total_users")} value={stats.totalUsers} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title={t("admin.total_banks")} value={stats.totalBanks} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title={t("admin.total_papers")} value={stats.totalPapers} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title={t("admin.knowledge_docs")} value={stats.totalKnowledgeDocs} /></Card></Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} lg={8}><Card><Statistic title={t("admin.active_subscriptions")} value={stats.activeSubscriptions} /></Card></Col>
        <Col xs={24} sm={12} lg={8}><Card><Statistic title={t("admin.completed_attempts")} value={stats.completedAttempts} /></Card></Col>
        <Col xs={24} lg={8}><Card><Statistic title={t("admin.open_feedback")} value={stats.openFeedback} /></Card></Col>
      </Row>
    </div>
  );
}
