import {
  BookOutlined,
  GlobalOutlined,
  HistoryOutlined,
  LogoutOutlined,
  MenuOutlined,
  ReadOutlined,
  SettingOutlined,
  UserOutlined,
  WarningOutlined,
 MessageOutlined,
  CrownOutlined,
} from "@ant-design/icons";
import { Button, Drawer, Grid, Layout, Menu, Modal, Select, Space, Spin, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { SUPPORTED_LOCALES, isRTL, detectLocale } from "../i18n/locales";

const { Header, Content } = Layout;

export default function MainLayout() {
  const { t } = useTranslation();
  const { locale: urlLocale } = useParams<{ locale: string }>();
  const screens = Grid.useBreakpoint();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, loading, sessionExpired, logout, confirmSessionExpired } = useAuth();

  const locale = urlLocale && SUPPORTED_LOCALES.some((l) => l.id === urlLocale)
    ? urlLocale
    : detectLocale(urlLocale);

 const navItems = [
   { key: "banks", icon: <BookOutlined />, label: t("nav.banks") },
   { key: "subscription", icon: <CrownOutlined />, label: t("nav.subscription") },
   { key: "records", icon: <HistoryOutlined />, label: t("nav.records") },
    { key: "wrong-questions", icon: <WarningOutlined />, label: t("nav.wrong_questions") },
    { key: "knowledge", icon: <ReadOutlined />, label: t("nav.knowledge") },
    { key: "feedback", icon: <MessageOutlined />, label: t("nav.feedback") ?? "Feedback" },
  ];

  function navPath(key: string): string {
    return `/${locale}/${key}`;
  }

  function selectedKey(pathname: string): string {
    for (const item of navItems) {
      if (pathname.includes(`/${locale}/${item.key}`)) return item.key;
    }
    return "banks";
  }

  function handleNav(key: string) {
    navigate(navPath(key));
    setDrawerOpen(false);
  }

  function handleLocaleChange(newLocale: string) {
    const newPath = location.pathname.replace(`/${locale}/`, `/${newLocale}/`);
    navigate(newPath);
  }

  function handleBrandClick() {
    navigate(navPath("banks"));
    setDrawerOpen(false);
  }

  async function handleLogout() {
    await logout();
    navigate(`/${locale}/login`, { replace: true });
  }

  function handleSessionExpiredOk() {
    confirmSessionExpired();
    navigate(`/${locale}/login?redirect=${encodeURIComponent(location.pathname)}`, {
      replace: true,
    });
  }

  if (loading) {
    return <div className="center-loading"><Spin size="large" /></div>;
  }

  if (!user) {
    if (sessionExpired) {
      return (
        <>
          <div className="center-loading"><Spin size="large" /></div>
          <Modal
            open
            title={t("auth.session_expired")}
            onOk={handleSessionExpiredOk}
            cancelButtonProps={{ style: { display: "none" } }}
            okText={t("auth.relogin")}
            closable={false}
            maskClosable={false}
          >
            {t("auth.session_expired_description")}
          </Modal>
        </>
      );
    }
    const loginPath = `/${locale}/login?redirect=${encodeURIComponent(location.pathname)}`;
    return <Navigate to={loginPath} replace />;
  }

  const menu = (
    <Menu
      mode={screens.md ? "horizontal" : "inline"}
      theme={screens.md ? "dark" : "light"}
      selectedKeys={[selectedKey(location.pathname)]}
      items={navItems.map((item) => ({
        key: item.key,
        icon: item.icon,
        label: item.label,
      }))}
      onClick={({ key }) => handleNav(key)}
    />
  );

  const localeSelect = (
    <Select
      size="small"
      value={locale}
      onChange={handleLocaleChange}
      className="locale-select"
      popupClassName="locale-select-dropdown"
      popupMatchSelectWidth={false}
      listHeight={320}
      suffixIcon={<GlobalOutlined />}
      labelRender={({ value }) => {
        const localeConfig = SUPPORTED_LOCALES.find((item) => item.id === value);
        return (
          <span className="locale-selected-label">
            {localeConfig && <span className="locale-selected-flag">{localeConfig.flag}</span>}
            {localeConfig && <span className="locale-selected-code">{localeConfig.shortCode}</span>}
          </span>
        );
      }}
      optionRender={(option) => {
        const localeConfig = SUPPORTED_LOCALES.find((item) => item.id === option.value);
        if (!localeConfig) return String(option.label ?? option.value);

        return (
          <div className="locale-option">
            <span className="locale-option-flag">{localeConfig.flag}</span>
            <span className="locale-option-name">{localeConfig.endonym}</span>
            <span className="locale-option-meta">
              <span className="locale-option-code">{localeConfig.id}</span>
              <span className="locale-option-direction">
                {localeConfig.direction.toUpperCase()}
              </span>
              {localeConfig.isDefault && (
                <span className="locale-option-default-dot" aria-hidden="true" />
              )}
            </span>
          </div>
        );
      }}
      options={SUPPORTED_LOCALES.map((l) => ({
        value: l.id,
        label: l.endonym,
      }))}
    />
  );

  return (
    <Layout className="app-layout" style={{ direction: isRTL(locale) ? "rtl" : "ltr" }}>
      <Header className="app-header user-header">
        <button className="brand-button" type="button" onClick={handleBrandClick}>
          <span className="brand-text">{t("app.name")}</span>
        </button>
        {screens.md ? (
          <>
            <div className="user-menu">{menu}</div>
            <Space className="header-actions">
              {localeSelect}
              <Space className="header-user">
                <UserOutlined />
                <Typography.Text style={{ color: "rgba(255,255,255,0.85)" }}>{user.displayName}</Typography.Text>
                <Button
                  type="text"
                  className="header-icon-button"
                  icon={<LogoutOutlined />}
                  onClick={handleLogout}
                />
                {user.isAdmin && (
                  <Button
                    type="text"
                    className="header-icon-button"
                    icon={<SettingOutlined />}
                    onClick={() => navigate(`/${locale}/admin`)}
                  />
                )}
              </Space>
            </Space>
          </>
        ) : (
          <>
            <div className="header-actions">{localeSelect}</div>
            <Button
              type="text"
              className="header-icon-button"
              icon={<MenuOutlined />}
              onClick={() => setDrawerOpen(true)}
            />
          </>
        )}
      </Header>
      <Content className="app-content">
        <Outlet />
      </Content>
      <Drawer
        title={t("app.name")}
        placement={isRTL(locale) ? "left" : "right"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={280}
      >
        {menu}
        <div className="drawer-user-actions">
          <div className="drawer-user"><UserOutlined /> {user.displayName}</div>
          <Button icon={<LogoutOutlined />} block onClick={handleLogout}>
            {t("auth.logout") ?? "Logout"}
          </Button>
          {user.isAdmin && (
            <Button block style={{ marginTop: 8 }} onClick={() => navigate(`/${locale}/admin`)}>
              Admin
            </Button>
          )}
        </div>
      </Drawer>
    </Layout>
  );
}
