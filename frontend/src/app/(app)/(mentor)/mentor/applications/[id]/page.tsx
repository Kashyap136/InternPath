'use client';

import { use } from 'react';
import { ApplicationReviewDetailView } from '@/components/application-review';

export default function MentorApplicationReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <ApplicationReviewDetailView
      id={id}
      apiBase="/api/mentor/applications"
      listHref="/mentor/applications"
    />
  );
}
