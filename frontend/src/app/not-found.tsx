import Link from 'next/link';
import { PublicHeader } from '@/components/public-header';
import { PublicFooter } from '@/components/public-footer';
import { ButtonLink } from '@/components/ui';

// 404 page — a clear message and a way back to somewhere useful
// (spec §19.5).
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-primary-700">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink text-balance sm:text-3xl">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary">
          The link may be broken, or the page may have moved. Check the address
          or head back to a known starting point.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <ButtonLink href="/">Go to the home page</ButtonLink>
          <ButtonLink href="/login" variant="secondary">
            Sign in
          </ButtonLink>
        </div>
        <p className="mt-8 text-[13px] text-muted">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-primary-700 underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
