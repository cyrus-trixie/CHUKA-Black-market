// src/contexts/DarkModeContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

// Create the context
const DarkModeContext = createContext();

// Custom hook to consume the context easily
export const useDarkMode = () => useContext(DarkModeContext);

// Provider component
export const DarkModeProvider = ({ children }) => {
    // Initialize dark mode state:
    // 1. Check localStorage for a saved preference.
    // 2. If no saved preference, check the user's system preference.
    // 3. Default to false (light mode) if no preference found.
    const [darkMode, setDarkMode] = useState(() => {
        const savedMode = localStorage.getItem('darkMode');
        if (savedMode !== null) {
            return JSON.parse(savedMode);
        }
        // Check system preference only once on initial load
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    // Effect to apply/remove 'dark' class to the <html> element and save preference
    useEffect(() => {
        localStorage.setItem('darkMode', JSON.stringify(darkMode));
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    // Function to toggle dark mode
    const toggleDarkMode = () => setDarkMode(prevMode => !prevMode);

    return (
        <DarkModeContext.Provider value={{ darkMode, toggleDarkMode }}>
            {children}
        </DarkModeContext.Provider>
    );
};