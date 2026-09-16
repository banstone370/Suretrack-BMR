import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import type { RoleGuide } from './roleGuides';

export function startUiTour(guide: RoleGuide, onDone?: () => void): void {
  const steps = guide.tourSteps
    .map((step) => {
      const el = document.querySelector(step.element);
      if (!el) return null;
      return {
        element: step.element,
        popover: {
          title: step.title,
          description: step.description,
          side: 'right' as const,
          align: 'start' as const,
        },
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  if (steps.length === 0) {
    onDone?.();
    return;
  }

  const d = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    overlayColor: 'rgba(15, 23, 42, 0.55)',
    stagePadding: 6,
    stageRadius: 8,
    popoverClass: 'suretech-driver-popover',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Finish',
    steps,
    onDestroyStarted: () => {
      if (!d.isActive()) return;
      d.destroy();
      onDone?.();
    },
  });

  d.drive();
}
