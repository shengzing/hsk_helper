import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LOCALE, FALLBACK_LOCALE } from "./locales";

import zhCNCommon from "./locales/zh-CN/common.json";
import enUSCommon from "./locales/en-US/common.json";
import hiINCommon from "./locales/hi-IN/common.json";
import esCommon from "./locales/es/common.json";
import frFRCommon from "./locales/fr-FR/common.json";
import arCommon from "./locales/ar/common.json";
import bnBDCommon from "./locales/bn-BD/common.json";
import ruRUCommon from "./locales/ru-RU/common.json";
import ptBRCommon from "./locales/pt-BR/common.json";
import urPKCommon from "./locales/ur-PK/common.json";
import jaJPCommon from "./locales/ja-JP/common.json";
import koKRCommon from "./locales/ko-KR/common.json";

export const RESOURCES = {
  "zh-CN": { common: zhCNCommon },
  "en-US": { common: enUSCommon },
  "hi-IN": { common: hiINCommon },
  "es": { common: esCommon },
  "fr-FR": { common: frFRCommon },
  "ar": { common: arCommon },
  "bn-BD": { common: bnBDCommon },
  "ru-RU": { common: ruRUCommon },
  "pt-BR": { common: ptBRCommon },
  "ur-PK": { common: urPKCommon },
  "ja-JP": { common: jaJPCommon },
  "ko-KR": { common: koKRCommon },
};

void i18n.use(initReactI18next).init({
  resources: RESOURCES,
  lng: DEFAULT_LOCALE,
  fallbackLng: FALLBACK_LOCALE,
  defaultNS: "common",
  ns: ["common"],
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
