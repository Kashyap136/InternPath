'use client';

// Authenticated application shell (Phase 10 §4 navigation redesign):
// the header carries the official wordmark, the role-specific site menu
// (three-dot dropdown on desktop, hamburger drawer on mobile) and the account
// menu with the primary account actions. A skip link is the first focusable
// element (spec §14).

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AccountMenu } from '@/components/account-menu';
import { Wordmark } from '@/components/ui';
import { NavMenu, type NavGroup } from '@/components/nav-menu';

const navGroups: Record<'STUDENT' | 'MENTOR' | 'ADMIN', NavGroup[]> = {
  STUDENT: [
    {
      links: [{ href: '/dashboard', label: 'Dashboard' }],
    },
    {
      label: 'Discover',
      links: [
        { href: '/programs', label: 'Programs' },
        { href: '/domains', label: 'Domains' },
      ],
    },
    {
      label: 'My pathway',
      links: [
        { href: '/applications', label: 'My applications' },
        { href: '/internships', label: 'My internships' },
        { href: '/assessment', label: 'Assessment' },
        { href: '/certificates', label: 'My certificates' },
      ],
    },
    {
      label: 'Account & support',
      links: [
        { href: '/profile', label: 'My profile' },
        { href: '/notifications', label: 'Notifications' },
        { href: '/reports', label: 'My reports' },
        { href: '/policy', label: 'Participation policy' },
      ],
    },
  ],
  MENTOR: [
    {
      links: [{ href: '/dashboard', label: 'Dashboard' }],
    },
    {
      label: 'Mentoring',
      links: [
        { href: '/mentor/internships', label: 'Assigned internships' },
        { href: '/mentor/review-queue', label: 'Review queue' },
      ],
    },
    {
      label: 'Projects',
      links: [
        { href: '/mentor/projects', label: 'My projects' },
        { href: '/projects', label: 'Project repository' },
        { href: '/domains', label: 'Domains' },
      ],
    },
    {
      label: 'Account & support',
      links: [
        { href: '/profile', label: 'My profile' },
        { href: '/notifications', label: 'Notifications' },
        { href: '/reports', label: 'My reports' },
        { href: '/policy', label: 'Participation policy' },
      ],
    },
  ],
  ADMIN: [
    {
      links: [{ href: '/dashboard', label: 'Dashboard' }],
    },
    {
      label: 'People & intake',
      links: [
        { href: '/admin/users', label: 'Users' },
        { href: '/admin/applications', label: 'Applications' },
        { href: '/admin/questions', label: 'Question bank' },
      ],
    },
    {
      label: 'Catalog',
      links: [
        { href: '/admin/programs', label: 'Programs' },
        { href: '/admin/domains', label: 'Domains' },
        { href: '/admin/projects', label: 'Projects' },
      ],
    },
    {
      label: 'Operations',
      links: [
        { href: '/admin/internships', label: 'Internships' },
        { href: '/admin/certificates', label: 'Certificates' },
        { href: '/admin/reports', label: 'Reports' },
      ],
    },
    {
      label: 'Platform',
      links: [
        { href: '/admin/settings', label: 'Settings' },
        { href: '/admin/audit', label: 'Audit log' },
      ],
    },
  ],
};

// The most-used destinations per role, shown inline on large screens. The
// full grouped menu (NavMenu) stays available for everything else and is the
// only navigation on small screens.
const primaryLinks: Record<'STUDENT' | 'MENTOR' | 'ADMIN', { href: string; label: string }[]> = {
  STUDENT: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/programs', label: 'Programs' },
    { href: '/applications', label: 'Applications' },
    { href: '/internships', label: 'Internships' },
    { href: '/assessment', label: 'Assessment' },
  ],
  MENTOR: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/mentor/review-queue', label: 'Review queue' },
    { href: '/mentor/internships', label: 'Interns' },
    { href: '/mentor/projects', label: 'My projects' },
  ],
  ADMIN: [
    { href: '/dashboard', label: 'Overview' },
    { href: '/admin/applications', label: 'Applications' },
    { href: '/admin/internships', label: 'Internships' },
    { href: '/admin/programs', label: 'Programs' },
    { href: '/admin/projects', label: 'Projects' },
    { href: '/admin/users', label: 'Users' },
  ],
};

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user) return <>{children}</>;

  const groups = navGroups[user.role] ?? [];
  const links = primaryLinks[user.role] ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <header className="sticky top-0 z-20 border-b border-line bg-white/85 backdrop-blur-md supports-backdrop-filter:bg-white/75">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-6">
              <Wordmark href="/dashboard" />
              <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
                {links.map((link) => {
                  const active = isActivePath(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 ${
                        active
                          ? 'text-primary-800 after:absolute after:inset-x-3 after:-bottom-3.25 after:h-0.5 after:rounded-full after:bg-primary-600'
                          : 'text-secondary hover:bg-surface-subtle hover:text-ink'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-1">
              <AccountMenu />
              <div className="relative">
                <NavMenu groups={groups} label="Site menu" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 focus:outline-hidden sm:px-6 sm:py-10 lg:px-8"
      >
        {children}
      </main>

      <footer className="border-t border-line bg-canvas py-5">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>InternPath — Project-based internships</p>
          <p>
            <a
              href="/policy"
              className="underline-offset-2 hover:text-ink hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Participation policy
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
