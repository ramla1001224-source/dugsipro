/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Allow images from Supabase storage and other external sources.
   * Extend this list as new image hosts are added.
   */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },

  /**
   * Security & CORS headers.
   *
   * For subdomain routing to work in local dev (e.g. xamdaan.localhost:3000),
   * you need to add `127.0.0.1  xamdaan.localhost` to your hosts file:
   *   Windows: C:\Windows\System32\drivers\etc\hosts
   *   macOS/Linux: /etc/hosts
   */
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          // Allow cross-origin requests from subdomains in local dev
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          {
            key: 'Access-Control-Allow-Origin',
            // In production Vercel sets this correctly; this covers local dev
            value: process.env.NODE_ENV === 'development'
              ? '*'
              : 'https://dugsipro.so',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
