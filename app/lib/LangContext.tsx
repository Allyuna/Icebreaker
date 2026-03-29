"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { type Lang, translations, type Translations } from "./i18n";

type LangCtx = {
  lang: Lang;
  t: Translations;
  toggleLang: () => void;
};

const LangContext = createContext<LangCtx>({
  lang: "fr",
  t: translations.fr,
  toggleLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("fr");

  // Read persisted preference after hydration
  useEffect(() => {
    const stored = localStorage.getItem("ttm_lang");
    if (stored === "en" || stored === "fr") setLang(stored);
  }, []);

  function toggleLang() {
    const next: Lang = lang === "fr" ? "en" : "fr";
    setLang(next);
    localStorage.setItem("ttm_lang", next);
  }

  return (
    <LangContext.Provider value={{ lang, t: translations[lang], toggleLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
