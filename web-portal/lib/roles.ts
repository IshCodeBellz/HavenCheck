import type { User } from '@/lib/auth';

export function isCarer(user: User | null | undefined): boolean {
  return user?.role === 'CARER';
}

/** Carer-style portal (visits-first); guardians use the same nav until a dedicated UX exists. */
export function hasCarerPortalNav(user: User | null | undefined): boolean {
  return isCarerLikeRole(user?.role);
}

export function isCarerLikeRole(
  role: User['role'] | undefined
): boolean {
  return role === 'CARER' || role === 'GUARDIAN';
}

export function isStaff(user: User | null | undefined): boolean {
  return user?.role === 'ADMIN' || user?.role === 'MANAGER';
}

export function isAdmin(user: User | null | undefined): boolean {
  return user?.role === 'ADMIN';
}

export function isGuardian(user: User | null | undefined): boolean {
  return user?.role === 'GUARDIAN';
}
