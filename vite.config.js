import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 5151,
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' unpkg.com cdn.jsdelivr.net cdnjs.cloudflare.com cdn.plot.ly code.jquery.com; style-src 'self' 'unsafe-inline' unpkg.com fonts.googleapis.com; img-src 'self' data: blob: unpkg.com cdn.jsdelivr.net *.tile.openstreetmap.org; connect-src 'self' api.asetpedia.online *.api.asetpedia.online wss://api.asetpedia.online; font-src 'self' fonts.gstatic.com; frame-src 'self' youtube.com *.youtube.com;",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), display-capture=()',
    },
  },
  preview: {
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' unpkg.com cdn.jsdelivr.net cdnjs.cloudflare.com cdn.plot.ly code.jquery.com; style-src 'self' 'unsafe-inline' unpkg.com fonts.googleapis.com; img-src 'self' data: blob: unpkg.com cdn.jsdelivr.net *.tile.openstreetmap.org; connect-src 'self' api.asetpedia.online *.api.asetpedia.online wss://api.asetpedia.online; font-src 'self' fonts.gstatic.com; frame-src 'self' youtube.com *.youtube.com;",
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
