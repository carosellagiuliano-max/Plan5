import type { NextConfig } from 'next';

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.hcaptcha.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.hcaptcha.com",
  "connect-src 'self' https://api.hcaptcha.com",
  "frame-src https://*.hcaptcha.com",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: csp
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  }
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  headers: async () => [
    {
      source: '/:path*',
      headers: securityHeaders
    }
  ],
  eslint: {
    ignoreDuringBuilds: false
  },
  typescript: {
    ignoreBuildErrors: false
  },
  env: {
    NEXT_PUBLIC_SUPPORTED_LOCALES: 'en-CH,de-CH,fr-CH'
  },
  output: 'standalone'
};

export default nextConfig;
