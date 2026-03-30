const INACTIVE_PROJECT_STATUSES = new Set([
  "completed",
  "closed",
  "archived",
  "closeout",
]);

export const isOperationalProjectStatus = (status?: string | null) => {
  const normalized = String(status || "ACTIVE").trim().toLowerCase();
  return !INACTIVE_PROJECT_STATUSES.has(normalized);
};

export const filterOperationalProjects = <
  Project extends { status?: string | null },
>(
  projects: Project[],
) => projects.filter((project) => isOperationalProjectStatus(project.status));
