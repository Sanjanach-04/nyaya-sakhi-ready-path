import * as React from "react";
import { en, type TranslationKey } from "./en";
import { hi } from "./hi";
import { kn } from "./kn";

export type LanguageCode = "en" | "hi" | "kn";

export const LANGUAGES: { code: LanguageCode; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
];

const DICTIONARIES: Record<LanguageCode, Partial<Record<TranslationKey, string>>> = {
  en,
  hi,
  kn,
};

const STORAGE_KEY = "nyaya-sakhi-language";

interface I18nContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

function resolveInitialLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "hi" || stored === "kn") return stored;
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Server render and first client render use the same stable default ("en");
  // the stored preference is applied in an effect after hydration.
  const [language, setLanguageState] = React.useState<LanguageCode>("en");

  React.useEffect(() => {
    setLanguageState(resolveInitialLanguage());
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = language === "hi" ? "hi" : language === "kn" ? "kn" : "en";
  }, [language]);

  const setLanguage = React.useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // storage unavailable — session-only language
    }
  }, []);

  const t = React.useCallback(
    (key: TranslationKey): string => DICTIONARIES[language][key] ?? en[key],
    [language],
  );

  const value = React.useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
