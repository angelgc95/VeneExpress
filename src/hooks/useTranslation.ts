import { useAuth } from "@/contexts/AuthContext";
import { getDateLocale, translateText, type LanguageCode } from "@/lib/i18n";

type TranslationVariables = Record<string, string | number>;

export const useTranslation = () => {
  const { language, setLanguagePreference } = useAuth();

  const t = (key: string, variables?: TranslationVariables) =>
    translateText(language, key, variables);

  return {
    language,
    t,
    dateLocale: getDateLocale(language),
    setLanguagePreference,
    isSpanish: language === "es",
  };
};

export type { LanguageCode };
