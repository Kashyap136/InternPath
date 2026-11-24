import Link from 'next/link';
import { Wordmark } from '@/components/ui';

// Public footer (Phase 10 §3 cleanup): academic-project and demo-warning
// wording removed in favour of a professional trust-and-policy footer.
// Public-product transformation (2026-11-17): the landing statistics no
// longer carry sample-data labels either — static UI copy is product copy;
// demo-labelling lives only in clearly labelled demo-environment DATA.

const columns = [
  {
    heading: 'Product',
    links: [
      { href: '/#how-it-works', label: 'How it works' },
      { href: '/#roles', label: 'Roles' },
      { href: '/about', label: 'About' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { href: '/login', label: 'Sign in' },
      { href: '/register', label: 'Register as a student' },
    ],
  },
  {
    heading: 'Trust & policy',
    links: [
      { href: '/verify', label: 'Verify a certificate' },
      { href: '/policy', label: 'Participation policy' },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="bg-evergreen relative overflow-hidden text-primary-100">
      <div aria-hidden="true" className="bg-line-grid-light pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Wordmark tone="light" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-primary-100/85">
              Project-based internships for students, guided by mentors and
              run by administrators — free for every student, verifiable by
              anyone.
            </p>
            <Link
              href="/register"
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-[10px] bg-accent-400 px-4 text-sm font-semibold text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.4)] transition-colors hover:bg-accent-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-200 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-900"
            >
              Start your pathway
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          {columns.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-300">{col.heading}</p>
              <ul className="mt-4 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="inline-block rounded-xs py-1 text-sm text-primary-100/90 transition-colors hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-primary-200">© InternPath · Project-based internships</p>
          <p className="text-xs text-primary-200">
            Certificate verification and the participation policy are available
            without an account.
          </p>
        </div>
      </div>
    </footer>
  );
}
