'use client';

// AccountMenu — a disclosure (not an ARIA menu) holding the account actions
// that used to sit in the app header. It keeps Change password and Sign out
// reachable on every screen size (spec §12.14, F-10).

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, roleLabels } from '@/lib/auth-context';
import { Avatar, Button } from '@/components/ui';
import { ChevronDownIcon } from '@/components/icons';

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
        className="flex h-10 items-center gap-2 rounded-lg px-1.5 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      >
        <Avatar name={user.fullName} />
        <span className="hidden max-w-[8rem] truncate text-sm font-medium text-ink lg:inline">
          {firstName}
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
          className="absolute right-0 z-30 mt-2 w-64 rounded-lg border border-line bg-white shadow-panel"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">
              {user.fullName}
            </p>
            <p className="truncate text-[13px] text-muted">{user.email}</p>
            <p className="mt-0.5 text-[13px] text-secondary">
              {roleLabels[user.role]}
            </p>
          </div>
          <div className="p-1.5">
            {user.role === 'ADMIN' && (
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-sm text-body transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                My account
              </Link>
            )}
            <Link
              href="/change-password"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-body transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Change password
            </Link>
            <div className="px-1.5 py-1.5">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                loading={signingOut}
                onClick={() => void handleSignOut()}
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
