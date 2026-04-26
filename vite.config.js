import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 5151,
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: unpkg.com cdn.jsdelivr.net cdnjs.cloudflare.com cdn.plot.ly code.jquery.com s3.tradingview.com *.tradingview.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' unpkg.com fonts.googleapis.com; img-src 'self' data: blob: unpkg.com cdn.jsdelivr.net *.tile.openstreetmap.org *.openstreetmap.org *.basemaps.cartocdn.com server.arcgisonline.com; connect-src 'self' blob: unpkg.com api.asetpedia.online *.api.asetpedia.online wss://api.asetpedia.online wss://*.asetpedia.online https://api.asetpedia.online https://*.asetpedia.online s3.tradingview.com *.tradingview.com *.basemaps.cartocdn.com server.arcgisonline.com api.open-meteo.com restcountries.com data.bmkg.go.id; font-src 'self' fonts.gstatic.com; frame-src 'self' youtube.com *.youtube.com s3.tradingview.com sslecal2.investing.com *.tradingview.com *.kaspersky.com;",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), display-capture=()',
    },
  },
  preview: {
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: unpkg.com cdn.jsdelivr.net cdnjs.cloudflare.com cdn.plot.ly code.jquery.com s3.tradingview.com *.tradingview.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' unpkg.com fonts.googleapis.com; img-src 'self' data: blob: unpkg.com cdn.jsdelivr.net *.tile.openstreetmap.org *.openstreetmap.org *.basemaps.cartocdn.com server.arcgisonline.com; connect-src 'self' blob: unpkg.com api.asetpedia.online *.api.asetpedia.online wss://api.asetpedia.online wss://*.asetpedia.online https://api.asetpedia.online https://*.asetpedia.online s3.tradingview.com *.tradingview.com *.basemaps.cartocdn.com server.arcgisonline.com api.open-meteo.com restcountries.com data.bmkg.go.id; font-src 'self' fonts.gstatic.com; frame-src 'self' youtube.com *.youtube.com s3.tradingview.com sslecal2.investing.com *.tradingview.com *.kaspersky.com;",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), display-capture=()',
    },
  },
  build: {
    target: 'esnext',
  },
});
