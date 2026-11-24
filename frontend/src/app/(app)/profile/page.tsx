'use client';

// /profile is one shared route; each role's view lives in its role folder
// (components/student|mentor|admin/).

import { useAuth } from '@/lib/auth-context';
import { StudentProfileView } from '@/components/student/student-profile-view';
import { MentorProfileView } from '@/components/mentor/mentor-profile-view';
import { AdminProfileInfo } from '@/components/admin/admin-profile-info';

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-6">
      {user.role === 'STUDENT' && <StudentProfileView />}
      {user.role === 'MENTOR' && <MentorProfileView />}
      {user.role === 'ADMIN' && <AdminProfileInfo />}
    </div>
  );
}
