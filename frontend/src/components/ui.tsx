'use client';

// Shared UI primitives — one deliberate design language for spacing, focus
// rings, surface treatment and interaction states across the whole app.
//
// Implements the component design system in
// docs/08-ui-ux/InternPath_UI_UX_Design_Specification.md §12.

import React, { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircleIcon, XCircleIcon } from '@/components/icons';

const focusRing =
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'wine' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

// Solid buttons carry a 1px top highlight and a tight drop shadow so they
// read as pressable objects rather than flat rectangles.
const buttonBase =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold tracking-[-0.005em] transition-[color,background-color,border-color,box-shadow,transform] duration-150 motion-safe:active:translate-y-px disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

const solidShadow = 'shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(6_35_25/0.22)]';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: `bg-primary-700 text-white hover:bg-primary-800 active:bg-primary-900 ${solidShadow}`,
  // Marigold CTA with ink text (8.5:1) — the warm counterpoint to evergreen.
  accent:
    'bg-accent-400 text-ink hover:bg-accent-300 active:bg-accent-400 shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_1px_2px_rgb(115_60_17/0.25)]',
  wine: `bg-wine-600 text-white hover:bg-wine-700 active:bg-wine-800 ${solidShadow}`,
  danger: `bg-danger-solid text-white hover:bg-danger-solid-hover active:bg-danger-solid-hover ${solidShadow}`,
  secondary:
    'border border-line-strong bg-white text-ink shadow-xs hover:border-line-input-hover hover:bg-surface-subtle',
  ghost: 'text-secondary hover:bg-ink/[0.045] hover:text-ink',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'h-10 gap-2 rounded-[10px] px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-[15px]',
};

// React 19 + Next 15 typing note: `React.ComponentProps<typeof Link>` collapses
// to an index-signature type under @types/react 19 (destructured props became
// `any`), so ButtonLink declares its props explicitly. All call sites use
// href/className/variant/size/children; standard anchor props are included for
// forward compatibility.
type ButtonLinkProps = {
  href: string;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
  target?: string;
  rel?: string;
  'aria-label'?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: React.ReactNode;
};

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
  }
>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    className = '',
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-busy={loading || undefined}
      className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" ariaHidden />}
      {children}
    </button>
  );
});

export function Spinner({
  className = 'w-5 h-5',
  label,
  ariaHidden = false,
}: {
  className?: string;
  label?: string;
  ariaHidden?: boolean;
}) {
  const svg = (
    <svg
      className={`animate-spin text-current ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden={ariaHidden ? 'true' : 'false'}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  if (!label) return svg;

  return (
    <span role="status" className="inline-flex items-center gap-2">
      <span className="sr-only">{label}</span>
      {svg}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

function initialsOf(name: string): string {
  // Ignore bracketed suffixes and words without letters, e.g. "Aarav Mehta
  // (Demo)" → "AM" rather than "A(".
  const parts = name
    .replace(/\([^)]*\)/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((p) => /\p{L}/u.test(p));
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  const first = parts[0]!.charAt(0);
  const last = parts[parts.length - 1]!.charAt(0);
  return `${first}${last}`.toUpperCase();
}

export function Avatar({
  name,
  className = '',
}: {
  name: string;
  className?: string;
}) {
  // Caller-supplied size / type / ring classes replace the defaults instead of
  // competing with them (two `h-*` utilities resolve by stylesheet order, not
  // by class order, so "overriding" via className is unreliable).
  const has = (re: RegExp) => re.test(className);
  const size = has(/(^|\s)h-/) ? '' : 'h-8 w-8';
  const text = has(/(^|\s)text-(xs|sm|base|lg|\[)/) ? '' : 'text-xs';
  const ring = has(/(^|\s)ring-(white|primary|ink|accent)/) ? 'ring-2' : 'ring-2 ring-white';
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary-600 to-primary-900 font-semibold tracking-wide text-white ${size} ${text} ${ring} ${className}`}
    >
      {initialsOf(name)}
    </span>
  );
}

// InternPath wordmark — the owner-supplied leaf/arrows logo mark plus the
// product name. Shared by the public header, the authenticated shell, the
// landing page, the change-password screen and footers so the identity stays
// identical everywhere. Per the Phase 9 design decision the small header
// placement shows the mark and name only (no tagline); the full logo with
// tagline (logo-full*) is reserved for large placements.
export function Wordmark({
  href = '/',
  className = '',
  tone = 'dark',
  compact = false,
}: {
  href?: string;
  className?: string;
  /** `light` renders the name in white for dark (evergreen) surfaces. */
  tone?: 'dark' | 'light';
  /** Below 360px show only the mark (the name stays for screen readers). */
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${className}`}
    >
      {/* Owner-supplied brand mark (frontend/public/brand/, byte-preserved
          derivative of logo-original.png). Rendered at 32px from the 64px
          asset for crisp rendering on high-DPI displays. Decorative: the
          adjacent product name carries the accessible identity. */}
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white shadow-xs ring-1 ring-ink/[0.06] transition-transform duration-200 group-hover:-rotate-3">
        <Image
          src="/brand/logo-mark-64.png"
          alt=""
          aria-hidden="true"
          width={28}
          height={28}
          className="h-7 w-7"
        />
      </span>
      <span
        className={`font-serif text-[19px] font-bold tracking-[-0.03em] ${
          tone === 'light' ? 'text-white' : 'text-ink'
        } ${compact ? 'max-[359px]:sr-only' : ''}`}
      >
        InternPath
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Forms                                                               */
/* ------------------------------------------------------------------ */

const inputBase =
  'block w-full rounded-[10px] border bg-white text-sm text-ink shadow-xs placeholder:text-muted disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-muted read-only:bg-surface-subtle transition-[border-color,box-shadow,background-color] duration-150';

// Inputs use a soft 4px halo on focus (Figma-style) instead of an offset ring.
const inputFocus = 'focus-visible:outline-hidden focus-visible:ring-4';

const inputState = (invalid?: boolean) =>
  invalid
    ? 'border-danger-solid focus-visible:border-danger-solid focus-visible:ring-danger-solid/15'
    : 'border-line-input hover:border-line-input-hover focus-visible:border-primary-600 focus-visible:ring-primary-500/15';

/**
 * Field wires its label, hint and error to the child control:
 * it injects `id`, `aria-describedby` and `aria-invalid` so assistive
 * technology always associates the message with the input (spec §12.3).
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional = false,
  counter,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  counter?: React.ReactNode;
  children: React.ReactNode;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: (children.props as { id?: string }).id ?? htmlFor,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children;

  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-ink">
        {label}
        {optional && <span className="ml-1.5 font-normal text-muted">Optional</span>}
      </label>
      {child}
      {(hint || counter) && (
        <div className="flex items-start justify-between gap-3">
          {hint ? (
            <p className="text-[13px] text-muted" id={hintId}>
              {hint}
            </p>
          ) : (
            <span />
          )}
          {counter && <span className="shrink-0 text-[13px] text-muted">{counter}</span>}
        </div>
      )}
      {error && (
        <p className="flex items-start gap-1.5 text-[13px] text-danger-text" id={errorId}>
          <XCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export function TextInput({
  invalid,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={`${inputBase} ${inputState(invalid)} h-11 px-3.5 ${inputFocus} ${className}`}
      {...props}
    />
  );
}

export function TextArea({
  invalid,
  className = '',
  value,
  maxLength,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  const length = typeof value === 'string' ? value.length : 0;
  const nearLimit = maxLength ? length / maxLength > 0.9 : false;

  return (
    <div>
      <textarea
        className={`${inputBase} ${inputState(invalid)} px-3.5 py-3 leading-relaxed ${inputFocus} ${className}`}
        value={value}
        maxLength={maxLength}
        {...props}
      />
      {maxLength && (
        <p
          className={`mt-1 text-right text-[13px] ${nearLimit ? 'text-warning-text' : 'text-muted'}`}
        >
          {length} / {maxLength}
        </p>
      )}
    </div>
  );
}

export function Select({
  invalid,
  size = 'md',
  className = '',
  children,
  ...props
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  invalid?: boolean;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="relative">
      <select
        className={`${inputBase} ${inputState(invalid)} cursor-pointer appearance-none pr-9 ${inputFocus} ${
          size === 'sm' ? 'h-8 rounded-lg pl-3 text-[13px]' : 'h-11 pl-3.5'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    </div>
  );
}

/**
 * Checkbox control. When `label` is provided the input is wrapped in a real
 * `<label>` (click target covers the text; screen readers announce it).
 * Without `label` it renders the bare input — callers that render their own
 * `<label htmlFor>` (e.g. the register form) keep working unchanged.
 */
export function Checkbox({
  label,
  className = '',
  id,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'children'> & {
  label?: React.ReactNode;
}) {
  const input = (
    <input
      type="checkbox"
      id={id}
      className={`h-4 w-4 shrink-0 cursor-pointer rounded border-line-input text-primary-700 accent-primary-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${className}`}
      {...props}
    />
  );
  if (label === undefined) return input;
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-body">
      <span className="flex h-[1.625em] shrink-0 items-center">{input}</span>
      <span>{label}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Password input with visibility toggle                              */
/* ------------------------------------------------------------------ */

export function PasswordInput({
  invalid,
  className = '',
  value,
  onChange,
  onBlur,
  required,
  disabled,
  placeholder,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  const togglePassword = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <div className="relative">
      <input
        type={showPassword ? 'text' : 'password'}
        className={`${inputBase} ${inputState(invalid)} h-11 px-3.5 pr-12 ${inputFocus} ${className}`}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        {...props}
      />
      <button
        type="button"
        onClick={togglePassword}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePassword();
          }
        }}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        className="absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors duration-200 ease-in-out hover:bg-ink/[0.045] hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 motion-safe:active:scale-90"
      >
        {showPassword ? (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
          </svg>
        ) : (
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.483 7.74 7.024 5 12 5c4.978 0 8.518 2.74 9.542 7 1.024 4.26-2.556 7-7.542 7-4.474 0-7.994-2.74-8.958-7zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

type AlertVariant = 'error' | 'success' | 'info' | 'warning';

const alertStyles: Record<AlertVariant, string> = {
  error: 'border-danger-border bg-danger-bg text-danger-text',
  success: 'border-success-border bg-success-bg text-success-text',
  info: 'border-info-border bg-info-bg text-info-text',
  warning: 'border-warning-border bg-warning-bg text-warning-text',
};

const alertIcons: Record<AlertVariant, (props: { className?: string }) => React.ReactNode> = {
  error: XCircleIcon,
  success: CheckCircleIcon,
  info: InformationIcon,
  warning: ExclamationIcon,
};

function InformationIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
      />
    </svg>
  );
}

function ExclamationIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  );
}

export function Alert({
  variant = 'info',
  title,
  children,
  onDismiss,
}: {
  variant?: AlertVariant;
  title?: string;
  children?: React.ReactNode;
  onDismiss?: () => void;
}) {
  const Icon = alertIcons[variant];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`fade-in flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm leading-relaxed ${alertStyles[variant]}`}
    >
      <span className="mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current/10">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-current">{title}</p>}
        {children && <div className="mt-0.5 text-current/90">{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-current/60 transition-colors hover:text-current focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-current"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

const badgeStyles: Record<StatusTone, string> = {
  success: 'bg-success-bg text-success-text border-success-border',
  warning: 'bg-warning-bg text-warning-text border-warning-border',
  danger: 'bg-danger-bg text-danger-text border-danger-border',
  neutral: 'bg-neutral-bg text-neutral-text border-neutral-border',
};

const badgeDots: Record<StatusTone, string> = {
  success: 'bg-success-text',
  warning: 'bg-warning-text',
  danger: 'bg-danger-text',
  neutral: 'bg-muted',
};

/**
 * StatusBadge — a scannable state for a record. Only for status.
 * Use `tone="neutral"` for non-semantic labels such as a role.
 */
export function StatusBadge({
  tone = 'neutral',
  dot = true,
  children,
  className = '',
}: {
  tone?: StatusTone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-xs font-semibold leading-none ${badgeStyles[tone]} ${className}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${badgeDots[tone]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

// Backwards-compatible name for the status badge.
export const Badge = StatusBadge;

/* ------------------------------------------------------------------ */
/* States                                                              */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  bordered = true,
  className = '',
}: {
  icon?: (props: { className?: string }) => React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  bordered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col ${
        bordered
          ? 'items-center rounded-2xl border border-dashed border-line-strong bg-white/70 px-6 py-14 text-center'
          : 'items-start py-2'
      } ${className}`}
    >
      {Icon && (
        <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-b from-primary-50 to-primary-100 text-primary-700 shadow-xs ring-1 ring-primary-200/70">
          <Icon className="h-5 w-5" />
          <span aria-hidden="true" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent-400 ring-2 ring-white" />
        </span>
      )}
      <p className={`font-serif text-base font-semibold text-ink ${Icon ? 'mt-4' : ''}`}>
        {title}
      </p>
      {description && (
        <p className="mt-1 max-w-md text-[13px] leading-relaxed text-secondary">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({
  label = 'Loading…',
  variant = 'region',
  className = '',
}: {
  label?: string;
  variant?: 'region' | 'page';
  className?: string;
}) {
  if (variant === 'page') {
    return (
      <div
        role="status"
        className={`flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas ${className}`}
      >
        <LoaderOrb />
        <p className="text-sm font-medium text-secondary">{label}</p>
      </div>
    );
  }

  // Region loader: a skeleton of the content shape plus the live label, so
  // the layout does not jump when data arrives.
  return (
    <div role="status" className={`min-h-[160px] w-full py-2 ${className}`}>
      <div aria-hidden="true" className="space-y-3">
        <div className="skeleton h-4 w-2/5 rounded-md" />
        <div className="skeleton h-3 w-4/5 rounded-md" />
        <div className="skeleton h-3 w-3/5 rounded-md" />
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="skeleton h-14 rounded-xl" />
          <div className="skeleton h-14 rounded-xl" />
          <div className="skeleton h-14 rounded-xl" />
        </div>
      </div>
      <p className="mt-4 flex items-center gap-2 text-[13px] font-medium text-muted">
        <Spinner className="h-3.5 w-3.5 text-primary-600" ariaHidden />
        {label}
      </p>
    </div>
  );
}

/** Branded loading mark: evergreen orb with a marigold orbit. */
function LoaderOrb() {
  return (
    <span aria-hidden="true" className="relative inline-flex h-10 w-10 items-center justify-center">
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-primary-100 border-t-primary-600" />
      <span className="h-2.5 w-2.5 rounded-full bg-accent-400" />
    </span>
  );
}

/** Shimmering placeholder block for custom skeleton layouts. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-md ${className}`} />;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div>
      <Alert variant="error" title={title}>
        {message}
      </Alert>
      {onRetry && (
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

export function ProgressBar({
  value,
  label,
  valueText,
  className = '',
}: {
  value: number;
  label?: string;
  valueText?: string;
  className?: string;
}) {
  const clamp = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamp)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={valueText}
      className={`h-2 w-full overflow-hidden rounded-full bg-surface-sunken ring-1 ring-inset ring-ink/5 ${className}`}
    >
      <div
        className={`h-full rounded-full bg-linear-to-r transition-[width] duration-500 ease-out ${
          clamp >= 100 ? 'from-primary-500 to-success-text' : 'from-primary-400 to-primary-700'
        }`}
        style={{ width: `${clamp}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = '',
  padded = true,
}: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={`rounded-2xl border border-line bg-white shadow-card ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {title && (
              <h2 id={titleId} className="font-serif text-base font-semibold tracking-[-0.02em] text-ink">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-[13px] text-secondary [overflow-wrap:anywhere]">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

// Backwards-compatible name for Panel.
export const Card = Panel;

/**
 * StatCard — one headline number with a label, an optional hint and an
 * optional link. Used for dashboard summaries.
 */
export function StatCard({
  label,
  value,
  hint,
  href,
  icon: Icon,
  tone = 'primary',
  className = '',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  icon?: (props: { className?: string }) => React.ReactNode;
  tone?: 'primary' | 'accent' | 'wine' | 'purple';
  className?: string;
}) {
  const toneChip: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-700 ring-primary-100',
    accent: 'bg-accent-50 text-accent-700 ring-accent-100',
    wine: 'bg-wine-50 text-wine-600 ring-wine-100',
    purple: 'bg-purple-50 text-purple-600 ring-purple-100',
  };
  // A soft tinted glow in the top-right corner gives each card its own tone.
  const toneGlow: Record<string, string> = {
    primary: 'from-primary-100/70',
    accent: 'from-accent-100/80',
    wine: 'from-wine-100/70',
    purple: 'from-purple-100/70',
  };
  const body = (
    <>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-radial ${toneGlow[tone]} to-transparent to-70%`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-secondary">{label}</p>
        {Icon && (
          <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${toneChip[tone]}`}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>
      <p className="relative mt-2 font-serif text-[2rem] font-bold leading-none tracking-[-0.03em] tabular-nums text-ink">
        {value}
      </p>
      {hint && (
        <p className="relative mt-2 flex items-center gap-1 text-[13px] text-muted">
          {hint}
          {href && (
            <span
              aria-hidden="true"
              className="ml-auto translate-x-[-4px] text-primary-700 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100"
            >
              →
            </span>
          )}
        </p>
      )}
    </>
  );
  const base = `group relative block overflow-hidden rounded-2xl border border-line bg-white p-5 shadow-card ${className}`;
  if (href) {
    return (
      <Link
        href={href}
        className={`${base} transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-panel ${focusRing}`}
      >
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}

/** Small uppercase label above a page title. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50/80 py-1 pl-2 pr-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary-700">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-500" />
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Page headers                                                        */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="rise-in flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="font-serif text-[1.75rem] font-bold leading-[1.08] tracking-[-0.035em] text-ink text-balance sm:text-[2.25rem]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-secondary text-pretty">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table helpers                                                       */
/* ------------------------------------------------------------------ */

export function Table({
  caption,
  children,
  className = '',
}: {
  caption?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <table className={`w-full text-left text-sm ${className}`}>
      {caption && <caption className="sr-only">{caption}</caption>}
      {children}
    </table>
  );
}

export function Th({
  children,
  className = '',
  srOnly = false,
}: {
  children?: React.ReactNode;
  className?: string;
  srOnly?: boolean;
}) {
  return (
    <th
      scope="col"
      className={`border-b border-line bg-surface-subtle px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted first:pl-5 last:pr-5 ${className}`}
    >
      {srOnly ? <span className="sr-only">{children}</span> : children}
    </th>
  );
}

export function Td({
  children,
  className = '',
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3.5 align-middle first:pl-5 last:pr-5 ${className}`}>
      {children}
    </td>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  noun = 'items',
  onPrevious,
  onNext,
  disabled = false,
}: {
  page: number;
  totalPages: number;
  total?: number;
  noun?: string;
  onPrevious: () => void;
  onNext: () => void;
  disabled?: boolean;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-subtle/60 px-5 py-3.5">
      <p className="text-[13px] font-medium text-muted tabular-nums">
        Page {page} of {totalPages}
        {typeof total === 'number' ? ` · ${total} ${noun}` : ''}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={onPrevious}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || page >= totalPages}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog                                                              */
/* ------------------------------------------------------------------ */

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  busy = false,
  error,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  busy?: boolean;
  error?: string | null;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  // Latest-callback refs: callers pass inline arrow functions and JSX
  // children (controlled form fields) that change identity on every
  // keystroke. Keeping them out of the effect deps stops the focus-trap
  // setup (focus restore, body-scroll lock, listener churn) from re-running
  // on every character typed inside the dialog.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const childrenRef = useRef(children);
  childrenRef.current = children;

  useEffect(() => {
    if (!open) return;

    // Remember what had focus, then move focus into the dialog. For an
    // action that has children (a form) focus the first control; for a
    // destructive confirm, focus Cancel so Enter cannot confirm by accident.
    restoreRef.current = document.activeElement as HTMLElement | null;
    const raf = window.requestAnimationFrame(() => {
      const firstField = dialogRef.current?.querySelector<HTMLElement>(
        'input, textarea, select'
      );
      if (childrenRef.current && firstField) firstField.focus();
      else if (confirmVariant === 'danger') cancelRef.current?.focus();
      else confirmRef.current?.focus();
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancelRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, confirmVariant]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby={description ? 'confirm-description' : undefined}
    >
      <div
        className="fade-in absolute inset-0 bg-primary-950/45 backdrop-blur-[3px]"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        className="rise-in relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-white p-6 shadow-dialog sm:p-7"
      >
        <span
          aria-hidden="true"
          className={`mb-4 block h-1 w-10 rounded-full ${
            confirmVariant === 'danger' ? 'bg-danger-solid' : 'bg-accent-400'
          }`}
        />
        <h2
          id="confirm-title"
          className="font-serif text-lg font-semibold tracking-[-0.02em] text-ink"
        >
          {title}
        </h2>
        {description && (
          <div
            id="confirm-description"
            className="mt-1.5 text-sm leading-relaxed text-secondary"
          >
            {description}
          </div>
        )}
        {children && <div className="mt-4">{children}</div>}
        {error && (
          <div className="mt-4">
            <Alert variant="error" title="Action failed">
              {error}
            </Alert>
          </div>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onCancel}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={confirmVariant}
            loading={busy}
            disabled={confirmDisabled}
            onClick={onConfirm}
            className="w-full sm:w-auto"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
