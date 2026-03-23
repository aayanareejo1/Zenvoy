import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTheme, DARK_THEME } from '../constants/theme';

const THEME_KEY = 'app_theme_dark';

const ThemeContext = createContext({ isDarkMode: true, colors: DARK_THEME, toggleDarkMode: () => {} });

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true); // default dark

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(val => {
      if (val !== null) setIsDarkMode(val === 'true');
    });
  }, []);

  const toggleDarkMode = async () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    await AsyncStorage.setItem(THEME_KEY, String(next));
  };

  const colors = getTheme(isDarkMode);

  return (
    <ThemeContext.Provider value={{ isDarkMode, colors, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
