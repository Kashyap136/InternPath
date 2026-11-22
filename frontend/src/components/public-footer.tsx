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
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-secondary">
              A project-based internship management platform for students,
              mentors and administrators.
            </p>
          </div>

          {columns.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <p className="text-[13px] font-semibold text-body">{col.heading}</p>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="inline-block rounded-xs py-1 text-sm text-secondary transition-colors hover:text-primary-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">InternPath — Project-based internships</p>
          <p className="text-xs text-muted">
            Certificate verification and the participation policy are available
            without an account.
          </p>
        </div>
      </div>
    </footer>
  );
}
