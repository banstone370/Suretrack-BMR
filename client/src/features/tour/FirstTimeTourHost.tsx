import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { RoleGuideModal } from './RoleGuideModal';
import { hasCompletedRoleTour } from './tourStorage';

/** Opens the role guide automatically the first time a user signs in on this device. */
export function FirstTimeTourHost() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setOpen(false);
      return;
    }
    if (!hasCompletedRoleTour(user.id)) {
      setOpen(true);
    }
  }, [user]);

  if (!user || !open) return null;

  return (
    <RoleGuideModal user={user} open={open} firstTime onClose={() => setOpen(false)} />
  );
}
