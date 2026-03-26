import type { AppRole } from '@/types/shipping';

const APP_ROLE_PRIORITY: Record<AppRole, number> = {
  readonly: 0,
  staff: 1,
  admin: 2,
};

export const getAppRolePriority = (role: AppRole) => APP_ROLE_PRIORITY[role];

export const resolveHighestRole = (roles: Array<AppRole | null | undefined>): AppRole | null => {
  const validRoles = roles.filter((role): role is AppRole =>
    role === 'admin' || role === 'staff' || role === 'readonly',
  );

  if (validRoles.length === 0) {
    return null;
  }

  return validRoles.reduce((highestRole, currentRole) =>
    getAppRolePriority(currentRole) > getAppRolePriority(highestRole) ? currentRole : highestRole,
  );
};
