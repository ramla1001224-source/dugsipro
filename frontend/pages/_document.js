import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="so" translate="no">
      <Head>
        <meta name="google" content="notranslate" />
        {/* ── Favicon ── */}
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.png" />

        {/* ── Apple / iOS: Add to Home Screen ── */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Dugsi Pro" />

        {/* ── Android / PWA ── */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0F172A" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* ── General SEO ── */}
        <meta name="application-name" content="Dugsi Pro System" />
        <meta
          name="description"
          content="Smart School Management System - Digitalizing Education Across Somalia"
        />
        <meta property="og:title" content="Dugsi Pro System" />
        <meta
          property="og:description"
          content="Smart School Management System - Digitalizing Education Across Somalia"
        />
        <meta property="og:image" content="/icon-512x512.png" />
        <meta property="og:type" content="website" />

        {/* ── Font ── */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />

        {/* ── Service Worker Registration (Offline Mode) ── */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker
                    .register('/sw.js', { scope: '/' })
                    .then(function (reg) {
                      console.log('[SW] Registered:', reg.scope);
                    })
                    .catch(function (err) {
                      console.warn('[SW] Registration failed:', err);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </Html>
  )
}

