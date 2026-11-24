'use client';

// Role dashboards — each one leads with the work that is happening on the
// platform (internship progress, review queue, intake), with profile and
// account details as secondary context. All figures come from the existing
// API endpoints; nothing is computed or invented client-side beyond simple
// counts of what the API returned.
//
// /dashboard is one shared route; each role's view lives in its role folder
// (components/student|mentor|admin/*-dashboard.tsx).

import { useAuth } from '@/lib/auth-context';
import { StudentView } from '@/components/student/student-dashboard';
import { MentorView } from '@/components/mentor/mentor-dashboard';
import { AdminView } from '@/components/admin/admin-dashboard';

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === 'STUDENT') return <StudentView user={user} />;
  if (user.role === 'MENTOR') return <MentorView user={user} />;
  return <AdminView user={user} />;
}
