/**
 * theme_mermaid.js
 * Definitions for Mermaid themes in Mahameru Copilot
 */

export const MERMAID_THEMES = {
    dark: {
        theme: 'dark',
        containerBg: 'rgba(0, 0, 0, 0.2)', // Original dark transparent
        isLight: false,
        themeVariables: {
            primaryColor: '#22d3ee', // cp-accent
            primaryTextColor: '#fff',
            primaryBorderColor: '#22d3ee',
            lineColor: '#94a3b8',
            secondaryColor: '#1e293b',
            tertiaryColor: '#0f172a',
            noteBkgColor: '#334155',
            noteTextColor: '#fff'
        }
    },
    light: {
        theme: 'default',
        containerBg: '#ffffff', // Pure white for light theme
        isLight: true,
        themeVariables: {
            primaryColor: '#0ea5e9',
            primaryTextColor: '#000',
            primaryBorderColor: '#0ea5e9',
            lineColor: '#334155',
            secondaryColor: '#f1f5f9',
            tertiaryColor: '#f8fafc',
            noteBkgColor: '#fff9c4',
            noteTextColor: '#000'
        }
    },
    forest: {
        theme: 'forest',
        containerBg: '#f0fdf4', // Very light green
        isLight: true,
        themeVariables: {
            primaryColor: '#22c55e',
            primaryTextColor: '#fff',
            primaryBorderColor: '#22c55e',
            lineColor: '#059669',
        }
    },
    neutral: {
        theme: 'neutral',
        containerBg: '#f8fafc', // Light slate
        isLight: true,
        themeVariables: {
            primaryColor: '#64748b',
            primaryTextColor: '#fff',
            primaryBorderColor: '#64748b',
        }
    }
};

/**
 * Applies a theme configuration to Mermaid
 */
export function applyMermaidTheme(themeId) {
    if (!window.mermaid) {
        console.warn('[MermaidTheme] window.mermaid not loaded yet');
        return;
    }
    const themeConfig = MERMAID_THEMES[themeId] || MERMAID_THEMES.dark;
    
    window.mermaid.initialize({
        startOnLoad: false,
        theme: themeConfig.theme,
        themeVariables: themeConfig.themeVariables,
        securityLevel: 'loose',
        fontFamily: 'Inter, sans-serif'
    });
}
