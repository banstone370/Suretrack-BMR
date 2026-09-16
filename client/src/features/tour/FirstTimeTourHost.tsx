import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { RoleGuideModal } from './RoleGuideModal';
import { hasCompletedRoleTour } from './tourStorage';

/**
 * Hosts the role guide at AppShell level (viewport-centered portal).
 * Auto-opens once per user on first login; also listens for manual reopen.
 */
export function FirstTimeTourHost() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [firstTime, setFirstTime] = useState(false);

  useEffect(() => {
    if (!user) {
      setOpen(false);
      setFirstTime(false);
      return;
    }
    if (!hasCompletedRoleTour(user.id)) {
      setFirstTime(true);
      setOpen(true);
    }
  }, [user]);

  useEffect(() => {
    const onOpen = () => {
      setFirstTime(false);
      setOpen(true);
    };
    window.addEventListener('suretech:open-role-guide', onOpen);
    return () => window.removeEventListener('suretech:open-role-guide', onOpen);
  }, []);

  if (!user || !open) return null;

  return (
    <RoleGuideModal
      user={user}
      open={open}
      firstTime={firstTime}
      onClose={() => setOpen(false)}
    />
  );
}
