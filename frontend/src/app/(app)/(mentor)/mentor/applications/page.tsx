'use client';

// Mentor: applications to programs in the mentor's expertise domains.
// The backend limits the list and every decision to those domains.

import { ApplicationReviewList } from '@/components/application-review';

export default function MentorApplicationsPage() {
  return (
    <ApplicationReviewList
      apiBase="/api/mentor/applications"
      detailBase="/mentor/applications"
      subtitle="Applications to programs in your expertise domains. Review each candidate and approve or reject."
      emptyDescription="Nothing to review yet. Applications to programs in your domains appear here once students submit them. If you expected some, ask an administrator to check the domains on your mentor profile."
    />
  );
}
