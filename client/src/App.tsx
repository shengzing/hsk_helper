import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import I18nProvider from "./i18n/I18nProvider";
import { DEFAULT_LOCALE, detectLocale, isSupportedLocale } from "./i18n/locales";
import AdminLayout from "./layouts/AdminLayout";
import MainLayout from "./layouts/MainLayout";
import BanksPage from "./pages/BanksPage";
import ExamPage from "./pages/ExamPage";
import FeedbackPage from "./pages/FeedbackPage";
import KnowledgePage from "./pages/KnowledgePage";
import LanguageSettingsPage from "./pages/LanguageSettingsPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import PapersPage from "./pages/PapersPage";
import RegisterPage from "./pages/RegisterPage";
import RecordDetailPage from "./pages/RecordDetailPage";
import RecordsPage from "./pages/RecordsPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import ReportPage from "./pages/ReportPage";
import WrongQuestionsPage from "./pages/WrongQuestionsPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminFeedbackPage from "./pages/admin/AdminFeedbackPage";
import AdminPapersPage from "./pages/admin/AdminPapersPage";
import AdminKnowledgePage from "./pages/admin/AdminKnowledgePage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import EssayReviewPage from "./pages/admin/EssayReviewPage";
import SubscriptionsPage from "./pages/admin/SubscriptionsPage";

/** Redirect root to detected locale */
function RootRedirect() {
  const locale = detectLocale();
  return <Navigate to={`/${locale}/banks`} replace />;
}

/** Validates locale param, wraps in I18nProvider + MainLayout (with auth check) */
function LocaleLayout() {
  const { locale } = useParams<{ locale: string }>();
  const effective = locale && isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  if (locale && !isSupportedLocale(locale)) {
    return <Navigate to={`/${effective}/banks`} replace />;
  }
  return (
    <I18nProvider locale={effective}>
      <MainLayout />
    </I18nProvider>
  );
}

/** Validates locale param, wraps in I18nProvider + AdminLayout */
function AdminLocaleLayout() {
  const { locale } = useParams<{ locale: string }>();
  const effective = locale && isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  if (locale && !isSupportedLocale(locale)) {
    return <Navigate to={`/${effective}/admin`} replace />;
  }
  return (
    <I18nProvider locale={effective}>
      <AdminLayout />
    </I18nProvider>
  );
}

/** Validates locale, wraps in I18nProvider only (for login page — no auth required) */
function LocaleI18nOnly() {
  const { locale } = useParams<{ locale: string }>();
  const effective = locale && isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  if (locale && !isSupportedLocale(locale)) {
    return <Navigate to={`/${effective}/login`} replace />;
  }
  return (
    <I18nProvider locale={effective}>
      <LoginPage />
    </I18nProvider>
  );
}

/** Validates locale, wraps in I18nProvider only (for register page — no auth required) */
function LocaleI18nRegister() {
  const { locale } = useParams<{ locale: string }>();
  const effective = locale && isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  if (locale && !isSupportedLocale(locale)) {
    return <Navigate to={`/${effective}/register`} replace />;
  }
  return (
    <I18nProvider locale={effective}>
      <RegisterPage />
    </I18nProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Root redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* Login — locale-aware but not protected */}
        <Route path="/:locale/login" element={<LocaleI18nOnly />} />
        {/* Register — locale-aware but not protected */}
        <Route path="/:locale/register" element={<LocaleI18nRegister />} />

        {/* User routes — protected by MainLayout auth check */}
        <Route path="/:locale" element={<LocaleLayout />}>
          <Route index element={<Navigate to="banks" replace />} />
         <Route path="banks" element={<BanksPage />} />
         <Route path="banks/:bankId/papers" element={<PapersPage />} />
         <Route path="subscription" element={<SubscriptionPage />} />
         <Route path="papers/:paperId/exam" element={<ExamPage />} />
          <Route path="attempts/:attemptId/report" element={<ReportPage />} />
          <Route path="records" element={<RecordsPage />} />
          <Route path="records/:recordId" element={<RecordDetailPage />} />
          <Route path="wrong-questions" element={<WrongQuestionsPage />} />
          <Route path="knowledge" element={<KnowledgePage />} />
          <Route path="feedback" element={<FeedbackPage />} />
          <Route path="settings/language" element={<LanguageSettingsPage />} />
        </Route>

        {/* Admin routes */}
        <Route path="/:locale/admin" element={<AdminLocaleLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="papers" element={<AdminPapersPage />} />
          <Route path="knowledge" element={<AdminKnowledgePage />} />
          <Route path="essay-reviews" element={<EssayReviewPage />} />
          <Route path="feedback" element={<AdminFeedbackPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
