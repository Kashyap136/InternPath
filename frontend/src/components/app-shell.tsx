'use client';

// Authenticated application shell (2026-11 redesign).
//
//   lg+  : fixed evergreen sidebar with EVERY role destination, grouped and
//          iconised, plus a slim top bar (section breadcrumb, notifications,
//          account menu). Nothing is hidden behind an overflow menu.
//   <lg  : top bar with the wordmark, account menu and the drawer menu
//          (NavMenu) that carries the same grouped destinations.
//
// A skip link is the first focusable element (spec §14). Navigation is purely
// presentational — the backend remains authoritative for access.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, roleLabels } from '@/lib/auth-context';
import { AccountMenu } from '@/components/account-menu';
import { Avatar, Wordmark } from '@/components/ui';
import { NavMenu, type NavGroup } from '@/components/nav-menu';
import {
  BellIcon,
  BriefcaseIcon,
  ChartBarIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  CogIcon,
  DocumentTextIcon,
  FlagIcon,
  FolderIcon,
  HomeIcon,
  PencilSquareIcon,
  QuestionMarkCircleIcon,
  QueueListIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SquaresIcon,
  TrophyIcon,
  UserCircleIcon,
  UsersIcon,
} from '@/components/icons';

type Role = 'STUDENT' | 'MENTOR' | 'ADMIN';

export const navGroups: Record<Role, NavGroup[]> = {
  STUDENT: [
    { links: [{ href: '/dashboard', label: 'Dashboard' }] },
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
    { links: [{ href: '/dashboard', label: 'Dashboard' }] },
    {
      label: 'Mentoring',
      links: [
        { href: '/mentor/applications', label: 'Applications' },
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
    { links: [{ href: '/dashboard', label: 'Overview' }] },
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

type IconComponent = (props: { className?: string }) => React.ReactNode;

// One icon per destination, shared by the sidebar and the mobile drawer.
const NAV_ICONS: Record<string, IconComponent> = {
  '/dashboard': HomeIcon,
  '/programs': SparklesIcon,
  '/domains': SquaresIcon,
  '/applications': DocumentTextIcon,
  '/internships': BriefcaseIcon,
  '/assessment': PencilSquareIcon,
  '/certificates': TrophyIcon,
  '/profile': UserCircleIcon,
  '/notifications': BellIcon,
  '/reports': FlagIcon,
  '/policy': ShieldCheckIcon,
  '/projects': FolderIcon,
  '/mentor/applications': DocumentTextIcon,
  '/mentor/internships': UsersIcon,
  '/mentor/review-queue': QueueListIcon,
  '/mentor/projects': FolderIcon,
  '/admin/users': UsersIcon,
  '/admin/applications': DocumentTextIcon,
  '/admin/questions': QuestionMarkCircleIcon,
  '/admin/programs': SparklesIcon,
  '/admin/domains': SquaresIcon,
  '/admin/projects': FolderIcon,
  '/admin/internships': BriefcaseIcon,
  '/admin/certificates': TrophyIcon,
  '/admin/reports': ChartBarIcon,
  '/admin/settings': CogIcon,
  '/admin/audit': ClipboardListIcon,
};

const WORKSPACE_LABEL: Record<Role, string> = {
  STUDENT: 'Student workspace',
  MENTOR: 'Mentor workspace',
  ADMIN: 'Admin console',
};

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The group + link that own the current path, for the top-bar breadcrumb. */
function locate(groups: NavGroup[], pathname: string) {
  let best: { group?: string; label: string; href: string } | null = null;
  for (const group of groups) {
    for (const link of group.links) {
      if (isActivePath(pathname, link.href) && (!best || link.href.length > best.href.length)) {
        best = { group: group.label, label: link.label, href: link.href };
      }
    }
  }
  return best;
}

function SidebarLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  const Icon = NAV_ICONS[href] ?? ClipboardCheckIcon;
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-300 ${
        active
          ? 'bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]'
          : 'text-primary-100/85 hover:bg-white/[0.06] hover:text-white'
      }`}
    >
      {active && (
        <span aria-hidden="true" className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent-400" />
      )}
      <Icon
        className={`h-[18px] w-[18px] shrink-0 transition-colors ${
          active ? 'text-accent-300' : 'text-primary-300 group-hover:text-primary-100'
        }`}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user) return <>{children}</>;

  const role: Role = user.role;
  const groups = navGroups[role] ?? [];
  const here = locate(groups, pathname);

  return (
    <div className="min-h-screen bg-canvas lg:pl-[272px]">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      {/* ---------------- Sidebar (lg+) ---------------- */}
      <aside className="bg-evergreen fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col lg:flex">
        <div aria-hidden="true" className="bg-dot-grid-light pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_40%)]" />

        <div className="relative px-5 pb-4 pt-5">
          <Wordmark href="/dashboard" tone="light" />
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary-100 ring-1 ring-inset ring-white/10">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-400" />
            {WORKSPACE_LABEL[role]}
          </p>
        </div>

        <nav aria-label="Primary" className="relative flex-1 space-y-5 overflow-y-auto px-3 pb-6 pt-2">
          {groups.map((group, index) => (
            <div key={group.label ?? `group-${index}`}>
              {group.label && (
                <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-primary-300">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.links.map((link) => (
                  <SidebarLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    active={isActivePath(pathname, link.href)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="relative border-t border-white/10 p-3">
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.06] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-300"
          >
            <Avatar name={user.fullName} className="h-9 w-9 ring-white/15" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-white">{user.fullName}</span>
              <span className="block truncate text-[11.5px] text-primary-200">{roleLabels[user.role]}</span>
            </span>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-primary-300" />
          </Link>
        </div>
      </aside>

      {/* ---------------- Top bar ---------------- */}
      <header className="sticky top-0 z-20 border-b border-line/80 bg-canvas/80 backdrop-blur-xl supports-backdrop-filter:bg-canvas/70">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <div className="lg:hidden">
              <Wordmark href="/dashboard" />
            </div>
            {here && (
              <nav aria-label="Breadcrumb" className="hidden min-w-0 lg:block">
                <ol className="flex items-center gap-1.5 text-[13px]">
                  <li className="text-muted">{here.group ?? 'InternPath'}</li>
                  <li aria-hidden="true">
                    <ChevronRightIcon className="h-3.5 w-3.5 text-line-input-hover" />
                  </li>
                  <li className="truncate font-semibold text-ink" aria-current="page">
                    {here.label}
                  </li>
                </ol>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href="/notifications"
              aria-label="Notifications"
              className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 ${
                isActivePath(pathname, '/notifications')
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-secondary hover:bg-white hover:text-ink'
              }`}
            >
              <BellIcon className="h-5 w-5" />
            </Link>
            <AccountMenu />
            <div className="relative lg:hidden">
              <NavMenu groups={groups} label="Site menu" icons={NAV_ICONS} />
            </div>
          </div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl px-4 py-6 focus:outline-hidden sm:px-6 sm:py-10 lg:px-10"
      >
        {children}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <p>InternPath · Project-based internships, mentor-reviewed</p>
          <p>
            <Link
              href="/policy"
              className="rounded-xs underline-offset-2 hover:text-ink hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Participation policy
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
