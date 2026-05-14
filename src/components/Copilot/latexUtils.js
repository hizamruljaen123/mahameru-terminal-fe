/**
 * Utility library for LaTeX rendering and exports
 */

export async function ensureHtmlToImage() {
    if (window.htmlToImage) return window.htmlToImage;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js';
        script.onload = () => resolve(window.htmlToImage);
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Captures a LaTeX element as a high-quality PNG with black text on white background.
 * Automatically handles full area processing without scrollbars.
 */
export async function downloadLatexAsPng(element, formulaName = 'formula') {
    if (!element) return;
    
    const h2i = await ensureHtmlToImage();
    
    // We want the capture to be black on white, regardless of terminal theme.
    // We also want to ensure the full width is captured (no scrollbars).
    const options = {
        backgroundColor: '#ffffff',
        style: {
            padding: '40px',
            margin: '0',
            color: '#000000',
            background: '#ffffff',
            'font-weight': '600',
            'display': 'inline-block',
            'width': 'fit-content', // Forces container to expand to match math width
            'min-width': '100%',
            'max-width': 'none',
            'overflow': 'visible',
        },
        filter: (node) => {
            // Optional: filter out any UI elements if they leaked in
            return true;
        },
        // Improve quality
        pixelRatio: 2, 
    };

    // Apply a temporary class or style to the katex elements inside the capture
    // to force them to be black. 
    // html-to-image style prop only affects the root element.
    // We might need to inject a temporary style tag or modify descendants.
    
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
        .latex-capture-temp .katex { color: #000000 !important; }
        .latex-capture-temp .katex-display { margin: 0 !important; }
    `;
    document.head.appendChild(styleTag);
    
    element.classList.add('latex-capture-temp');

    try {
        const dataUrl = await h2i.toPng(element, options);
        
        const link = document.createElement('a');
        link.download = `${formulaName}-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
    } finally {
        element.classList.remove('latex-capture-temp');
        document.head.removeChild(styleTag);
    }
}
