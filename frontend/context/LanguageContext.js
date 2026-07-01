import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../locales/en.json';
import so from '../locales/so.json';

const translations = { en, so };

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    const [language, setLang] = useState('en');

    useEffect(() => {
        const savedLang = localStorage.getItem('language');
        if (savedLang && translations[savedLang]) {
            setLang(savedLang);
        }
    }, []);

    const setLanguage = (lang) => {
        if (!translations[lang]) return;
        setLang(lang);
        localStorage.setItem('language', lang);
    };

    const toggleLanguage = () => {
        setLanguage(language === 'en' ? 'so' : 'en');
    };

    const t = (key) => {
        return translations[language]?.[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
