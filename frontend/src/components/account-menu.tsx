'use client';

// AccountMenu — a disclosure (not an ARIA menu) holding the account actions
// that used to sit in the app header. It keeps Change password and Sign out
// reachable on every screen size (spec §12.14, F-10).

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, roleLabels } from '@/lib/auth-context';
import { Avatar, Spinner } from '@/components/ui';
import {
  BellIcon,
  ChevronDownIcon,
  KeyIcon,
  SignOutIcon,
  UserCircleIcon,
} from '@/components/icons';

export function AccountMenu() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on outside click and Escape (returning focus to the trigger).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  const firstName = user.fullName.trim().split(/\s+/)[0] || user.fullName;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div
      className="relative"
      ref={containerRef}
      onBlur={(e) => {
        // Tabbing past the last item closes the disclosure.
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-2.5 rounded-full border border-transparent py-1 pl-1 pr-1.5 text-left transition-colors hover:border-line hover:bg-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 lg:pr-3"
      >
        <Avatar name={user.fullName} />
        <span className="hidden min-w-0 flex-col leading-tight lg:flex">
          <span className="max-w-[9rem] truncate text-[13px] font-semibold text-ink">{firstName}</span>
          <span className="text-[11px] font-medium text-muted">{roleLabels[user.role]}</span>
        </span>
        <ChevronDownIcon
          className={`hidden h-4 w-4 text-muted transition-transform lg:block ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          id="account-menu"
          className="pop-in absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-2xl border border-line bg-white shadow-dialog"
        >
          <div className="relative overflow-hidden bg-evergreen px-4 py-4">
            <div aria-hidden="true" className="bg-dot-grid-light pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative flex items-center gap-3">
              <Avatar name={user.fullName} className="h-11 w-11 text-sm ring-white/20" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user.fullName}</p>
                <p className="truncate text-[12px] text-primary-100">{user.email}</p>
                <p className="mt-1.5 inline-flex rounded-full bg-accent-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink">
                  {roleLabels[user.role]}
                </p>
              </div>
            </div>
          </div>
          <div className="p-2">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <UserCircleIcon className="h-[18px] w-[18px] text-muted" />
              {user.role === 'ADMIN' ? 'My account' : 'My profile'}
            </Link>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <BellIcon className="h-[18px] w-[18px] text-muted" />
              Notifications
            </Link>
            <Link
              href="/change-password"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <KeyIcon className="h-[18px] w-[18px] text-muted" />
              Change password
            </Link>
          </div>
          <div className="border-t border-line p-2">
            <button
              type="button"
              disabled={signingOut}
              aria-busy={signingOut || undefined}
              onClick={() => void handleSignOut()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-danger-text transition-colors hover:bg-danger-bg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-danger-solid disabled:opacity-60"
            >
              {signingOut ? (
                <Spinner className="h-[18px] w-[18px]" ariaHidden />
              ) : (
                <SignOutIcon className="h-[18px] w-[18px]" />
              )}
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
