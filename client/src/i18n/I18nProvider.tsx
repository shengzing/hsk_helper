import { ConfigProvider } from "antd";
import arEG from "antd/locale/ar_EG";
import enUS from "antd/locale/en_US";
import esES from "antd/locale/es_ES";
import frFR from "antd/locale/fr_FR";
import hiIN from "antd/locale/hi_IN";
import ptBR from "antd/locale/pt_BR";
import ruRU from "antd/locale/ru_RU";
import urPK from "antd/locale/ur_PK";
import zhCN from "antd/locale/zh_CN";
import jaJP from "antd/locale/ja_JP";
import koKR from "antd/locale/ko_KR";
import { type ReactNode, useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { RESOURCES } from "./config";
import { isRTL, isSupportedLocale, DEFAULT_LOCALE } from "./locales";

const antdLocales: Record<string, typeof zhCN> = {
  "zh-CN": zhCN,
  "en-US": enUS,
  "hi-IN": hiIN,
  "es": esES,
  "fr-FR": frFR,
  "ar": arEG,
  "bn-BD": enUS, // Ant Design has no Bengali locale, use English fallback
  "ru-RU": ruRU,
  "pt-BR": ptBR,
  "ur-PK": urPK,
  "ja-JP": jaJP,
  "ko-KR": koKR,
};

interface I18nProviderProps {
  locale: string;
  children: ReactNode;
}

export default function I18nProvider({ locale, children }: I18nProviderProps) {
  const effectiveLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  useEffect(() => {
    if (i18n.language !== effectiveLocale) {
      void i18n.changeLanguage(effectiveLocale);
    }
    localStorage.setItem("hsk_locale", effectiveLocale);

    const dir = isRTL(effectiveLocale) ? "rtl" : "ltr";
    document.documentElement.lang = effectiveLocale;
    document.documentElement.dir = dir;
  }, [effectiveLocale]);

  const antdLocale = antdLocales[effectiveLocale] ?? antdLocales["en-US"];
  const hasBundle = Boolean(RESOURCES[effectiveLocale as keyof typeof RESOURCES]);
  const activeLocale = hasBundle ? effectiveLocale : DEFAULT_LOCALE;

  return (
    <I18nextProvider i18n={i18n}>
      <ConfigProvider
        locale={antdLocale}
        theme={{
          token: {
            colorPrimary: "#1677ff",
            colorBgLayout: "#f5f7fa",
            colorText: "#1f2329",
            colorTextSecondary: "#5e6470",
            borderRadius: 6,
            fontFamily: '"Noto Sans", "Noto Sans SC", "Noto Sans Arabic", "Noto Sans Devanagari", "Noto Sans Bengali", system-ui, sans-serif',
          },
        }}
      >
        <span data-locale={activeLocale} hidden />
        {children}
      </ConfigProvider>
    </I18nextProvider>
  );
}
