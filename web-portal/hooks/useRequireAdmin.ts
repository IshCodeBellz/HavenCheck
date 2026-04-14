'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth';
import { isAdmin } from '@/lib/roles';

/** null = checking; true = admin; false = redirecting. */
export function useRequireAdmin(): boolean | null {
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

      if (!u || !isAdmin(u)) {
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
