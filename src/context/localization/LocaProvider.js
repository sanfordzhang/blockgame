import React, { useState, useEffect, useCallback } from 'react';
import LocaContext from './locaContext';
import en from '../../locales/en';
import zh from '../../locales/zh';

const DICTS = { en, zh };

const initialState = localStorage.getItem('lang') || 'en';

const LocaProvider = ({ children }) => {
  const [lang, setLang] = useState(initialState);

  useEffect(() => {
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    urlLang && setLang(urlLang);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.setAttribute('lang', lang);
    // eslint-disable-next-line
  }, [lang]);

  const t = useCallback(
    (key) => DICTS[lang]?.[key] ?? DICTS['en']?.[key] ?? key,
    [lang]
  );

  return (
    <LocaContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LocaContext.Provider>
  );
};

export default LocaProvider;
