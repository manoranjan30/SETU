const INACTIVE_PROJECT_STATUSES = new Set([
  'completed',
  'closed',
  'archived',
  'closeout',
]);

export function isOperationalProjectStatus(status: string | null | undefined) {
  const normalized = String(status || 'ACTIVE').trim().toLowerCase();
  return !INACTIVE_PROJECT_STATUSES.has(normalized);
}

