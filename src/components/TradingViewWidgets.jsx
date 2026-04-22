import { onMount, createEffect, onCleanup, createSignal } from 'solid-js';

const useTheme = () => {
    const [theme, setTheme] = createSignal(document.documentElement.getAttribute('data-theme') || 'grey');
    onMount(() => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'data-theme') {
                    setTheme(document.documentElement.getAttribute('data-theme') || 'grey');
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true });
        onCleanup(() => observer.disconnect());
    });
    return theme;
};

const formatTVSymbol = (sym) => {
    if (!sym) return '';
    const upperSym = sym.toUpperCase();
    if (upperSym.endsWith('.JK')) {
        return `IDX:${upperSym.replace('.JK', '')}`;
    }
    return upperSym;
};

export const SymbolInfoWidget = (props) => {
    let container;
    const theme = useTheme();

    createEffect(() => {
        if (!container || !props.symbol) return;
        container.innerHTML = '';
        const currentTheme = theme() === 'light' ? 'light' : 'dark';
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js";
        script.type = "text/javascript";
        script.async = true;
        
        const tvSymbol = formatTVSymbol(props.symbol); 
        script.innerHTML = JSON.stringify({
            "symbol": tvSymbol,
            "width": "100%",
            "locale": "en",
            "colorTheme": currentTheme,
            "isTransparent": true
        });
        container.appendChild(script);
    });

    return (
        <div class="tradingview-widget-container w-full" ref={container}>
            <div class="tradingview-widget-container__widget"></div>
        </div>
    );
};

export const TechnicalAnalysisWidget = (props) => {
    let container;
    const theme = useTheme();

    createEffect(() => {
        if (!container || !props.symbol) return;
        container.innerHTML = '';
        const currentTheme = theme() === 'light' ? 'light' : 'dark';
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
            "interval": "1m",
            "width": "100%",
            "isTransparent": true,
            "height": "100%",
            "symbol": formatTVSymbol(props.symbol),
            "showIntervalTabs": true,
            "displayMode": "single",
            "locale": "en",
            "colorTheme": currentTheme
        });
        container.appendChild(script);
    });

    return (
        <div class="tradingview-widget-container h-full w-full" ref={container}>
            <div class="tradingview-widget-container__widget h-full w-full"></div>
        </div>
    );
};

export const FinancialsWidget = (props) => {
    let container;
    const theme = useTheme();

    createEffect(() => {
        if (!container || !props.symbol) return;
        container.innerHTML = '';
        const currentTheme = theme() === 'light' ? 'light' : 'dark';
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-financials.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
            "isTransparent": true,
            "largeChartUrl": "",
            "displayMode": "regular",
            "width": "100%",
            "height": "100%",
            "colorTheme": currentTheme,
            "symbol": formatTVSymbol(props.symbol),
            "locale": "en"
        });
        container.appendChild(script);
    });

    return (
        <div class="tradingview-widget-container h-full w-full" ref={container}>
            <div class="tradingview-widget-container__widget h-full w-full"></div>
        </div>
    );
};

export const SymbolProfileWidget = (props) => {
    let container;
    const theme = useTheme();

    createEffect(() => {
        if (!container || !props.symbol) return;
        container.innerHTML = '';
        const currentTheme = theme() === 'light' ? 'light' : 'dark';
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-profile.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
            "width": "100%",
            "height": "100%",
            "colorTheme": currentTheme,
            "isTransparent": true,
            "symbol": formatTVSymbol(props.symbol),
            "locale": "en"
        });
        container.appendChild(script);
    });

    return (
        <div class="tradingview-widget-container h-full w-full" ref={container}>
            <div class="tradingview-widget-container__widget h-full w-full"></div>
        </div>
    );
};

export const AdvancedChartWidget = (props) => {
    let container;
    const theme = useTheme();

    createEffect(() => {
        if (!container || !props.symbol) return;
        container.innerHTML = '';
        const currentTheme = theme() === 'light' ? 'light' : 'dark';
        const bgColor = currentTheme === 'light' ? '#ffffff' : '#030303';
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
            "autosize": true,
            "symbol": formatTVSymbol(props.symbol),
            "interval": "D",
            "timezone": "Etc/UTC",
            "theme": currentTheme,
            "style": "1",
            "locale": "en",
            "enable_publishing": false,
            "allow_symbol_change": true,
            "hide_side_toolbar": false,
            "calendar": false,
            "support_host": "https://www.tradingview.com",
            "backgroundColor": bgColor
        });
        container.appendChild(script);
    });

    return (
        <div class="tradingview-widget-container h-full w-full" ref={container} style={{ height: props.height || '500px' }}>
            <div class="tradingview-widget-container__widget h-full w-full"></div>
        </div>
    );
};
