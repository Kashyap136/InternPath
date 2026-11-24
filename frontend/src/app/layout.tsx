import type { Metadata } from 'next';
import { Bricolage_Grotesque, Figtree, Instrument_Serif } from 'next/font/google';
import '../styles/globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { WelcomeGate } from '@/components/welcome-gate';
import { DemoInstanceBanner } from '@/components/demo-instance-banner';

// Self-hosted at build time by next/font: no runtime request to Google, so the
// CSP's font-src 'self' still holds.
// Type system (2026-11 redesign):
//   Figtree              — UI + body copy (warm, highly legible humanist sans)
//   Bricolage Grotesque  — display + headings (characterful optical-size grotesque)
//   Instrument Serif     — italic editorial accents only (`.font-accent`)
const figtree = Figtree({ subsets: ['latin'], display: 'swap', variable: '--font-body' });
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-accent',
  weight: '400',
  style: ['normal', 'italic'],
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
    <html
      lang="en"
      className={`${figtree.variable} ${bricolage.variable} ${instrumentSerif.variable}`}
    >
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