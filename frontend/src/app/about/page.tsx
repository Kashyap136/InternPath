import type { Metadata } from 'next';
import { PublicHeader } from '@/components/public-header';
import { PublicFooter } from '@/components/public-footer';

export const metadata: Metadata = {
  title: 'About — InternPath',
  description: 'About the InternPath internship management platform',
};

const sections = [
  {
    title: 'What InternPath does',
    body: 'InternPath is a project-based technical internship platform. Students take a short skills assessment, apply to open programs and, once accepted, complete a real project under a dedicated mentor — submitting work, receiving structured feedback and revising until every milestone is approved. Administrators publish programs, match mentors and students, and issue completion certificates.',
  },
  {
    title: 'How the pathway works',
    points: [
      'Register as a student and complete your study profile',
      'Take a timed assessment in a technical domain to establish your level',
      'Apply to open internship programs in that domain',
      'Once approved, work through milestone tasks and submit evidence for review',
      'Your mentor approves submissions and submits a final evaluation',
      'Administrators verify completion and issue a verifiable certificate',
    ],
  },
  {
    title: 'Trust and transparency',
    body: 'InternPath charges students nothing — no registration, participation or placement fee, and no commission (see the participation policy). Internships on the platform are unpaid learning engagements. Every completion certificate carries a unique number that anyone can verify on the public verification page; a certificate records internship completion and is not an academic qualification or a guarantee of employment.',
  },
  {
    title: 'Your data',
    body: 'The platform stores the name, email and study details you provide, plus the work you submit, to operate your account and internships. Public certificate verification exposes only the certificate holder\u2019s name, the internship and the issue date. Signed-in users can raise concerns privately through the in-app reports feature, which is visible only to the reporter and administrators.',
  },
  {
    title: 'Technology',
    body: 'Next.js (App Router), React, Express, TypeScript, PostgreSQL and Prisma — arranged as an npm-workspace monorepo.',
  },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <PublicHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
          <h1 className="font-serif text-3xl font-bold leading-[1.08] tracking-tight text-ink text-balance sm:text-4xl">
            About InternPath
          </h1>
          <p className="mt-4 text-base leading-7 text-body text-pretty">
            A free, project-based technical internship management platform for
            students, mentors and administrators.
          </p>

          <div className="mt-10 space-y-10">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  {section.title}
                </h2>
                {section.body && (
                  <p className="mt-2 text-base leading-7 text-body">
                    {section.body}
                  </p>
                )}
                {section.points && (
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base leading-7 text-body">
                    {section.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
