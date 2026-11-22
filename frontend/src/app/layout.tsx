import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import '../styles/globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { WelcomeGate } from '@/components/welcome-gate';
import { DemoInstanceBanner } from '@/components/demo-instance-banner';

// Self-hosted at build time by next/font: no runtime request to Google, so the
// CSP's font-src 'self' still holds.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'InternPath - Project-Based Technical Internship Management Platform',
  description:
    'InternPath pairs students with mentor-supervised, project-based technical internships with secure, role-based access.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-screen bg-canvas font-sans antialiased">
        <DemoInstanceBanner />
        <AuthProvider>
          <WelcomeGate />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}