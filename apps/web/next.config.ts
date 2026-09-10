import type { NextConfig } from 'next';

const apiInternalUrl = process.env.API_INTERNAL_URL;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    // Browser calls remain relative. In deployed environments the server-side
    // rewrite targets the private API service, never a browser localhost URL.
    return apiInternalUrl ? [{ source: '/api/:path*', destination: `${apiInternalUrl}/api/:path*` }] : [];
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};

export default nextConfig;
