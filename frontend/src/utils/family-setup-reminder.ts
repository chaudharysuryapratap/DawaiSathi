export const FAMILY_SETUP_REMINDER_MS = 120_000;

/** Re-check server membership before prompting; late responses cannot reopen a closed flow. */
export function scheduleFamilySetupReminder(check: () => Promise<boolean>, show: () => void) {
  let cancelled = false;
  const timer = setInterval(() => {
    void check().then(needed => { if (!cancelled && needed) show(); }).catch(() => {
      // Keep the app usable offline; retry at the next interval.
    });
  }, FAMILY_SETUP_REMINDER_MS);
  return () => { cancelled = true; clearInterval(timer); };
}
