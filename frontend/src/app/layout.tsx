import type { Metadata } from 'next';
import '../styles/globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { WelcomeGate } from '@/components/welcome-gate';
import { DemoInstanceBanner } from '@/components/demo-instance-banner';

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
    <html lang="en">
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