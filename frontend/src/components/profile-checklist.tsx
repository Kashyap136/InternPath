'use client';

// Student profile completeness checklist — derived entirely from the real
// profile record fetched from the backend, with the server's `complete` flag
// as the authoritative decision (BR-CAND-001, spec §15.2).

import type { StudentProfile } from '@/types';
import { ProgressBar } from '@/components/ui';
import { CheckCircleIcon } from '@/components/icons';

export const STUDENT_FIELDS: Array<{
  key: keyof StudentProfile;
  label: string;
  test: (p: StudentProfile) => boolean;
}> = [
  {
    key: 'institution',
    label: 'Institution',
    test: (p) => Boolean(p.institution),
  },
  { key: 'degree', label: 'Degree', test: (p) => Boolean(p.degree) },
  {
    key: 'yearOfStudy',
    label: 'Year of study',
    test: (p) => Boolean(p.yearOfStudy),
  },
  {
    key: 'graduationYear',
    label: 'Graduation year',
    test: (p) => Boolean(p.graduationYear),
  },
  {
    key: 'declaredSkills',
    label: 'Declared skills',
    test: (p) => p.declaredSkills.length > 0,
  },
];

function DashedCircle() {
  return (
    <span
      className="inline-block h-4 w-4 shrink-0 rounded-full border border-dashed border-line-input"
      aria-hidden="true"
    />
  );
}

export function StudentChecklist({
  profile,
  complete,
}: {
  profile: StudentProfile;
  complete?: boolean;
}) {
  const serverFields = STUDENT_FIELDS.filter((f) => f.key !== 'declaredSkills');
  const filled = STUDENT_FIELDS.filter((f) => f.test(profile)).length;
  const serverFilled = serverFields.filter((f) => f.test(profile)).length;

  // TEMP: FUNC-001 — the backend's completeness check does not count skills, so
  // `complete === true` can coexist with a missing skills row. Until the backend
  // is fixed, count only the server-required fields and label skills as
  // recommended. Remove this branch once FUNC-001 is fixed.
  const skillsMissing = !STUDENT_FIELDS.find((f) => f.key === 'declaredSkills')!
    .test(profile);
  const useServerCounts = complete === true && skillsMissing;

  const countedFilled = useServerCounts ? serverFilled : filled;
  const countedTotal = useServerCounts
    ? serverFields.length
    : STUDENT_FIELDS.length;
  const percent = Math.round((countedFilled / countedTotal) * 100);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-body">
          {countedFilled} of {countedTotal} required fields
        </span>
        <span className="text-sm tabular-nums text-muted">{percent}%</span>
      </div>
      <ProgressBar
        value={percent}
        label="Profile completeness"
        valueText={`${countedFilled} of ${countedTotal} required fields complete`}
        className="mt-2"
      />
      <ul className="mt-5 space-y-2.5">
        {STUDENT_FIELDS.map((field) => {
          const done = field.test(profile);
          const recommended =
            field.key === 'declaredSkills' && useServerCounts;
          return (
            <li
              key={field.key}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-body">{field.label}</span>
              <span className="flex items-center gap-1.5">
                {done ? (
                  <CheckCircleIcon className="h-4 w-4 text-success-text" />
                ) : (
                  <DashedCircle />
                )}
                <span
                  className={
                    done
                      ? 'text-secondary'
                      : recommended
                        ? 'text-muted'
                        : 'font-medium text-warning-text'
                  }
                >
                  {done
                    ? 'Added'
                    : recommended
                      ? 'Missing — recommended'
                      : 'Missing'}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {useServerCounts && (
        <p className="mt-3 text-[13px] text-muted">Skills are recommended.</p>
      )}
    </div>
  );
}
