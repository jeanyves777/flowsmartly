/**
 * Team Permissions Helper
 * Role hierarchy: OWNER > ADMIN > EDITOR > MEMBER
 */

const ROLE_LEVELS: Record<string, number> = {
  OWNER: 4,
  ADMIN: 3,
  EDITOR: 2,
  MEMBER: 1,
};

function roleLevel(role: string): number {
  return ROLE_LEVELS[role] ?? 0;
}

/** ADMIN+ can invite members */
export function canInviteMembers(role: string): boolean {
  return roleLevel(role) >= ROLE_LEVELS.ADMIN;
}

/** ADMIN+ can create projects */
export function canCreateProjects(role: string): boolean {
  return roleLevel(role) >= ROLE_LEVELS.ADMIN;
}

/** EDITOR+ can create tasks */
export function canCreateTasks(role: string): boolean {
  return roleLevel(role) >= ROLE_LEVELS.EDITOR;
}

/** EDITOR+ or assigned MEMBER can update a task */
export function canUpdateTask(role: string, assigneeId?: string | null, userId?: string): boolean {
  if (roleLevel(role) >= ROLE_LEVELS.EDITOR) return true;
  if (assigneeId && userId && assigneeId === userId) return true;
  return false;
}

/** ADMIN+ can delete tasks */
export function canDeleteTask(role: string): boolean {
  return roleLevel(role) >= ROLE_LEVELS.ADMIN;
}

/** OWNER only can delete the team */
export function canDeleteTeam(role: string): boolean {
  return role === "OWNER";
}

/** ADMIN+ can manage members (change roles, remove) */
export function canManageMembers(role: string): boolean {
  return roleLevel(role) >= ROLE_LEVELS.ADMIN;
}

/** ADMIN+ can manage project settings */
export function canManageProject(role: string): boolean {
  return roleLevel(role) >= ROLE_LEVELS.ADMIN;
}
