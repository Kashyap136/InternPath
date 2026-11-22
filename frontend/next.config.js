/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // P1-04 support (critical-defect remediation 2026-11-17): production builds
  // can be written to a separate directory via INTERNPATH_DIST_DIR so a
  // `next build` never touches the running dev server's `.next`. Unset (the
  // normal case, including dev and deploys) it is exactly the Next default.
  distDir: process.env.INTERNPATH_DIST_DIR || '.next',
  async headers() {
    // P2-02 fix (comprehensive audit 2026-11-15): Next.js-served pages
    // previously carried no security headers — Helmet's protections applied
    // only to /api/backend/* responses, so every HTML page (including admin
    // pages capable of destructive actions) was frameable and lacked
    // defence-in-depth. A strict CSP needs nonces for Next's inline scripts;
    // a Report-Only CSP is the documented first step (see the remediation
    // report) and HSTS belongs to the HTTPS reverse proxy (condition C-1).
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value:
              'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
          },
          // Public-release hardening (2026-11-17): Report-Only CSP as the
          // documented first step toward a strict policy (Next inline scripts
          // need nonces for enforcement). Report-Only never blocks anything —
          // it only surfaces violations in the browser console for tuning.
          {
            key: 'Content-Security-Policy-Report-Only',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        // Trailing slashes stripped so a pasted "https://host/" cannot yield "//" paths.
        destination: `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '')}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
