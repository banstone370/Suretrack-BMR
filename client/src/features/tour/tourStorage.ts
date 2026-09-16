const PREFIX = 'suretech_tour_v1_';

export function hasCompletedRoleTour(userId: string): boolean {
  try {
    return localStorage.getItem(`${PREFIX}${userId}`) === 'done';
  } catch {
    return false;
  }
}

export function markRoleTourComplete(userId: string): void {
  try {
    localStorage.setItem(`${PREFIX}${userId}`, 'done');
  } catch {
    /* ignore quota / private mode */
  }
}

export function resetRoleTour(userId: string): void {
  try {
    localStorage.removeItem(`${PREFIX}${userId}`);
  } catch {
    /* ignore */
  }
}
