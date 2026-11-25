'use client';

// Admin: application review queue (SRS FR-CAND-030/031, BE-14/BE-18).
// Each row opens the full review page with the decision form.

import { ApplicationReviewList } from '@/components/application-review';

export default function AdminApplicationsPage() {
  return (
    <ApplicationReviewList
      apiBase="/api/admin/applications"
      detailBase="/admin/applications"
      subtitle="Review every submitted application across all programs and record an approve or reject decision — the same review mentors do in their domains."
      emptyDescription="Applications appear here once students submit them."
      allowDrafts
    />
  );
}
