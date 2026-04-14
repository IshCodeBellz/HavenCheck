'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth';
import { isStaff } from '@/lib/roles';

/** null = checking session; true = manager/admin; false = carer or unauthenticated (redirecting). */
export function useRequireStaff(): boolean | null {
  const router = useRouter();
  const [state, setState] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!authService.isAuthenticated()) {
        if (!cancelled) {
          router.replace('/login');
          setState(false);
        }
        return;
      }

      const u = await authService.getCurrentUser();
      if (cancelled) return;

      if (!u || !isStaff(u)) {
        router.replace('/dashboard');
        setState(false);
        return;
      }

      setState(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return state;
}
