import type { Metadata } from 'next';
import { PageHeader, Panel } from '@/components/ui';
import { PublicHeader } from '@/components/public-header';
import { PublicFooter } from '@/components/public-footer';

export const metadata: Metadata = {
  title: 'Participation Policy — InternPath',
  description:
    'What InternPath does not charge for, and which external costs a participant may incur.',
};

// Participation Policy (FR-CAND-108): a public page stating which charges the
// platform does not levy and which external costs a participant may incur.
// The content mirrors the SRS requirement without inventing commercial claims.

const noCharges = [
  'InternPath does not charge any participation, registration or membership fee.',
  'InternPath does not take any commission, placement fee or success fee from students.',
  'InternPath does not require payment for assessments, evaluations, completion certificates or certificate verification.',
  'InternPath does not intermediate or collect any payment between students and organizations.',
];

const possibleExternalCosts = [
  'Internet access and a personal computer capable of running the project work.',
  'Optional third-party services a student chooses themselves (for example a paid GitHub plan or a paid cloud tier) — these are never required by InternPath.',
  'Optional travel or equipment costs for presenting project work (for example a final demo), if the assigned project includes one.',
];

export default function PolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <PageHeader
          title="Participation policy"
          subtitle="What InternPath does not charge, and what a participant may spend externally."
        />

        <Panel className="mb-6">
          <h2 className="font-serif text-lg font-semibold text-ink">
            Charges InternPath does not levy
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-body">
            {noCharges.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Panel>

        <Panel className="mb-6">
          <h2 className="font-serif text-lg font-semibold text-ink">
            External costs a participant may incur
          </h2>
          <p className="mt-2 text-sm text-secondary">
            InternPath does not bill for these; depending on personal setup, a participant may
            pay:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-body">
            {possibleExternalCosts.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Panel>

        <Panel className="mb-6">
          <h2 className="font-serif text-lg font-semibold text-ink">Certificates</h2>
          <p className="mt-2 text-sm leading-relaxed text-body">
            Completion certificates record the completion of the internship described on them
            within the InternPath platform. They are not academic qualifications, professional
            accreditations or employment verifications, and they never imply endorsement by any
            university, government body or company. Every issued certificate carries a unique
            number that anyone can check on the public verification page.
          </p>
        </Panel>

        <Panel>
          <h2 className="font-serif text-lg font-semibold text-ink">Data and privacy</h2>
          <p className="mt-2 text-sm leading-relaxed text-body">
            InternPath stores the name, email address and study details you provide, together
            with the work you submit and the feedback you receive, to operate your account and
            internships. Public certificate verification shows only the certificate
            holder&rsquo;s name, the internship and the issue date — never contact details,
            scores or evaluation notes. In-app reports are visible only to the reporter and
            administrators. To ask for account deletion or a copy of your data, raise a concern
            through the in-app reports feature after signing in, and an administrator will
            handle your request.
          </p>
        </Panel>
      </main>
      <PublicFooter />
    </div>
  );
}
