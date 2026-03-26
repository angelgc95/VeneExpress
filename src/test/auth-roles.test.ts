import { describe, expect, it } from 'vitest';

import { getAppRolePriority, resolveHighestRole } from '@/lib/auth';

describe('auth role helpers', () => {
  it('prefers admin when duplicate role rows exist', () => {
    expect(resolveHighestRole(['readonly', 'staff', 'admin'])).toBe('admin');
  });

  it('falls back to staff when admin is absent', () => {
    expect(resolveHighestRole(['readonly', 'staff'])).toBe('staff');
  });

  it('returns null when no valid roles are present', () => {
    expect(resolveHighestRole([null, undefined])).toBeNull();
  });

  it('ranks roles in ascending privilege order', () => {
    expect(getAppRolePriority('readonly')).toBeLessThan(getAppRolePriority('staff'));
    expect(getAppRolePriority('staff')).toBeLessThan(getAppRolePriority('admin'));
  });
});
