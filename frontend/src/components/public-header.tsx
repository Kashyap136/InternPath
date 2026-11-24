'use client';

// Header for public pages (Phase 10 §4 navigation redesign). The wordmark
// stays; public links live in the same three-dot/hamburger menu used across
// the app. Primary account actions (Sign in / Register / Go to dashboard)
// remain directly accessible on the bar.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ButtonLink, Wordmark } from '@/components/ui';
import { NavMenu, type NavGroup } from '@/components/nav-menu';

const publicGroups: NavGroup[] = [
  {
    label: 'Explore',
    links: [
      { href: '/#how-it-works', label: 'How it works' },
      { href: '/#roles', label: 'Roles' },
      { href: '/about', label: 'About' },
    ],
  },
  {
    label: 'Trust & policy',
    links: [
      { href: '/verify', label: 'Verify a certificate' },
      { href: '/policy', label: 'Participation policy' },
    ],
  },
];

// Signed-out visitors on phones see only "Sign in" on the bar (the two
// buttons do not fit beside the wordmark at 360px), so registration must
// stay reachable through the site menu.
const accountGroup: NavGroup = {
  label: 'Account',
  links: [
    { href: '/register', label: 'Create an account' },
    { href: '/login', label: 'Sign in' },
  ],
};

export function PublicHeader() {
  const { user } = useAuth();
  const pathname = usePathname();
  const authPage =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/change-password';

  // On auth pages the menu collapses to just the trust links (anchors on the
  // landing page would be dead ends from /login) plus the account group.
  const trustGroup = publicGroups[1] ?? { label: 'Trust & policy', links: [] };
  const groups: NavGroup[] = authPage
    ? [trustGroup, accountGroup]
    : [...publicGroups, accountGroup];

  // Inline links on desktop (anchors only make sense on the landing page).
  const inlineLinks = authPage
    ? [
        { href: '/verify', label: 'Verify a certificate' },
        { href: '/policy', label: 'Policy' },
      ]
    : [
        { href: '/#how-it-works', label: 'How it works' },
        { href: '/#roles', label: 'Roles' },
        { href: '/verify', label: 'Verify' },
        { href: '/about', label: 'About' },
      ];

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/75 backdrop-blur-xl supports-backdrop-filter:bg-canvas/65">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Wordmark href="/" />
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {inlineLinks.map((link) => {
              const active = !link.href.includes('#') && pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    active ? 'bg-white text-ink shadow-xs ring-1 ring-line' : 'text-secondary hover:bg-white/80 hover:text-ink'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <ButtonLink href="/dashboard" size="sm">
              Go to dashboard
            </ButtonLink>
          ) : (
            <>
              {pathname !== '/login' && (
                <ButtonLink href="/login" variant="ghost" size="sm">
                  Sign in
                </ButtonLink>
              )}
              {pathname !== '/register' && (
                <ButtonLink href="/register" size="sm" className="hidden sm:inline-flex">
                  Get started
                </ButtonLink>
              )}
            </>
          )}
          <div className="relative md:hidden">
            <NavMenu groups={groups} label="Site menu" />
          </div>
        </div>
      </div>
    </header>
  );
}
