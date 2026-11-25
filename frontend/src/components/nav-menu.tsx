'use client';

// Unified site navigation menu (Phase 10 §4).
//
// One control, two presentations, one design language:
//   - md+ : three-dot button → anchored dropdown panel with grouped links
//   - <md : three-line hamburger → modal drawer (overlay, scroll lock)
//
// Accessibility contract:
//   - button exposes aria-expanded + aria-controls
//   - Escape closes and returns focus to the button
//   - click on the overlay/outside closes
//   - focus moves into the panel on open; Tab is trapped inside the drawer
//   - closes automatically on route change
//   - body scroll is locked only while the modal drawer is open
//
// The mobile drawer is PORTALLED to <body>. The headers that host this menu
// use `backdrop-filter` (frosted glass), and per the CSS spec an element with
// a backdrop-filter becomes the containing block for `position: fixed`
// descendants — rendered in place, the "full-height" drawer was clipped to
// the 64px header bar instead of covering the viewport.
//
// The menu content is role-specific (see app-shell / public-header); this
// component is purely presentational and holds no authorization logic —
// the backend remains authoritative.

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarsThreeIcon, MenuIcon, XIcon } from '@/components/icons';

export interface NavLink {
  href: string;
  label: string;
}

export interface NavGroup {
  /** Optional small group heading inside the panel. */
  label?: string;
  links: NavLink[];
}

const DESKTOP_QUERY = '(min-width: 768px)';

/** Tracks the md breakpoint: dropdown at md+, modal drawer below. */
function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return desktop;
}

function isActive(pathname: string, href: string): boolean {
  // Anchor links ("​/#section") are never "active".
  if (href.includes('#')) return false;
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

const itemBase =
  'group flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500';

type IconComponent = (props: { className?: string }) => React.ReactNode;

function NavLinkItem({
  link,
  active,
  onNavigate,
  Icon,
}: {
  link: NavLink;
  active: boolean;
  onNavigate: () => void;
  Icon?: IconComponent;
}) {
  return (
    <Link
      href={link.href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={`${itemBase} ${
        active
          ? 'bg-primary-50 text-primary-800 ring-1 ring-inset ring-primary-100'
          : 'text-body hover:bg-surface-subtle hover:text-ink'
      }`}
    >
      {Icon && (
        <Icon
          className={`h-[18px] w-[18px] shrink-0 ${
            active ? 'text-primary-700' : 'text-muted group-hover:text-secondary'
          }`}
        />
      )}
      <span className="flex-1">{link.label}</span>
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-accent-500' : 'bg-transparent'}`}
      />
    </Link>
  );
}

function PanelGroups({
  groups,
  pathname,
  onNavigate,
  icons,
}: {
  groups: NavGroup[];
  pathname: string;
  onNavigate: () => void;
  icons?: Record<string, IconComponent>;
}) {
  return (
    <>
      {groups.map((group, index) => (
        <div key={group.label ?? `group-${index}`} className="space-y-0.5">
          {group.label && (
            <p className="px-3 pb-1.5 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">
              {group.label}
            </p>
          )}
          {group.links.map((link) => (
            <NavLinkItem
              key={link.href}
              link={link}
              active={isActive(pathname, link.href)}
              onNavigate={onNavigate}
              Icon={icons?.[link.href]}
            />
          ))}
        </div>
      ))}
    </>
  );
}

export function NavMenu({
  groups,
  label = 'Site menu',
  icons,
}: {
  groups: NavGroup[];
  label?: string;
  /** Optional icon per href (the authenticated shell passes its nav icons). */
  icons?: Record<string, IconComponent>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // React-generated id — identical on server and client (a Math.random id
  // here caused a hydration attribute mismatch).
  const panelId = useId();
  const isDesktop = useIsDesktop();

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  // Close on route change (covers links that navigate without click handlers).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape + focus management + scroll lock + Tab trap while open.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key === 'Tab' && panelRef.current) {
        // Lightweight focus trap for the modal drawer and the dropdown alike.
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])'
        );
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        close();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);

    // Move focus to the first link when the panel opens.
    const raf = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('a[href]')?.focus();
    });

    // Lock background scroll only for the modal (mobile) presentation.
    const media = window.matchMedia(DESKTOP_QUERY);
    if (!media.matches) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('mousedown', onClickOutside);
        cancelAnimationFrame(raf);
        document.body.style.overflow = previousOverflow;
      };
    }

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
      cancelAnimationFrame(raf);
    };
  }, [open, close]);

  return (
    <>
      {/* Three-dot control on desktop, hamburger on mobile — one button */}
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 ${
          open ? 'border-line bg-white text-ink' : 'border-transparent text-ink hover:border-line hover:bg-white'
        }`}
      >
        {open ? (
          <XIcon className="h-5 w-5" />
        ) : (
          <>
            <MenuIcon className="h-5 w-5 md:hidden" />
            <BarsThreeIcon className="hidden h-5 w-5 md:block" />
          </>
        )}
      </button>

      {open && isDesktop && (
        // md+: dropdown anchored under the button (the caller wraps the
        // button in a `relative` container).
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          className="pop-in absolute right-0 top-full z-50 mt-2 flex max-h-[72vh] w-76 flex-col overflow-y-auto rounded-2xl border border-line bg-white p-2 shadow-dialog"
        >
          <nav aria-label={label} className="flex flex-col gap-1 pb-2">
            <PanelGroups groups={groups} pathname={pathname} onNavigate={() => close()} icons={icons} />
          </nav>
        </div>
      )}

      {open &&
        !isDesktop &&
        createPortal(
          <>
            {/* Overlay + full-height drawer, rendered on <body> so no
                ancestor (frosted header) can clip the fixed positioning. */}
            <div
              aria-hidden="true"
              onClick={() => close()}
              className="fade-in fixed inset-0 z-[60] bg-primary-950/40 backdrop-blur-[2px]"
            />
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label={label}
              className="slide-in-right fixed inset-y-0 right-0 z-[70] flex h-dvh w-80 max-w-[86vw] flex-col border-l border-line bg-white shadow-dialog"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-line px-5 pb-3 pt-4">
                <span className="font-serif text-base font-semibold text-ink">Menu</span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => close(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-secondary hover:bg-surface-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
              <nav
                aria-label={label}
                className="flex flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1"
              >
                <PanelGroups groups={groups} pathname={pathname} onNavigate={() => close()} icons={icons} />
              </nav>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
