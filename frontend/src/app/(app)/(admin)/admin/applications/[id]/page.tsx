'use client';

import { use } from 'react';
import { ApplicationReviewDetailView } from '@/components/application-review';

export default function AdminApplicationReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <ApplicationReviewDetailView
      id={id}
      apiBase="/api/admin/applications"
      listHref="/admin/applications"
    />
  );
}
