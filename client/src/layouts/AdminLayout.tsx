import {
  AppstoreOutlined,
  AuditOutlined,
  FileTextOutlined,
  BookOutlined,
  MessageOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Layout, Menu } from "antd";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { isRTL } from "../i18n/locales";

const { Sider, Header, Content } = Layout;

export default function AdminLayout() {
  const { t } = useTranslation();
  const { locale } = useParams<{ locale: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const dir = isRTL(locale ?? "zh-CN") ? "rtl" : "ltr";

  const items = [
    { key: "", icon: <AppstoreOutlined />, label: t("admin.dashboard") },
    { key: "subscriptions", icon: <TeamOutlined />, label: t("admin.subscriptions") },
    { key: "users", icon: <TeamOutlined />, label: t("admin.users") },
    { key: "papers", icon: <FileTextOutlined />, label: t("admin.papers") },
    { key: "knowledge", icon: <BookOutlined />, label: t("admin.knowledge") },
    { key: "essay-reviews", icon: <AuditOutlined />, label: t("admin.essay_reviews") },
    { key: "feedback", icon: <MessageOutlined />, label: t("admin.feedback") },
  ];

  function selectedKey(pathname: string): string {
    const parts = pathname.split("/");
    const adminIdx = parts.indexOf("admin");
    if (adminIdx >= 0 && parts[adminIdx + 1]) return parts[adminIdx + 1];
    return "";
  }

  return (
    <Layout className="admin-app-layout" style={{ minHeight: "100vh", direction: dir }}>
      <Header className="admin-header" style={{ background: "#0f1623" }}>
        <span className="admin-brand" style={{ color: "#fff", fontWeight: 700 }}>
          HSK Admin
        </span>
      </Header>
      <Layout>
        <Sider width={220} className="admin-sider" style={{ background: "#fff" }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey(location.pathname)]}
            items={items}
            onClick={({ key }) => navigate(`/${locale}/admin/${key}`)}
          />
        </Sider>
        <Content className="admin-content" style={{ background: "#f5f7fa" }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
